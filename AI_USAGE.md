# AI_USAGE.md

* **Which tools:** Code Antigravity IDE integrated with Working Buddy AI, and Harness Open Source infrastructure.
* **How cost constraints shaped tool selection:** The project brief explicitly stated there is "no budget for enterprise tooling." Instead of relying on expensive premium models and APIs (like GPT-4o or Claude 3.5 Sonnet) which would easily incur $10+ in token and subscription fees for development and production of this scope, I deliberately utilized these open-ecosystem and highly cost-efficient tools. This approach brought our AI token costs down to effectively $0, proving we can deliver powerful AI features (like the Agent Copilot) without increasing the startup's burn rate.
* **What for:** Generating boilerplate UI components (Tailwind CSS forms/tables), scaffolding the Next.js App Router structure, and generating realistic, interconnected seed data (SQL). Working Buddy AI acted as a continuous pair-programmer for architectural validation and rapid prototyping.
* **Where they saved real time:** Writing the 150+ lines of SQL seed data. Working Buddy AI generated realistic B2B scenarios (e.g., VIP customers with API rate limit issues, complete with timestamps and interrelated UUIDs), which saved me at least 45 minutes of tedious typing.
* **Where they produced something bad:** The AI struggled with Supabase's exact RLS syntax, injecting non-breaking spaces into the SQL policies which caused PostgreSQL to throw cryptic syntax errors during migrations. I had to manually debug and rewrite the policies.
* **One recommendation I rejected and why:** The AI strongly recommended building a "Customer-facing AI Chatbot" to deflect tickets. I outright rejected this. For a B2B SaaS with 60 paying customers, a hallucinated or incorrect answer damages the brand instantly. Instead, I pivoted the AI to be an internal "Agent Copilot," keeping a human in the loop for quality control.
* **How I verified generated code:** All AI-generated SQL migrations were tested in a local, isolated Docker container (`supabase start`) before ever being applied to the remote schema. UI code was manually reviewed for accessibility (aria-labels) before committing.
* **Which parts of the architecture were my own thinking:** The `ticket_events` tracking table and the `first_responded_at` timestamp architecture. The AI initially suggested a simple CRUD schema. I knew that to answer the founder's question ("Are we slow?"), we needed an immutable audit trail of state changes (SLA tracking), which I designed and implemented manually.

---

## Production AI Runtime Architecture & Defensibility

### 1. Defensible AI Capability: Tenant-Scoped Agent Co-pilot & Classification
* **Why this capability:** In a B2B SaaS with 60 paying customers and 2 support agents, repetitive how-to questions waste hours of agent time, but fully autonomous AI chatbots risk customer alienation and hallucinated commitments. We built an **Agent-in-the-Loop Co-pilot**:
  - Classifies incoming tickets into 4 categories (`duplicate_question`, `billing`, `bug`, `feature_request`).
  - Retrieves similar solved tickets strictly from the *same customer's history* (tenant-scoped RAG).
  - Drafts a suggested reply with confidence score and reasoning: *"This is a suggested reply. Edit it or approve it."*
  - Allows agents to edit the response directly in the ticket view before approving and dispatching.
* **Why the ambitious version was wrong:** An autonomous customer deflection bot that auto-closes tickets would be catastrophic for a company with 60 customers paying up to substantial tiers. If the bot misunderstands an outage or gives wrong billing advice, the churn cost far exceeds the $15/hr agent cost.

### 2. Tenant Isolation at the Data Layer
* Similar solved tickets are queried using strict PostgreSQL filters: `.eq('customer_id', customerId).in('status', ['resolved', 'closed'])`.
* Customer A cannot see or retrieve Customer B's tickets or past solutions, mathematically preventing cross-tenant leakage.

### 3. Prompt Injection Defense & Untrusted Input Sandboxing
* All customer-submitted text (`subject`, `description`) is sanitized, HTML-stripped, and bounded within `<untrusted_customer_input>` delimiters.
* The system directive explicitly forbids the model from following role overrides, administrative commands, or system prompt extraction attempts.
* Sensitive domains (billing, authentication, security) permanently bypass auto-reply and force human review.

### 4. Latency, Cost, and Provider Failure Strategy
* **Replaceable Architecture:** The LLM engine implements `AiProviderInterface` and can be swapped with zero changes to business logic (`getAiProvider()` / `setAiProvider()`).
* **Multi-Model Fallback:** Cascades gracefully (`gemini-flash-latest` → `gemini-2.5-flash-lite` → `gemini-3.8-flash`).
* **Fail-Closed Fallback:** If all models fail, rate-limit, or time out, confidence drops to `0.0`, the ticket is safely routed to the human queue, and the creation flow completes without errors. No ticket is ever dropped.
* **Auto-Reply Safety Policy:** Disabled by default in `public.app_settings`. Only permitted for low-risk categories (`duplicate_question`, `feature_request`) with confidence $\ge 0.85$. Billing, security, and bugs *always* require human review. AI is never allowed to auto-close a ticket (`in_progress`, never `resolved`).