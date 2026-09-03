import { test, expect } from '@playwright/test';

// Setup Mocking Helper for Visual Tests
const mockAPI = async (page: any) => {
  await page.route(/\/v1\/dashboard\/coverage/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { pageId: "Quick Sale", languageCode: "ar", coveragePercent: 100, totalTags: 24, translatedTags: 24 },
        { pageId: "Quick Sale", languageCode: "es", coveragePercent: 85, totalTags: 24, translatedTags: 20 },
        { pageId: "Settings", languageCode: "ar", coveragePercent: 40, totalTags: 156, translatedTags: 60 },
        { pageId: "Settings", languageCode: "es", coveragePercent: 0, totalTags: 156, translatedTags: 0 }
      ])
    });
  });

  await page.route(/\/v1\/pages/, async (route: any) => {
    if (route.request().method() === 'GET' && !route.request().url().includes('/tags')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { pageId: "page-001", pageName: "Quick Sale", module: "POS", status: "ACTIVE" },
          { pageId: "page-002", pageName: "Settings", module: "POS", status: "ACTIVE" }
        ])
      });
    } else {
      route.continue();
    }
  });

  await page.route(/\/v1\/auth\/me/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          userId: "a0000000-0000-0000-0000-000000000001",
          displayName: "Founder",
          email: "founder@miosalonsoftware.com",
          roles: ["FN", "ADMIN"],
          permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
        },
        mustChangePassword: false
      })
    });
  });

  await page.route(/\/v1\/dashboard\/environments/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { environment: "PRODUCTION", version: 4 },
        { environment: "QA", version: 5 },
        { environment: "DEV", version: 12 }
      ])
    });
  });
};

test.describe('Pixel-Level Visual Regression Audits', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token');
    });
    await mockAPI(page);
  });

  test('Pages List Visual Audit', async ({ page }) => {
    // /coverage redirects to /pages now
    await page.goto('/pages');
    // Wait for pages to render
    await expect(page.locator('h1:has-text("Pages")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Take full page screenshot and compare
    await expect(page).toHaveScreenshot('pages-list.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05
    });
  });

  test('Overview Dashboard Visual Audit', async ({ page }) => {
    // /deployments redirects to /overview
    await page.goto('/overview');
    // Wait for overview to load
    await expect(page.locator('h1:has-text("Overview")')).toBeVisible();
    
    // Verify the queue cards are visible
    await expect(page.locator('text=Translations').first()).toBeVisible();
    
    await expect(page).toHaveScreenshot('overview-dashboard.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05
    });
  });
});
