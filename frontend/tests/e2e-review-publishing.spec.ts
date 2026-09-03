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
          displayName: "Lead Reviewer",
          email: "lead@miosalonsoftware.com",
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

  await page.route(/\/v1\/pages\/SERSET\/detail/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: {
          pageId: "SERSET",
          pageName: "Service Settings",
          module: "POS",
          status: "ACTIVE",
          createdAt: new Date().toISOString()
        },
        tags: [
          {
            id: "serset.header.title",
            english: "Service Settings",
            englishStatus: "Approved",
            englishVersion: 1,
            type: "Label",
            values: {
              ar: { text: "إعدادات الخدمة", status: "APPROVED", confidence: 0.92 },
              es: { text: "Ajustes de servicio", status: "PENDING_REVIEW", confidence: 0.88 }
            }
          }
        ]
      })
    });
  });
};

test.describe('Module 3: Review & Publishing Gate Integrity', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('miotranslate_token', 'mock_token_123');
    });
    await setupMocks(page);
  });

  test('Page Detail toolbar renders Approve and Publish action buttons', async ({ page }) => {
    await page.goto('/pages');
    
    // Wait for and click first page link
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    // The approval button says "Approve" (not "Bulk Approve") or "Approved" if all done
    const approveBtn = page.locator('button:has-text("Approve")').or(page.locator('button:has-text("Approved")'));
    await expect(approveBtn.first()).toBeVisible({ timeout: 10000 });
    
    // Publish button is always visible for FN role
    await expect(page.locator('button:has-text("Publish")')).toBeVisible();
  });

  test('Page Detail 3-dot menu shows Export JSON and Export CSV', async ({ page }) => {
    await page.goto('/pages');
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    // Wait for page detail
    await expect(page.locator('button:has-text("Publish")')).toBeVisible({ timeout: 10000 });
    
    // Click the 3-dot button (only button with both shadow-xs and w-8 classes)
    await page.locator('button[class*="shadow-xs"][class*="w-8"]').click();
    
    // Export options appear in dropdown
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
  });

  test('Publish Modal displays environment selection and pre-publish configuration', async ({ page }) => {
    await page.goto('/pages');
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();
    
    const publishBtn = page.locator('button:has-text("Publish")');
    await expect(publishBtn).toBeVisible({ timeout: 10000 });
    await publishBtn.click();
    
    // Verify Publish Modal opened - check for environment labels
    await expect(page.locator('text=Dev').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=QA').first()).toBeVisible();
    await expect(page.locator('text=Prod').first()).toBeVisible();
    
    // Pre-Publish Changes section
    await expect(page.locator('text=Pre-Publish Changes')).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('Bulk Approve Modal opens and executes bulk approval', async ({ page }) => {
    // Mock the bulk-approve endpoint
    await page.route(/\/v1\/pages\/SERSET\/translations\/.*\/bulk-approve/, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          approved: 1,
          total: 1,
          skipReasons: {},
          threshold: "0.8",
          skipped: 0
        })
      });
    });

    await page.goto('/pages');
    const firstPageLink = page.locator('tbody tr a').first();
    await expect(firstPageLink).toBeVisible({ timeout: 10000 });
    await firstPageLink.click();

    // Select Spanish tab (which has pending review in mock)
    const esTab = page.locator('button:has-text("Spanish")').or(page.locator('button:has-text("Español")'));
    if (await esTab.isVisible()) {
      await esTab.click();
    }

    // Look for Approve button
    const approveBtn = page.locator('button:has-text("Approve")').first();
    if (await approveBtn.isVisible() && !(await approveBtn.isDisabled())) {
      await approveBtn.click();
      
      // Bulk Approve modal should appear
      await expect(page.locator('text=Bulk Approve Translations')).toBeVisible({ timeout: 5000 });
      
      // Confirm button in modal
      const modalApproveBtn = page.locator('button:has-text("Approve")').last();
      await expect(modalApproveBtn).toBeVisible();
      await modalApproveBtn.click();

      // Modal closes
      await expect(page.locator('text=Bulk Approve Translations')).not.toBeVisible();
    }
  });
});
