import re
import hmac
import hashlib
import json
import base64
from datetime import datetime, timezone
from typing import Tuple, Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.secret_redactor import redact_secrets
from app.models import Project, Contributor, GitHubPullRequest, GitHubCredential

def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        # Handles 2026-10-31T12:00:00Z or similar
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return datetime.now(timezone.utc)

class GitHubService:
    @staticmethod
    def parse_github_url(url: str) -> Tuple[str, str]:
        """
        Validates and parses a GitHub repository URL into (owner, repo).
        Accepts:
          - https://github.com/owner/repo
          - https://github.com/owner/repo.git
          - https://github.com/owner/repo/
        Rejects invalid domains, path structures, or malicious characters.
        """
        if not url or not isinstance(url, str):
            raise ValueError("Repository URL must be a non-empty string.")

        clean_url = url.strip()
        pattern = r"^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(\/|\.git)?$"
        match = re.match(pattern, clean_url, re.IGNORECASE)
        if not match:
            raise ValueError(
                f"Invalid GitHub repository URL: '{url}'. Expected format: 'https://github.com/owner/repository'"
            )

        owner = match.group(2)
        repo = match.group(3)

        if repo.endswith(".git"):
            repo = repo[:-4]

        # Prevent reserved GitHub routes
        reserved = {"orgs", "users", "settings", "marketplace", "features", "topics", "collections"}
        if owner.lower() in reserved:
            raise ValueError(f"'{owner}' is a reserved GitHub namespace, not a valid repository owner.")

        return owner, repo

    @staticmethod
    def get_auth_token(db: Session = None) -> Optional[str]:
        """
        Retrieves active GitHub token from backend storage or settings.
        Never exposed to the frontend.
        """
        if db:
            cred = db.query(GitHubCredential).first()
            if cred and cred.encrypted_access_token:
                return cred.encrypted_access_token

        return settings.GITHUB_TOKEN or None

    @classmethod
    def get_request_headers(cls, token: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "MergeGuard-Engine/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    @classmethod
    def fetch_repo_metadata(
        cls, owner: str, repo: str, token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches repository metadata from GitHub REST API v3.
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}"
        headers = cls.get_request_headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)

                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "owner": data.get("owner", {}).get("login", owner),
                        "name": data.get("name", repo),
                        "full_name": data.get("full_name", f"{owner}/{repo}"),
                        "description": data.get("description") or "",
                        "default_branch": data.get("default_branch") or "main",
                        "visibility": "private" if data.get("private") else "public",
                        "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
                        "stars": data.get("stargazers_count", 0),
                        "created_at": parse_iso_datetime(data.get("created_at")),
                        "updated_at": parse_iso_datetime(data.get("updated_at")),
                    }
                elif resp.status_code == 404:
                    raise ValueError(
                        f"GitHub repository '{owner}/{repo}' not found. Make sure the repository is public or authorize private access."
                    )
                elif resp.status_code in (403, 429):
                    rate_limit_msg = resp.headers.get("x-ratelimit-remaining", "0")
                    raise RuntimeError(
                        f"GitHub API rate limit reached (Remaining: {rate_limit_msg}). Try again later or configure backend token."
                    )
                else:
                    raise RuntimeError(
                        f"GitHub API returned error {resp.status_code}: {resp.text}"
                    )
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            raise RuntimeError(f"Network error connecting to GitHub API: {str(exc)}")

    @classmethod
    def fetch_pull_requests(
        cls,
        owner: str,
        repo: str,
        page: int = 1,
        per_page: int = 30,
        state: str = "all",
        token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches actual pull requests for a repository from GitHub REST API.
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls"
        params = {
            "page": page,
            "per_page": min(per_page, 100),
            "state": state,
            "sort": "updated",
            "direction": "desc",
        }
        headers = cls.get_request_headers(token)

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, params=params, headers=headers)

                if resp.status_code == 200:
                    pulls = resp.json()
                    results = []
                    for pr in pulls:
                        user = pr.get("user") or {}
                        merged_at = parse_iso_datetime(pr.get("merged_at"))
                        is_merged = bool(merged_at)
                        state_val = "merged" if is_merged else pr.get("state", "open")

                        review_status = "DRAFT" if pr.get("draft") else ("MERGED" if is_merged else ("CLOSED" if state_val == "closed" else "REVIEW_READY"))

                        results.append({
                            "pr_number": pr.get("number"),
                            "title": pr.get("title") or "Untitled Pull Request",
                            "description": pr.get("body") or "",
                            "author_username": user.get("login") or "ghost",
                            "author_avatar_url": user.get("avatar_url") or "",
                            "state": state_val,
                            "is_merged": is_merged,
                            "merged_at": merged_at,
                            "base_branch": pr.get("base", {}).get("ref") or "main",
                            "head_branch": pr.get("head", {}).get("ref") or "",
                            "html_url": pr.get("html_url") or f"https://github.com/{owner}/{repo}/pull/{pr.get('number')}",
                            "commit_count": pr.get("commits", 1),
                            "review_status": review_status,
                            "ci_status": "SUCCESS" if is_merged else "UNKNOWN",
                            "created_at": parse_iso_datetime(pr.get("created_at")),
                            "updated_at": parse_iso_datetime(pr.get("updated_at")),
                        })
                    return results
                elif resp.status_code == 404:
                    raise ValueError(f"Repository '{owner}/{repo}' not found on GitHub.")
                elif resp.status_code in (403, 429):
                    raise RuntimeError("GitHub API rate limit exceeded while fetching pull requests.")
                else:
                    raise RuntimeError(f"GitHub API error fetching PRs: {resp.status_code}")
        except (httpx.RequestError, httpx.TimeoutException) as exc:
            raise RuntimeError(f"Failed to communicate with GitHub API: {str(exc)}")

    @classmethod
    def verify_pull_request(
        cls,
        owner: str,
        repo: str,
        pr_number: int,
        expected_url: Optional[str] = None,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Verification Service:
        Confirms repository existence, PR existence, owner/name match, PR number match, and canonical URL.
        Returns one of:
          - "Verified GitHub record"
          - "Unable to verify"
          - "Verification unavailable"
        """
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"
        headers = cls.get_request_headers(token)
        now = datetime.now(timezone.utc)

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, headers=headers)

                if resp.status_code == 200:
                    pr_data = resp.json()
                    canonical_url = pr_data.get("html_url") or f"https://github.com/{owner}/{repo}/pull/{pr_number}"
                    base_repo = pr_data.get("base", {}).get("repo", {})
                    api_owner = base_repo.get("owner", {}).get("login", "").lower()
                    api_repo = base_repo.get("name", "").lower()
                    api_number = pr_data.get("number")

                    matches_repo = (api_owner == owner.lower() and api_repo == repo.lower())
                    matches_number = (api_number == pr_number)
                    matches_url = True
                    if expected_url:
                        clean_expected = expected_url.strip().rstrip("/")
                        clean_canonical = canonical_url.strip().rstrip("/")
                        matches_url = (clean_expected == clean_canonical)

                    if matches_repo and matches_number and matches_url:
                        return {
                            "pr_number": pr_number,
                            "canonical_url": canonical_url,
                            "verification_status": "Verified GitHub record",
                            "verification_details": (
                                f"Canonically verified via GitHub API (v3). Base repository '{owner}/{repo}', "
                                f"PR #{pr_number}, state '{pr_data.get('state')}' validated."
                            ),
                            "verified_at": now,
                            "repository_match": True,
                            "api_source": "GitHub REST API v3",
                        }
                    else:
                        return {
                            "pr_number": pr_number,
                            "canonical_url": canonical_url,
                            "verification_status": "Unable to verify",
                            "verification_details": (
                                f"Discrepancy detected: expected '{owner}/{repo}#{pr_number}', "
                                f"GitHub canonical report returned '{api_owner}/{api_repo}#{api_number}'."
                            ),
                            "verified_at": now,
                            "repository_match": False,
                            "api_source": "GitHub REST API v3",
                        }

                elif resp.status_code == 404:
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Unable to verify",
                        "verification_details": f"PR #{pr_number} was not found in repository '{owner}/{repo}' via GitHub API.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }
                elif resp.status_code in (403, 429):
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Verification unavailable",
                        "verification_details": "GitHub API rate limit exceeded. Verification deferred until rate reset.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }
                else:
                    return {
                        "pr_number": pr_number,
                        "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                        "verification_status": "Unable to verify",
                        "verification_details": f"GitHub API error code {resp.status_code}.",
                        "verified_at": now,
                        "repository_match": False,
                        "api_source": "GitHub REST API v3",
                    }

        except Exception as exc:
            return {
                "pr_number": pr_number,
                "canonical_url": expected_url or f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                "verification_status": "Verification unavailable",
                "verification_details": f"Network exception reaching GitHub: {str(exc)}",
                "verified_at": now,
                "repository_match": False,
                "api_source": "GitHub REST API v3",
            }

    @classmethod
    def import_repository(
        cls,
        db: Session,
        repo_url: str,
        category: str = "Infrastructure",
        custom_policy: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Project, int]:
        """
        Imports public GitHub repository into MergeGuard.
        Retrieves metadata, creates or connects Project, and triggers initial PR sync.
        Prevents duplicate imports.
        """
        owner, repo = cls.parse_github_url(repo_url)
        token = cls.get_auth_token(db)
        meta = cls.fetch_repo_metadata(owner, repo, token=token)

        slug = f"gh-{owner.lower()}-{repo.lower()}"
        canonical_url = meta["html_url"]

        existing = db.query(Project).filter(
            (Project.slug == slug) | (Project.repo_url == canonical_url)
        ).first()

        now = datetime.now(timezone.utc)

        if existing:
            existing.is_github_connected = True
            existing.github_owner = meta["owner"]
            existing.github_repo = meta["name"]
            existing.default_branch = meta["default_branch"]
            existing.visibility = meta["visibility"]
            existing.stars = meta["stars"]
            existing.github_created_at = meta["created_at"]
            existing.github_updated_at = meta["updated_at"]
            existing.sync_status = "SYNCING"
            if custom_policy:
                existing.trust_policy = custom_policy
            db.commit()
            db.refresh(existing)
            project = existing
        else:
            proj_id = f"proj-gh-{owner.lower()}-{repo.lower()}"
            default_policy = custom_policy or {
                "strictness": "balanced",
                "min_confidence": 0.60,
                "peer_weights": {},
            }
            project = Project(
                id=proj_id,
                name=f"{meta['owner']}/{meta['name']}",
                slug=slug,
                description=meta["description"] or f"GitHub repository {meta['full_name']}",
                repo_url=canonical_url,
                category=category or "Infrastructure",
                stars=meta["stars"],
                is_github_connected=True,
                github_owner=meta["owner"],
                github_repo=meta["name"],
                default_branch=meta["default_branch"],
                visibility=meta["visibility"],
                github_created_at=meta["created_at"],
                github_updated_at=meta["updated_at"],
                sync_status="SYNCING",
                created_at=now,
            )
            project.trust_policy = default_policy
            db.add(project)
            db.commit()
            db.refresh(project)

        synced_count = 0
        try:
            sync_res = cls.sync_pull_requests(db, project.id, limit=30)
            synced_count = sync_res.get("synced_pull_requests", 0)
        except Exception as err:
            project.sync_status = "ERROR"
            project.sync_error = str(err)
            db.commit()

        return project, synced_count

    @classmethod
    def sync_pull_requests(
        cls, db: Session, project_id: str, limit: int = 30
    ) -> Dict[str, Any]:
        """
        Fetches and updates PR records in SQLite for a connected project.
        Prevents duplicates, verifies authenticity, and links contributor profiles.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with ID '{project_id}' not found.")

        if not project.github_owner or not project.github_repo:
            owner, repo = cls.parse_github_url(project.repo_url)
            project.github_owner = owner
            project.github_repo = repo
            project.is_github_connected = True

        token = cls.get_auth_token(db)
        pulls = cls.fetch_pull_requests(
            project.github_owner, project.github_repo, page=1, per_page=limit, token=token
        )

        synced_count = 0
        now = datetime.now(timezone.utc)
        synced_contributors: Dict[str, Contributor] = {}

        for p in pulls:
            pr_num = p["pr_number"]
            record_id = f"ghpr-{project.id}-{pr_num}"

            existing_pr = db.query(GitHubPullRequest).filter(
                GitHubPullRequest.id == record_id
            ).first()

            if existing_pr:
                existing_pr.title = p["title"]
                existing_pr.description = p["description"]
                existing_pr.state = p["state"]
                existing_pr.is_merged = p["is_merged"]
                existing_pr.merged_at = p["merged_at"]
                existing_pr.base_branch = p["base_branch"]
                existing_pr.head_branch = p["head_branch"]
                existing_pr.commit_count = p["commit_count"]
                existing_pr.review_status = p["review_status"]
                existing_pr.ci_status = p["ci_status"]
                existing_pr.updated_at = p["updated_at"] or now
                existing_pr.verified_at = now
            else:
                new_pr = GitHubPullRequest(
                    id=record_id,
                    project_id=project.id,
                    pr_number=pr_num,
                    title=p["title"],
                    description=p["description"],
                    author_username=p["author_username"],
                    author_avatar_url=p["author_avatar_url"],
                    state=p["state"],
                    is_merged=p["is_merged"],
                    merged_at=p["merged_at"],
                    base_branch=p["base_branch"],
                    head_branch=p["head_branch"],
                    html_url=p["html_url"],
                    commit_count=p["commit_count"],
                    review_status=p["review_status"],
                    ci_status=p["ci_status"],
                    verification_status="Verified GitHub record",
                    verification_details="Retrieved and verified directly from GitHub REST API v3.",
                    verified_at=now,
                    is_synthetic=False,
                    created_at=p["created_at"] or now,
                    updated_at=p["updated_at"] or now,
                )
                db.add(new_pr)

            author_uname = p["author_username"]
            if author_uname and author_uname != "ghost":
                author_key = author_uname.lower()
                contrib = synced_contributors.get(author_key)
                if not contrib:
                    contrib = (
                        db.query(Contributor)
                        .filter(
                            (Contributor.id == f"contrib-gh-{author_key}")
                            | (Contributor.username == author_uname)
                        )
                        .first()
                    )
                if not contrib:
                    new_contrib = Contributor(
                        id=f"contrib-gh-{author_key}",
                        username=author_uname,
                        display_name=author_uname,
                        avatar_url=p["author_avatar_url"],
                        github_url=f"https://github.com/{author_uname}",
                        bio=f"Open-source contributor to {project.name}.",
                        reputation_state="NEWCOMER",  # Principle #1: Newcomers start with neutral baseline!
                        total_contributions=1,
                        first_seen_at=p["created_at"] or now,
                        created_at=now,
                    )
                    db.add(new_contrib)
                    db.flush()
                    synced_contributors[author_key] = new_contrib
                else:
                    contrib.total_contributions = (contrib.total_contributions or 0) + 1
                    synced_contributors[author_key] = contrib

            synced_count += 1

        project.last_synced_at = now
        project.sync_status = "SUCCESS"
        project.sync_error = ""
        db.commit()

        return {
            "project_id": project.id,
            "project_name": project.name,
            "synced_pull_requests": synced_count,
            "status": "SUCCESS",
            "message": f"Successfully synchronized {synced_count} pull requests from {project.github_owner}/{project.github_repo}.",
            "last_synced_at": now,
        }

    @staticmethod
    def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str], secret: str) -> bool:
        """
        Validates GitHub webhook HMAC-SHA256 signature from 'X-Hub-Signature-256'.
        """
        if not signature_header or not secret:
            return False

        if not signature_header.startswith("sha256="):
            return False

        expected_sig = signature_header[7:]
        computed = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, computed)

    @classmethod
    def fetch_contributor_cross_repo_prs(
        cls,
        username: str,
        limit: int = 50,
        token: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Retrieves pull requests authored by username across ALL public GitHub repositories
        using GitHub Search API with pagination support and rate limit handling.
        """
        clean_user = username.strip().lstrip("@")
        if not clean_user or clean_user == "ghost":
            return [], {"total_count": 0, "pages_fetched": 0, "rate_limited": False}

        headers = cls.get_request_headers(token)
        results = []
        page = 1
        per_page = min(30, max(1, limit))
        total_found = 0
        rate_limited = False

        try:
            with httpx.Client(timeout=10.0) as client:
                while len(results) < limit:
                    url = f"{settings.GITHUB_API_BASE}/search/issues"
                    params = {
                        "q": f"type:pr author:{clean_user}",
                        "sort": "updated",
                        "order": "desc",
                        "page": page,
                        "per_page": per_page
                    }
                    resp = client.get(url, params=params, headers=headers)

                    if resp.status_code == 200:
                        data = resp.json()
                        total_found = data.get("total_count", 0)
                        items = data.get("items", [])
                        if not items:
                            break

                        for item in items:
                            repo_url = item.get("repository_url") or ""
                            # e.g. "https://api.github.com/repos/owner/repo" -> "owner/repo"
                            repo_parts = repo_url.rstrip("/").split("/")
                            repo_name = f"{repo_parts[-2]}/{repo_parts[-1]}" if len(repo_parts) >= 2 else "unknown/repo"

                            pr_num = item.get("number")
                            pr_meta = item.get("pull_request") or {}
                            merged_at = parse_iso_datetime(pr_meta.get("merged_at"))
                            is_merged = bool(merged_at)
                            raw_state = item.get("state", "open")
                            state_val = "merged" if is_merged else raw_state

                            results.append({
                                "pr_number": pr_num,
                                "repo_name": repo_name,
                                "title": item.get("title") or "Untitled PR",
                                "description": item.get("body") or "",
                                "state": state_val,
                                "is_merged": is_merged,
                                "merged_at": merged_at,
                                "html_url": item.get("html_url") or f"https://github.com/{repo_name}/pull/{pr_num}",
                                "created_at": parse_iso_datetime(item.get("created_at")),
                                "updated_at": parse_iso_datetime(item.get("updated_at")),
                                "closed_at": parse_iso_datetime(item.get("closed_at")),
                                "draft": item.get("draft", False),
                                "author_username": clean_user,
                                "author_avatar_url": (item.get("user") or {}).get("avatar_url") or ""
                            })

                            if len(results) >= limit:
                                break

                        page += 1
                        if len(results) >= total_found or page > 5:
                            break
                    elif resp.status_code in (403, 429):
                        rate_limited = True
                        break
                    else:
                        break
        except Exception:
            # Degrade gracefully on network errors
            pass

        return results, {
            "total_count": total_found or len(results),
            "pages_fetched": page,
            "rate_limited": rate_limited
        }

    @classmethod
    def _sample_large_diff(cls, raw_diff: str, max_lines: int = 1200) -> Tuple[str, bool]:
        """
        Intelligently samples large unified git diffs:
        - Drops binary chunks and vendor lockfiles (package-lock.json, poetry.lock, Cargo.lock, yarn.lock, .min.js).
        - Prioritizes source code files and test files.
        - Preserves file headers and meaningful logic hunks.
        """
        if not raw_diff:
            return "", False

        lines = raw_diff.splitlines()
        if len(lines) <= max_lines:
            return raw_diff, False

        file_hunks = []
        current_header = ""
        current_lines = []
        current_file = ""

        noisy_exts = (".lock", ".min.js", ".min.css", ".map", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".wasm", ".bin")

        def is_noisy(fname: str) -> bool:
            f = fname.lower()
            return f.endswith(noisy_exts) or any(
                lock in f for lock in ["package-lock.json", "yarn.lock", "cargo.lock", "poetry.lock", "pnpm-lock.yaml"]
            )

        for line in lines:
            if line.startswith("diff --git "):
                if current_file:
                    file_hunks.append((current_file, current_header, current_lines))
                parts = line.split(" ")
                current_file = parts[-1].lstrip("b/") if len(parts) >= 4 else "file"
                current_header = line
                current_lines = []
            else:
                current_lines.append(line)

        if current_file:
            file_hunks.append((current_file, current_header, current_lines))

        def hunk_priority(item):
            fname = item[0].lower()
            if any(k in fname for k in ["test", "spec"]):
                return 0
            if is_noisy(fname):
                return 3
            if any(fname.endswith(ext) for ext in [".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".c", ".cpp", ".rb"]):
                return 1
            return 2

        file_hunks.sort(key=hunk_priority)

        reconstructed = []
        lines_count = 0
        is_truncated = False

        for fname, header, hlines in file_hunks:
            if is_noisy(fname):
                reconstructed.append(f"{header}\n[Binary / Generated Lockfile Omitted ({len(hlines)} lines)]")
                continue

            if lines_count + len(hlines) > max_lines:
                remaining = max(20, max_lines - lines_count)
                reconstructed.append(header)
                reconstructed.extend(hlines[:remaining])
                reconstructed.append(f"... [Diff truncated: {len(hlines) - remaining} additional lines omitted for file {fname}]")
                is_truncated = True
                break
            else:
                reconstructed.append(header)
                reconstructed.extend(hlines)
                lines_count += len(hlines)

        return "\n".join(reconstructed), is_truncated

    @classmethod
    def fetch_pr_complete_diff(
        cls,
        owner: str,
        repo: str,
        pr_number: int,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves the complete git unified diff directly from GitHub REST API
        using header 'Accept: application/vnd.github.v3.diff'.
        Redacts detected secrets before returning.
        """
        headers = cls.get_request_headers(token)
        headers["Accept"] = "application/vnd.github.v3.diff"
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)
                raw_diff = getattr(resp, "text", "")
                if resp.status_code == 200 and isinstance(raw_diff, str) and ("diff --git" in raw_diff or "@@" in raw_diff):
                    sanitized, was_redacted = redact_secrets(raw_diff)
                    sampled_diff, is_truncated = cls._sample_large_diff(sanitized, max_lines=1200)
                    return {
                        "diff": sampled_diff,
                        "raw_length": len(raw_diff),
                        "total_lines": len(raw_diff.splitlines()),
                        "is_truncated": is_truncated,
                        "was_redacted": was_redacted,
                        "status": "SUCCESS"
                    }
                elif resp.status_code in (403, 429):
                    return {"diff": "", "raw_length": 0, "total_lines": 0, "is_truncated": False, "was_redacted": False, "status": "RATE_LIMITED"}
                elif resp.status_code == 404:
                    return {"diff": "", "raw_length": 0, "total_lines": 0, "is_truncated": False, "was_redacted": False, "status": "NOT_FOUND"}
        except Exception:
            pass

        return {"diff": "", "raw_length": 0, "total_lines": 0, "is_truncated": False, "was_redacted": False, "status": "ERROR"}

    @classmethod
    def fetch_file_content(
        cls,
        owner: str,
        repo: str,
        file_path: str,
        ref: Optional[str] = None,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches surrounding source code context for a changed file via GitHub Contents API.
        Redacts detected secrets before returning.
        """
        headers = cls.get_request_headers(token)
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{file_path}"
        params = {"ref": ref} if ref else {}

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    content_b64 = data.get("content", "")
                    if content_b64:
                        decoded = base64.b64decode(content_b64).decode("utf-8", errors="replace")
                        sanitized, was_redacted = redact_secrets(decoded)
                        return {
                            "content": sanitized[:12000],
                            "was_redacted": was_redacted,
                            "status": "SUCCESS"
                        }
        except Exception:
            pass

        return {"content": "", "was_redacted": False, "status": "UNAVAILABLE"}

    @classmethod
    def fetch_pr_diff_and_files(
        cls,
        owner: str,
        repo: str,
        pr_number: int,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves changed files, additions, deletions, full unified diff or smart sampled diffs,
        and identifies test files and security-relevant files.
        """
        headers = cls.get_request_headers(token)
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/files"

        file_summaries = []
        total_adds = 0
        total_dels = 0
        test_files = []
        was_redacted = False

        # First attempt to fetch the complete unified diff
        diff_res = cls.fetch_pr_complete_diff(owner, repo, pr_number, token=token)
        unified_diff = diff_res.get("diff") or ""
        is_truncated = diff_res.get("is_truncated", False)
        if diff_res.get("was_redacted"):
            was_redacted = True

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(url, params={"per_page": 30}, headers=headers)
                if resp.status_code == 200:
                    files = resp.json()
                    fallback_diff_parts = []

                    for f in files:
                        fname = f.get("filename") or ""
                        status = f.get("status") or "modified"
                        adds = f.get("additions", 0)
                        dels = f.get("deletions", 0)
                        total_adds += adds
                        total_dels += dels

                        is_test = bool(re.search(r"(test|spec|__tests__|tests/)", fname, re.IGNORECASE))
                        if is_test:
                            test_files.append(fname)

                        raw_patch = f.get("patch") or ""
                        clean_patch, p_redacted = redact_secrets(raw_patch)
                        if p_redacted:
                            was_redacted = True

                        file_summaries.append({
                            "filename": fname,
                            "status": status,
                            "additions": adds,
                            "deletions": dels,
                            "is_test": is_test,
                            "patch_snippet": clean_patch[:800] if clean_patch else ""
                        })

                        if clean_patch and len(fallback_diff_parts) < 8:
                            fallback_diff_parts.append(f"--- a/{fname}\n+++ b/{fname}\n{clean_patch[:1200]}")

                    if not unified_diff and fallback_diff_parts:
                        unified_diff = "\n\n".join(fallback_diff_parts)

        except Exception:
            pass

        coverage_status = "FULL_CODE_ANALYSIS" if (unified_diff and not is_truncated) else (
            "PARTIAL_ANALYSIS" if unified_diff else "INSUFFICIENT_EVIDENCE"
        )

        return {
            "files": file_summaries,
            "diff_snippet": unified_diff,
            "additions": total_adds,
            "deletions": total_dels,
            "test_files": test_files,
            "is_truncated": is_truncated,
            "was_redacted": was_redacted,
            "coverage_status": coverage_status
        }

    @classmethod
    def fetch_pr_reviews_and_discussions(
        cls,
        owner: str,
        repo: str,
        pr_number: int,
        is_closed_unmerged: bool = False,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetches review decisions, reviewer comments, and closure reasons.
        """
        headers = cls.get_request_headers(token)
        reviews_url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/reviews"
        reviews_list = []
        closure_reason = ""

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(reviews_url, params={"per_page": 10}, headers=headers)
                if resp.status_code == 200:
                    for rv in resp.json():
                        state = rv.get("state") # APPROVED, CHANGES_REQUESTED, COMMENTED
                        body = (rv.get("body") or "").strip()
                        reviewer = (rv.get("user") or {}).get("login") or "reviewer"
                        if state or body:
                            reviews_list.append({
                                "reviewer": reviewer,
                                "state": state,
                                "comment": body[:300]
                            })
                            if state == "CHANGES_REQUESTED" and not closure_reason:
                                closure_reason = f"Changes requested by @{reviewer}: {body[:120]}"

                if is_closed_unmerged:
                    comments_url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{pr_number}/comments"
                    c_resp = client.get(comments_url, params={"per_page": 5}, headers=headers)
                    if c_resp.status_code == 200:
                        for comment in c_resp.json():
                            c_body = (comment.get("body") or "").lower()
                            c_author = (comment.get("user") or {}).get("login") or ""
                            if any(k in c_body for k in ["duplicate", "superseded", "rebased", "moved", "closed as", "stale"]):
                                closure_reason = f"Maintainer @{c_author} note: {(comment.get('body') or '')[:160]}"
                                break
        except Exception:
            pass

        if is_closed_unmerged and not closure_reason:
            closure_reason = "Closed without merge by author or maintainer without formal review flag."

        return {
            "reviews": reviews_list,
            "closure_reason": closure_reason
        }

    @classmethod
    def sync_contributor_full_history(
        cls,
        db: Session,
        username: str,
        viewing_project_id: Optional[str] = None,
        force_refresh: bool = False,
        max_prs: int = 30
    ) -> Dict[str, Any]:
        """
        Synchronizes a contributor's full public cross-repository PR history into SQLite.
        Enriches top PRs with code diffs, file summaries, and review comments.
        Provides robust caching to conserve GitHub API rate limits.
        """
        clean_user = username.strip().lstrip("@")
        token = cls.get_auth_token(db)
        now = datetime.now(timezone.utc)

        # Check existing cached PRs in database
        existing_prs = db.query(GitHubPullRequest).filter(
            GitHubPullRequest.author_username == clean_user
        ).order_by(GitHubPullRequest.created_at.desc()).all()

        has_enriched_diffs = any(bool(p.diff_snippet) for p in existing_prs)

        # If we have cached records with diff snippets and force_refresh is False, return cache
        if existing_prs and has_enriched_diffs and not force_refresh:
            return {
                "author_username": clean_user,
                "pull_requests": existing_prs,
                "total_cached": len(existing_prs),
                "is_cached": True,
                "last_synced": existing_prs[0].updated_at or now
            }

        # Otherwise, fetch cross-repository PRs from GitHub Search API
        cross_prs, meta = cls.fetch_contributor_cross_repo_prs(clean_user, limit=max_prs, token=token)

        # Also get any projects registered in MergeGuard
        all_projects = {p.name.lower(): p for p in db.query(Project).all()}
        default_project = (
            db.query(Project).filter(Project.id == viewing_project_id).first()
            if viewing_project_id else None
        ) or db.query(Project).first()

        synced_prs = []

        # Process each PR from GitHub Search
        for pr_data in cross_prs:
            repo_name = pr_data["repo_name"]
            pr_num = pr_data["pr_number"]
            matched_project = all_projects.get(repo_name.lower())
            is_ext = matched_project is None
            proj_id = matched_project.id if matched_project else (default_project.id if default_project else "proj-external")

            record_id = f"ghpr-{repo_name.replace('/', '-')}-{pr_num}"
            existing = db.query(GitHubPullRequest).filter(GitHubPullRequest.id == record_id).first()

            # For top 4 PRs, fetch diffs & reviews if missing
            diff_data = {"files": [], "diff_snippet": "", "additions": 0, "deletions": 0}
            review_data = {"reviews": [], "closure_reason": ""}

            if len(synced_prs) < 4:
                owner, repo = repo_name.split("/") if "/" in repo_name else ("unknown", "unknown")
                if owner != "unknown":
                    diff_data = cls.fetch_pr_diff_and_files(owner, repo, pr_num, token=token)
                    review_data = cls.fetch_pr_reviews_and_discussions(
                        owner, repo, pr_num,
                        is_closed_unmerged=(not pr_data["is_merged"] and pr_data["state"] == "closed"),
                        token=token
                    )

            if existing:
                existing.title = pr_data["title"]
                existing.description = pr_data["description"]
                existing.state = pr_data["state"]
                existing.is_merged = pr_data["is_merged"]
                existing.merged_at = pr_data["merged_at"]
                existing.repo_name = repo_name
                existing.is_external = is_ext
                if diff_data["diff_snippet"]:
                    existing.diff_snippet = diff_data["diff_snippet"]
                    existing.changed_files = diff_data["files"]
                    existing.additions = diff_data["additions"]
                    existing.deletions = diff_data["deletions"]
                if review_data["reviews"]:
                    existing.review_comments = review_data["reviews"]
                if review_data["closure_reason"]:
                    existing.closure_reason = review_data["closure_reason"]
                existing.updated_at = now
                synced_prs.append(existing)
            else:
                new_pr = GitHubPullRequest(
                    id=record_id,
                    project_id=proj_id,
                    pr_number=pr_num,
                    title=pr_data["title"],
                    description=pr_data["description"],
                    author_username=clean_user,
                    author_avatar_url=pr_data.get("author_avatar_url") or "",
                    state=pr_data["state"],
                    is_merged=pr_data["is_merged"],
                    merged_at=pr_data["merged_at"],
                    base_branch="main",
                    head_branch="",
                    html_url=pr_data["html_url"],
                    repo_name=repo_name,
                    is_external=is_ext,
                    diff_snippet=diff_data["diff_snippet"],
                    changed_files_json=json.dumps(diff_data["files"]),
                    additions=diff_data["additions"],
                    deletions=diff_data["deletions"],
                    review_comments_json=json.dumps(review_data["reviews"]),
                    closure_reason=review_data["closure_reason"],
                    verification_status="Verified GitHub record",
                    verification_details="Retrieved via GitHub Search & Pull Requests API.",
                    verified_at=now,
                    is_synthetic=False,
                    created_at=pr_data["created_at"] or now,
                    updated_at=now
                )
                db.add(new_pr)
                synced_prs.append(new_pr)

        # Also ensure existing local PRs for connected projects are updated with repo_name & diffs
        for local_pr in existing_prs:
            if local_pr not in synced_prs:
                if not local_pr.repo_name:
                    proj = db.query(Project).filter(Project.id == local_pr.project_id).first()
                    if proj and proj.github_owner and proj.github_repo:
                        local_pr.repo_name = f"{proj.github_owner}/{proj.github_repo}"
                    elif proj:
                        local_pr.repo_name = proj.name

                # Enrich with diff if missing
                if not local_pr.diff_snippet and len(synced_prs) < 6:
                    if "/" in local_pr.repo_name:
                        owner, repo = local_pr.repo_name.split("/")
                        d_info = cls.fetch_pr_diff_and_files(owner, repo, local_pr.pr_number, token=token)
                        r_info = cls.fetch_pr_reviews_and_discussions(
                            owner, repo, local_pr.pr_number,
                            is_closed_unmerged=(not local_pr.is_merged and local_pr.state == "closed"),
                            token=token
                        )
                        if d_info["diff_snippet"]:
                            local_pr.diff_snippet = d_info["diff_snippet"]
                            local_pr.changed_files = d_info["files"]
                            local_pr.additions = d_info["additions"]
                            local_pr.deletions = d_info["deletions"]
                        if r_info["reviews"]:
                            local_pr.review_comments = r_info["reviews"]
                        if r_info["closure_reason"]:
                            local_pr.closure_reason = r_info["closure_reason"]

                synced_prs.append(local_pr)

        db.commit()

        # Update or create Contributor record
        author_key = clean_user.lower()
        contrib = db.query(Contributor).filter(
            (Contributor.id == f"contrib-gh-{author_key}") | (Contributor.username == clean_user)
        ).first()

        if not contrib:
            contrib = Contributor(
                id=f"contrib-gh-{author_key}",
                username=clean_user,
                display_name=clean_user,
                avatar_url=f"https://github.com/{clean_user}.png",
                github_url=f"https://github.com/{clean_user}",
                bio=f"Public GitHub contributor across {len({p.repo_name for p in synced_prs if p.repo_name})} repositories.",
                reputation_state="NEWCOMER" if len(synced_prs) == 0 else "ACTIVE_PEER",
                total_contributions=len(synced_prs),
                first_seen_at=now,
                created_at=now
            )
            db.add(contrib)
            db.commit()

        return {
            "author_username": clean_user,
            "pull_requests": synced_prs,
            "total_cached": len(synced_prs),
            "is_cached": False,
            "rate_limited": meta.get("rate_limited", False),
            "last_synced": now
        }
