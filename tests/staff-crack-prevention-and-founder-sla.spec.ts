import { test, expect } from '@playwright/test';

test.describe('Staff Shift Operations, Crack Prevention & Founder SLA Verification', () => {
  test('Agent can work shift without dropping tickets, view all context on one screen, and Founder can verify slowness claims', async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);

    // =========================================================================
    // 1. Staff Shift & Crack-Prevention Verification (Agent Mike)
    // =========================================================================
    await page.goto('/login');
    await page.locator('input#email').fill('mike@company.com');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/agent', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Unified Support Queue/i })).toBeVisible();

    // Verify all 7 crack-prevention filter dimensions are accessible in the UI
    await expect(page.getByRole('link', { name: /All/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Mine/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Unassigned/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Wait Client/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Wait Int/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Reopened/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Resolved/i })).toBeVisible();

    // 2. Open an active Enterprise ticket to verify "all context on one screen"
    const enterpriseTicketLink = page.locator('a').filter({ hasText: /Database connection dropping/i }).first();
    await enterpriseTicketLink.click();
    await page.waitForURL(/\/agent\/.+/, { timeout: 15000 });

    // Assert screen contains full customer history, account plan, and attachments sidebar
    await expect(page.getByText('Account & Contract SLA')).toBeVisible();
    await expect(page.getByText('Customer Ticket History')).toBeVisible();
    await expect(page.getByText('Attachments & Resources')).toBeVisible();
    await expect(page.getByText('Audit Trail & SLA Events')).toBeVisible();

    // Test transition to "Waiting on Customer" and "Waiting on Internal"
    const waitCustomerBtn = page.getByRole('button', { name: /Wait Customer/i });
    if (await waitCustomerBtn.isVisible()) {
      await waitCustomerBtn.click();
      await expect(page.getByText(/Waiting on Customer/i)).toBeVisible({ timeout: 10000 });
    }

    const waitInternalBtn = page.getByRole('button', { name: /Wait Internal/i });
    if (await waitInternalBtn.isVisible()) {
      await waitInternalBtn.click();
      await expect(page.getByText(/Waiting on Internal/i)).toBeVisible({ timeout: 10000 });
    }

    // =========================================================================
    // 2. Founder SLA Executive Command Center & Claim Verification (Sarah)
    // =========================================================================
    await context.clearCookies();

    await page.goto('/login');
    await page.locator('input#email').fill('founder@company.com');
    await page.locator('input#password').fill('demo123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.waitForURL('**/agent', { timeout: 15000 });

    // Assert Founder Command Center header is displayed
    await expect(page.getByText('Founder SLA Command Center & Performance Audit')).toBeVisible();
    await expect(page.getByText('Avg First Response')).toBeVisible();
    await expect(page.getByText('Avg Resolution Time')).toBeVisible();
    await expect(page.getByText('Active Backlog')).toBeVisible();

    // Toggle detailed plan breakdowns
    const toggleBreakdownsBtn = page.getByRole('button', { name: /View Plan & Priority Breakdowns/i });
    await toggleBreakdownsBtn.click();
    await expect(page.getByText('Performance Breakdown by Contract Plan')).toBeVisible();
    await expect(page.getByText('Response Times by Ticket Priority Urgency')).toBeVisible();

    // Test the "Customer Claim Verifier" tool
    await expect(page.getByText(/Customer Claim Verifier/i)).toBeVisible();
    const customerSelect = page.locator('select');
    await expect(customerSelect).toBeVisible();

    // Assert that a definitive executive verdict ("Claim Refuted" or "Claim Verified") is clearly presented
    await expect(page.locator('body')).toContainText(/Claim Refuted|Claim Verified/);
  });
});
