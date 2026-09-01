import { test, expect } from '@playwright/test';

test.describe('Module 5: Administration, Languages, Roles & Settings', () => {
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
            displayName: "System Admin",
            email: "admin@miosalonsoftware.com",
            roles: ["FN", "ADMIN"],
            permissions: ["ADMIN_CONFIG", "PUBLISH_DEV", "AUDIT_VIEW", "SUBMIT_FOR_REVIEW", "EXPORT", "TRANSLATION_EDIT", "ADMIN_USERS", "ROLLBACK", "TRANSLATION_APPROVE", "ADMIN_MIGRATION", "PUBLISH_PRODUCTION", "PUBLISH_QA", "TRANSLATION_CREATE", "ENGLISH_APPROVE", "ENGLISH_AUTHOR", "TRANSLATION_BULK_APPROVE", "ADMIN_LANGUAGES", "CONTENT_VIEW", "PAGE_TAG_CREATE", "COMMENT_CREATE", "HISTORY_VIEW"]
          },
          mustChangePassword: false
        })
      });
    });

    await page.route(/\/v1\/admin\/languages/, async (route) => {
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

    await page.route(/\/v1\/admin\/config/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { configKey: "AI_CONFIDENCE_THRESHOLD", configValue: "85", etagVersion: 1 }
          ])
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    await page.route(/\/v1\/users/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            userId: "u-101",
            email: "translator@miosalon.com",
            displayName: "Translator User",
            isActive: true,
            roles: [{ roleName: "TRANSLATOR", roleCode: "TR", assignmentId: "as-1" }]
          }
        ])
      });
    });
  });

  test('Settings - Switch across all 4 administration tabs', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    
    // Tab 1: Languages
    await page.locator('button:has-text("Languages")').first().click();
    await expect(page.locator('button:has-text("Add Language")')).toBeVisible();
    
    // Tab 2: Users & Access
    await page.locator('button:has-text("Users & Access")').first().click();
    await expect(page.locator('button:has-text("Invite User")')).toBeVisible();
    
    // Tab 3: AI & Automation
    await page.locator('button:has-text("AI & Automation")').first().click();
    await expect(page.locator('text=Confidence Threshold')).toBeVisible();
    
    // Tab 4: Import & Export
    await page.locator('button:has-text("Import & Export")').first().click();
    await expect(page.locator('text=Export Full Catalog')).toBeVisible();
  });

  test('Settings - Add Language modal opens, accepts inputs, and submits', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('button:has-text("Languages")').first().click();
    
    // Open Add Language form
    await page.locator('button:has-text("Add Language")').click();
    
    // Enter inputs
    await page.locator('input[placeholder="e.g., pt-BR"]').fill('pt');
    await page.locator('input[placeholder="e.g., Portuguese"]').fill('Portuguese');
    
    // Submit
    await page.locator('button[type="submit"]:has-text("Add Language")').click();
    await expect(page.locator('text=Language Portuguese added.')).toBeVisible();
  });

  test('Settings - Invite User Modal opens and closes', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('button:has-text("Users & Access")').first().click();
    
    // Open Invite Form
    await page.locator('button:has-text("Invite User")').click();
    await expect(page.locator('button:has-text("Create User")')).toBeVisible();
    
    // Close form
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('button:has-text("Create User")')).not.toBeVisible();
  });
});
