from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field

class ExecutionMode(str, Enum):
    AI_INFERENCE = "AI_INFERENCE"
    DETERMINISTIC_HEURISTIC_FALLBACK = "DETERMINISTIC_HEURISTIC_FALLBACK"

class AnalysisMetadata(BaseModel):
    provider: str
    model: str
    execution_mode: ExecutionMode
    fallback_reason: Optional[str] = None
    advisory_only: bool = True
    latency_ms: float = 0.0
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==========================================
# 1. Vouch Evidence Analysis
# ==========================================

class VouchAnalysisRequest(BaseModel):
    vouch_id: Optional[str] = Field(default=None, max_length=100)
    submitter_id: str = Field(..., min_length=1, max_length=150)
    recipient_id: str = Field(..., min_length=1, max_length=150)
    project_id: str = Field(..., min_length=1, max_length=150)
    context_notes: str = Field(..., min_length=1, max_length=8000)
    evidence_links: List[str] = Field(default_factory=list, max_length=20)
    cryptographic_hash: Optional[str] = Field(default=None, max_length=128)

class VouchAnalysisResponse(BaseModel):
    advisory_only: bool = True
    endorsement_quality: str
    verified_evidence: List[str]
    allegations_or_claims: List[str]
    confidence_assessment: str
    investigation_checklist: List[str]
    explanation: str
    metadata: AnalysisMetadata

# ==========================================
# 2. Denouncement Evidence Analysis
# ==========================================

class DenouncementAnalysisRequest(BaseModel):
    denouncement_id: Optional[str] = Field(default=None, max_length=100)
    reporter_id: str = Field(..., min_length=1, max_length=150)
    accused_id: str = Field(..., min_length=1, max_length=150)
    project_id: str = Field(..., min_length=1, max_length=150)
    allegation_type: str = Field(default="AI_SLOP_SPAM", max_length=100)
    allegation_details: str = Field(..., min_length=1, max_length=8000)
    evidence_urls: List[str] = Field(default_factory=list, max_length=20)
    diff_snippet: Optional[str] = Field(default=None, max_length=4000)

class DenouncementAnalysisResponse(BaseModel):
    advisory_only: bool = True
    allegation_classification: str
    verified_evidence: List[str]
    unverified_allegations: List[str]
    severity_assessment: str
    investigation_checklist: List[str]
    no_automatic_punishment_notice: str = (
        "This assessment is advisory. Maintainer verification is strictly required before any moderation or policy action."
    )
    explanation: str
    metadata: AnalysisMetadata

# ==========================================
# 3. Coordinated Campaign Analysis
# ==========================================

class CampaignAnalysisRequest(BaseModel):
    campaign_cluster_id: Optional[str] = Field(default=None, max_length=100)
    suspected_contributor_ids: List[str] = Field(..., min_length=1, max_length=50)
    affected_project_ids: List[str] = Field(..., min_length=1, max_length=50)
    activity_timestamps: List[str] = Field(default_factory=list, max_length=100)
    similarity_indicators: Dict[str, Any] = Field(default_factory=dict)
    sample_pr_titles: List[str] = Field(default_factory=list, max_length=50)

class CampaignAnalysisResponse(BaseModel):
    advisory_only: bool = True
    coordination_signal_strength: str
    cross_repo_pattern_breakdown: List[str]
    shared_template_indicators: List[str]
    similarity_vs_proof_notice: str = (
        "Heuristic and template similarities indicate correlated behavior, not conclusive human-AI attribution. Human maintainer triage is required."
    )
    investigation_checklist: List[str]
    explanation: str
    metadata: AnalysisMetadata

# ==========================================
# 4. Contributor Activity Summary
# ==========================================

class ContributorSummaryRequest(BaseModel):
    contributor_id: str = Field(..., min_length=1, max_length=150)
    vouch_count: int = Field(default=0, ge=0)
    denouncement_count: int = Field(default=0, ge=0)
    verified_pr_count: int = Field(default=0, ge=0)
    merged_pr_count: int = Field(default=0, ge=0)
    closed_pr_count: int = Field(default=0, ge=0)
    open_pr_count: int = Field(default=0, ge=0)
    merge_rate_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    pr_samples: List[Dict[str, Any]] = Field(default_factory=list)
    active_projects: List[str] = Field(default_factory=list, max_length=50)
    first_seen_timestamp: Optional[str] = None
    raw_trust_score: Optional[float] = None
    activity_notes: Optional[str] = Field(default=None, max_length=4000)

class ContributorSummaryResponse(BaseModel):
    advisory_only: bool = True
    reputation_status: str
    is_newcomer: bool
    newcomer_neutrality_statement: Optional[str] = None
    verified_merits: List[str]
    unresolved_allegations: List[str]
    investigation_checklist: List[str]
    summary: str
    ai_trust_score: Optional[float] = None
    merge_acceptance_assessment: Optional[str] = None
    pr_stats: Optional[Dict[str, Any]] = None
    metadata: AnalysisMetadata

# ==========================================
# 5. Deterministic Trust Decision Explanation
# ==========================================

