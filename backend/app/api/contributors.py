import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models import Contributor, Vouch, Denouncement, Project
from app.schemas import ContributorOut, ContributorCreate, VouchOut, DenouncementOut

router = APIRouter(prefix="/contributors", tags=["contributors"])

def serialize_contributor(c: Contributor, db: Session, viewing_project_id: Optional[str] = None) -> ContributorOut:
    vouches_out = []
    repo_map = {}
    for v in c.vouches:
        proj = db.query(Project).filter(Project.id == v.source_project_id).first()
        pname = proj.name if proj else v.source_project_id
        if v.source_project_id and v.source_project_id not in repo_map:
            repo_map[v.source_project_id] = {
                "id": v.source_project_id,
                "name": pname,
                "pr_count": 0,
                "is_connected": proj.is_github_connected if proj else False
            }
        vouches_out.append(VouchOut(
            id=v.id,
            contributor_id=v.contributor_id,
            contributor_username=c.username,
            source_project_id=v.source_project_id,
            source_project_name=pname,
            reason=v.reason,
            evidence_url=v.evidence_url,
            context=v.context or "",
            confidence=v.confidence,
            provenance_hash=v.provenance_hash or "",
            created_at=v.created_at
        ))

    denounce_out = []
    for d in c.denouncements:
        proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()
        denounce_out.append(DenouncementOut(
            id=d.id,
            contributor_id=d.contributor_id,
            contributor_username=c.username,
            reporting_project_id=d.reporting_project_id,
            reporting_project_name=proj.name if proj else d.reporting_project_id,
            reason=d.reason,
            evidence_url=d.evidence_url,
            details=d.details or "",
            status=d.status,
            review_notes=d.review_notes or "",
            reviewed_by=d.reviewed_by or "",
            created_at=d.created_at,
            updated_at=d.updated_at
        ))

    from app.models import GitHubPullRequest
    gh_prs = db.query(GitHubPullRequest).filter(GitHubPullRequest.author_username == c.username).all()
    has_real_pr = False
    for pr in gh_prs:
        if not pr.is_synthetic:
            has_real_pr = True
        proj = db.query(Project).filter(Project.id == pr.project_id).first()
        pname = proj.name if proj else pr.project_id
        if pr.project_id not in repo_map:
            repo_map[pr.project_id] = {
                "id": pr.project_id,
                "name": pname,
                "pr_count": 0,
                "is_connected": proj.is_github_connected if proj else False
            }
        repo_map[pr.project_id]["pr_count"] += 1

    is_demo = not has_real_pr

    from app.services.trust_engine import TrustEvaluationEngine
    try:
        eval_res = TrustEvaluationEngine.evaluate(db, c.id, viewing_project_id)
        trust_score = round(eval_res.trust_confidence, 2)
    except Exception:
        if c.reputation_state == "ESTABLISHED":
            trust_score = 0.95
        elif c.reputation_state == "UNDER REVIEW":
            trust_score = 0.35
        elif c.reputation_state == "INSUFFICIENT EVIDENCE":
            trust_score = 0.50
        else:
            trust_score = 0.60

    return ContributorOut(
        id=c.id,
        username=c.username,
        display_name=c.display_name or c.username,
        avatar_url=c.avatar_url or "",
        github_url=c.github_url or f"https://github.com/{c.username}",
        bio=c.bio or "",
        skills=c.skills,
        reputation_state=c.reputation_state or "NEWCOMER",
        total_contributions=c.total_contributions or 0,
        first_seen_at=c.first_seen_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
        vouches=vouches_out,
        denouncements=denounce_out,
        trust_score=trust_score,
        repositories=list(repo_map.values()),
        is_demo=is_demo
    )

@router.get("", response_model=List[ContributorOut])
def list_contributors(
    search: Optional[str] = Query(None, description="Search by username or display name"),
    reputation_state: Optional[str] = Query(None, description="Filter by state (NEWCOMER, INSUFFICIENT EVIDENCE, ESTABLISHED, UNDER REVIEW)"),
    project_id: Optional[str] = Query(None, description="Filter by repository / project ID"),
    include_demo: Optional[bool] = Query(None, description="Whether to include synthetic demo contributors"),
    db: Session = Depends(get_db)
):
    query = db.query(Contributor)
    if search:
        s = f"%{search.lower()}%"
        query = query.filter((Contributor.username.ilike(s)) | (Contributor.display_name.ilike(s)))
    if reputation_state:
        query = query.filter(Contributor.reputation_state == reputation_state)

    contributors = query.all()
    results = [serialize_contributor(c, db, project_id) for c in contributors]

    # If real contributors exist and user didn't ask for demo, hide demo profiles
    has_real_contributors = any(not r.is_demo for r in results)
    if has_real_contributors and include_demo is not True:
        results = [r for r in results if not r.is_demo]

    # Filter by project_id if provided
    if project_id and project_id != "ALL":
        results = [r for r in results if any(repo.get("id") == project_id for repo in r.repositories)]

    # Sort so most trusted people appear first (highest trust_score, then vouches, then contributions)
    results.sort(
        key=lambda r: (
            r.trust_score if r.trust_score is not None else 0.0,
            len(r.vouches) if r.vouches else 0,
            r.total_contributions if r.total_contributions else 0,
        ),
        reverse=True
    )

    return results

