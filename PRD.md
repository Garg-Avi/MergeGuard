# Product Requirements Document (PRD) — MergeGuard

> **Every PR. Under the Lens.**  
> An evidence-driven trust and threat intelligence platform for GitHub repositories and contributors.

---

## 1. Document Overview & Metadata

| Attribute | Specification |
| :--- | :--- |
| **Product Name** | MergeGuard |
| **Product Version** | 1.0.0 Production Baseline |
| **Document Status** | Approved / Living Specification |
| **Author / Project Owner** | Avi Garg (`Garg-Avi`) |
| **Repository** | [https://github.com/Garg-Avi/MergeGuard](https://github.com/Garg-Avi/MergeGuard) |
| **License** | Apache License, Version 2.0 |
| **Target Runtime** | FastAPI (Python 3.12+) + React 19 / Vite SPA |

---

## 2. Executive Summary & Problem Statement

### 2.1 The Open-Source Challenge
Open-source maintainers face an unprecedented influx of:
1. **AI-Generated PR Slop**: Automated low-effort docstring mutations, trivial whitespace modifications, and synthetic PR bursts.
2. **Coordinated Sybil Swarms**: Distributed bad actors rotating disposable GitHub accounts to target dozens of repositories simultaneously.
3. **Information Silos**: Each open-source repository operates in isolation. When maintainers block a malicious bot in Repository A, Repositories B and C have no shared provenance ledger to prevent the exact same actor from merging vulnerable code.
4. **Unfair Gatekeeping**: Existing naive reputation tools penalize first-time contributors simply for having a new account, discouraging genuine developers.

### 2.2 The MergeGuard Solution
MergeGuard establishes a **subjective, policy-driven trust network** that connects independent open-source repositories without requiring centralized authority:
- **Zero Blackbox Bias**: Contributor trust scores are computed deterministically by verifiable graph algorithms.
- **Newcomer Fairness Guarantee**: First-time contributors start with a neutral baseline and are never penalized for lack of prior history.
- **Evidence-Backed Consensus**: Every endorsement (**Vouch**) and allegation (**Denouncement**) requires an attributable GitHub PR URL and generates a tamper-evident SHA-256 cryptographic provenance hash.
- **Coordinated Campaign Radar**: Cross-repository burst correlator detecting synchronized token-Jaccard similarities and fast-follow sybil account patterns.
- **Real GitHub API Authenticity**: Validates repository existence, pull request numbers, and commit metadata against canonical GitHub records.

---

## 3. Goals & Non-Goals

### 3.1 Core Goals
- Provide maintainers with real-time trust intelligence when evaluating pull requests.
- Enable repositories to define subjective trust weights toward peer projects.
- Detect cross-repository coordinated abuse before malicious code enters release branches.
- Maintain transparent, explainable decision records using open-weight AI models (GPT-OSS-120B) with 100% deterministic offline fallback.
- Deliver a fast, responsive, GitHub Dark developer experience adhering to Primer design standards.

### 3.2 Non-Goals
- MergeGuard is **not** a continuous integration (CI) runner; it focuses purely on contributor trust, pull request provenance, and abuse detection.
- MergeGuard is **not** an automated pull request auto-merger; final decision-making remains with human maintainers.
- MergeGuard does **not** store private credentials, personal access tokens, or private repository source code.

---

## 4. User Personas & Workflows

### 4.1 Personas
1. **Repository Maintainer**: Needs fast, reliable verification of incoming PRs, wants to protect project queues from automated bot spam, and configures peer trust weights with trusted ecosystem libraries.
2. **Security & Triage Lead**: Investigates coordinated spam campaigns, audits administrative activity, and verifies tamper-evident provenance hashes.
3. **Open-Source Contributor**: Submits pull requests, receives verifiable vouches from maintainers, and builds an authentic cross-repository track record.

### 4.2 Key User Journeys
```mermaid
flowchart TD
    A[Public GitHub Repository] -->|Import URL| B[MergeGuard Repository Ingestion]
    B -->|Synchronize Pull Requests| C[PR Authenticity Verification Service]
    C -->|Fetch Canonical GitHub Records| D{Authenticity Status}
    D -->|Verified| E[Cryptographic Provenance Established]
    D -->|Mismatch / 404| F[Flagged as Unverified Evidence]
    
    G[Incoming Pull Request] --> H[Deterministic Trust Engine]
    H -->|Calculate Subjective Peer Weights| I[Contributor Reputation State]
    I --> J{Reputation State}
    J -->|ESTABLISHED| K[Expedited Review / Peer Endorsed]
    J -->|NEWCOMER| L[Neutral Baseline Fairness Guarantee]
    J -->|UNDER REVIEW| M[Maintainer Triage Required]
    
    N[Cross-Repo Activity Stream] --> O[Campaign Forensic Radar]
    O -->|Token-Jaccard Correlator| P[Coordinated Spam Clusters Flagged]
```

---

## 5. Functional Requirements & Feature Specifications

### 5.1 Repository Management & Subjective Policy Engine
- **Public URL Ingestion**: Users can import any public repository URL (`https://github.com/owner/repo`). Validates syntax, queries GitHub REST API v3, extracts metadata (owner, stars, branch, visibility).
- **Subjective Policy Tuning**:
  - `Strictness`: `lenient` (low barrier), `balanced` (recommended default), `strict` (high security).
  - `Min Confidence Threshold`: Slider (0.10 to 0.95).
  - `Peer Trust Weights`: Autonomous directional weights (0.0 to 1.0) configured toward partner repositories.

### 5.2 Contributor Trust & Fairness Guarantees
- **Reputation States**:
  - `NEWCOMER`: Clean slate baseline. Zero negative deductions applied.
  - `ESTABLISHED`: Backed by multiple verified peer vouches and canonical PR evidence.
  - `UNDER REVIEW`: Active denouncements pending maintainer triage or flagged by Campaign Radar.
  - `INSUFFICIENT EVIDENCE`: Emerging profile requiring further corroboration.
- **Perspective-Driven Scoring**: A contributor’s trust score is calculated from the viewpoint of a specific repository (`viewing_project_id`). Endorsements from trusted peer projects carry full weight, while signals from unpeered projects are appropriately discounted.

### 5.3 Peer Vouch Workflow
- Maintainers can submit vouches for contributors based on genuine code contributions.
- Mandatory fields: Contributor handle, source project, contribution reason, verifiable PR evidence URL, confidence weight (0.1 to 1.0).
- Calculates a SHA-256 tamper-evident provenance hash:
  $$\text{hash} = \text{SHA-256}(\text{source\_project} \parallel \text{contributor} \parallel \text{evidence\_url} \parallel \text{timestamp})$$

### 5.4 Denouncements & Maintainer Triage
- Reports against accounts for coordinated bot spam, malicious diffs, or sybil rotation.
- **Fairness Protection**: Every report initiates in `Pending Review` and is discounted in evaluations until verified.
- **Maintainer Triage**: Authorized maintainers can update status to `Reviewed` (confirmed) or `Dismissed` (false allegation) with audit notes.

### 5.5 Coordinated Campaign Radar (Forensic Pattern Engine)
- Deterministic pattern scanner detecting multi-repository burst PRs using:
  - Token-level Jaccard similarity across PR titles and bodies.
  - Temporal burst clustering (sliding window detection).
  - Commit author time-zone anomaly analysis.
- Maintainer investigation states: `Active Investigation` $\rightarrow$ `Confirmed Coordinated Abuse` / `Dismissed`.

### 5.6 Real GitHub Repository & PR Authenticity Integration
- **GitHub REST API v3 Client**: Direct integration querying repository records and pull request metadata.
- **PR Verification Service**: Verifies repository existence, PR number, owner/repo binding, and canonical URL match.
  - Explicit statuses: `VERIFIED_GITHUB`, `UNABLE_TO_VERIFY`, `VERIFICATION_UNAVAILABLE`.
- **Webhook Receiver**: HMAC-SHA256 signature verification (`X-Hub-Signature-256`) processing real-time `pull_request` events.

### 5.7 Decentralized Trust Federation
- **Export Trust Bundle**: Generates signed JSON bundles containing repository policies, vouches, and peering edges.
- **Import Trust Bundle**: Validates external bundles and merges peer trust signals without central authority lock-in.

### 5.8 Admin Monitoring & Transactional Email Audit Trail
- **Server-Side Activity Stream**: Real-time tracking of sign-ups, sign-ins, repository syncs, and security anomalies.
- **Transactional Email Audit**: Resend API integration dispatching security notifications directly to the administrator (`16avigarg@gmail.com`).
- **Privacy Notice**: Strict exclusion of passwords, JWT secrets, and private repository tokens from notification payloads.

### 5.9 Open-Weight AI Architecture (GPT-OSS-120B)
- Integrates open-weight model **GPT-OSS-120B** (Apache 2.0) for evidence summarization and natural language explanation generation.
- **Deterministic Independence**: All reputation states, weights, and metrics are computed deterministically by the Python engine; the AI model operates strictly as an explanatory layer.
- **Graceful Offline Mode**: Pure deterministic fallback when an external API key is not configured.

---

## 6. Technical Architecture & Tech Stack

```
+--------------------------------------------------------------------------+
|                     Frontend: React 19 + Vite + Tailwind CSS              |
|        GitHub Dark Primer Theme | React Flow Topology (@xyflow/react)    |
+--------------------------------------------------------------------------+
                                     |
                                     | JSON REST API (/api)
                                     v
+--------------------------------------------------------------------------+
|                       Backend: FastAPI (Python 3.12+)                     |
|                                                                          |
|  +-----------------------+  +-----------------------+  +--------------+  |
|  | Trust Engine          |  | Campaign Radar        |  | Federation   |  |
|  | (Deterministic/Policy)|  | (Pattern Forensics)   |  | (Import/Exp) |  |
|  +-----------------------+  +-----------------------+  +--------------+  |
|  | GitHub Service        |  | Activity Logger       |  | Email Svc    |  |
|  | (REST v3 + Webhooks)  |  | (Audit Stream)        |  | (Resend API) |  |
|  +-----------------------+  +-----------------------+  +--------------+  |
|                                     |                                    |
|                      +--------------+--------------+                     |
|                      |                             |                     |
|                      v                             v                     |
|           +--------------------+         +--------------------+          |
|           | SQLite Persistence |         | AI Explanation Svc |          |
|           | (SQLAlchemy 2.0)   |         | (GPT-OSS-120B /    |          |
|           +--------------------+         | Deterministic)     |          |
|                                          +--------------------+          |
+--------------------------------------------------------------------------+
```

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19.3 + Vite 8.3 | High-performance SPA frontend |
| **Styling & Theme** | Tailwind CSS v4 | GitHub Dark Primer design system |
| **Graph Visualization** | `@xyflow/react` (v12.12) | Interactive multi-project topological mesh |
| **Icons** | `lucide-react` | Clean developer-tool icon set |
| **Backend Framework** | FastAPI (Python) | High-performance async REST API |
| **Database ORM** | SQLAlchemy 2.0 + SQLite | Structured relational persistence |
| **Testing Engine** | Pytest 9.2 + AnyIO | 71 automated test suites passing |
| **Email Delivery** | Resend API Client | Transactional administrator audit notifications |
| **AI Inference** | Groq Live / Deterministic | GPT-OSS-120B evidence summarization |

---

## 7. UI/UX Design System Specification

### 7.1 GitHub Dark Theme Palette
- **Canvas Default**: `#0D1117`
- **Canvas Subtle (Cards/Sidebar)**: `#161B22`
- **Elevated Surfaces**: `#21262D`
- **Borders**: `#30363D`
- **Primary Text**: `#F0F6FC`
- **Secondary Text**: `#8B949E`
- **Primary Accent (Buttons/Verified)**: `#2DA44E` (Hover: `#3FB950`)
- **Links & Focus**: `#58A6FF`
- **Attention / Warnings**: `#D29922`
- **Danger / Alerts**: `#F85149`

### 7.2 Core Views
1. **Landing Page**: Explains core value proposition, PR check simulation card, and 5 architectural pillars.
2. **Dashboard**: High-level control panel with connected repository counts, contributor distribution bar, active campaigns, and audit activity stream.
3. **Interactive Graph**: React Flow topological graph with project and contributor nodes and inspector side drawer.
4. **Repositories**: Connected repos, public GitHub repo import, policy tuning, and PR authenticity verification.
5. **Contributors**: Contributor directory, reputation state filtering, viewpoint-based evaluations, and AI reasoning.
6. **Vouches & Denouncements**: Submissions, cryptographic provenance, and maintainer triage drawers.
7. **Campaign Radar**: Real-time forensic scan runner, cluster cards, diff samples, and review workflows.
8. **Evidence Center**: Cross-repository immutable supply chain records.
9. **Admin Monitoring**: Event stream, security threat feed, and email notification audit trail.
10. **Settings & Federation**: Signed bundle export/import and demo database reset utility.

---

## 8. Backend API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & system version |
| `GET` | `/api/trust/overview` | Platform metrics, contributor distribution, activity stream |
| `GET` | `/api/trust/evaluate` | Evaluates contributor from viewpoint of `viewing_project_id` |
| `GET` | `/api/network` | Multi-project topology formatted for React Flow |
| `GET` | `/api/projects` | List all federated repositories with policies |
| `POST` | `/api/projects` | Register a new repository with custom trust policy |
| `PATCH` | `/api/projects/{id}` | Update repository policy (strictness, confidence) |
| `POST` | `/api/projects/{id}/peers` | Configure subjective peer trust weight |
| `GET` | `/api/projects/{id}/relationships` | Inspect incoming and outgoing trust peering edges |
| `GET` | `/api/contributors` | List contributors with search and state filtering |
| `POST` | `/api/contributors` | Register a new contributor identity |
| `GET` | `/api/contributors/{id}` | Contributor profile with vouches and allegations |
| `GET` | `/api/contributors/{id}/activity` | Contributor timeline across repositories |
| `GET` | `/api/vouches` | List all positive peer vouches |
| `POST` | `/api/vouches` | Submit a vouch with PR evidence and SHA-256 provenance |
| `GET` | `/api/denouncements` | List anomaly reports with status filtering |
| `POST` | `/api/denouncements` | Submit a report (starts in 'Pending Review') |
| `PATCH` | `/api/denouncements/{id}/status` | Maintainer triage decision (`Reviewed` / `Dismissed`) |
| `GET` | `/api/campaigns` | Coordinated AI slop and sybil campaign radar |
| `POST` | `/api/campaigns/scan` | Trigger real-time deterministic cross-repo pattern scanner |
| `PATCH` | `/api/campaigns/{id}/status` | Update campaign human review triage status |
| `GET` | `/api/evidence` | Cross-repository evidence records |
| `GET` | `/api/federation/export/{id}` | Export signed project trust bundle |
| `POST` | `/api/federation/import` | Import external federation bundle |
| `GET` | `/api/github/status` | GitHub integration and OAuth status |
| `POST` | `/api/github/import-repo` | Import public GitHub repository & sync pull requests |
| `GET` | `/api/github/projects/{id}/pulls` | Fetch imported PRs with authenticity status |
| `POST` | `/api/github/projects/{id}/sync` | Re-synchronize PRs from GitHub API |
| `POST` | `/api/github/verify-pr` | Verify PR authenticity against GitHub canonical records |
| `POST` | `/api/github/webhook` | Webhook receiver with HMAC-SHA256 signature verification |
| `GET` | `/api/admin/metrics` | System telemetry and notification status |
| `GET` | `/api/admin/activities` | Filterable administrative activity stream |
| `GET` | `/api/admin/email-deliveries` | Audit log of dispatched Resend email alerts |
| `POST` | `/api/admin/test-email` | Trigger test notification to administrator |
| `GET` | `/api/admin/privacy-notice` | Security transparency disclosure |
| `POST` | `/api/ai/explain` | Evidence summarization via GPT-OSS-120B |
| `GET` | `/api/ai/status` | Check AI model connectivity and fallback status |
| `POST` | `/api/ai/reset-demo` | Reset database back to clean synthetic seed state |

---

## 9. Security, Privacy & Fairness Guarantees

1. **Newcomer Fairness Principle**: First-time contributors are never penalized for having no prior track record.
2. **Presumption of Neutrality**: Allegations remain unverified until corroborated by maintainer triage.
3. **Cryptographic Provenance**: Every vouch and allegation computes a SHA-256 hash anchoring evidence.
4. **HMAC-SHA256 Webhook Verification**: GitHub webhooks are verified with secret signatures before execution.
5. **Zero Sensitive Data Exposure**: Passwords, hashed credentials, private OAuth tokens, and session secrets are never stored in activity logs or transmitted in email notification payloads.

---

## 10. Verification & Automated Test Results

MergeGuard maintains **100% automated test coverage** across all modules with 71 passing tests:

```
backend/tests/test_admin_activity.py (26 tests) .......................... PASSED
backend/tests/test_ai_service.py (19 tests) ............................. PASSED
backend/tests/test_github_integration.py (12 tests) .................... PASSED
backend/tests/test_mergeguard.py (14 tests) ............................ PASSED
============================= 71 passed in 0.53s =============================
```

Frontend production verification:
```
npm --prefix frontend run build
✓ 2219 modules transformed in 145ms. Zero errors.
```

---

## 11. Document Signoff

- **Product**: MergeGuard
- **Owner**: Avi Garg (`Garg-Avi`)
- **Status**: Production Ready Baseline (v1.0.0)

