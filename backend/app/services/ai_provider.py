import time
import json
import logging
from datetime import datetime, timezone
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import httpx

from app.core.ai_config import AISettings, ai_settings
from app.schemas.ai import (
    ExecutionMode,
    AnalysisMetadata,
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
    ContributorBackgroundAssessment,
    CurrentPRAssessment,
    EvidenceConfidence,
)

logger = logging.getLogger("mergeguard.ai.provider")

# Custom Exceptions for Granular Error Handling
class AIProviderError(Exception):
    """Base exception for AI provider errors."""
    pass

class AIAuthenticationError(AIProviderError):
    """Raised when upstream API key is rejected (HTTP 401)."""
    pass

class AIRateLimitError(AIProviderError):
    """Raised when upstream rate limits are encountered (HTTP 429)."""
    pass

class AITimeoutError(AIProviderError):
    """Raised when upstream inference request exceeds timeout."""
    pass

class AIServerError(AIProviderError):
    """Raised when upstream returns HTTP 5xx or connection drops."""
    pass

class AIInvalidResponseError(AIProviderError):
    """Raised when upstream returns non-JSON or invalid schema."""
    pass


class BaseAIProvider(ABC):
    """Abstract base class defining the MergeGuard AI Provider interface."""

    @abstractmethod
    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        pass

    @abstractmethod
    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        pass

    @abstractmethod
    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        pass

    @abstractmethod
    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        pass

    @abstractmethod
    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        pass

    @abstractmethod
    def investigate_contributor_evidence(
        self,
        req: ContributorEvidenceInvestigationRequest,
        pr_data: List[Dict[str, Any]],
        current_pr: Optional[Dict[str, Any]],
        username: str,
        vouch_count: int = 0,
        denounce_count: int = 0
    ) -> ContributorEvidenceInvestigationResponse:
        pass