@router.get("/{contributor_id}", response_model=ContributorOut)
def get_contributor(contributor_id: str, db: Session = Depends(get_db)):
    c = db.query(Contributor).filter(
        (Contributor.id == contributor_id) | (Contributor.username == contributor_id)
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Contributor {contributor_id} not found")
    return serialize_contributor(c, db)

@router.post("", response_model=ContributorOut, status_code=status.HTTP_201_CREATED)
def create_contributor(data: ContributorCreate, db: Session = Depends(get_db)):
    uname = data.username.strip().lstrip("@").lower()
    if not uname:
        raise HTTPException(status_code=400, detail="Username is required")

    cid = data.id or f"contrib-{uname}"
    existing = db.query(Contributor).filter(
        (Contributor.id == cid) | (Contributor.username == uname)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Contributor with username '@{uname}' already exists")

    # Newcomer fairness: newly registered contributors start as NEWCOMER with clean slate
    contrib = Contributor(
        id=cid,
        username=uname,
        display_name=data.display_name.strip() if data.display_name else uname,
        avatar_url=data.avatar_url.strip() if data.avatar_url else f"https://github.com/{uname}.png",
        github_url=data.github_url.strip() if data.github_url else f"https://github.com/{uname}",
        bio=data.bio.strip() if data.bio else "Open source contributor on MergeGuard.",
        skills_json=json.dumps(data.skills if data.skills else []),
        reputation_state="NEWCOMER",
        total_contributions=data.total_contributions or 0
    )
    db.add(contrib)
    db.commit()
    db.refresh(contrib)
    return serialize_contributor(contrib, db)

@router.get("/{contributor_id}/activity")
def get_contributor_activity(contributor_id: str, db: Session = Depends(get_db)):
    c = db.query(Contributor).filter(
        (Contributor.id == contributor_id) | (Contributor.username == contributor_id)
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contributor not found")

    events = []
    # Vouches received
    for v in c.vouches:
        proj = db.query(Project).filter(Project.id == v.source_project_id).first()
        events.append({
            "type": "VOUCH_RECEIVED",
            "title": f"Endorsed by {proj.name if proj else v.source_project_id}",
            "description": v.reason,
            "evidence_url": v.evidence_url,
            "provenance_hash": v.provenance_hash,
            "confidence": v.confidence,
            "timestamp": v.created_at.isoformat()
        })
    # Denouncements received
    for d in c.denouncements:
        proj = db.query(Project).filter(Project.id == d.reporting_project_id).first()
        events.append({
            "type": "REPORT_FILED",
            "title": f"Reported by {proj.name if proj else d.reporting_project_id}",
            "description": d.reason,
            "evidence_url": d.evidence_url,
            "status": d.status,
            "review_notes": d.review_notes,
            "timestamp": d.created_at.isoformat()
        })

    # Verified GitHub Pull Requests
    from app.models import GitHubPullRequest
    gh_pulls = db.query(GitHubPullRequest).filter(
        GitHubPullRequest.author_username == c.username
    ).all()
    for gh in gh_pulls:
        proj = db.query(Project).filter(Project.id == gh.project_id).first()
        events.append({
            "type": "GITHUB_PR",
            "title": f"GitHub PR #{gh.pr_number}: {gh.title}",
            "description": f"Target: {gh.base_branch} | Commits: {gh.commit_count} | Review: {gh.review_status}",
            "evidence_url": gh.html_url,
            "verification_status": gh.verification_status,
            "state": gh.state,
            "is_merged": gh.is_merged,
            "timestamp": gh.created_at.isoformat() if gh.created_at else utc_now().isoformat()
        })

    events.sort(key=lambda x: x["timestamp"], reverse=True)
    return {
        "contributor_id": c.id,
        "username": c.username,
        "reputation_state": c.reputation_state,
        "total_contributions": c.total_contributions,
        "timeline": events
    }
