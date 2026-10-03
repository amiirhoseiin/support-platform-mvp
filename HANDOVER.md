# HANDOVER.md: Founder Handover & Operational Guide

*Written for the Founder (Non-Technical Executive Overview)*

---

## 1. What Was Delivered (In Plain English)

We built and deployed a dedicated, dual-surface B2B support platform that completely replaces your shared inbox and spreadsheet. 

Instead of emails getting lost in a shared Gmail or conflicting across agents:
- **Your Customers get a clean, branded Self-Serve Portal**: They log in, submit their problems in seconds, and track progress live in a clear conversation thread without wondering if their email bounced or went into spam.
- **Your Support Team (Mike & Anna) gets an automated, prioritized Queue**: Incoming requests are automatically ranked by customer plan value (**Enterprise VIP** first, then **Substantial**, then **Small**) and wait time. Your agents immediately know who to help first.
- **You (The Founder) get instant SLA Visibility**: Whenever you log in, an executive bar at the top tells you:
  - Exactly how many tickets are open right now.
  - The longest currently waiting ticket and who it belongs to (so you can answer *"Are we slow?"* honestly to any client).
  - Which high-value accounts need immediate attention.
- **AI-Assisted Drafting & Classification (Human-in-the-Loop)**: Rather than an unvetted chatbot hallucinating incorrect answers to paying customers, the AI acts as an internal copilot:
  - Automatically classifies incoming tickets into 4 categories (`duplicate_question`, `billing`, `bug`, `feature_request`).
  - Retrieves similar solved tickets strictly scoped to the *same customer's history* (tenant-scoped RAG).
  - Presents agents with: *"This is a suggested reply. Edit it or approve it."*, allowing inline edits before approving.
  - Optional auto-reply setting (disabled by default) that strictly excludes billing, bugs, and security, and requires high confidence ($\ge 85\%$).
  - Never auto-closes tickets, and provides human escape hatches.
- **Explicit Ticket Assignments & Shift Handoffs**:
  - Agents can self-assign tickets with one click.
  - The founder can assign tickets to any agent, highlighted with a purple badge and VIP priority alert.
  - An interactive notification drawer and team audit stream keeps everyone updated without third-party email noise.
- **Ironclad Privacy Guaranteed at the Database Level**: A customer can *never* view another customer's ticket under any circumstance. Even if there were a bug in the website code, the database physically refuses to return data belonging to another tenant.

---

## 2. The Main Workflow (Starting Monday Morning)

### What the Customer Experiences:
1. **Accessing the Portal**: The customer visits `/login` and signs into their account.
2. **Submitting a Request**: On `/customer`, they click **"New Ticket"**, type their issue subject and description, and pick an urgency level.
3. **Tracking & Replying**: They are redirected to the ticket thread where they see their initial submission and live updates from your team. They can reply anytime. They will never see internal staff discussions or unapproved AI drafts.

### What Agents Mike & Anna Do on Monday:
1. **Queue Prioritization**: Agents log in at `/agent`. The queue is automatically ordered from top to bottom by contract tier and longest wait time. They always work from the top ticket down.
2. **Context on One Screen**: Opening a ticket reveals the customer's plan, contact info, past messages, and the entire audit trail of status changes without switching tabs.
3. **AI Copilot Review**:
   - The ticket displays the AI's classification category, confidence percentage, and similar past solutions for context.
   - The banner instructs: *"This is a suggested reply. Edit it or approve it."*
   - The agent can edit the suggested response inline directly in the box, or click **"Approve & Send"** to dispatch it immediately.
4. **Handoffs & Collaboration**: If Mike needs to flag an issue for Anna or you (the founder), he checks **"Send as Internal Note"**. The note turns amber and is locked to staff only—the customer never sees it. He can also reassign or assign tickets directly.
5. **Resolving**: When finished, clicking **"Mark Resolved"** timestamps the resolution and removes it from the active queue.

---

## 3. Known Limitations (Stated Plainly)

