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
    // Login heading says "MioSalon Translate"
    await expect(page.locator('h1')).toContainText(/MioSalon/i);
    await freshContext.close();
  });

  test('Renders Shell navigation and user profile', async ({ page }) => {
    await page.goto('/pages');
    // Brand header is "MioSalon" + "Translate" as separate spans
    await expect(page.locator('text=MioSalon').first()).toBeVisible();
    // Main nav: Pages, Overview
    await expect(page.locator('text=Pages').first()).toBeVisible();
    await expect(page.locator('text=Overview').first()).toBeVisible();
    // Bottom nav: History, Settings, Guide
    await expect(page.locator('text=History').first()).toBeVisible();
    await expect(page.locator('text=Settings').first()).toBeVisible();
    await expect(page.locator('text=Guide').first()).toBeVisible();
  });

  test('Global Search command palette (Cmd+K) opens and navigates', async ({ page }) => {
    await page.goto('/pages');
    
    // Open via header button
    await page.locator('button:has-text("Search everything...")').click();
    
    // Use .first() because there may be duplicate search inputs in desktop + mobile
    const searchInput = page.locator('input[placeholder*="Search pages, tags"]').first();
    await expect(searchInput).toBeVisible();
    
    // Search for Overview
    await searchInput.fill('Overview');
    await page.keyboard.press('Enter');
    
    await expect(page).toHaveURL(/.*overview/);
    await expect(page.locator('h1:has-text("Overview")')).toBeVisible();
  });

  test('Theme switcher toggles between dark and light modes', async ({ page }) => {
    await page.goto('/pages');
    
    // Record initial theme
    const initialClass = await page.locator('html').getAttribute('class');
    
    // Theme toggle is inside the user dropdown menu
    // The user profile area is in the sidebar bottom — click the chevron dropdown button
    const userArea = page.locator('text=Test Founder').first();
    await userArea.click();
    
    // Click "Switch Theme" button inside dropdown
    const switchThemeBtn = page.locator('button:has-text("Switch Theme")');
    await expect(switchThemeBtn).toBeVisible();
    await switchThemeBtn.click();
    
    // HTML root class should have changed
    const newClass = await page.locator('html').getAttribute('class');
    expect(newClass).toBeDefined();
    expect(newClass).not.toEqual(initialClass);
  });
});
