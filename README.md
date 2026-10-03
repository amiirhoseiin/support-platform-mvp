# B2B SaaS Support Platform (Day-1 MVP)

> A pragmatic, multi-tenant B2B support platform built with **Next.js (App Router)**, **Tailwind CSS / shadcn**, **Supabase (@supabase/ssr)**, and **Google Gemini via Vercel AI SDK**.

---

## 🚀 Live Demo & Accounts

**Live Demo:** [https://support-platform-mvp.vercel.app/](https://support-platform-mvp.vercel.app/)  
**Login Page:** [https://support-platform-mvp.vercel.app/login](https://support-platform-mvp.vercel.app/login)

| Role | Email | Password | Surface & Access |
| :--- | :--- | :--- | :--- |
| **Enterprise VIP Customer** | `cto@acmecorp.com` | `demo123` | Customer Portal (`/customer`) |
| **Substantial Tier Customer** | `admin@novintech.ir` | `demo123` | Customer Portal (`/customer`) |
| **Small Tier Customer** | `hello@startup.io` | `demo123` | Customer Portal (`/customer`) |
| **L2 Support Agent** | `mike@company.com` | `demo123` | Unified Support Queue (`/agent`) |
| **Company Founder** | `founder@company.com` | `demo123` | Queue + Executive SLA Metrics Header |

The login page at `/login` provides 1-click quick-fill buttons for all demo accounts.

---

## 🛠 Local Setup & Reproduction (One-Command Workflow)

### Prerequisites
- Node.js 18+ (tested on Node 20 & 24)
- Docker Desktop (for local Supabase instance)

### Setup Steps
```bash
# 1. Clone repository & install dependencies
git clone https://github.com/amiirhoseiin/support-platform-mvp.git
cd support-platform-mvp
npm install

# 2. Start and seed local Supabase database
npx supabase start

# 3. Start development server
npm run dev
```

Visit **[http://localhost:5050](http://localhost:5050)** in your browser.

*(Note: We configured port `5050` by default to avoid Windows Hyper-V port exclusion conflicts on `3000`).*

---

## 🔒 Security & Multi-Tenant Isolation Guarantee

### Proving Isolation to the Founder
Data isolation is **not** handled by fragile application-level `if` checks. It is cryptographically and natively enforced by **PostgreSQL Row Level Security (RLS)**:

1. **Customers**: Can only query tickets where `customer_id = auth.uid()`. Database policies physically reject queries for any other tenant's data.
2. **Internal Notes & AI Drafts**: Messages with `is_internal_note = TRUE` or `is_ai_draft = TRUE` are blocked by PostgreSQL RLS from customer SELECT queries.
3. **Staff Access**: Backed by a `SECURITY DEFINER` function `public.is_staff()` that checks role membership without incurring recursive policy evaluation.

---

## 🧠 AI Copilot Architecture (Agent-in-the-Loop & Safety Guardrails)

- **Cost Control & Performance**: Powered by Google Generative AI (`gemini-flash-latest` / `gemini-2.5-flash-lite`) abstracted behind a pluggable `AiProviderInterface`. Token burn rate remains effectively **$0**.
- **Automated Classification**: Classifies incoming tickets into 4 categories: `duplicate_question`, `billing`, `bug`, and `feature_request`.
- **Tenant-Scoped RAG (Zero Cross-Tenant Leakage)**: Similar solved tickets used to generate context are queried strictly with `.eq('customer_id', customerId)` at the SQL layer. A customer's technical history can never be leaked to another tenant.
- **Prompt Injection Defense**: Untrusted customer input is sanitized and enclosed in `<untrusted_customer_input>` tags. The model is constrained by strict JSON schema outputs and cannot execute arbitrary actions.
- **Agent Experience**:
  1. The agent is shown: *"This is a suggested reply. Edit it or approve it."*
  2. The agent can edit the suggested response inline directly before sending.
  3. The agent can approve and send the reply with one click, or discard it.
  4. The classification category, confidence percentage, and similar solved tickets used are surfaced for context.
- **Auto-Reply Option & Safety Invariants**:
  - Configurable via the agent dashboard settings dialog (`app_settings` table), **disabled by default**.
  - Can only be enabled for low-risk categories (`duplicate_question`, `feature_request`) with high confidence ($\ge 85\%$).
  - **Billing, security, and bug tickets always require human review** — the system hard-blocks auto-replying to them.
  - An explicit human escape hatch is always appended to any automated reply.
  - **Never auto-closes tickets**: tickets are updated to `in_progress`, never `resolved`.
  - Every AI reply, classification, and confidence score is audit logged in `ticket_events`.
- **Fail-Closed Principle**: If the AI provider times out, encounters rate limits, or errors, it cascades through fallback models and routes to the human queue (`shouldRequireHumanReview: true`). Tickets are never silently dropped.

---

## 🧪 Testing Suite (Automated Playwright E2E & Invariant Tests)

Run the automated test suite with:

```bash
npm run test:workflow
```

The test suite executes 6 comprehensive automated tests:
1. **Critical Path E2E Workflow (`tests/customer-workflow.spec.ts`)**: Login $\rightarrow$ Route guard $\rightarrow$ New ticket modal $\rightarrow$ Server Action $\rightarrow$ Database insertion $\rightarrow$ Dashboard list update.
2. **Data Layer Tenant Isolation (`tests/ai-tenant-isolation-and-safety.spec.ts`)**: Verifies `getTenantSolvedTickets` physically prevents Customer A from querying Customer B's historical solutions.
3. **Billing & Safety Policy Immunity (`tests/ai-tenant-isolation-and-safety.spec.ts`)**: Verifies billing, bug, and security tickets are permanently locked to human review even if auto-reply is enabled.
4. **AI Fail-Closed Fallback (`tests/ai-tenant-isolation-and-safety.spec.ts`)**: Simulates provider outage / bad credentials, verifying multi-model fallback, zero silent drops, and safe routing to human queue with 0 confidence.
5. **Prompt Injection Defense (`tests/ai-tenant-isolation-and-safety.spec.ts`)**: Tests adversarial override payloads within untrusted input sandboxes.
6. **AI Agent Full Workflow E2E (`tests/ai-agent-workflow.spec.ts`)**: Customer creates ticket $\rightarrow$ AI generates suggested draft with classification and context $\rightarrow$ Agent inspects and edits suggested reply inline $\rightarrow$ Agent approves & sends $\rightarrow$ Customer receives verified response in portal.

---

## 📚 Deliverables & Documentation Index

- [SCOPE.md](SCOPE.md): Agreed scope, problem context, and non-goals.
- [DECISIONS.md](DECISIONS.md): Architectural decisions, alternatives considered, and trade-offs.
- [AI_USAGE.md](AI_USAGE.md): Tooling breakdown, time savings, rejected ideas, and verification.
- [HANDOVER.md](HANDOVER.md): Founder operational guide, limitations, next 5 ranked features, and scale breakdown.

