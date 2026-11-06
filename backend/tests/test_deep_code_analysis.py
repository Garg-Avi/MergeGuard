import json
import base64
import pytest
from unittest.mock import patch, MagicMock

from app.core.ai_config import AISettings
from app.core.secret_redactor import redact_secrets, redact_payload_secrets
from app.schemas.ai import (
    ContributorEvidenceInvestigationRequest,
    ContributorEvidenceInvestigationResponse,
    CodeIssue,
    FileAnalysis,
    ExecutionMode
)
from app.services.github_service import GitHubService
from app.services.ai_provider import (
    GroqProvider,
    DeterministicFallbackProvider,
    _extract_diff_hunks_and_issues,
    _safe_code_issues,
    _safe_file_analyses
)
from app.services.ai_service import MergeGuardAIService


def test_secret_redactor_all_patterns():
    """1. Test secret redaction for API keys, tokens, and private keys."""
    sensitive_diff = (
        "--- a/config.py\n"
        "+++ b/config.py\n"
        "+OPENAI_KEY = 'sk-proj-abc12345678901234567890'\n"
        "+GROQ_KEY = 'gsk_abcdef1234567890abcdef12'\n"
        "+GH_TOKEN = 'ghp_123456789012345678901234567890123456'\n"
        "+AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'\n"
        "+SLACK_TOKEN = 'xoxb-1234567890-abcdefghij'\n"
        "+PRIVATE_KEY = '''-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'''\n"
    )

    clean_text, was_redacted = redact_secrets(sensitive_diff)
    assert was_redacted is True
    assert "sk-proj-" not in clean_text
    assert "gsk_" not in clean_text
    assert "ghp_" not in clean_text
    assert "AKIA" not in clean_text
    assert "-----BEGIN RSA PRIVATE KEY-----" not in clean_text
    assert "[REDACTED_OPENAI_KEY]" in clean_text
    assert "[REDACTED_GROQ_KEY]" in clean_text
    assert "[REDACTED_GITHUB_TOKEN]" in clean_text
    assert "[REDACTED_AWS_KEY_ID]" in clean_text
    assert "[REDACTED_PRIVATE_KEY]" in clean_text


def test_nested_payload_secret_redaction():
    """2. Test recursive redaction of nested payload dictionaries and lists."""
    payload = {
        "repo": "owner/repo",
        "nested": {
            "token": "ghp_123456789012345678901234567890123456",
            "items": ["safe item", "gsk_live_key_987654321012345678"]
        }
    }
    clean_payload, redacted = redact_payload_secrets(payload)
    assert redacted is True
    assert clean_payload["nested"]["token"] == "[REDACTED_GITHUB_TOKEN]"
    assert clean_payload["nested"]["items"][1] == "[REDACTED_GROQ_KEY]"


def test_large_diff_and_lockfile_sampling():
    """3. Test intelligent diff sampling drops binary/noisy lockfiles and keeps logic & tests."""
    large_diff = (
        "diff --git a/package-lock.json b/package-lock.json\n"
        + "\n".join([f"+  'line_{i}': 'val'," for i in range(500)]) + "\n"
        "diff --git a/src/auth.py b/src/auth.py\n"
        "@@ -1,5 +1,10 @@\n"
        "+def authenticate_user(token):\n"
        "+    return verify_jwt(token)\n"
        "diff --git a/tests/test_auth.py b/tests/test_auth.py\n"
        "@@ -1,3 +1,8 @@\n"
        "+def test_auth_success():\n"
        "+    assert authenticate_user('valid')\n"
    )

    sampled, is_truncated = GitHubService._sample_large_diff(large_diff, max_lines=100)
    # The lockfile content should be omitted, while test and source diffs are preserved
    assert "Binary / Generated Lockfile Omitted" in sampled
    assert "def test_auth_success():" in sampled
    assert "def authenticate_user(token):" in sampled


def test_fetch_pr_complete_diff_success():
    """4. Test fetch_pr_complete_diff retrieves unified diff via Accept header."""
    mock_diff = (
        "diff --git a/src/calc.py b/src/calc.py\n"
        "@@ -1,2 +1,3 @@\n"
        "+def add(a, b): return a + b\n"
    )
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_diff
        mock_get.return_value = mock_resp

        res = GitHubService.fetch_pr_complete_diff("acme", "calc", 101)
        assert res["status"] == "SUCCESS"
        assert "def add(a, b)" in res["diff"]
        assert res["total_lines"] == len(mock_diff.splitlines())


