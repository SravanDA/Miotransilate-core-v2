import { test, expect } from '@playwright/test';

// Setup Mocking Helper
const mockAPI = async (page: any) => {
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

  await page.route(/\/v1\/(admin\/)?languages/, async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          languageCode: "pt",
          languageName: "Portuguese",
          direction: "LTR",
          status: "ACTIVE"
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { languageCode: "es", languageName: "Spanish", direction: "LTR", status: "ACTIVE" }
        ])
      });
    }
  });

  await page.route(/\/v1\/(admin\/)?config/, async (route: any) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { configKey: "AI_CONFIDENCE_THRESHOLD", configValue: "95", etagVersion: 1 }
        ])
      });
    } else if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: "Optimistic concurrency failure" })
      });
    } else {
      route.continue();
    }
  });
};

test.describe('Logical End-to-End Workflows', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token');
    });
    await mockAPI(page);
  });

  test('Page List renders mocked data correctly', async ({ page }) => {
    await page.goto('/pages');
    await expect(page.locator('table >> text=Quick Sale')).toBeVisible();
    await expect(page.locator('table >> text=Settings')).toBeVisible();
  });

  test('Settings Page - Adding a new language', async ({ page }) => {
    await page.goto('/settings');
    
    // Wait for languages tab
    await page.locator('button:has-text("Languages")').first().click();

    // Click Add Language
    await page.locator('button:has-text("Add Language")').click();
    
    // Actual placeholders: "Code (e.g. it)" and "Name (e.g. Italian)"
    await page.fill('input[placeholder="Code (e.g. it)"]', 'pt');
    await page.fill('input[placeholder="Name (e.g. Italian)"]', 'Portuguese');
    
    // Submit button says "Save"
    await page.locator('button:has-text("Save")').click();
    
    // Actual toast: "Added Portuguese to languages"
    await expect(page.locator('text=Added Portuguese to languages')).toBeVisible();
  });

  test('Settings Page - AI & Automation Config tab loads correctly', async ({ page }) => {
    await page.goto('/settings');
    
    // Switch to AI & Automation tab
    await page.locator('button:has-text("AI & Automation")').click();
    
    // Wait for Config to load
    await expect(page.getByText('Confidence Threshold')).toBeVisible();
  });
});
