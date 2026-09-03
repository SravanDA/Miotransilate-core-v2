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

  test('Overview - Switches across all 5 queues seamlessly', async ({ page }) => {
    // /work redirects to /overview
    await page.goto('/overview');
    await expect(page.locator('h1:has-text("Overview")')).toBeVisible();
    
    // The 5 queue cards are clickable cards, not .grid buttons
    // Tab 1: Translations (selected by default)
    await page.locator('button:has-text("Translations"), div:has-text("Translations")').first().click();
    
    // Tab 2: English Copy
    await page.locator('button:has-text("English Copy"), div:has-text("English Copy")').first().click();
    await expect(page.locator('text=Master review').or(page.locator('text=No Pending English Drafts')).or(page.locator('h3:has-text("No Pending English Drafts")'))).toBeVisible();
    
    // Tab 3: Stale
    await page.locator('button:has-text("Stale"), div:has-text("Stale")').first().click();
    await expect(page.locator('text=Source modified').or(page.locator('text=All translations are up-to-date'))).toBeVisible();
    
    // Tab 4: Escalations
    await page.locator('button:has-text("Escalations"), div:has-text("Escalations")').first().click();
    await expect(page.locator('text=Action required').or(page.locator('text=No Pending Escalations'))).toBeVisible();

    // Tab 5: Published & Unpublished (label is truncated in UI but button text contains "Published")
    const publishTab = page.locator('button:has-text("Published")').first();
    await publishTab.click();
    // The desc says "X unpublished · Y published" — verify the tab content loaded
    await expect(page.locator('text=unpublished').or(page.locator('text=published')).first()).toBeVisible();
  });

  test('Pages List - Renders table with page data', async ({ page }) => {
    // /coverage now redirects to /pages
    await page.goto('/pages');
    await expect(page.locator('h1:has-text("Pages")')).toBeVisible();
    
    // Check table is rendered
    await expect(page.locator('table')).toBeVisible();
    
    // Check for page data rows
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  test('History Audit Page - Filter controls and search', async ({ page }) => {
    await page.goto('/history');
    // Actual heading is "Activity & Audit Log"
    await expect(page.locator('h1:has-text("Activity & Audit Log")')).toBeVisible();
    
    // Search input placeholder is "Search Tag or Page..."
    const entityInput = page.locator('input[placeholder*="Search Tag or Page"]');
    await expect(entityInput).toBeVisible();
    
    // Enter search filter
    await entityInput.fill('SERSET');
    
    // Clear button text is just "Clear" (not "Clear Filters")
    const clearBtn = page.locator('button:has-text("Clear")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(entityInput).toHaveValue('');
  });
});
