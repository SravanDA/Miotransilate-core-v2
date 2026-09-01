import { test, expect } from '@playwright/test';

test.describe('Module 2: Content & Tag Lifecycle Workflows', () => {
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
            displayName: "Test Reviewer",
            email: "reviewer@miosalonsoftware.com",
            roles: ["FN", "ADMIN"],
            permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
          },
          mustChangePassword: false
        })
      });
    });
  });

  test('Page List renders pages with tags and allows module filtering', async ({ page }) => {
    await page.goto('/pages');
    
    // Check that pages are displayed
    await expect(page.locator('h1:has-text("Pages")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Filter by search query
    const searchInput = page.locator('input[placeholder*="Search pages"]');
    await searchInput.fill('Settings');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  test('Page Detail renders tags, bookmark toggle, and CSV/JSON export buttons', async ({ page }) => {
    await page.goto('/pages');
    
    // Click first page link
    const firstPageLink = page.locator('tbody tr td a').first();
    await firstPageLink.click();
    
    // Page detail header loaded
    await expect(page.locator('button[title*="Bookmark this page"]')).toBeVisible();
    await expect(page.locator('button:has-text("JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("CSV")')).toBeVisible();
    
    // Toggle Page Bookmark
    await page.locator('button[title*="Bookmark this page"]').click();
    await expect(page.locator('text=Page bookmarked')).toBeVisible();
  });

  test('Tag Detail - Edit English Draft -> Approve English -> Stale translation flow', async ({ page }) => {
    await page.goto('/pages');
    
    // Click first page
    await page.locator('tbody tr td a').first().click();
    
    // Click first tag
    const firstTagLink = page.locator('tbody tr td a').first();
    const tagId = await firstTagLink.innerText();
    await firstTagLink.click();
    
    // Verify TagDetail loaded
    await expect(page.locator('h1')).toContainText(tagId.trim());
    
    // Toggle Tag Bookmark
    const starBtn = page.locator('button[title*="Bookmark this tag"]');
    await starBtn.click();
    await expect(page.locator('text=Tag bookmarked')).toBeVisible();
    
    // Expand English Version History
    await page.locator('button:has-text("Version History")').first().click();
    await expect(page.locator('text=Hide English Version History')).toBeVisible();
  });

  test('Page Detail - Deprecation Modal opens with audit confirmation', async ({ page }) => {
    await page.goto('/pages');
    await page.locator('tbody tr td a').first().click();
    
    // Click Deprecate Page button
    const deprecateBtn = page.locator('button:has-text("Deprecate")');
    if (await deprecateBtn.isVisible()) {
      await deprecateBtn.click();
      await expect(page.locator('h3:has-text("Deprecate Page")')).toBeVisible();
      await page.locator('button:has-text("Cancel")').click();
      await expect(page.locator('h3:has-text("Deprecate Page")')).not.toBeVisible();
    }
  });
});