class ExplainDecisionRequest(BaseModel):
    contributor_id: str = Field(..., min_length=1, max_length=150)
    project_id: str = Field(..., min_length=1, max_length=150)
    deterministic_score: float = Field(..., ge=-1.0, le=1.0)
    assigned_tier: str = Field(..., max_length=50)
    newcomer_baseline_applied: bool = False
    effective_vouches_weight: float = Field(default=1.0, ge=0.0)
    effective_denouncements_weight: float = Field(default=1.5, ge=0.0)
    policy_thresholds: Dict[str, float] = Field(default_factory=dict)

class ExplainDecisionResponse(BaseModel):
    advisory_only: bool = True
    plain_english_rationale: str
    policy_factor_breakdown: List[str]
    newcomer_fairness_applied: bool
    investigation_checklist: List[str]
    metadata: AnalysisMetadata

# ==========================================
# 6. Deep Code-Aware AI Contributor Investigation
# ==========================================

class CodeIssue(BaseModel):
    file: str
    line: Optional[int] = None
    issue_type: str = "CODE_QUALITY"  # BUG, SECURITY, REGRESSION, MAINTAINABILITY, TESTING_GAP, DESIGN
    severity: str = "MEDIUM"          # HIGH, MEDIUM, LOW, ADVISORY
    description: str
    suggested_fix: Optional[str] = None

class FileAnalysis(BaseModel):
    filename: str
    status: str = "modified"          # modified, added, removed, renamed
    additions: int = 0
    deletions: int = 0
    logic_analyzed: str = ""
    risk_level: str = "LOW"           # LOW, MEDIUM, HIGH
    security_and_bugs_notes: Optional[str] = None

class ContributorEvidenceInvestigationRequest(BaseModel):
    contributor_id: str = Field(..., min_length=1, max_length=150)
    viewing_project_id: Optional[str] = Field(default=None, max_length=150)
    current_pr_number: Optional[int] = Field(default=None)
    force_refresh: bool = Field(default=False)

class ContributorBackgroundAssessment(BaseModel):
    engineering_quality_rating: Optional[float] = None  # 0.0 to 1.0, or None if insufficient evidence
    is_insufficient_evidence: bool = False
    rubric_breakdown: Dict[str, float] = Field(default_factory=dict)
    technical_strengths: List[str] = Field(default_factory=list)
    recurring_weaknesses: List[str] = Field(default_factory=list)
    historical_consistency: str = ""
    problem_solving_ability: str = ""
    complexity_assessment: str = ""
    testing_habits: str = ""
    feedback_responsiveness: str = ""
    positive_engineering_signals: List[str] = Field(default_factory=list)
    potential_technical_concerns: List[str] = Field(default_factory=list)
    summary: str = ""

class CurrentPRAssessment(BaseModel):
    pr_number: Optional[int] = None
    repo_name: Optional[str] = None
    title: Optional[str] = None
    verdict: str = "NOT_APPLICABLE"  # READY_TO_MERGE, NEEDS_REVISION, SECURITY_TRIAGE_RECOMMENDED, LOW_RISK, INSUFFICIENT_TESTS, NOT_APPLICABLE
    implementation_quality_rating: Optional[float] = None
    overall_summary: str = ""
    code_issues: List[CodeIssue] = Field(default_factory=list)
    file_analyses: List[FileAnalysis] = Field(default_factory=list)
    code_review_findings: List[str] = Field(default_factory=list)
    correctness_and_edge_cases: str = ""
    security_concerns: str = ""
    test_coverage_evaluation: str = ""
    test_files_detected: List[str] = Field(default_factory=list)
    maintainability_and_architecture: str = ""
    problem_solution_alignment: str = ""
    recommendations: List[str] = Field(default_factory=list)

class EvidenceConfidence(BaseModel):
    confidence_level: str = "LOW"    # HIGH, MEDIUM, LOW, INSUFFICIENT
    completeness_score: float = Field(default=0.5, ge=0.0, le=1.0)
    coverage_status: str = "PARTIAL_ANALYSIS"  # FULL_CODE_ANALYSIS, PARTIAL_ANALYSIS, INSUFFICIENT_EVIDENCE
    total_prs_available: int = 0
    prs_inspected_count: int = 0
    sampling_strategy_explained: str = ""
    files_analyzed_count: int = 0
    lines_analyzed_count: int = 0
    deep_diffs_analyzed: int = 0
    repos_spanned: int = 0
    missing_evidence_notes: List[str] = Field(default_factory=list)
    data_limitations: str = ""
    is_supported_by_code: bool = True

class ContributorEvidenceInvestigationResponse(BaseModel):
    advisory_only: bool = True
    contributor_id: str
    username: str
    github_profile_url: str = ""
    background_assessment: ContributorBackgroundAssessment
    current_pr_assessment: CurrentPRAssessment
    evidence_confidence: EvidenceConfidence
    investigation_checklist: List[str] = Field(default_factory=list)
    pr_records: List[Dict[str, Any]] = Field(default_factory=list)
    secret_redaction_applied: bool = False
    last_synced_at: Optional[str] = None
    is_cached: bool = False
    metadata: AnalysisMetadata