*Being transparent about what the MVP does not do saves headaches down the road:*

1. **No Inbound Email Ingestion**: Customers must submit requests via the web portal. If a customer emails `support@company.com`, it will not automatically convert into a ticket in this version.
2. **Text-Only Communication (No File Attachments)**: Customers and agents cannot upload screenshots, PDFs, or log files directly into the thread. They must paste error logs or link to shared cloud storage (e.g., Google Drive, Loom).
3. **No Agent Concurrency Lock ("Collision Avoidance")**: If Mike and Anna open the exact same ticket at the exact same minute, the system does not show a "Mike is currently typing" indicator. They coordinate via internal notes or assignment badges.
4. **No Automated Ticket Escalation Rules**: Escalations are driven by queue sorting and human assignment rather than automated cron triggers.

---

## 4. The Next 5 Things We Would Build (Ranked with Business Rationale)

1. **Inbound Email-to-Ticket Gateway (SendGrid / Postmark Inbound Webhook)**
   - *Why*: Eliminates friction for enterprise executives who instinctively email rather than logging into a web portal.
2. **Agent Collision Detection & Live Typing Presence (Supabase Realtime)**
   - *Why*: As ticket volume grows, two agents answering the same customer simultaneously looks unprofessional and wastes time.
3. **File & Screenshot Attachments (Supabase Storage with Antivirus Scan)**
   - *Why*: Technical B2B issues (500 errors, UI bugs) are solved 3x faster when customers can attach HAR files and screenshots.
4. **Automated SLA Breach Alerts (Slack / Telegram Webhook Notifications)**
   - *Why*: Rather than requiring the founder to check the dashboard, notify the team in Slack whenever an Enterprise ticket waits more than 15 minutes unresponded.
5. **Knowledge Base / Snippet Macros for Common Answers**
   - *Why*: Reduces repetitive agent typing by 40% for frequent onboarding and billing inquiries.

---

## 5. Where This Architecture Breaks

### At 100 Paying Users (~20–40 tickets/day):
- **Status**: **Completely Stable.** 
- The Next.js serverless functions and Supabase PostgreSQL database will easily handle this workload with zero performance degradation. The $0–$25/month hosting tier is more than sufficient.

### At 10,000 Users (~500–1,500 tickets/day):
- **Breaking Point 1: Global Queue Query Bottleneck**:
  - The unified queue currently joins `tickets` with `users` and sorts in-memory in the Server Component. At this scale, the query will slow down unless we add composite PostgreSQL indexes: `CREATE INDEX idx_tickets_status_created ON tickets (status, created_at)` and pre-calculate tier priority on the `tickets` table directly.
- **Breaking Point 2: Operational Agent Collision**:
  - A 2-person shared queue collapses with 10+ support agents. You will require queue segmenting (Tier 1 vs. Tier 2) and automated round-robin assignment.
- **Breaking Point 3: Transient AI Draft Bloat in Messages Table**:
  - Storing unapproved drafts with `is_ai_draft: true` directly in the core `messages` table will bloat the table with rejected drafts, slowing down conversational history queries. Drafts should be migrated to a dedicated ephemeral table or Redis cache.

### At 1,000,000 Tickets:
- **Breaking Point 1: PostgreSQL Table Size & Sequential Scans**:
  - The `messages` and `ticket_events` tables will exceed tens of millions of rows. Relational queries will require table partitioning by year/month and cold-storage archiving for tickets older than 90 days.
- **Breaking Point 2: Audit Event Write Contention**:
  - Logging every state change synchronously in `ticket_events` inside Server Actions will create connection pool exhaustion during peak hours. State change events will need to be pushed to an asynchronous event queue (e.g., Kafka / AWS SQS / pg_mq) and written in batches.
- **Breaking Point 3: Search Performance**:
  - Searching ticket descriptions using standard `ILIKE` will time out. A dedicated full-text search engine (PostgreSQL pg_trgm / Elasticsearch / Meilisearch) will be mandatory.
