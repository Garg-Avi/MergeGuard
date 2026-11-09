from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Contributor, Project, CoordinatedCampaign
from app.services.trust_engine import TrustEvaluationEngine
from app.services.seed_data import seed_database
from app.schemas.ai import (
    VouchAnalysisRequest,
    VouchAnalysisResponse,
    DenouncementAnalysisRequest,
    DenouncementAnalysisResponse,
    CampaignAnalysisRequest,
    CampaignAnalysisResponse,
    ContributorSummaryRequest,
    ContributorSummaryResponse,
    ExplainDecisionRequest,
    ExplainDecisionResponse,
    ContributorEvidenceInvestigationRequest,
    ContributorEvidenceInvestigationResponse,
)
from app.services.ai_service import ai_service, MergeGuardAIService
from app.services.github_service import GitHubService

router = APIRouter(prefix="/api/ai", tags=["AI Analysis Engine"])

def get_ai_service() -> MergeGuardAIService:
    return ai_service

class GeneralExplainRequest(BaseModel):
    target_type: str = Field(..., description="Target type: 'contributor' or 'campaign'")
    target_id: str = Field(..., description="Unique ID of the contributor or campaign cluster")
    viewing_project_id: Optional[str] = Field(None, description="Optional viewing project context")

@router.get("/status", summary="AI Engine Health & Active Provider Status (Alias)")
@router.get("/health", summary="AI Engine Health & Active Provider Status")
def ai_health(service: MergeGuardAIService = Depends(get_ai_service)) -> Dict[str, Any]:
    """
    Returns AI service health, configured provider, active model, and fallback status.
    Credentials and API keys are strictly masked to ensure security.
    """
    return service.get_health_status()

