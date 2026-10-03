# DECISIONS.md

**1. Framework & Architecture**
* **Decision:** Use a Next.js Monorepo with Supabase (PostgreSQL) for backend/auth.
* **Reason:** Eliminates the need to maintain a separate backend API (e.g., Express/FastAPI). Supabase provides out-of-the-box Auth and PostgreSQL.
* **Alternative Considered:** Separate React SPA + Python FastAPI backend.
* **Trade-off Accepted:** Extremely high development speed and unified deployment (Vercel) at the cost of being heavily coupled to Supabase's specific ecosystem.

**2. Data Security & Multi-Tenancy Guarantee**
* **Decision:** Enforce multi-tenant data isolation strictly at the PostgreSQL layer using Row Level Security (RLS) policies, rather than application-level middleware.
* **Reason:** It is the only way to cryptographically "prove it to the founder." Even if the Next.js API has a routing bug, the database will physically refuse to return Ticket B to Customer A.
* **Alternative Considered:** Application-level checks (e.g., `if user.id !== ticket.customer_id throw 403`).
* **Trade-off Accepted:** Writing and maintaining raw SQL policies is harder to debug than JavaScript logic, but absolute data privacy is worth the friction.

**3. [Revisit/Wrong] AI Drafts Storage Mechanism**
* **Decision:** Storing AI-generated drafts directly in the `messages` table using an `is_ai_draft` boolean flag.
* **Reason:** Fast to implement within the timebox. It allowed me to reuse the same UI components for rendering both real messages and drafts.
* **Alternative Considered:** Creating a separate `ai_drafts` table linked to the ticket.
* **Trade-off Accepted:** I traded architectural purity for speed. I would revisit this because, at scale, storing transient AI drafts in the core `messages` table will bloat the table and slow down queries for actual historical conversations.

**4. [Revisit/Wrong] Global Shared Queue Model**
* **Decision:** All agents see the exact same list of open tickets, sorted by priority, without explicit assignment constraints.
* **Reason:** Fits the 6-hour cap perfectly. The company only has two agents; they can self-coordinate via verbal communication or internal notes.
* **Alternative Considered:** A "claim" system where an agent must explicitly lock a ticket before replying.
* **Trade-off Accepted:** I traded workflow safety for simplicity. I would revisit this immediately because it introduces "Agent Collision"—two agents might unknowingly type a reply to the same customer simultaneously.

**5. Reproducible Environment & Setup**
* **Decision:** Use Supabase CLI (which is backed by Docker) for the local database setup and seeding, rather than a remote staging database.
* **Reason:** It perfectly fulfills the "one command, README'd" requirement. By running `npx supabase start`, it guarantees that any engineer (or evaluator) reviewing this codebase gets the exact same PostgreSQL version, schema, and seeded realistic data without manual configuration.
* **Alternative Considered:** Providing a manual `docker-compose.yml` with separate SQL initialization scripts, or simply hardcoding a connection to a remote hosted staging database.
* **Trade-off Accepted:** It requires the evaluator to have the Docker daemon installed and running locally, which is a heavy system dependency. However, eliminating "it works on my machine" bugs and avoiding the security risks of sharing a remote database makes this trade-off worthwhile for a professional engineering environment.

**6. Ticket Lifecycle & Auditability (Preventing "Lost" Requests)**
* **Decision:** Implement a strict state machine for ticket categorization using database Enums (`status`, `priority`, `tier`) and back it with an immutable Audit Log (`ticket_events` table).
* **Reason:** The core business problem stated that "requests get lost" and management lacks visibility. By strictly typing the categories and logging every state change in an append-only event table, we mathematically guarantee that no ticket can vanish without a trace. The system always knows who changed what, and when.
* **Alternative Considered:** A simple CRUD structure where a ticket's status is merely overwritten upon update, and categories are stored as simple free-text strings.
* **Trade-off Accepted:** This architecture increases the database storage footprint (as every status change creates a new row) and makes the analytical queries for the Founder Dashboard more complex. However, providing the founder with an irrefutable audit trail to answer "are we slow?" is absolutely worth the added query complexity.