def test_rate_limit_and_missing_permissions_handling():
    """5. Test graceful degradation on GitHub rate limits (403/429) or missing repos (404)."""
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.text = '{"message": "API rate limit exceeded"}'
        mock_get.return_value = mock_resp

        res = GitHubService.fetch_pr_complete_diff("acme", "private_repo", 1)
        assert res["status"] == "RATE_LIMITED"
        assert res["diff"] == ""

        mock_resp.status_code = 404
        res404 = GitHubService.fetch_pr_complete_diff("acme", "missing_repo", 1)
        assert res404["status"] == "NOT_FOUND"


def test_fetch_file_content_surrounding_context():
    """6. Test retrieving surrounding file contents via GitHub contents API with secret redaction."""
    raw_code = "import os\nAPI_KEY = 'gsk_123456789012345678901234'\ndef run(): pass\n"
    b64_code = base64.b64encode(raw_code.encode("utf-8")).decode("utf-8")

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"content": b64_code, "encoding": "base64"}
        mock_get.return_value = mock_resp

        file_res = GitHubService.fetch_file_content("owner", "repo", "src/run.py")
        assert file_res["status"] == "SUCCESS"
        assert file_res["was_redacted"] is True
        assert "gsk_" not in file_res["content"]
        assert ("[REDACTED_GROQ_KEY]" in file_res["content"] or "[REDACTED_SECRET]" in file_res["content"])


def test_diff_line_number_and_code_issue_extraction():
    """7. Test accurate extraction of file and line numbers for code issues from git diff hunks."""
    sample_diff = (
        "diff --git a/backend/auth.py b/backend/auth.py\n"
        "--- a/backend/auth.py\n"
        "+++ b/backend/auth.py\n"
        "@@ -10,4 +15,6 @@\n"
        " def check_perm():\n"
        "+    # unsafe execution\n"
        "+    eval(request.args.get('code'))\n"
        "+    return True\n"
        "diff --git a/backend/worker.py b/backend/worker.py\n"
        "--- a/backend/worker.py\n"
        "+++ b/backend/worker.py\n"
        "@@ -40,3 +45,5 @@\n"
        " try:\n"
        "+    pass\n"
        "+except: pass\n"
    )
    changed_files = [
        {"filename": "backend/auth.py", "additions": 3, "deletions": 0, "status": "modified"},
        {"filename": "backend/worker.py", "additions": 2, "deletions": 0, "status": "modified"},
        {"filename": "tests/test_auth.py", "additions": 10, "deletions": 0, "status": "added"}
    ]

    issues, file_analyses, test_files = _extract_diff_hunks_and_issues(sample_diff, changed_files)

    assert "tests/test_auth.py" in test_files
    assert len(file_analyses) == 3

    # Check that eval() was flagged with high severity and exact line number
    eval_issue = next((i for i in issues if "eval" in i.description), None)
    assert eval_issue is not None
    assert eval_issue.file == "backend/auth.py"
    assert eval_issue.line == 17  # line 15 is def, 16 is comment, 17 is eval
    assert eval_issue.issue_type == "SECURITY"
    assert eval_issue.severity == "HIGH"

    # Check bare except was flagged
    except_issue = next((i for i in issues if "except" in i.description), None)
    assert except_issue is not None
    assert except_issue.file == "backend/worker.py"
    assert except_issue.line == 47


