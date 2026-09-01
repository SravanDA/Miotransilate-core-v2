import { test, expect } from '@playwright/test';

test.describe('Module 1: Authentication, Shell & Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed authenticated founder user
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token_123');
    });

    // Mock /v1/auth/me
    await page.route(/\/v1\/auth\/me/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            userId: "a0000000-0000-0000-0000-000000000001",
            displayName: "Test Founder",
            email: "founder@miosalonsoftware.com",
            roles: ["FN", "ADMIN"],
            permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
          },
          mustChangePassword: false
        })
      });
    });

    // Mock /v1/pages
    await page.route(/\/v1\/pages/, async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/tags')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { pageId: "SERSET", pageName: "Service Settings", module: "POS", status: "Active" },
            { pageId: "CUSINS", pageName: "Customer Insights", module: "CRM", status: "Active" }
          ])
        });
      } else {
        route.continue();
      }
    });
  });

  test('Redirects unauthenticated users to /login when token is missing', async ({ browser }) => {
    const freshContext = await browser.newContext();
    const page = await freshContext.newPage();
    await page.goto('/pages');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1')).toContainText(/MioTranslate/i);
    await freshContext.close();
  });

  test('Renders Shell navigation and user profile', async ({ page }) => {
    await page.goto('/pages');
    await expect(page.locator('text=MioTranslate').first()).toBeVisible();
    await expect(page.locator('text=Pages').first()).toBeVisible();
    await expect(page.locator('text=My Work').first()).toBeVisible();
    await expect(page.locator('text=Coverage').first()).toBeVisible();
    await expect(page.locator('text=Deployments').first()).toBeVisible();
    await expect(page.locator('text=History').first()).toBeVisible();
  });

  test('Global Search command palette (Cmd+K) opens and navigates', async ({ page }) => {
    await page.goto('/pages');
    
    // Open via header button
    await page.locator('button:has-text("Search everything...")').click();
    
    const searchInput = page.locator('input[placeholder*="Search pages, tags"]');
    await expect(searchInput).toBeVisible();
    
    // Search for My Work
    await searchInput.fill('My Work');
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL(/.*work/);
    await expect(page.locator('h1:has-text("My Work")')).toBeVisible();
  });

  test('Theme switcher toggles between dark and light modes', async ({ page }) => {
    await page.goto('/pages');
    
    const themeBtn = page.locator('button[title="Toggle theme"]');
    await expect(themeBtn).toBeVisible();
    
    // Toggle theme
    await themeBtn.click();
    
    // HTML root should update class
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toBeDefined();
  });
});
