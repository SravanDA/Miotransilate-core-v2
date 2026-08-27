import { test, expect } from '@playwright/test';

// Setup Mocking Helper for Visual Tests
const mockAPI = async (page: any) => {
  await page.route(/\/v1\/dashboard\/coverage/, async (route) => {
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

  await page.route(/\/v1\/pages/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { pageId: "Quick Sale", pageName: "Quick Sale", module: "POS", status: "ACTIVE" },
        { pageId: "Settings", pageName: "Settings", module: "POS", status: "ACTIVE" }
      ])
    });
  });

  await page.route(/\/v1\/dashboard\/environments/, async (route) => {
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
  test.beforeEach(async ({ page }) => {
    await mockAPI(page);
  });

  test('Coverage Dashboard Visual Audit', async ({ page }) => {
    await page.goto('/coverage');
    // Wait for the matrix to render completely by looking for "Quick Sale"
    await expect(page.locator('table >> text=Quick Sale')).toBeVisible();
    await expect(page.locator('table >> text=Settings')).toBeVisible();
    
    // Take full page screenshot and compare
    await expect(page).toHaveScreenshot('coverage-dashboard-matrix.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05
    });
  });

  test('Deployment History Visual Audit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("miotranslate_deployments_v2", JSON.stringify([
        { 
          id: "1", 
          pageId: "Quick Sale", 
          pageName: "Quick Sale", 
          language: "ar", 
          environment: "PRODUCTION", 
          version: 4, 
          publishedAt: "2023-10-01T12:00:00Z", 
          status: "SUCCESSFUL" 
        }
      ]));
    });
    await page.goto('/deployments');
    // Wait for deployments to load
    await expect(page.getByRole('heading', { name: 'PRODUCTION' })).toBeVisible();
    await expect(page.getByText('v4', { exact: true })).toBeVisible();
    
    await expect(page).toHaveScreenshot('deployment-history.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05
    });
  });
});