@router.post("/explain", summary="Generate AI Explanation for Target (Contributor or Campaign)")
def explain_target(
    req: GeneralExplainRequest,
    db: Session = Depends(get_db),
    service: MergeGuardAIService = Depends(get_ai_service)
) -> Dict[str, Any]:
    """
    Provides forensic AI or deterministic heuristic summarization for a contributor or campaign cluster.
    Advisory only.
    """
    if req.target_type == "contributor":
        contrib = db.query(Contributor).filter(
            (Contributor.id == req.target_id) | (Contributor.username == req.target_id)
        ).first()
        if not contrib:
            from app.models import GitHubPullRequest
            author_pr = db.query(GitHubPullRequest).filter(
                GitHubPullRequest.author_username == req.target_id
            ).first()
            if author_pr:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                author_key = author_pr.author_username.lower()
                contrib = Contributor(
                    id=f"contrib-gh-{author_key}",
                    username=author_pr.author_username,
                    display_name=author_pr.author_username,
                    avatar_url=author_pr.author_avatar_url or f"https://github.com/{author_pr.author_username}.png",
                    github_url=f"https://github.com/{author_pr.author_username}",
                    bio=f"Open-source contributor to imported repositories.",
                    reputation_state="NEWCOMER",
                    total_contributions=1,
                    first_seen_at=now,
                    created_at=now
                )
                db.add(contrib)
                db.commit()
                db.refresh(contrib)
            else:
                raise HTTPException(status_code=404, detail=f"Contributor '{req.target_id}' not found")

        eval_res = TrustEvaluationEngine.evaluate(db, contrib.id, req.viewing_project_id)
        vouch_count = len(contrib.vouches) if contrib.vouches else 0
        denounce_count = len(contrib.denouncements) if contrib.denouncements else 0

        # Query pull request history
        try:
            GitHubService.sync_contributor_full_history(db, contrib.username, req.viewing_project_id, force_refresh=False)
        except Exception:
            pass

        from app.models import GitHubPullRequest
        prs = db.query(GitHubPullRequest).filter(
            GitHubPullRequest.author_username == contrib.username
        ).all()

        total_prs = len(prs)
        merged_prs = sum(1 for p in prs if p.is_merged)
        open_prs = sum(1 for p in prs if (p.state or "").lower() == "open")
        closed_unmerged = sum(1 for p in prs if not p.is_merged and (p.state or "").lower() == "closed")
        closed_total = merged_prs + closed_unmerged
        merge_rate_pct = round((merged_prs / closed_total * 100), 1) if closed_total > 0 else 0.0

        pr_samples = [
            {
                "pr_number": p.pr_number,
                "title": p.title,
                "state": p.state,
                "is_merged": p.is_merged,
                "commit_count": p.commit_count,
                "review_status": p.review_status
            }
            for p in prs[:6]
        ]

        active_projs = []
        for p in prs:
            proj = db.query(Project).filter(Project.id == p.project_id).first()
            if proj and proj.name not in active_projs:
                active_projs.append(proj.name)
        if not active_projs:
            active_projs = [p.name for p in db.query(Project).all()[:2]]

        summary_req = ContributorSummaryRequest(
            contributor_id=contrib.id,
            vouch_count=vouch_count,
            denouncement_count=denounce_count,
            verified_pr_count=total_prs or contrib.total_contributions or 0,
            merged_pr_count=merged_prs,
            closed_pr_count=closed_unmerged,
            open_pr_count=open_prs,
            merge_rate_pct=merge_rate_pct,
            pr_samples=pr_samples,
            active_projects=active_projs,
            first_seen_timestamp=contrib.first_seen_at.isoformat() if contrib.first_seen_at else None,
            raw_trust_score=eval_res.trust_confidence,
            activity_notes=f"Contributor @{contrib.username} reputation: {eval_res.reputation_state}. Pull Requests: {merged_prs} merged out of {total_prs}."
        )
        ai_res = service.summarize_contributor(summary_req)
        return {
            "summary": ai_res.summary,
            "investigation_checklist": ai_res.investigation_checklist,
            "reputation_status": ai_res.reputation_status,
            "is_newcomer": ai_res.is_newcomer,
            "ai_trust_score": ai_res.ai_trust_score,
            "merge_acceptance_assessment": ai_res.merge_acceptance_assessment,
            "pr_stats": ai_res.pr_stats,
            "metadata": ai_res.metadata.model_dump()
        }

    elif req.target_type == "campaign":
        campaign = db.query(CoordinatedCampaign).filter(CoordinatedCampaign.id == req.target_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail=f"Campaign '{req.target_id}' not found")

        suspected = campaign.contributor_ids or ["contributor-unknown"]
        affected = campaign.affected_projects or ["infrastructure"]
        evidence = campaign.evidence_records or []
        pr_samples = [e.get("pr_title") or e.get("notes") or "Coordinated PR" for e in evidence if isinstance(e, dict)][:5]
        if not pr_samples:
            pr_samples = ["Coordinated commit template across repositories"]

        camp_req = CampaignAnalysisRequest(
            campaign_cluster_id=campaign.id,
            suspected_contributor_ids=suspected,
            affected_project_ids=affected,
            sample_pr_titles=pr_samples,
            similarity_indicators={"signal_strength": campaign.signal_strength, "pattern_type": campaign.pattern_type}
        )
        ai_res = service.analyze_campaign(camp_req)
        return {
            "summary": ai_res.explanation,
            "investigation_checklist": ai_res.investigation_checklist,
            "coordination_signal_strength": ai_res.coordination_signal_strength,
            "metadata": ai_res.metadata.model_dump()
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target_type '{req.target_type}'. Expected 'contributor' or 'campaign'."
        )

