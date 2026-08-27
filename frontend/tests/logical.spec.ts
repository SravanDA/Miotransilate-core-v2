import { test, expect } from '@playwright/test';

// Setup Mocking Helper
const mockAPI = async (page: any) => {
  await page.route(/\/v1\/pages/, async (route) => {
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

  await page.route(/\/v1\/languages/, async (route) => {
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

  await page.route(/\/v1\/config/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { configKey: "AI_CONFIDENCE_THRESHOLD", configValue: "95", etagVersion: 1 }
        ])
      });
    } else if (route.request().method() === 'PATCH') {
      // Mock a 409 conflict when patching config to test optimistic concurrency banner
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
  test.beforeEach(async ({ page }) => {
    await mockAPI(page);
  });

  test('Page List renders mocked data correctly', async ({ page }) => {
    await page.goto('/pages');
    await expect(page.locator('table >> text=Quick Sale')).toBeVisible();
    await expect(page.locator('table >> text=Settings')).toBeVisible();
    await expect(page.locator('td', { hasText: /^0$/ }).first()).toBeVisible();
  });

  test('Settings Page - Adding a new language', async ({ page }) => {
    await page.goto('/settings');
    
    // Wait for languages to load
    await expect(page.locator('text=Spanish')).toBeVisible();

    // Click Add Language
    await page.locator('button:has-text("Add Language")').click();
    
    // Fill form
    await page.fill('input[placeholder="e.g., pt-BR"]', 'pt');
    await page.fill('input[placeholder="e.g., Portuguese"]', 'Portuguese');
    
    // Submit
    await page.locator('button[type="submit"]').click();
    
    // Verify success toast
    await expect(page.locator('text=Language Portuguese added.')).toBeVisible();
  });

  test('Settings Page - Optimistic Concurrency 409 error on Config save', async ({ page }) => {
    await page.goto('/settings');
    
    // Switch to Configuration tab
    await page.locator('button:has-text("Configuration")').click();
    
    // Wait for Config to load (95 is from our mock)
    await expect(page.getByText('Confidence Threshold (95%)')).toBeVisible();
    
    // Click Save (this triggers the PATCH request which we mocked to fail with 409)
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Verify the conflict toast appears
    await expect(page.locator('text=Conflict: Configuration modified by another user.')).toBeVisible();
  });
});