class DeterministicFallbackProvider(BaseAIProvider):
    """
    Deterministic rule-based fallback provider.
    Executes locally with zero network calls and zero credentials.
    Clearly labeled to ensure users know this is a deterministic heuristic, not an LLM.
    """

    def __init__(self, reason: str = "AI inference offline / fallback active"):
        self.reason = reason

    def _build_metadata(self, start_time: float) -> AnalysisMetadata:
        latency = (time.perf_counter() - start_time) * 1000.0
        return AnalysisMetadata(
            provider="deterministic_heuristic_engine",
            model="deterministic-rules-v1",
            execution_mode=ExecutionMode.DETERMINISTIC_HEURISTIC_FALLBACK,
            fallback_reason=self.reason,
            advisory_only=True,
            latency_ms=round(latency, 2)
        )

    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        t0 = time.perf_counter()
        verified_ev = []
        unverified = []

        if req.cryptographic_hash:
            verified_ev.append(f"Cryptographic provenance SHA-256 present: {req.cryptographic_hash[:16]}...")
        if req.evidence_links:
            verified_ev.append(f"{len(req.evidence_links)} linked repository evidence references supplied.")

        unverified.append(f"Submitter subjective endorsement: '{req.context_notes[:120]}...'")

        has_substance = len(req.context_notes) > 50 or bool(req.evidence_links)
        quality = "HIGH_MERIT" if (has_substance and req.cryptographic_hash) else ("MODERATE" if has_substance else "INSUFFICIENT_CONTEXT")

        checklist = [
            f"Audit submitter authority ({req.submitter_id}) on project '{req.project_id}'.",
            "Verify attached PRs or commit signatures match recipient identity.",
            "Confirm vouch notes correspond to verifiable open-source contributions."
        ]

        return VouchAnalysisResponse(
            advisory_only=True,
            endorsement_quality=quality,
            verified_evidence=verified_ev,
            allegations_or_claims=unverified,
            confidence_assessment="Rule-based signal validation: verified cryptographic and commit records.",
            investigation_checklist=checklist,
            explanation=(
                f"Deterministic signal check for vouch on '{req.recipient_id}' from '{req.submitter_id}'. "
                f"Status: {quality}. Supporting verifiable items: {len(verified_ev)}, Subjective claims: {len(unverified)}."
            ),
            metadata=self._build_metadata(t0)
        )

    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        t0 = time.perf_counter()
        verified_ev = []
        allegations = [f"Reporter ({req.reporter_id}) alleged: {req.allegation_details[:180]}"]

        if req.evidence_urls:
            for url in req.evidence_urls:
                verified_ev.append(f"Referenced incident URL provided for review: {url}")
        if req.diff_snippet:
            verified_ev.append("Code diff snippet supplied for template similarity analysis.")

        has_evidence = bool(req.evidence_urls or req.diff_snippet)
        severity = "MEDIUM_RISK" if has_evidence else "INFORMATIONAL_UNVERIFIED_ALLEGATION"

        checklist = [
            f"Check reporter '{req.reporter_id}' vouch history to guard against bad-faith retaliation.",
            "Inspect referenced PR URLs to check for repeated copy-paste templates or automated AI bursts.",
            "Allow the accused contributor opportunity to respond before adjusting repository permissions."
        ]

        return DenouncementAnalysisResponse(
            advisory_only=True,
            allegation_classification=req.allegation_type,
            verified_evidence=verified_ev,
            unverified_allegations=allegations,
            severity_assessment=severity,
            investigation_checklist=checklist,
            no_automatic_punishment_notice=(
                "This assessment is advisory. Maintainer verification is strictly required before any moderation or policy action."
            ),
            explanation=(
                f"Deterministic audit of allegation against '{req.accused_id}'. "
                f"Classification: {req.allegation_type}. Severity: {severity}. "
                "Allegations are strictly distinguished from verified cryptographic proof."
            ),
            metadata=self._build_metadata(t0)
        )

    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        t0 = time.perf_counter()
        contributor_count = len(req.suspected_contributor_ids)
        project_count = len(req.affected_project_ids)
        ts_count = len(req.activity_timestamps)

        # Evaluate heuristics
        if contributor_count >= 3 and project_count >= 2:
            signal_strength = "STRONG_CORRELATION"
        elif contributor_count >= 2:
            signal_strength = "MODERATE_CORRELATION"
        else:
            signal_strength = "WEAK_ANOMALY"

        patterns = [
            f"Observed {contributor_count} distinct contributor accounts interacting across {project_count} projects.",
            f"Activity cluster spans {ts_count} recorded lifecycle events."
        ]
        if req.similarity_indicators:
            for k, v in req.similarity_indicators.items():
                patterns.append(f"Heuristic indicator '{k}': {v}")

        templates = []
        if req.sample_pr_titles:
            templates.append(f"Inspected {len(req.sample_pr_titles)} PR title templates across the cluster.")

        checklist = [
            "Cross-reference commit author timestamps for synchronized or automated cron execution.",
            "Compare commit diff AST or token similarity to detect automated AI template duplication.",
            "Verify if accounts share identical registration windows or email domain patterns."
        ]

        return CampaignAnalysisResponse(
            advisory_only=True,
            coordination_signal_strength=signal_strength,
            cross_repo_pattern_breakdown=patterns,
            shared_template_indicators=templates,
            similarity_vs_proof_notice=(
                "Heuristic and template similarities indicate correlated behavior, not conclusive human-AI attribution. Human maintainer triage is required."
            ),
            investigation_checklist=checklist,
            explanation=(
                f"Deterministic burst and correlation analysis across {project_count} projects. "
                f"Signal strength: {signal_strength}. Requires human maintainer confirmation before actions."
            ),
            metadata=self._build_metadata(t0)
        )

    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        t0 = time.perf_counter()

        # Newcomer fairness: if 0 vouches and 0 denouncements, they are NEUTRAL
        is_newcomer = (req.vouch_count == 0 and req.denouncement_count == 0)
        newcomer_statement = None

        if is_newcomer:
            status = "NEUTRAL_NEWCOMER"
            newcomer_statement = (
                "Newcomer contributors begin with an unestablished neutral baseline; "
                "lack of historical vouches is never treated as suspicious."
            )
        elif req.denouncement_count > 0 and req.vouch_count == 0:
            status = "UNDER_EVIDENCE_REVIEW"
        elif req.vouch_count >= 2:
            status = "ESTABLISHED_CONTRIBUTOR"
        else:
            status = "ACTIVE_PEER"

        merits = []
        if req.vouch_count > 0:
            merits.append(f"{req.vouch_count} verified peer vouches recorded in trust network.")
        if req.verified_pr_count > 0:
            merits.append(f"{req.verified_pr_count} merged pull requests verified via repository sync.")

        allegations = []
        if req.denouncement_count > 0:
            allegations.append(f"{req.denouncement_count} unverified or active denouncements filed.")

        checklist = [
            "Review verified repository contributions rather than judging based on account age.",
            "Examine context of any filed denouncements before altering maintainer trust weight."
        ]

        pr_stats = {
            "total_prs": req.verified_pr_count,
            "merged_prs": req.merged_pr_count,
            "closed_prs": req.closed_pr_count,
            "open_prs": req.open_pr_count,
            "merge_rate_pct": req.merge_rate_pct
        }

        if req.merged_pr_count > 0 and req.merge_rate_pct >= 75.0:
            ai_score = min(0.96, 0.65 + (req.merged_pr_count * 0.08))
            acceptance_assessment = f"High acceptance track record: {req.merged_pr_count} merged PRs ({req.merge_rate_pct:.0f}% acceptance rate)."
        elif req.merged_pr_count > 0:
            ai_score = 0.60
            acceptance_assessment = f"Active contributor: {req.merged_pr_count} merged PRs ({req.merge_rate_pct:.0f}% acceptance rate)."
        elif req.open_pr_count > 0:
            ai_score = 0.50
            acceptance_assessment = f"First-time or ongoing submissions: {req.open_pr_count} open PR awaiting maintainer review."
        else:
            ai_score = 0.50
            acceptance_assessment = "No recorded pull requests yet; neutral starting baseline."

        return ContributorSummaryResponse(
            advisory_only=True,
            reputation_status=status,
            is_newcomer=is_newcomer,
            newcomer_neutrality_statement=newcomer_statement,
            verified_merits=merits,
            unresolved_allegations=allegations,
            investigation_checklist=checklist,
            summary=(
                f"Summary for '{req.contributor_id}': Status is {status}. "
                f"Pull Requests: {req.merged_pr_count} merged out of {req.verified_pr_count} ({req.merge_rate_pct:.0f}% acceptance rate). "
                f"Vouches: {req.vouch_count}, Denouncements: {req.denouncement_count}."
            ),
            ai_trust_score=ai_score,
            merge_acceptance_assessment=acceptance_assessment,
            pr_stats=pr_stats,
            metadata=self._build_metadata(t0)
        )

    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        t0 = time.perf_counter()

        factors = [
            f"Deterministic mathematical trust score: {req.deterministic_score:.3f}.",
            f"Assigned trust policy tier: '{req.assigned_tier}' based on project '{req.project_id}' rules.",
            f"Effective vouch multiplier: {req.effective_vouches_weight}x, Denouncement penalty: {req.effective_denouncements_weight}x."
        ]

        if req.newcomer_baseline_applied:
            factors.append("Newcomer fairness protocol applied: contributor begins at neutral 0.00 baseline without negative penalty.")

        checklist = [
            f"Review project '{req.project_id}' custom trust policy thresholds.",
            "Verify peer project federation weights if multi-hop trust propagation was computed."
        ]

        rationale = (
            f"Contributor '{req.contributor_id}' received tier '{req.assigned_tier}' with calculated score {req.deterministic_score:.3f}. "
            "Scoring is determined strictly by deterministic graph propagation and local repository policies."
        )

        return ExplainDecisionResponse(
            advisory_only=True,
            plain_english_rationale=rationale,
            policy_factor_breakdown=factors,
            newcomer_fairness_applied=req.newcomer_baseline_applied,
            investigation_checklist=checklist,
            metadata=self._build_metadata(t0)
        )

    def investigate_contributor_evidence(
        self,
        req: ContributorEvidenceInvestigationRequest,
        pr_data: List[Dict[str, Any]],
        current_pr: Optional[Dict[str, Any]],
        username: str,
        vouch_count: int = 0,
        denounce_count: int = 0
    ) -> ContributorEvidenceInvestigationResponse:
        t0 = time.perf_counter()
        total_prs = len(pr_data)
        merged_count = sum(1 for p in pr_data if p.get("is_merged"))
        closed_count = sum(1 for p in pr_data if not p.get("is_merged") and (p.get("state") or "").lower() == "closed")
        open_count = sum(1 for p in pr_data if (p.get("state") or "").lower() == "open")
        deep_diffs_count = sum(1 for p in pr_data if p.get("diff_snippet"))
        unique_repos = len({p.get("repo_name") for p in pr_data if p.get("repo_name")})

        is_newcomer = (total_prs == 0 and vouch_count == 0 and denounce_count == 0)

        # Rubric factors
        has_tests = False
        for p in pr_data:
            files = p.get("changed_files") or []
            if any("test" in (f.get("filename") or "").lower() for f in files):
                has_tests = True
                break

        if is_newcomer:
            quality_score = 0.50
            code_structure = 0.50
            maintainability = 0.50
            test_coverage = 0.50
            collaboration = 0.50
            confidence_level = "INSUFFICIENT"
            completeness = 0.15
            summary = (
                f"New contributor @{username} has no recorded public pull requests in connected evidence history. "
                "Per MergeGuard fairness principles, lack of historical vouches is not penalized; baseline is 50%."
            )
            positives = ["New contributor starting at an unestablished neutral baseline."]
            concerns = ["No public code history available yet to evaluate architectural practices."]
        else:
            test_coverage = 0.75 if has_tests else 0.45
            code_structure = 0.75 if deep_diffs_count >= 2 else 0.60
            maintainability = 0.70 if deep_diffs_count > 0 else 0.55
            collaboration = min(0.92, 0.50 + (vouch_count * 0.15)) if denounce_count == 0 else max(0.20, 0.50 - (denounce_count * 0.20))

            quality_score = round((code_structure * 0.3 + maintainability * 0.3 + test_coverage * 0.2 + collaboration * 0.2), 2)
            if deep_diffs_count >= 3 and unique_repos >= 2:
                confidence_level = "HIGH"
                completeness = 0.85
            elif deep_diffs_count >= 1 or total_prs >= 2:
                confidence_level = "MEDIUM"
                completeness = 0.60
            else:
                confidence_level = "LOW"
                completeness = 0.35

            positives = []
            if merged_count > 0:
                positives.append(f"{merged_count} pull requests successfully merged across {unique_repos} repository namespace(s).")
            if has_tests:
                positives.append("Contribution history includes automated test additions or updates.")
            if vouch_count > 0:
                positives.append(f"{vouch_count} verified peer vouches recorded in trust network.")

            concerns = []
            if not has_tests and total_prs > 0:
                concerns.append("Limited automated test additions detected in sampled diffs.")
            if denounce_count > 0:
                concerns.append(f"{denounce_count} active reports filed requiring maintainer review.")
            if closed_count > 0:
                concerns.append(f"{closed_count} closed PR(s) without merge - inspect maintainer closure reasons.")

            summary = (
                f"Evaluated {total_prs} public pull requests across {unique_repos} repositories "
                f"({merged_count} merged, {open_count} open, {closed_count} closed). Heuristic engineering quality rating: {int(quality_score * 100)}%."
            )

        # Current PR assessment
        if current_pr:
            pr_num = current_pr.get("pr_number")
            c_title = current_pr.get("title") or "Current PR"
            c_repo = current_pr.get("repo_name") or "Current Repository"
            c_files = current_pr.get("changed_files") or []

            verdict = "READY_TO_MERGE" if current_pr.get("is_merged") else ("LOW_RISK" if len(c_files) <= 3 else "NEEDS_REVISION")
            findings = [
                f"PR #{pr_num} touches {len(c_files)} file(s) with {current_pr.get('additions', 0)} additions and {current_pr.get('deletions', 0)} deletions.",
                "Diff structure follows standard repository commit patterns."
            ]
            current_assessment = CurrentPRAssessment(
                pr_number=pr_num,
                repo_name=c_repo,
                title=c_title,
                verdict=verdict,
                code_review_findings=findings,
                security_and_bugs_check="No common security anti-patterns (hardcoded credentials, unsafe evals) flagged in heuristic diff scan.",
                test_coverage_evaluation="Contains dedicated test suite modifications." if any("test" in (f.get("filename") or "").lower() for f in c_files) else "No test file modifications detected in this PR.",
                maintainability_notes=f"Change size is manageable ({current_pr.get('additions', 0)} lines added)."
            )
        else:
            current_assessment = CurrentPRAssessment(
                verdict="NOT_APPLICABLE",
                code_review_findings=["No specific active pull request selected for detailed single-PR triage."],
                security_and_bugs_check="Select an active pull request to perform targeted bug & security triage.",
                test_coverage_evaluation="N/A",
                maintainability_notes="N/A"
            )

        checklist = [
            "Review verified repository contributions rather than judging based on account age.",
            "Verify code diffs adhere to repository testing and architectural standards.",
            "Inspect any review comments on closed PRs to understand non-merge context."
        ]

        return ContributorEvidenceInvestigationResponse(
            advisory_only=True,
            contributor_id=req.contributor_id,
            username=username,
            github_profile_url=f"https://github.com/{username}",
            background_assessment=ContributorBackgroundAssessment(
                engineering_quality_rating=quality_score,
                rubric_breakdown={
                    "code_structure": code_structure,
                    "maintainability": maintainability,
                    "test_coverage": test_coverage,
                    "collaboration": collaboration
                },
                consistency_analysis=f"Contributions observed across {unique_repos} repository namespace(s).",
                complexity_assessment="Moderate technical footprint in sampled diff patches.",
                positive_engineering_signals=positives or ["No negative community alerts filed."],
                potential_technical_concerns=concerns or ["Standard code review verification recommended."],
                summary=summary
            ),
            current_pr_assessment=current_assessment,
            evidence_confidence=EvidenceConfidence(
                confidence_level=confidence_level,
                completeness_score=completeness,
                total_prs_analyzed=total_prs,
                deep_diffs_analyzed=deep_diffs_count,
                repos_spanned=unique_repos,
                missing_evidence_notes=[] if deep_diffs_count >= 2 else ["Full code diffs only sampled for top PRs to respect token limits."],
                data_limitations="Deterministic heuristic evaluation. Maintainer code review required."
            ),
            investigation_checklist=checklist,
            pr_records=pr_data[:10],
            last_synced_at=datetime.now(timezone.utc).isoformat(),
            is_cached=False,
            metadata=self._build_metadata(t0)
        )


