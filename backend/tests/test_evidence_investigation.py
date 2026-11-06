import json
import pytest
from unittest.mock import patch, MagicMock
import httpx
from fastapi.testclient import TestClient

from app.schemas.ai import (
    ContributorEvidenceInvestigationRequest,
    ContributorEvidenceInvestigationResponse,
    ExecutionMode
)
from app.services.github_service import GitHubService
from app.services.ai_service import MergeGuardAIService
from app.services.ai_provider import GroqProvider, DeterministicFallbackProvider, AITimeoutError, AIRateLimitError
from app.core.ai_config import AISettings
from app.models import Contributor, Project, GitHubPullRequest


def test_cross_repository_contributor_history(db_session):
    """1. Test cross-repository contributor history retrieval across multiple public GitHub repos."""
    mock_items = [
        {
            "number": 101,
            "title": "Add async event worker",
            "body": "Implements task queue",
            "state": "closed",
            "repository_url": "https://api.github.com/repos/external-org/engine-core",
            "html_url": "https://github.com/external-org/engine-core/pull/101",
            "created_at": "2026-10-01T10:00:00Z",
            "closed_at": "2026-10-02T10:00:00Z",
            "pull_request": {"merged_at": "2026-10-02T10:00:00Z"},
            "user": {"avatar_url": "https://github.com/testauthor.png"}
        },
        {
            "number": 42,
            "title": "Refactor auth middleware",
            "body": "Clean up JWT handlers",
            "state": "open",
            "repository_url": "https://api.github.com/repos/another-org/web-service",
            "html_url": "https://github.com/another-org/web-service/pull/42",
            "created_at": "2026-10-05T12:00:00Z",
            "pull_request": {"merged_at": None},
            "user": {"avatar_url": "https://github.com/testauthor.png"}
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"total_count": 2, "items": mock_items}
        mock_get.return_value = mock_resp

        results, meta = GitHubService.fetch_contributor_cross_repo_prs("testauthor", limit=10)

        assert len(results) == 2
        assert results[0]["repo_name"] == "external-org/engine-core"
        assert results[0]["is_merged"] is True
        assert results[1]["repo_name"] == "another-org/web-service"
        assert results[1]["state"] == "open"
        assert meta["total_count"] == 2


def test_github_pagination_multiple_pages():
    """2. Test that GitHub search traverses multiple pages when requested limit > 30."""
    page_1_items = [{"number": i, "title": f"PR #{i}", "repository_url": "https://api.github.com/repos/org/repo"} for i in range(1, 31)]
    page_2_items = [{"number": i, "title": f"PR #{i}", "repository_url": "https://api.github.com/repos/org/repo"} for i in range(31, 46)]

    def side_effect(url, params, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if params.get("page") == 1:
            resp.json.return_value = {"total_count": 45, "items": page_1_items}
        else:
            resp.json.return_value = {"total_count": 45, "items": page_2_items}
        return resp

    with patch("httpx.Client.get", side_effect=side_effect):
        results, meta = GitHubService.fetch_contributor_cross_repo_prs("prolific-dev", limit=45)
        assert len(results) == 45
        assert meta["pages_fetched"] >= 2


def test_missing_and_incomplete_github_data():
    """3. Test graceful handling when GitHub returns 404, rate limit, or empty files."""
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        diff_res = GitHubService.fetch_pr_diff_and_files("unknown", "repo", 999)
        assert diff_res["files"] == []
        assert diff_res["diff_snippet"] == ""
        assert diff_res["additions"] == 0

        # Rate limit simulation (403)
        mock_resp.status_code = 403
        prs, meta = GitHubService.fetch_contributor_cross_repo_prs("rate-limited-user", limit=10)
        assert prs == []
        assert meta["rate_limited"] is True


def test_code_diff_retrieval():
    """4. Test retrieval and compaction of code diff patches and changed file counts."""
    files_payload = [
        {
            "filename": "src/auth/jwt.py",
            "status": "modified",
            "additions": 14,
            "deletions": 2,
            "patch": "@@ -10,3 +10,15 @@\n+def verify_token(token: str):\n+    return jwt.decode(token)"
        },
        {
            "filename": "tests/test_jwt.py",
            "status": "added",
            "additions": 25,
            "deletions": 0,
            "patch": "@@ -0,0 +1,25 @@\n+def test_jwt_valid():\n+    assert verify_token('abc')"
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = files_payload
        mock_get.return_value = mock_resp

        res = GitHubService.fetch_pr_diff_and_files("org", "repo", 10)
        assert len(res["files"]) == 2
        assert res["additions"] == 39
        assert res["deletions"] == 2
        assert "--- a/src/auth/jwt.py" in res["diff_snippet"]
        assert "+def verify_token" in res["diff_snippet"]


def test_review_comments_and_requested_changes():
    """5. Test review decision parsing and closure reason extraction."""
    reviews_payload = [
        {
            "user": {"login": "senior-reviewer"},
            "state": "CHANGES_REQUESTED",
            "body": "Please add unit tests for edge case tokens."
        }
    ]
    comments_payload = [
        {
            "user": {"login": "maintainer-bot"},
            "body": "Closing as duplicate of PR #152"
        }
    ]

    def side_effect(url, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if "reviews" in url:
            resp.json.return_value = reviews_payload
        else:
            resp.json.return_value = comments_payload
        return resp

    with patch("httpx.Client.get", side_effect=side_effect):
        res = GitHubService.fetch_pr_reviews_and_discussions("org", "repo", 25, is_closed_unmerged=True)
        assert len(res["reviews"]) == 1
        assert res["reviews"][0]["state"] == "CHANGES_REQUESTED"
        assert "Changes requested by @senior-reviewer" in res["closure_reason"] or "duplicate" in res["closure_reason"]


def test_gpt_payload_contains_actual_evidence():
    """6. Test that GroqProvider builds a prompt payload containing actual code diffs and reviews."""
    settings = AISettings(
        AI_ENABLED=True,
        AI_PROVIDER="groq",
        AI_MODEL_NAME="openai/gpt-oss-120b",
        GROQ_API_KEY="test_key"
    )
    provider = GroqProvider(settings=settings)

    pr_data = [
        {
            "pr_number": 42,
            "repo_name": "acme/auth",
            "title": "Fix token expiration race",
            "state": "merged",
            "is_merged": True,
            "additions": 15,
            "deletions": 3,
            "changed_files": [{"filename": "auth.py", "additions": 15}],
            "diff_snippet": "@@ -1,3 +1,5 @@\n+if token.is_expired(): return False",
            "review_comments": [{"reviewer": "alice", "state": "APPROVED", "comment": "Looks clean"}],
            "closure_reason": ""
        }
    ]
    req = ContributorEvidenceInvestigationRequest(contributor_id="alice_dev")

    with patch.object(provider, "_call_groq_chat") as mock_chat:
        mock_chat.return_value = {
            "background_assessment": {
                "engineering_quality_rating": 0.88,
                "rubric_breakdown": {"code_structure": 0.9, "maintainability": 0.9, "test_coverage": 0.8, "collaboration": 0.9},
                "consistency_analysis": "Consistent code",
                "complexity_assessment": "High",
                "positive_engineering_signals": ["Good diff"],
                "potential_technical_concerns": [],
                "summary": "Great engineer"
            },
            "current_pr_assessment": {
                "pr_number": 42,
                "verdict": "READY_TO_MERGE",
                "code_review_findings": ["No issues"],
                "security_and_bugs_check": "Clean",
                "test_coverage_evaluation": "Good",
                "maintainability_notes": "Clean"
            },
            "evidence_confidence": {
                "confidence_level": "HIGH",
                "completeness_score": 0.9,
                "missing_evidence_notes": [],
                "data_limitations": "None"
            },
            "investigation_checklist": ["Merge PR"]
        }

        res = provider.investigate_contributor_evidence(
            req=req,
            pr_data=pr_data,
            current_pr=pr_data[0],
            username="alice_dev",
            vouch_count=2,
            denounce_count=0
        )

        assert mock_chat.called
        call_args = mock_chat.call_args[0]
        user_prompt_str = call_args[1]
        user_prompt_json = json.loads(user_prompt_str)

        # Assert that actual code diff snippet is in the prompt sent to Groq
        assert "token.is_expired()" in user_prompt_str
        assert user_prompt_json["sampled_pr_evidence"][0]["diff_snippet"] == pr_data[0]["diff_snippet"]
        assert user_prompt_json["sampled_pr_evidence"][0]["review_comments"][0]["reviewer"] == "alice"


def test_ai_output_validation():
    """7. Test strict validation and normalization of structured AI output."""
    provider = DeterministicFallbackProvider()
    req = ContributorEvidenceInvestigationRequest(contributor_id="test_contrib")
    res = provider.investigate_contributor_evidence(
        req=req,
        pr_data=[],
        current_pr=None,
        username="test_contrib"
    )

    assert isinstance(res, ContributorEvidenceInvestigationResponse)
    assert 0.0 <= res.background_assessment.engineering_quality_rating <= 1.0
    assert 0.0 <= res.evidence_confidence.completeness_score <= 1.0
    assert res.current_pr_assessment.verdict in {
        "READY_TO_MERGE", "NEEDS_REVISION", "SECURITY_TRIAGE_RECOMMENDED",
        "LOW_RISK", "INSUFFICIENT_TESTS", "NOT_APPLICABLE"
    }


def test_newcomer_fairness_guarantee():
    """8. Test that newcomers with 0 records receive neutral 50% baseline without penalty."""
    provider = DeterministicFallbackProvider()
    req = ContributorEvidenceInvestigationRequest(contributor_id="brand_new_user")
    res = provider.investigate_contributor_evidence(
        req=req,
        pr_data=[],
        current_pr=None,
        username="brand_new_user",
        vouch_count=0,
        denounce_count=0
    )

    assert res.background_assessment.engineering_quality_rating == 0.50
    assert res.evidence_confidence.confidence_level == "INSUFFICIENT"
    assert "baseline" in res.background_assessment.summary.lower() or "neutral" in res.background_assessment.summary.lower()
    assert res.current_pr_assessment.verdict == "NOT_APPLICABLE"


def test_closed_unmerged_pr_handling():
    """9. Test that closed-unmerged PRs are inspected for closure context without blind penalty."""
    pr_data = [
        {
            "pr_number": 99,
            "repo_name": "acme/repo",
            "title": "Alternative layout engine",
            "state": "closed",
            "is_merged": False,
            "additions": 100,
            "deletions": 10,
            "changed_files": [{"filename": "layout.py", "additions": 100, "deletions": 10}],
            "diff_snippet": "@@ -0,0 +1,50 @@\n+class NewLayout: pass",
            "review_comments": [{"reviewer": "lead", "state": "COMMENTED", "comment": "Good idea, but implemented in core #105"}],
            "closure_reason": "Maintainer @lead note: Implemented in core #105"
        }
    ]

    provider = DeterministicFallbackProvider()
    req = ContributorEvidenceInvestigationRequest(contributor_id="creative_coder")
    res = provider.investigate_contributor_evidence(
        req=req,
        pr_data=pr_data,
        current_pr=pr_data[0],
        username="creative_coder"
    )

    # Should not penalize to 0
    assert res.background_assessment.engineering_quality_rating >= 0.50
    has_concern = any(
        "closure" in c.lower() or "closed" in c.lower()
        for c in res.background_assessment.potential_technical_concerns
    )
    assert has_concern


def test_low_sample_size_confidence():
    """10. Test that small sample sizes reflect LOW/MEDIUM confidence, separating sample size from quality."""
    pr_data = [
        {
            "pr_number": 1,
            "repo_name": "solo/repo",
            "title": "Initial commit",
            "state": "merged",
            "is_merged": True,
            "additions": 5,
            "deletions": 0,
            "changed_files": [{"filename": "README.md", "additions": 5, "deletions": 0}],
            "diff_snippet": "@@ -0,0 +1,5 @@\n+# Hello",
            "review_comments": [],
            "closure_reason": ""
        }
    ]
    provider = DeterministicFallbackProvider()
    req = ContributorEvidenceInvestigationRequest(contributor_id="one_pr_dev")
    res = provider.investigate_contributor_evidence(
        req=req,
        pr_data=pr_data,
        current_pr=pr_data[0],
        username="one_pr_dev"
    )

    assert res.evidence_confidence.confidence_level in {"LOW", "MEDIUM"}
    assert res.evidence_confidence.completeness_score < 0.70


def test_groq_timeouts_and_api_failures():
    """11. Test that Groq timeouts and rate limits degrade gracefully to fallback."""
    settings = AISettings(
        AI_ENABLED=True,
        AI_PROVIDER="groq",
        AI_MODEL_NAME="openai/gpt-oss-120b",
        GROQ_API_KEY="test_key"
    )
    provider = GroqProvider(settings=settings)

    with patch.object(provider, "_call_groq_chat", side_effect=AITimeoutError("Groq request timed out")):
        svc = MergeGuardAIService(settings=settings, provider=provider)
        req = ContributorEvidenceInvestigationRequest(contributor_id="failing_api_user")

        # Must not raise exception, must return degraded response
        res = svc.investigate_contributor_evidence(
            req=req,
            pr_data=[],
            current_pr=None,
            username="failing_api_user"
        )
        assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK
        assert "degraded" in res.metadata.fallback_reason.lower() or "failed" in res.metadata.fallback_reason.lower()


def test_fallback_provider_identification():
    """12. Test that fallback output is never falsely labeled as Groq / GPT-OSS-120B."""
    fallback = DeterministicFallbackProvider(reason="API Offline")
    req = ContributorEvidenceInvestigationRequest(contributor_id="test_user")
    res = fallback.investigate_contributor_evidence(
        req=req,
        pr_data=[],
        current_pr=None,
        username="test_user"
    )

    assert res.metadata.provider == "deterministic_heuristic_engine"
    assert res.metadata.model == "deterministic-rules-v1"
    assert res.metadata.execution_mode == ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK


def test_current_pr_assessment_endpoint(client, db_session):
    """13. Test full FastAPI endpoint /api/ai/investigate with current PR assessment."""
    payload = {
        "contributor_id": "contrib-gh-maxzver",
        "viewing_project_id": "proj-gh-acidanthera-applealc",
        "current_pr_number": 965,
        "force_refresh": False
    }

    # Seed mock contributor and PR in test database
    contrib = Contributor(
        id="contrib-gh-maxzver",
        username="MAXZVER",
        display_name="MAXZVER",
        reputation_state="ACTIVE_PEER"
    )
    db_session.add(contrib)
    db_session.commit()

    resp = client.post("/api/ai/investigate", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["username"] == "MAXZVER"
    assert "background_assessment" in data
    assert "current_pr_assessment" in data
    assert "evidence_confidence" in data
    assert "investigation_checklist" in data
    assert data["advisory_only"] is True
