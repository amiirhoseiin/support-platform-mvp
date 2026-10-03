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

## 🧠 AI Copilot Architecture (Agent-in-the-Loop)

- **Cost Control**: Powered by Google Generative AI (`gemini-flash-latest`) via the Vercel AI SDK. MVP token burn rate is effectively **$0**.
- **Zero Hallucination Risk for Customers**: Customers never interact with an unvetted chatbot. The AI only assists agents by drafting responses in the internal staff workspace.
- **Agent Workflow**:
  1. Click **"Generate AI Draft"** inside any ticket.
  2. The model digests ticket context, customer plan tier, and previous message history.
  3. The draft is stored with `is_ai_draft: TRUE` (hidden from the customer).
  4. The agent reviews the text and clicks **"Approve & Send"**, publishing the reply and recording `first_responded_at`.

---

## 🧪 Testing

### Automated E2E Workflow Test (Playwright)
Validates the complete critical customer path: Authentication $\rightarrow$ Route guard $\rightarrow$ Ticket modal $\rightarrow$ Server Action $\rightarrow$ Database insertion $\rightarrow$ Dashboard list update.

```bash
npm run test:workflow
```

---

## 📚 Deliverables & Documentation Index

- [SCOPE.md](SCOPE.md): Agreed scope, problem context, and non-goals.
- [DECISIONS.md](DECISIONS.md): Architectural decisions, alternatives considered, and trade-offs.
- [AI_USAGE.md](AI_USAGE.md): Tooling breakdown, time savings, rejected ideas, and verification.
- [HANDOVER.md](HANDOVER.md): Founder operational guide, limitations, next 5 ranked features, and scale breakdown.

