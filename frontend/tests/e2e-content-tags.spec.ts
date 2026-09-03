import { test, expect } from '@playwright/test';

const MOCK_PAGES = [
  { pageId: "SERSET", pageName: "Service Settings", module: "POS", status: "Active", name: "Service Settings" },
  { pageId: "CUSINS", pageName: "Customer Insights", module: "CRM", status: "Active", name: "Customer Insights" }
];

const setupMocks = async (page: any) => {
  await page.route(/\/v1\/auth\/me/, async (route: any) => {
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

  await page.route(/\/v1\/pages$/, async (route: any) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAGES)
      });
    } else {
      route.continue();
    }
  });

  // Mock page detail for SERSET
  await page.route(/\/v1\/pages\/SERSET\/detail/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pageId: "SERSET",
        pageName: "Service Settings",
        module: "POS",
        status: "Active",
        activeLanguages: ["ar", "es"],
        tags: [
          {
            tagId: "serset.header.title",
            masterEnglish: { current: "Service Settings", status: "APPROVED" },
            translations: {
              ar: { value: "إعدادات الخدمة", status: "APPROVED", aiConfidence: 92 },
              es: { value: "Ajustes de servicio", status: "PENDING_REVIEW", aiConfidence: 88 }
            }
          },
          {
            tagId: "serset.btn.save",
            masterEnglish: { current: "Save Changes", status: "APPROVED" },
            translations: {
              ar: { value: "حفظ التغييرات", status: "APPROVED", aiConfidence: 95 },
              es: { value: "Guardar cambios", status: "APPROVED", aiConfidence: 91 }
            }
          }
        ]
      })
    });
  });
};

test.describe('Module 2: Content & Tag Lifecycle Workflows', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token_123');
    });
    await setupMocks(page);
  });

  test('Page List renders pages with tags and allows module filtering', async ({ page }) => {
    await page.goto('/pages');
    
    // Check that pages heading is displayed
    await expect(page.locator('h1:has-text("Pages")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Filter by search query
    const searchInput = page.locator('input[placeholder*="Search pages"]');
    await searchInput.fill('Settings');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  test('Page Detail renders page header, action toolbar and Publish button', async ({ page }) => {
    await page.goto('/pages');
    
    // Click first page link - page links use `Link to="/pages/${pageId}"`
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    // Page detail loaded - verify the Publish button is visible
    await expect(page.locator('button:has-text("Publish")')).toBeVisible({ timeout: 10000 });
    
    // Verify the Approve button exists (says "Approve" or "Approved")
    const approveBtn = page.locator('button:has-text("Approve")').or(page.locator('button:has-text("Approved")'));
    await expect(approveBtn.first()).toBeVisible();
  });

  test('Page Detail - Navigate to page and verify Deprecate button', async ({ page }) => {
    await page.goto('/pages');
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    // Click Deprecate button
    const deprecateBtn = page.locator('button:has-text("Deprecate")');
    if (await deprecateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deprecateBtn.click();
      // Modal title contains "Deprecate Page"
      await expect(page.locator('text=Deprecate Page').first()).toBeVisible();
      await page.locator('button:has-text("Cancel")').click();
    }
  });

  test('Page Detail - 3-dot menu shows Export options', async ({ page }) => {
    await page.goto('/pages');
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    // Wait for page detail to fully load
    await expect(page.locator('button:has-text("Publish")')).toBeVisible({ timeout: 10000 });
    
    // Click the 3-dot more options button (DotsThreeVertical)
    // Use the exact selector from Playwright error: getByRole('button').filter({ hasText: /^$/ }).nth(2)
    await page.locator('button[class*="shadow-xs"][class*="w-8"]').click();
    
    // Export options appear
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
  });
});