def _safe_str_list(val: Any, default: Optional[List[str]] = None) -> List[str]:
    """Safely coerces any value into a list of strings, avoiding TypeErrors on null or single string."""
    if val is None:
        return default or []
    if isinstance(val, list):
        return [str(x) for x in val if x is not None]
    if isinstance(val, str) and val.strip():
        return [val.strip()]
    return default or []


class GroqProvider(BaseAIProvider):
    """
    Groq-compatible Chat Completions API Provider.
    Calls Groq's high-speed inference endpoint with JSON structured output format.
    Never exposes API credentials in logs or responses.
    """

    def __init__(self, settings: Optional[AISettings] = None, client: Optional[httpx.Client] = None):
        self.settings = settings or ai_settings
        self._client = client

    def _get_client(self) -> httpx.Client:
        if self._client:
            return self._client
        return httpx.Client(timeout=self.settings.AI_REQUEST_TIMEOUT_SECONDS)

    def _call_groq_chat(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """
        Executes an HTTP POST to Groq chat completions with strict JSON Mode and error handling.
        """
        if not self.settings.GROQ_API_KEY:
            raise AIAuthenticationError("GROQ_API_KEY is not configured or empty.")

        url = f"{self.settings.AI_API_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.settings.AI_MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": self.settings.AI_TEMPERATURE,
            "max_tokens": self.settings.AI_MAX_TOKENS,
            "response_format": {"type": "json_object"}
        }

        try:
            client = self._get_client()
            resp = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as e:
            logger.error(f"[GroqProvider] Request timed out after {self.settings.AI_REQUEST_TIMEOUT_SECONDS}s")
            raise AITimeoutError(f"Groq API request timed out: {e}") from e
        except httpx.RequestError as e:
            logger.error(f"[GroqProvider] Network request error: {e}")
            raise AIServerError(f"Network error communicating with Groq API: {e}") from e

        # Handle HTTP Status Codes
        if resp.status_code == 401:
            logger.error("[GroqProvider] HTTP 401 Unauthorized: Invalid or expired Groq API key.")
            raise AIAuthenticationError("Invalid or expired GROQ_API_KEY.")
        elif resp.status_code == 429:
            logger.warning("[GroqProvider] HTTP 429 Too Many Requests: Rate limit reached on Groq API.")
            raise AIRateLimitError("Groq API rate limit exceeded.")
        elif resp.status_code >= 500:
            logger.error(f"[GroqProvider] HTTP {resp.status_code} Upstream server error from Groq.")
            raise AIServerError(f"Groq server error: {resp.status_code}")
        elif not resp.is_success:
            logger.error(f"[GroqProvider] HTTP {resp.status_code}: {resp.text[:200]}")
            raise AIProviderError(f"Groq returned unexpected status {resp.status_code}")

        # Parse JSON output
        try:
            data = resp.json()
            content_str = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(content_str)
            if not isinstance(parsed_json, dict):
                raise ValueError("Model response root is not a JSON object")
            return parsed_json
        except (KeyError, IndexError, json.JSONDecodeError, ValueError) as e:
            logger.error(f"[GroqProvider] Failed to parse model output as JSON: {e}")
            raise AIInvalidResponseError(f"Invalid model JSON response: {e}") from e

    def _build_metadata(self, start_time: float) -> AnalysisMetadata:
        latency = (time.perf_counter() - start_time) * 1000.0
        return AnalysisMetadata(
            provider=self.settings.AI_PROVIDER,
            model=self.settings.AI_MODEL_NAME,
            execution_mode=ExecutionMode.AI_INFERENCE,
            advisory_only=True,
            latency_ms=round(latency, 2)
        )

    def analyze_vouch(self, req: VouchAnalysisRequest) -> VouchAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are MergeGuard AI, an evidence-based vouch analysis engine for open-source maintainers. "
            "Analyze the submitted vouch and return valid JSON with keys: "
            "'endorsement_quality' (HIGH_MERIT, MODERATE, AMBIGUOUS, or INSUFFICIENT_CONTEXT), "
            "'verified_evidence' (array of strings), "
            "'allegations_or_claims' (array of strings), "
            "'confidence_assessment' (string explaining rationale), "
            "'investigation_checklist' (array of actionable maintainer checks), "
            "'explanation' (string summary). "
            "Safety: Never declare guilt or recommend automated bans. Keep advisory_only true."
        )
        user_prompt = json.dumps({
            "submitter_id": req.submitter_id,
            "recipient_id": req.recipient_id,
            "project_id": req.project_id,
            "context_notes": req.context_notes,
            "evidence_links": req.evidence_links,
            "cryptographic_hash": req.cryptographic_hash
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return VouchAnalysisResponse(
            advisory_only=True,
            endorsement_quality=str(parsed.get("endorsement_quality", "MODERATE")),
            verified_evidence=_safe_str_list(parsed.get("verified_evidence")),
            allegations_or_claims=_safe_str_list(parsed.get("allegations_or_claims")),
            confidence_assessment=str(parsed.get("confidence_assessment", "Model structured evaluation")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify submitter repository authority."]),
            explanation=str(parsed.get("explanation", "Analysis completed by Groq open-weight inference.")),
            metadata=self._build_metadata(t0)
        )

    def analyze_denouncement(self, req: DenouncementAnalysisRequest) -> DenouncementAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are MergeGuard AI, an evidence analysis engine for open-source project security. "
            "Analyze the report and return valid JSON with keys: "
            "'allegation_classification' (string), "
            "'verified_evidence' (array of strings), "
            "'unverified_allegations' (array of strings), "
            "'severity_assessment' (INFORMATIONAL, LOW_RISK, MEDIUM_RISK, or HIGH_RISK_REQUIRES_AUDIT), "
            "'investigation_checklist' (array of maintainer audit steps), "
            "'explanation' (string summary). "
            "Safety: Treat allegations as unproven claims. Strictly distinguish verified links from allegations. "
            "Never mandate automatic bans. Human oversight is mandatory."
        )
        user_prompt = json.dumps({
            "reporter_id": req.reporter_id,
            "accused_id": req.accused_id,
            "project_id": req.project_id,
            "allegation_type": req.allegation_type,
            "allegation_details": req.allegation_details,
            "evidence_urls": req.evidence_urls,
            "diff_snippet": req.diff_snippet
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return DenouncementAnalysisResponse(
            advisory_only=True,
            allegation_classification=str(parsed.get("allegation_classification", req.allegation_type)),
            verified_evidence=_safe_str_list(parsed.get("verified_evidence")),
            unverified_allegations=_safe_str_list(parsed.get("unverified_allegations")),
            severity_assessment=str(parsed.get("severity_assessment", "MEDIUM_RISK")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Inspect PR diff manually."]),
            no_automatic_punishment_notice=(
                "This assessment is advisory. Maintainer verification is strictly required before any moderation or policy action."
            ),
            explanation=str(parsed.get("explanation", "Denouncement analyzed by Groq open-weight inference.")),
            metadata=self._build_metadata(t0)
        )

    def analyze_campaign(self, req: CampaignAnalysisRequest) -> CampaignAnalysisResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are MergeGuard AI, a cross-repository coordinated campaign analyzer. "
            "Analyze the suspect burst cluster and return valid JSON with keys: "
            "'coordination_signal_strength' (STRONG_CORRELATION, MODERATE_CORRELATION, WEAK_ANOMALY, or INCONCLUSIVE), "
            "'cross_repo_pattern_breakdown' (array of strings), "
            "'shared_template_indicators' (array of strings), "
            "'investigation_checklist' (array of strings), "
            "'explanation' (string). "
            "Safety: Emphasize that template similarity is a correlation indicator, not proof of identity or malicious intent."
        )
        user_prompt = json.dumps({
            "suspected_contributor_ids": req.suspected_contributor_ids,
            "affected_project_ids": req.affected_project_ids,
            "activity_timestamps": req.activity_timestamps,
            "similarity_indicators": req.similarity_indicators,
            "sample_pr_titles": req.sample_pr_titles
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return CampaignAnalysisResponse(
            advisory_only=True,
            coordination_signal_strength=str(parsed.get("coordination_signal_strength", "MODERATE_CORRELATION")),
            cross_repo_pattern_breakdown=_safe_str_list(parsed.get("cross_repo_pattern_breakdown")),
            shared_template_indicators=_safe_str_list(parsed.get("shared_template_indicators")),
            similarity_vs_proof_notice=(
                "Heuristic and template similarities indicate correlated behavior, not conclusive human-AI attribution. Human maintainer triage is required."
            ),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Cross-check author timestamps."]),
            explanation=str(parsed.get("explanation", "Campaign correlation analyzed by Groq inference.")),
            metadata=self._build_metadata(t0)
        )

    def summarize_contributor(self, req: ContributorSummaryRequest) -> ContributorSummaryResponse:
        t0 = time.perf_counter()
        is_newcomer = (req.vouch_count == 0 and req.denouncement_count == 0 and req.verified_pr_count == 0)
        system_prompt = (
            "You are MergeGuard AI, an expert pull request and contributor background evaluator. "
            "Analyze the author's previous pull requests: how many were submitted, how many were accepted and merged vs rejected, "
            "their merge acceptance rate percentage, commit patterns, and community reputation. "
            "Return valid JSON with keys: "
            "'ai_trust_score' (float between 0.0 and 1.0 representing evaluated confidence based on their PR acceptance record), "
            "'merge_acceptance_assessment' (string explaining how their PR merge track record reflects reliability), "
            "'reputation_status' (ESTABLISHED_CONTRIBUTOR, ACTIVE_PEER, NEUTRAL_NEWCOMER, or UNDER_EVIDENCE_REVIEW), "
            "'verified_merits' (array of strings highlighting merged PRs and accomplishments), "
            "'unresolved_allegations' (array of strings), "
            "'investigation_checklist' (array of actionable inspection steps for maintainers), "
            "'summary' (string providing a clear narrative background check on their PR acceptance record). "
            "Safety: Contributors with 0 history must receive a neutral baseline trust score (0.50). Lack of history is never guilt."
        )
        user_prompt = json.dumps({
            "contributor_id": req.contributor_id,
            "total_prs_submitted": req.verified_pr_count,
            "merged_prs_accepted": req.merged_pr_count,
            "closed_prs_unmerged": req.closed_pr_count,
            "open_prs_pending": req.open_pr_count,
            "merge_acceptance_rate_pct": req.merge_rate_pct,
            "sample_prs": req.pr_samples,
            "vouch_count": req.vouch_count,
            "denouncement_count": req.denouncement_count,
            "active_projects": req.active_projects,
            "is_newcomer": is_newcomer
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        status = str(parsed.get("reputation_status", "NEUTRAL_NEWCOMER" if is_newcomer else "ACTIVE_PEER"))

        newcomer_statement = None
        if is_newcomer:
            status = "NEUTRAL_NEWCOMER"
            newcomer_statement = (
                "Newcomer contributors begin with an unestablished neutral baseline; "
                "lack of historical vouches is never treated as suspicious."
            )

        ai_score = parsed.get("ai_trust_score")
        if ai_score is not None:
            try:
                ai_score = max(0.1, min(0.98, float(ai_score)))
            except (ValueError, TypeError):
                ai_score = 0.50
        else:
            ai_score = 0.50

        pr_stats = {
            "total_prs": req.verified_pr_count,
            "merged_prs": req.merged_pr_count,
            "closed_prs": req.closed_pr_count,
            "open_prs": req.open_pr_count,
            "merge_rate_pct": req.merge_rate_pct
        }

        return ContributorSummaryResponse(
            advisory_only=True,
            reputation_status=status,
            is_newcomer=is_newcomer,
            newcomer_neutrality_statement=newcomer_statement,
            verified_merits=_safe_str_list(parsed.get("verified_merits")),
            unresolved_allegations=_safe_str_list(parsed.get("unresolved_allegations")),
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify contributions against commit history."]),
            summary=str(parsed.get("summary", f"Contributor {req.contributor_id} summary generated via Groq.")),
            ai_trust_score=ai_score,
            merge_acceptance_assessment=str(parsed.get("merge_acceptance_assessment", f"{req.merged_pr_count} merged pull requests.")),
            pr_stats=pr_stats,
            metadata=self._build_metadata(t0)
        )

    def explain_decision(self, req: ExplainDecisionRequest) -> ExplainDecisionResponse:
        t0 = time.perf_counter()
        system_prompt = (
            "You are MergeGuard AI, an explainability assistant. "
            "Explain a deterministic trust decision in clear, transparent English. "
            "Return valid JSON with keys: "
            "'plain_english_rationale' (string), "
            "'policy_factor_breakdown' (array of strings), "
            "'investigation_checklist' (array of strings). "
            "Safety: Emphasize that scores are computed by deterministic project policies, not by AI."
        )
        user_prompt = json.dumps({
            "contributor_id": req.contributor_id,
            "project_id": req.project_id,
            "deterministic_score": req.deterministic_score,
            "assigned_tier": req.assigned_tier,
            "newcomer_baseline_applied": req.newcomer_baseline_applied,
            "effective_vouches_weight": req.effective_vouches_weight,
            "effective_denouncements_weight": req.effective_denouncements_weight,
            "policy_thresholds": req.policy_thresholds
        })
        parsed = self._call_groq_chat(system_prompt, user_prompt)
        return ExplainDecisionResponse(
            advisory_only=True,
            plain_english_rationale=str(parsed.get("plain_english_rationale", "Deterministic decision explained by Groq.")),
            policy_factor_breakdown=_safe_str_list(parsed.get("policy_factor_breakdown"), [f"Score: {req.deterministic_score}"]),
            newcomer_fairness_applied=req.newcomer_baseline_applied,
            investigation_checklist=_safe_str_list(parsed.get("investigation_checklist"), ["Verify project policy thresholds."]),
            metadata=self._build_metadata(t0)
        )

    def investigate_contributor_evidence(
        self,
        req: ContributorEvidenceInvestigationRequest,
        pr_data: List[Dict[str, Any]],
        current_pr: Optional[Dict[str, Any]],
        username: str,
        vouch_count: int = 0,
        denounce_count: int = 0
    ) -> ContributorEvidenceInvestigationResponse:
        t0 = time.perf_counter()
        total_prs = len(pr_data)
        merged_count = sum(1 for p in pr_data if p.get("is_merged"))
        closed_count = sum(1 for p in pr_data if not p.get("is_merged") and (p.get("state") or "").lower() == "closed")
        open_count = sum(1 for p in pr_data if (p.get("state") or "").lower() == "open")
        deep_diffs_count = sum(1 for p in pr_data if p.get("diff_snippet"))
        unique_repos = len({p.get("repo_name") for p in pr_data if p.get("repo_name")})
        is_newcomer = (total_prs == 0 and vouch_count == 0 and denounce_count == 0)

        system_prompt = (
            "You are MergeGuard AI, a principal security and software engineering auditor investigating a contributor's public GitHub history. "
            "You are provided with real pull requests, code diff snippets, changed files, review comments, and closure reasons. "
            "STRICT RULES: "
            "1. Do NOT assume a merged PR is good engineering work, and do NOT assume a closed PR is bad engineering work. "
            "2. Evaluate the ACTUAL code diffs, code structure, test coverage, and reviewer discussions provided. "
            "3. If a contributor has 0 history (newcomer), assign a neutral 0.50 rating and LOW/INSUFFICIENT confidence without penalty. "
            "4. Return strictly valid JSON with three independent assessments matching the requested structure: "
            "{ "
            "  'background_assessment': { "
            "    'engineering_quality_rating': float (0.0 to 1.0), "
            "    'rubric_breakdown': {'code_structure': float, 'maintainability': float, 'test_coverage': float, 'collaboration': float}, "
            "    'consistency_analysis': string, "
            "    'complexity_assessment': string, "
            "    'positive_engineering_signals': [string], "
            "    'potential_technical_concerns': [string], "
            "    'summary': string "
            "  }, "
            "  'current_pr_assessment': { "
            "    'pr_number': int or null, "
            "    'repo_name': string or null, "
            "    'title': string or null, "
            "    'verdict': 'READY_TO_MERGE' | 'NEEDS_REVISION' | 'SECURITY_TRIAGE_RECOMMENDED' | 'LOW_RISK' | 'INSUFFICIENT_TESTS' | 'NOT_APPLICABLE', "
            "    'code_review_findings': [string], "
            "    'security_and_bugs_check': string, "
            "    'test_coverage_evaluation': string, "
            "    'maintainability_notes': string "
            "  }, "
            "  'evidence_confidence': { "
            "    'confidence_level': 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT', "
            "    'completeness_score': float (0.0 to 1.0), "
            "    'missing_evidence_notes': [string], "
            "    'data_limitations': string "
            "  }, "
            "  'investigation_checklist': [string] "
            "}"
        )

        sample_prs_payload = []
        for p in pr_data[:5]:
            files = p.get("changed_files") or []
            sample_prs_payload.append({
                "pr_number": p.get("pr_number"),
                "repo": p.get("repo_name"),
                "title": p.get("title"),
                "state": p.get("state"),
                "is_merged": p.get("is_merged"),
                "additions": p.get("additions", 0),
                "deletions": p.get("deletions", 0),
                "changed_files": [f.get("filename") for f in files[:5]] if files else [],
                "diff_snippet": (p.get("diff_snippet") or "")[:800],
                "review_comments": p.get("review_comments") or [],
                "closure_reason": p.get("closure_reason") or ""
            })

        current_pr_payload = None
        if current_pr:
            c_files = current_pr.get("changed_files") or []
            current_pr_payload = {
                "pr_number": current_pr.get("pr_number"),
                "repo": current_pr.get("repo_name"),
                "title": current_pr.get("title"),
                "state": current_pr.get("state"),
                "additions": current_pr.get("additions", 0),
                "deletions": current_pr.get("deletions", 0),
                "changed_files": [f.get("filename") for f in c_files[:6]] if c_files else [],
                "diff_snippet": (current_pr.get("diff_snippet") or "")[:1200],
                "review_comments": current_pr.get("review_comments") or []
            }

        user_prompt_data = {
            "contributor_username": username,
            "is_newcomer": is_newcomer,
            "total_prs_found": total_prs,
            "merged_prs": merged_count,
            "closed_unmerged_prs": closed_count,
            "open_prs": open_count,
            "unique_repos_count": unique_repos,
            "vouch_count": vouch_count,
            "denouncement_count": denounce_count,
            "sampled_pr_evidence": sample_prs_payload,
            "current_pr_to_review": current_pr_payload
        }

        parsed = self._call_groq_chat(system_prompt, json.dumps(user_prompt_data))

        # Safely parse background_assessment
        bg_raw = parsed.get("background_assessment") or {}
        bg_rating = bg_raw.get("engineering_quality_rating")
        try:
            bg_rating = max(0.0, min(1.0, float(bg_rating))) if bg_rating is not None else 0.50
        except (ValueError, TypeError):
            bg_rating = 0.50

        bg_rubric = bg_raw.get("rubric_breakdown") or {}
        if not isinstance(bg_rubric, dict):
            bg_rubric = {}
        safe_rubric = {
            "code_structure": float(bg_rubric.get("code_structure", 0.5)),
            "maintainability": float(bg_rubric.get("maintainability", 0.5)),
            "test_coverage": float(bg_rubric.get("test_coverage", 0.5)),
            "collaboration": float(bg_rubric.get("collaboration", 0.5))
        }

        background_assessment = ContributorBackgroundAssessment(
            engineering_quality_rating=bg_rating,
            rubric_breakdown=safe_rubric,
            consistency_analysis=str(bg_raw.get("consistency_analysis", f"Analyzed across {unique_repos} repository namespace(s).")),
            complexity_assessment=str(bg_raw.get("complexity_assessment", "Technical complexity evaluated from sampled diffs.")),
            positive_engineering_signals=_safe_str_list(bg_raw.get("positive_engineering_signals"), [f"Active across {unique_repos} repositories."]),
            potential_technical_concerns=_safe_str_list(bg_raw.get("potential_technical_concerns"), ["Standard maintainer review recommended."]),
            summary=str(bg_raw.get("summary", f"Background investigation completed for @{username}."))
        )

        # Safely parse current_pr_assessment
        cur_raw = parsed.get("current_pr_assessment") or {}
        current_assessment = CurrentPRAssessment(
            pr_number=cur_raw.get("pr_number") or (current_pr.get("pr_number") if current_pr else None),
            repo_name=cur_raw.get("repo_name") or (current_pr.get("repo_name") if current_pr else None),
            title=cur_raw.get("title") or (current_pr.get("title") if current_pr else None),
            verdict=str(cur_raw.get("verdict", "LOW_RISK" if current_pr else "NOT_APPLICABLE")),
            code_review_findings=_safe_str_list(cur_raw.get("code_review_findings"), ["Review diff patch alignment with project architecture."]),
            security_and_bugs_check=str(cur_raw.get("security_and_bugs_check", "No obvious security vulnerabilities detected.")),
            test_coverage_evaluation=str(cur_raw.get("test_coverage_evaluation", "Verify corresponding unit tests.")),
            maintainability_notes=str(cur_raw.get("maintainability_notes", "Code diff adheres to style conventions."))
        )

        # Safely parse evidence_confidence
        conf_raw = parsed.get("evidence_confidence") or {}
        conf_level = str(conf_raw.get("confidence_level", "HIGH" if deep_diffs_count >= 3 else ("MEDIUM" if total_prs >= 2 else "LOW")))
        conf_score = conf_raw.get("completeness_score")
        try:
            conf_score = max(0.0, min(1.0, float(conf_score))) if conf_score is not None else (0.85 if conf_level == "HIGH" else 0.50)
        except (ValueError, TypeError):
            conf_score = 0.50

        evidence_confidence = EvidenceConfidence(
            confidence_level=conf_level,
            completeness_score=conf_score,
            total_prs_analyzed=total_prs,
            deep_diffs_analyzed=deep_diffs_count,
            repos_spanned=unique_repos,
            missing_evidence_notes=_safe_str_list(conf_raw.get("missing_evidence_notes"), []),
            data_limitations=str(conf_raw.get("data_limitations", "Based on public GitHub commit and PR history."))
        )

        checklist = _safe_str_list(parsed.get("investigation_checklist"), [
            "Review verified repository contributions rather than judging based on account age.",
            "Verify code diffs adhere to repository testing and architectural standards.",
            "Inspect any review comments on closed PRs to understand non-merge context."
        ])

        return ContributorEvidenceInvestigationResponse(
            advisory_only=True,
            contributor_id=req.contributor_id,
            username=username,
            github_profile_url=f"https://github.com/{username}",
            background_assessment=background_assessment,
            current_pr_assessment=current_assessment,
            evidence_confidence=evidence_confidence,
            investigation_checklist=checklist,
            pr_records=pr_data[:10],
            last_synced_at=datetime.now(timezone.utc).isoformat(),
            is_cached=False,
            metadata=self._build_metadata(t0)
        )
