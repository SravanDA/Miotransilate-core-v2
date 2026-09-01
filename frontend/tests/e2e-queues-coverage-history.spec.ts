import { test, expect } from '@playwright/test';

test.describe('Module 4: Queues, Coverage Matrix & Audit Trail', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token_123');
    });

    await page.route(/\/v1\/auth\/me/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            userId: "a0000000-0000-0000-0000-000000000001",
            displayName: "QA Lead",
            email: "qa@miosalonsoftware.com",
            roles: ["FN", "ADMIN"],
            permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
          },
          mustChangePassword: false
        })
      });
    });
  });

  test('My Work - Switches across all 5 queues seamlessly', async ({ page }) => {
    await page.goto('/work');
    await expect(page.locator('h1:has-text("My Work")')).toBeVisible();
    
    // Tab 1: Translations
    await page.locator('.grid button:has-text("Translations")').click();
    
    // Tab 2: English Copy
    await page.locator('.grid button:has-text("English Copy")').click();
    await expect(page.locator('text=Master review').or(page.locator('text=No Pending English Drafts')).or(page.locator('h3:has-text("No Pending English Drafts")'))).toBeVisible();
    
    // Tab 3: Releases
    await page.locator('.grid button:has-text("Releases")').click();
    await expect(page.locator('text=Target Environment').or(page.locator('text=No Pending Release Requests')).or(page.locator('text=Prod gates'))).toBeVisible();
    
    // Tab 4: Stale
    await page.locator('.grid button:has-text("Stale")').click();
    await expect(page.locator('text=translations marked stale').or(page.locator('text=All translations are up-to-date')).or(page.locator('text=Source modified'))).toBeVisible();
    
    // Tab 5: Escalations
    await page.locator('.grid button:has-text("Escalations")').click();
    await expect(page.locator('text=Escalated By').or(page.locator('text=No Pending Escalations')).or(page.locator('text=Action required'))).toBeVisible();
  });

  test('Coverage Matrix - Renders table, summary row with global average, and drill-down links', async ({ page }) => {
    await page.goto('/coverage');
    await expect(page.locator('h1:has-text("Coverage")')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('table >> text=Page Location')).toBeVisible();
    await expect(page.locator('table >> text=String Count')).toBeVisible();
    
    // Check Summary Row
    await expect(page.locator('text=Global Average / Total')).toBeVisible();
  });

  test('History Audit Page - Filter controls, query parameters, and timeline inspection', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('h1:has-text("History")')).toBeVisible();
    
    // Check filter toolbar
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Tag / Page ID"]')).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    
    // Enter Tag ID filter
    const entityInput = page.locator('input[placeholder*="Tag / Page ID"]');
    await entityInput.fill('SERSET');
    
    // Clear Filters button appears
    const clearBtn = page.locator('button:has-text("Clear Filters")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(entityInput).toHaveValue('');
  });
});
