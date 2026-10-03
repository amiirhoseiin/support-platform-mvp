# SCOPE.md: Day-1 Support Platform

## The Problem Context
The current shared inbox relies on manual coordination, resulting in lost requests, VIP customers waiting too long, duplicated agent effort, and a complete lack of operational visibility for management. 

## The Objective
Deliver a pragmatic, Day-1 ready support platform with two distinct surfaces (Customer and Staff) that guarantees data isolation, prioritizes high-value customers automatically, and leverages AI to accelerate agent response times without risking client trust.

## What is IN Scope (The Deliverable)
1. **Customer Surface (Self-Serve Portal):** A secure, authenticated portal where customers can submit issues and track their progress. Customers can *only* see their own data, guaranteed at the database level via Row Level Security (RLS).
2. **Staff Surface (Unified Workspace):** A dashboard for agents where incoming tickets are aggregated and automatically sorted by a combination of Customer Tier (Substantial vs. Small) and Wait Time. 
3. **Agent-Assisted AI:** An AI capability that reads the context of a ticket and generates a draft response for the agent to review and send. (AI is restricted to the staff side to eliminate hallucination risks for customers).
4. **Founder SLA Metrics:** A real-time header in the Staff Surface showing total open tickets, average response time, and the longest currently waiting ticket to answer the question: "Are we slow?".
5. **Audit Trail Schema:** A `ticket_events` database structure that tracks state changes, ensuring no request silently falls through the cracks and enabling accurate SLA calculations.

## What is OUT of Scope (Deliberately Excluded for MVP)
* **Email-to-Ticket Ingestion:** Customers must use the portal. Parsing incoming emails is too complex and brittle for a 6-hour timebox.
* **Customer-Facing AI Chatbots:** A flashy chatbot is rejected. Hallucinations in B2B SaaS destroy trust. AI will only augment our agents.
* **File Attachments:** Text-only communication ensures Day-1 system stability and minimizes security vectors (e.g., malicious uploads).
* **Automated Ticket Assignment:** We will utilize a shared-queue model. Building complex round-robin routing algorithms is unnecessary for a two-agent team.