def test_groq_deep_code_investigation_prompt_and_redaction():
    """8. Test that GroqProvider sends actual code diffs, redacts secrets, and parses typed assessments."""
    settings = AISettings(
        AI_ENABLED=True,
        AI_PROVIDER="groq",
        AI_MODEL_NAME="openai/gpt-oss-120b",
        GROQ_API_KEY="test_key"
    )
    provider = GroqProvider(settings=settings)

    current_pr = {
        "pr_number": 99,
        "repo_name": "owner/secure_app",
        "title": "Add OAuth2 and session cleanup",
        "state": "open",
        "additions": 30,
        "deletions": 5,
        "changed_files": [
            {"filename": "src/oauth.py", "additions": 25, "deletions": 5, "status": "modified"},
            {"filename": "tests/test_oauth.py", "additions": 15, "deletions": 0, "status": "added"}
        ],
        "diff_snippet": (
            "diff --git a/src/oauth.py b/src/oauth.py\n"
            "@@ -1,5 +1,10 @@\n"
            "+SECRET_KEY = 'gsk_12345678901234567890123456'\n"
            "+def authenticate(): return True\n"
        ),
        "review_comments": [{"reviewer": "lead_dev", "state": "COMMENTED", "comment": "Add tests"}]
    }

    req = ContributorEvidenceInvestigationRequest(contributor_id="sec_coder")

    with patch.object(provider, "_call_groq_chat") as mock_chat:
        # Mock structured response from GPT-OSS-120B
        mock_chat.return_value = {
            "background_assessment": {
                "engineering_quality_rating": 0.85,
                "is_insufficient_evidence": False,
                "rubric_breakdown": {
                    "code_correctness": 0.85,
                    "maintainability": 0.90,
                    "test_discipline": 0.80,
                    "technical_complexity": 0.85
                },
                "technical_strengths": ["Strong modular architecture", "Clean abstraction layers"],
                "recurring_weaknesses": ["Occasional test coverage omissions"],
                "historical_consistency": "Consistent high quality across repositories",
                "summary": "Proven backend software engineer with solid design patterns."
            },
            "current_pr_assessment": {
                "pr_number": 99,
                "repo_name": "owner/secure_app",
                "title": "Add OAuth2 and session cleanup",
                "verdict": "NEEDS_REVISION",
                "implementation_quality_rating": 0.70,
                "overall_summary": "Good implementation but hardcoded secret detected.",
                "code_issues": [
                    {
                        "file": "src/oauth.py",
                        "line": 2,
                        "issue_type": "SECURITY",
                        "severity": "HIGH",
                        "description": "Hardcoded secret key present in source code.",
                        "suggested_fix": "Load secret from environment variable."
                    }
                ],
                "file_analyses": [
                    {
                        "filename": "src/oauth.py",
                        "status": "modified",
                        "additions": 25,
                        "deletions": 5,
                        "logic_analyzed": "Added OAuth authentication routine.",
                        "risk_level": "HIGH",
                        "security_and_bugs_notes": "Hardcoded secret flagged."
                    }
                ],
                "code_review_findings": ["Fix hardcoded secret key on line 2."],
                "test_files_detected": ["tests/test_oauth.py"]
            },
            "evidence_confidence": {
                "confidence_level": "HIGH",
                "completeness_score": 0.90,
                "coverage_status": "FULL_CODE_ANALYSIS",
                "is_supported_by_code": True
            },
            "investigation_checklist": ["Rotate exposed key before merging."]
        }

        res = provider.investigate_contributor_evidence(
            req=req,
            pr_data=[],
            current_pr=current_pr,
            username="sec_coder"
        )

        # Verify call arguments to Groq: payload had secrets redacted!
        call_args = mock_chat.call_args[0]
        user_prompt_sent = call_args[1]
        assert "gsk_12345678901234567890123456" not in user_prompt_sent
        assert "[REDACTED_GROQ_KEY]" in user_prompt_sent

        # Verify parsed response
        assert isinstance(res, ContributorEvidenceInvestigationResponse)
        assert res.secret_redaction_applied is True
        assert res.current_pr_assessment.verdict == "NEEDS_REVISION"
        assert len(res.current_pr_assessment.code_issues) == 1
        assert res.current_pr_assessment.code_issues[0].line == 2
        assert res.current_pr_assessment.code_issues[0].file == "src/oauth.py"
        assert res.current_pr_assessment.file_analyses[0].filename == "src/oauth.py"
        assert res.evidence_confidence.coverage_status == "FULL_CODE_ANALYSIS"


def test_model_failure_fallback_to_deterministic_analysis():
    """9. Test that upstream Groq failures seamlessly fallback to deterministic diff analysis."""
    service = MergeGuardAIService(
        settings=AISettings(AI_ENABLED=True, GROQ_API_KEY="test_key", AI_PROVIDER="groq")
    )
    current_pr = {
        "pr_number": 44,
        "repo_name": "acme/service",
        "title": "Add helper",
        "changed_files": [{"filename": "src/helper.py", "additions": 5, "deletions": 1, "status": "modified"}],
        "diff_snippet": "diff --git a/src/helper.py b/src/helper.py\n@@ -1,2 +1,4 @@\n+def help(): pass\n"
    }

    # Force GroqProvider to raise an exception
    with patch.object(GroqProvider, "_call_groq_chat", side_effect=RuntimeError("Groq upstream timeout")):
        res = service.investigate_contributor_evidence(
            req=ContributorEvidenceInvestigationRequest(contributor_id="fallback_user"),
            pr_data=[],
            current_pr=current_pr,
            username="fallback_user"
        )

        assert isinstance(res, ContributorEvidenceInvestigationResponse)
        assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
        assert "degraded to deterministic rules" in (res.metadata.fallback_reason or "")
        # Should still contain file analyses and line issues
        assert len(res.current_pr_assessment.file_analyses) == 1
        assert res.current_pr_assessment.file_analyses[0].filename == "src/helper.py"