**7. AI Infrastructure & Cost Management (Burn Rate Control)**
* **Decision:** Utilize Code Antigravity IDE alongside Working Buddy AI and Harness Open Source infrastructure for both development and production AI features, avoiding expensive frontier models like GPT-4o or Claude 3.5 Sonnet.
* **Reason:** The prompt explicitly specifies "no budget for enterprise tooling". Generating polite support drafts and summarizing contexts does not require the complex reasoning capabilities of expensive premium models. By utilizing these highly cost-efficient, open-ecosystem tools, we reduce our AI token costs to effectively $0 for the MVP phase, keeping the startup's burn rate minimal while maintaining high developer velocity.
* **Alternative Considered:** Paying for GitHub Copilot / Cursor and integrating OpenAI APIs, which introduces recurring subscription costs and unpredictable usage-based API fees.
* **Trade-off Accepted:** We trade the absolute highest tier of linguistic nuance for a 99% cost reduction. The AI might occasionally sound slightly more generic, but because we implemented an "Agent-in-the-Loop" architecture (the AI only writes *drafts* that agents review), this is a completely acceptable and zero-risk trade-off.


**8. Security & Input Sanitization (Public Surface Vulnerabilities)**
* **Decision:** Rely on a defense-in-depth strategy using React's native XSS protection, Supabase RLS, and AI-system-prompt bounding to handle the 3 most critical risks of a public-facing text input surface.
* **Reason:** The prompt explicitly notes that people outside the company can type *whatever they like*. The three real risks here are:
  1. *Horizontal Privilege Escalation:* Handled strictly by our Database RLS (Customer A cannot query Customer B's tickets).
  2. *Cross-Site Scripting (XSS):* Handled natively by Next.js/React escaping all user-submitted text variables in the DOM, preventing malicious script execution in the Agent's dashboard.
  3. *Prompt Injection:* Handled by strict system prompting and architecture. Because the AI only generates a *draft* for the agent and cannot execute code or send emails autonomously, the blast radius of a successful prompt injection by a malicious customer is zero.
* **Alternative Considered:** Implementing a heavy Web Application Firewall (WAF) or writing custom Regex-based input sanitization middleware.
* **Trade-off Accepted:** I traded complex, enterprise-grade threat filtering (which is brittle and takes too much time for a 6-hour MVP) for built-in, robust framework protections.

**9. Testing Strategy (E2E Workflow vs. Unit Tests)**
* **Decision:** Implement a single End-to-End (E2E) Critical Path test using Playwright, and explicitly choose *not* to write isolated unit tests for UI components.
* **Reason:** In a strict 6-hour timebox, the most devastating business failure is a customer being unable to submit an issue. E2E testing validates the entire stack (Auth -> Frontend -> Server Action -> DB -> UI update) in one go, proving the core value proposition works.
* **Alternative Considered:** Using Jest and React Testing Library to write granular unit tests for individual Server Actions and UI components (e.g., testing if a button renders).
* **Trade-off Accepted:** I deliberately chose *not* to write unit tests. Testing UI cosmetics or basic CRUD functions in an MVP yields extremely low ROI. I traded high "code coverage" percentages for high "business confidence" by ensuring the main workflow never breaks.

**10. Staff Notifications, Ticket Handoffs & Team Activity Stream**
* **Decision:** Implement an in-app interactive notification bell (`NotificationBell`), ticket assignment selector (`TicketAssigneeSelector`), and a live staff activity & internal notes feed rather than integrating third-party notification services (like Twilio, SendGrid, or Slack webhooks).
* **Reason:** In day-1 operations with 2 agents and a founder, third-party webhook integrations add external failure points and recurring costs. An in-app reactive notification drawer combined with an explicit ticket handoff mechanism enables zero-drop shift transitions between Mike, Anna, and Sarah without leaving the dashboard.
* **Alternative Considered:** Sending external emails or Slack webhooks for every internal note and assignment.
* **Trade-off Accepted:** Team members must be logged into the support platform to see badges and alerts, but it avoids webhook configuration overhead, spam fatigue, and credential leaks.

