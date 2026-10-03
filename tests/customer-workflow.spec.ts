import { test, expect } from '@playwright/test';

test.describe('Customer Critical Path Workflow', () => {
  test('Customer logs in, submits a new ticket, and sees it in the dashboard list', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Navigate to the /login page
    await page.goto('/login');
    await expect(page).toHaveTitle(/B2B SaaS Support|Create Next App/i);
    await expect(page.getByRole('heading', { name: /Sign In/i })).toBeVisible();

    // 2. Log in using seeded customer credentials (hello@startup.io / demo123)
    await page.locator('input#email').fill('hello@startup.io');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // 3. Assert successful redirection to the Customer Dashboard (/customer)
    await page.waitForURL('**/customer', { timeout: 20000 });
    await expect(page).toHaveURL(/\/customer/);
    await expect(page.getByRole('heading', { name: /Customer Support Portal/i })).toBeVisible();

    // Generate unique subject for testing
    const uniqueId = Date.now().toString().slice(-6);
    const ticketSubject = `Critical Production Bug #${uniqueId}`;
    const ticketDescription = `We are experiencing high latency and timeout errors on our webhook listener since morning. Please investigate ASAP.`;

    // 4. Fill out and submit the "New Ticket" form
    const newTicketBtn = page.getByRole('button', { name: /New Ticket/i }).first();
    await expect(newTicketBtn).toBeVisible();
    await newTicketBtn.click();

    // Wait for the modal dialog to appear
    await expect(page.getByRole('heading', { name: /Submit a New Support Ticket/i })).toBeVisible();

    await page.locator('input#subject').fill(ticketSubject);
    await page.locator('textarea#description').fill(ticketDescription);
    await page.locator('select#priority').selectOption('high');

    // Submit the ticket
    await page.getByRole('button', { name: /Create Ticket/i }).click();

    // 5. Assert ticket creation: wait for either direct detail page or navigate to /customer
    // After creation, the app redirects to the ticket detail page (/customer/[id])
    await page.waitForURL(/\/customer\/.+/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: ticketSubject })).toBeVisible();

    // Navigate back to the customer dashboard list
    await page.goto('/customer');
    await page.waitForURL('**/customer');

    // 6. Assert that the newly created ticket successfully appears in the customer's open tickets list
    const ticketRow = page.getByRole('row', { name: new RegExp(ticketSubject, 'i') });
    await expect(ticketRow).toBeVisible({ timeout: 10000 });
    await expect(ticketRow).toContainText('Open');
    await expect(ticketRow).toContainText('High');
  });
});

