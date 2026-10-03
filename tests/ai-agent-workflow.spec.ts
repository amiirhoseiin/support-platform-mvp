import { test, expect } from '@playwright/test';

test.describe('End-to-End AI Copilot Workflow (Creation -> Suggestion -> Edit -> Approval)', () => {
  test('Complete lifecycle: Customer creates ticket -> AI generates draft -> Agent inspects, edits and approves reply -> Customer sees response', async ({
    page,
    context,
  }) => {
    test.setTimeout(90000); // Allow sufficient time for AI generation & multi-persona navigation

    // ---------------------------------------------------------
    // STEP 1: Customer logs in and creates a support ticket
    // ---------------------------------------------------------
    await page.goto('/login');
    await page.locator('input#email').fill('hello@startup.io');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/customer', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Customer Support Portal/i })).toBeVisible();

    const uniqueId = Date.now().toString().slice(-6);
    const ticketSubject = `SSO and Custom Domain Setup #${uniqueId}`;
    const ticketDescription = `We need assistance configuring Okta SAML with our custom domain for our enterprise team. Where can we submit our metadata XML?`;

    // Open New Ticket dialog
    await page.getByRole('button', { name: /New Ticket/i }).first().click();
    await expect(page.getByRole('heading', { name: /Submit a New Support Ticket/i })).toBeVisible();

    await page.locator('input#subject').fill(ticketSubject);
    await page.locator('textarea#description').fill(ticketDescription);
    await page.locator('select#priority').selectOption('normal');

    await page.getByRole('button', { name: /Create Ticket/i }).click();

    // Wait for redirect to ticket detail view
    await page.waitForURL(/\/customer\/.+/, { timeout: 20000 });
    const customerTicketUrl = page.url();
    const ticketId = customerTicketUrl.split('/').pop() || '';
    expect(ticketId).toBeTruthy();

    await expect(page.getByRole('heading', { name: ticketSubject })).toBeVisible();

    // ---------------------------------------------------------
    // STEP 2: Agent logs in and inspects the unified queue
    // ---------------------------------------------------------
    // Clear cookies to switch session from customer to agent
    await context.clearCookies();

    await page.goto('/login');
    await page.locator('input#email').fill('mike@company.com');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/agent', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Unified Support Queue/i })).toBeVisible();

    // Navigate to the newly created ticket in agent view
    await page.goto(`/agent/${ticketId}`);
    await page.waitForURL(`**/agent/${ticketId}`, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: ticketSubject })).toBeVisible();

    // ---------------------------------------------------------
    // STEP 3: Verify AI Draft Card & Explainability Context
    // ---------------------------------------------------------
    // The requirement states:
    // "Show the agent: 'This is a suggested reply. Edit it or approve it.'"
    const suggestedReplyNotice = page.getByText('This is a suggested reply. Edit it or approve it.');
    await expect(suggestedReplyNotice).toBeVisible({ timeout: 20000 });

    // Verify AI Copilot heading & classification
    await expect(page.getByText('AI Copilot Suggestion')).toBeVisible();

    // Verify the agent can edit the suggested response inline
    const replyTextarea = page.locator('textarea[placeholder*="Edit suggested response"]');
    await expect(replyTextarea).toBeVisible();

    const originalSuggestedText = await replyTextarea.inputValue();
    expect(originalSuggestedText.length).toBeGreaterThan(0);

    // ---------------------------------------------------------
    // STEP 4: Agent edits the suggestion before approving
    // ---------------------------------------------------------
    const agentCustomNote = '\n\n[Agent Update: I reviewed this and attached the Okta SAML configuration guide directly for your team.]';
    const editedReply = `${originalSuggestedText}${agentCustomNote}`;

    await replyTextarea.fill(editedReply);

    // Verify UI reflects agent edit status
    await expect(page.getByText(/Edited by agent/i)).toBeVisible();

    // ---------------------------------------------------------
    // STEP 5: Agent approves and sends the draft
    // ---------------------------------------------------------
    const approveButton = page.getByRole('button', { name: /Approve & Send/i });
    await expect(approveButton).toBeEnabled();
    await approveButton.click();

    // After approval, the AI draft card should disappear
    await expect(suggestedReplyNotice).not.toBeVisible({ timeout: 15000 });

    // And the message thread should contain the approved, edited reply
    await expect(page.locator('body')).toContainText('[Agent Update: I reviewed this and attached the Okta SAML configuration guide directly for your team.]');

    // ---------------------------------------------------------
    // STEP 6: Customer views the approved response
    // ---------------------------------------------------------
    await context.clearCookies();

    await page.goto('/login');
    await page.locator('input#email').fill('hello@startup.io');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/customer', { timeout: 15000 });
    await page.goto(`/customer/${ticketId}`);
    await page.waitForURL(`**/customer/${ticketId}`);

    // Customer should see the official reply containing the agent's edited response
    await expect(page.locator('body')).toContainText('[Agent Update: I reviewed this and attached the Okta SAML configuration guide directly for your team.]');
  });
});
