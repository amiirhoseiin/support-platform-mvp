# SCOPE.md: B2B SaaS Support Platform Architecture & Product Judgment

## 1. Executive Summary & Problem Context
The legacy shared-inbox model suffered from fatal B2B failure modes: dropped high-priority customer requests, SLA breaches on high-value contracts, duplicate agent collision, and zero empirical visibility into team velocity.

This platform replaces ad-hoc inboxes with a strictly isolated, multi-tenant B2B support platform built on Next.js 16, Supabase PostgreSQL with Row Level Security (RLS), and a fail-closed Gemini AI Copilot.

---

## 2. Customer Side Architecture & Defensible Choices

### A. Single Front Door
* **Portal URL**: `/customer` & `/customer#new-ticket` provides a unified, single front door for all corporate client ticket submissions.
* Text-based, structured ingestion with category classification (`bug`, `billing`, `feature_request`, `duplicate_question`, `account_access`) and urgency priority (`low`, `medium`, `high`, `urgent`).

### B. Customer Identity & Account Model Defense
* **Decision**: Authenticated corporate user accounts bound to an isolated `tenant_id` (organization).
* **Rationale**:
  1. **B2B Security & Liability**: B2B SaaS tickets contain proprietary production logs, database connection errors, and billing records. Unauthenticated web forms or loose public magic links are susceptible to session hijacking, URL enumeration, and corporate impersonation.
  2. **Account Provisioning**: Enterprise customers are provisioned during enterprise onboarding by organization admins or authorized invite tokens tied to corporate domains (`@acme.com`).
  3. **Post-Submission Confirmation & Visibility**: Upon submission, the customer is immediately redirected to `/customer/[id]` displaying:
     - Globally unique Ticket UUID (`ticket.id`).
     - Real-time status indicator (`Open`, `In Progress`, `Waiting on Customer`, `Waiting on Internal`, `Resolved`, `Reopened`).
     - High-visibility timestamp and confirmation alert.
     - Transparent conversation timeline.
  4. **Customer Replyability**: Customers can reply directly on their ticket tracking screen (`/customer/[id]`). Sending a reply appends a customer-authored message and transitions tickets out of `waiting_customer` back into active queues.

### C. Multi-Tenant Isolation & Proof
* **Data-Layer Enforcement**: PostgreSQL Row Level Security (RLS) is enabled on all tables (`tenants`, `profiles`, `tickets`, `ticket_messages`, `ticket_events`, `ai_suggestions`).
* **RLS Invariant**:
  ```sql
  CREATE POLICY "Customers view own tenant tickets"
  ON tickets FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
  ```
* **Proof & Verification**:
  - Automated Playwright & Vitest test suites (`tests/ai-tenant-isolation-and-safety.spec.ts`, `tests/customer-workflow.spec.ts`) execute cross-tenant queries where customer `alice@acme.com` attempts to query or retrieve tickets belonging to `Beta Ltd` or `Gamma Global`. The database layer rejects or returns 0 records, proving mathematical isolation.

---

## 3. Staff Side: Shift Operations & Crack Prevention

### A. Real Shift Workflow
An agent can run an entire shift from `/agent` and `/agent/[id]`:
1. **Queue Triage**: Real-time queue sorted deterministically by (1) SLA Breached status, (2) Contract Tier (`Enterprise` -> `Substantial` -> `Small`), and (3) Wait Time.
2. **Self-Assignment**: Agents can self-assign tickets with one click. Founders can assign to any staff member.
3. **Public Replies & Customer Collaboration**: Draft, review, or send messages directly to the client.
4. **Internal Notes**: Staff can post internal-only notes (`is_internal = true`) rendered in high-contrast amber cards. Internal notes are invisible to customers and excluded from customer RLS policies.
5. **State Lifecycle Transitions**: Status buttons for `In Progress`, `Waiting on Customer`, `Waiting on Internal`, `Resolved`, and `Reopened`.

### B. Clean End-of-Day Handoff Protocol
When an agent ends their shift:
1. **Filter to "Mine"**: The agent views all tickets currently assigned to them.
2. **Internal Note Checkpoint**: On any unresolved ticket requiring continuation, the departing agent leaves an internal note outlining:
   - What was tested / verified.
   - Current blocker or dependency (e.g. "Waiting on DB patch from DevOps").
   - Recommended next action.