@router.post("/investigate", response_model=ContributorEvidenceInvestigationResponse, summary="Evidence-Based Deep Contributor Investigation")
def investigate_contributor(
    req: ContributorEvidenceInvestigationRequest,
    db: Session = Depends(get_db),
    service: MergeGuardAIService = Depends(get_ai_service)
) -> ContributorEvidenceInvestigationResponse:
    """
    Retrieves a contributor's public GitHub contribution history (including unimported repos),
    code diffs, file modifications, and review comments, then conducts a deep engineering
    quality investigation using Groq openai/gpt-oss-120b.
    """
    clean_id = req.contributor_id.strip()
    from sqlalchemy import func
    contrib = db.query(Contributor).filter(
        (Contributor.id == clean_id)
        | (func.lower(Contributor.username) == clean_id.lower())
        | (Contributor.github_id == clean_id)
    ).first()

    # If not matched by ID or username, check display name
    if not contrib:
        contrib = db.query(Contributor).filter(Contributor.display_name.ilike(clean_id)).first()

    username = contrib.username if contrib else clean_id.lstrip("@")
    github_id = contrib.github_id if contrib else None

    # Sync full public cross-repository history strictly for this author
    sync_result = GitHubService.sync_contributor_full_history(
        db=db,
        username=username,
        viewing_project_id=req.viewing_project_id,
        force_refresh=req.force_refresh,
        max_prs=30
    )

    from app.models import GitHubPullRequest
    gh_filter = (func.lower(GitHubPullRequest.author_username) == username.lower())
    if github_id:
        gh_filter = gh_filter | (GitHubPullRequest.author_github_id == github_id)

    prs = db.query(GitHubPullRequest).filter(gh_filter).order_by(GitHubPullRequest.created_at.desc()).all()

    pr_list = []
    current_pr_dict = None

    for p in prs:
        p_dict = {
            "id": p.id,
            "pr_number": p.pr_number,
            "repo_name": p.repo_name or (p.project.name if p.project else "Repository"),
            "title": p.title,
            "description": p.description or "",
            "author_username": p.author_username,
            "author_github_id": p.author_github_id or "",
            "state": p.state,
            "is_merged": p.is_merged,
            "merged_at": p.merged_at.isoformat() if p.merged_at else None,
            "html_url": p.html_url,
            "additions": p.additions or 0,
            "deletions": p.deletions or 0,
            "changed_files": p.changed_files,
            "diff_snippet": p.diff_snippet or "",
            "review_comments": p.review_comments,
            "closure_reason": p.closure_reason or "",
            "verification_status": p.verification_status,
            "is_external": p.is_external,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        pr_list.append(p_dict)
        if req.current_pr_number and p.pr_number == req.current_pr_number:
            current_pr_dict = p_dict

    # Keep current PR investigation strictly separate from general profile history analysis.
    # Do not hijack arbitrary historical PRs when no current PR number was requested.

    vouch_count = len(contrib.vouches) if contrib and contrib.vouches else 0
    denounce_count = len(contrib.denouncements) if contrib and contrib.denouncements else 0

    res = service.investigate_contributor_evidence(
        req=req,
        pr_data=pr_list,
        current_pr=current_pr_dict,
        username=username,
        vouch_count=vouch_count,
        denounce_count=denounce_count
    )
    res.is_cached = sync_result.get("is_cached", False)
    return res

@router.post("/reset-demo", summary="Reset Demonstration Database to Synthetic Demo Baseline")
def reset_demo_database(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Restores all projects, contributors, vouches, denouncements, and coordinated campaigns back to clean synthetic seed data.
    """
    seed_database(db, reset=True)
    return {
        "status": "success",
        "message": "MergeGuard demonstration database restored back to clean synthetic state."
    }

@router.post("/analyze-vouch", response_model=VouchAnalysisResponse, summary="Analyze Vouch Evidence")
def analyze_vouch(
    req: VouchAnalysisRequest,
    service: MergeGuardAIService = Depends(get_ai_service)
) -> VouchAnalysisResponse:
    """
    Evaluates peer vouch notes and cryptographic evidence.
    Returns structured endorsement quality, verified items, and an investigation checklist.
    Strictly advisory.
    """
    return service.analyze_vouch(req)

@router.post("/analyze-denouncement", response_model=DenouncementAnalysisResponse, summary="Analyze Denouncement Evidence")
def analyze_denouncement(
    req: DenouncementAnalysisRequest,
    service: MergeGuardAIService = Depends(get_ai_service)
) -> DenouncementAnalysisResponse:
    """
    Evaluates abuse allegations and submitted diff/incident evidence.
    Strictly separates verified evidence from unverified claims.
    Never declares automated bans or guilt.
    """
    return service.analyze_denouncement(req)

@router.post("/analyze-campaign", response_model=CampaignAnalysisResponse, summary="Analyze Coordinated Activity Cluster")
def analyze_campaign(
    req: CampaignAnalysisRequest,
    service: MergeGuardAIService = Depends(get_ai_service)
) -> CampaignAnalysisResponse:
    """
    Analyzes cross-repository bursts and template similarity indicators.
    Clarifies correlation vs conclusive human/AI proof.
    """
    return service.analyze_campaign(req)

@router.post("/contributor-summary", response_model=ContributorSummaryResponse, summary="Summarize Contributor Trust History")
def summarize_contributor(
    req: ContributorSummaryRequest,
    service: MergeGuardAIService = Depends(get_ai_service)
) -> ContributorSummaryResponse:
    """
    Generates a concise reputation digest.
    Guarantees newcomer neutrality for contributors without prior history.
    """
    return service.summarize_contributor(req)

@router.post("/explain-decision", response_model=ExplainDecisionResponse, summary="Explain Deterministic Trust Decision")
def explain_decision(
    req: ExplainDecisionRequest,
    service: MergeGuardAIService = Depends(get_ai_service)
) -> ExplainDecisionResponse:
    """
    Explains the mathematical scoring and repository trust tier in plain English.
    Confirms newcomer fairness application and active policy weights.
    """
    return service.explain_decision(req)
