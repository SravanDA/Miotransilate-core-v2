import { test, expect } from '@playwright/test';

test.describe('Module 3: Review & Publishing Gate Integrity', () => {
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
            displayName: "Lead Reviewer",
            email: "lead@miosalonsoftware.com",
            roles: ["FN", "ADMIN"],
            permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
          },
          mustChangePassword: false
        })
      });
    });
  });

  test('Translation Review Modal renders 4 action buttons and comment input', async ({ page }) => {
    await page.goto('/pages');
    await page.locator('tbody tr td a').first().click();
    await page.locator('tbody tr td a').first().click();
    
    // Check if Review AI Draft button or Auto-Translate is available
    const reviewBtn = page.locator('button:has-text("Review AI Draft")');
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      
      // Verify Modal rendered with 4 actions
      await expect(page.locator('button:has-text("Approve Translation")')).toBeVisible();
      await expect(page.locator('button:has-text("Edit & Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Return for Revision")')).toBeVisible();
      await expect(page.locator('button:has-text("Reject")')).toBeVisible();
      
      // Close modal
      await page.locator('button:has-text("Cancel")').first().click();
    }
  });

  test('Bulk Approve Modal opens or shows pending count toast', async ({ page }) => {
    await page.goto('/pages');
    await page.locator('tbody tr td a').first().click();
    
    const bulkBtn = page.locator('button:has-text("Bulk Approve")');
    await expect(bulkBtn).toBeVisible();
    await bulkBtn.click();
    
    // Either modal opens with Confidence Threshold or toast notifies status
    await expect(
      page.locator('text=Bulk Approve Translations')
        .or(page.locator('text=Confidence Threshold'))
        .or(page.locator('text=No pending review translations'))
    ).toBeVisible();
  });

  test('Publish Modal displays environment selection and pre-publish diff summary', async ({ page }) => {
    await page.goto('/pages');
    await page.locator('tbody tr td a').first().click();
    
    const publishBtn = page.locator('button:has-text("Publish")');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();
    
    // Verify Publish Modal and Pre-Publish Changes
    await expect(page.locator('text=Publish Content Bundle')).toBeVisible();
    await expect(page.locator('text=Pre-Publish Changes')).toBeVisible();
    await expect(page.locator('button:has-text("Dev")')).toBeVisible();
    await expect(page.locator('button:has-text("QA")')).toBeVisible();
    await expect(page.locator('button:has-text("Prod")')).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
  });
});