3. **Queue Handoff**: The departing agent either unassigns the ticket back to the central queue (where it retains its SLA urgency rank) or assigns it to the incoming shift colleague.
4. **Shift Briefing via Audit Trail**: The incoming agent opens `/agent/[id]` and immediately reviews the chronological **Audit Trail & SLA Events** timeline, inheriting the complete state without lost context.

### C. The 7-State Crack Prevention Matrix
Nothing silently falls through the cracks. The system accounts for all 7 edge states:
| Failure Mode | Detection & Mitigation |
| :--- | :--- |
| **1. Unassigned Tickets** | Dedicated "Unassigned" tab in queue; high-contrast gray badge `Unassigned` prevents orphaned work. |
| **2. SLA Breaches** | Real-time calculation (`now - created_at > target_minutes`). Pulsating red `SLA BREACH` badge; breached tickets force-float to the very top of the queue. |
| **3. Waiting on Customer** | Explicit state `waiting_customer`. Stops active first-response SLA clock; filtered in dedicated tab. Customer reply auto-resumes queue urgency. |
| **4. Waiting on Internal** | Explicit state `waiting_internal` with amber badge. Used when blocked on engineering/infrastructure. Tracked separately so customer is not blamed for latency. |
| **5. Stale Tickets** | Detected when an open ticket has had no staff or customer activity for >24 hours. Tagged with orange `Stale (24h+)` badge. |
| **6. Reopened Tickets** | Dedicated status `reopened`. Highlighted in violet with a dedicated filter tab, alerting staff that a prior solution was inadequate. |
| **7. AI Failure / Low Confidence** | Fail-Closed principle: If AI times out, errors, or returns confidence < 0.70, it is flagged as `Manual Triage Required` and routed to the human queue. |

### D. Single-Screen Agent Context
In `/agent/[id]`, the agent never needs to leave the screen to find answers:
1. **Account & Contract SLA Panel**: Displays contract tier (`Enterprise` / `Substantial` / `Small`), SLA target, and time remaining.
2. **Customer Ticket History Panel**: Displays all historical tickets from this customer with links and resolution statuses.
3. **Attachments & External Resources Panel**: Extracts referenced log traces, dashboard URLs, PR links, and file URLs from ticket messages.
4. **Audit Trail & Event Timeline**: Shows chronological lifecycle transitions (`status_changed`, `assigned`, `message_sent`) with exact actor timestamps.

---

## 4. Founder Executive Visibility: "Are We Slow?" & Customer Slowness Defense

### A. Real-Time Operational Velocity
The `/agent` dashboard includes the Founder SLA Command Center:
* **Avg First Response Time**: Real-time average in minutes across all active and resolved tickets.
* **Avg Resolution Time**: Real-time average duration from creation to resolution.
* **Active Backlog**: Count of active tickets segmented by urgency.
* **SLA Breaches & Stale Tickets**: Instant count of compliance violations.
* **Plan & Priority Breakdowns**: Granular tabular breakdown of performance by Enterprise, Substantial, and Small tiers.

### B. Customer Slowness Claim Verifier
When a VIP customer claims: *"Your team is slow and unresponsive!"*, the Founder has mathematical ground truth:
* **Interactive Tool**: Select any customer account from the dropdown.
* **Metrics Computed**:
  - Customer's Average First Response Time (e.g. 18m).
  - Customer's Contract SLA Target (e.g. 60m).
  - Breached Tickets on Record for that specific tenant.
* **Definitive Executive Verdict**:
  - **Claim Refuted**: *"Fast Performance: Average response time (18m) is well within contract SLA (60m). No breaches on record."*
  - **Claim Verified**: *"Response Delays Detected: Customer has experienced SLA violations or average response exceeds agreement."*

---

## 5. AI Copilot: Safety, Tenant Scoping & Fail-Closed Invariants
1. **Strict Tenant-Scoped RAG**: Suggested replies query *only* solved tickets belonging to `current_ticket.tenant_id`. Zero cross-tenant leakage.
2. **Untrusted Input Defense**: User ticket text is isolated inside `<untrusted_ticket_content>` sandbox tags to defend against prompt injection.
3. **Billing & Account Safety Policy**: AI auto-replies are strictly forbidden for `billing` and `account_access` categories; human agent review is mandatory.
4. **Never Auto-Close**: AI suggestions can only draft responses; only human agents have the authorization to resolve or close tickets.
5. **Provider Agnostic**: Multi-model fallback (`gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-2.5-flash-lite` -> fail-closed to human).