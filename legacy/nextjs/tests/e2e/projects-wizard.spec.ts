import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createUserAndHousehold, cleanupTestData } from "./helpers/test-data";

let testUserId: string;
let testHouseholdId: string;
let testUserEmail: string;
let testUserPassword: string;

test.describe("Project Creation Wizard", () => {
  test.beforeEach(async ({ page }) => {
    const testData = await createUserAndHousehold();
    testUserId = testData.userId;
    testHouseholdId = testData.householdId;
    testUserEmail = testData.email;
    testUserPassword = testData.password;

    await page.goto("/auth");
    await page.fill('input[type="email"]', testUserEmail);
    await page.fill('input[type="password"]', testUserPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app/dashboard");
    await page.goto("/app/projects");
  });

  test.afterEach(async () => {
    if (testUserId && testHouseholdId) {
      await cleanupTestData(testUserId, testHouseholdId);
    }
  });

  test("should open wizard dialog from projects list", async ({ page }) => {
    // Click the "Create Project with AI" button
    await page.click('button:has-text("Create Project with AI")');

    // Dialog should be visible
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(
      page.locator('text="Create Project with AI"')
    ).toBeVisible();

    // Should show step 1
    await expect(page.locator('text="Project Details"')).toBeVisible();
  });

  test("should validate required fields in step 1", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")');

    // Should show validation errors
    await expect(
      page.locator('text="Project title is required"')
    ).toBeVisible();
    await expect(
      page.locator('text="At least one zone must be selected"')
    ).toBeVisible();
  });

  test("should complete step 1 with valid data", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Fill in project details
    await page.fill('input[id="title"]', "Kitchen Renovation");
    await page.fill(
      'textarea[id="description"]',
      "Complete kitchen remodel with new cabinets and appliances"
    );

    // Select a zone (assuming there's at least one)
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape"); // Close zone picker

    // Set priority
    await page.locator('input[type="range"]').fill("4");

    // Set budget
    await page.fill('input[id="budget"]', "15000");

    // Add tags
    await page.fill('input[id="tags"]', "renovation, kitchen, appliances");

    // Proceed to next step
    await page.click('button:has-text("Next")');

    // Should be on step 2
    await expect(page.locator('text="Supporting Documents"')).toBeVisible();
  });

  test("should allow file upload in step 2", async ({ page }) => {
    // Complete step 1
    await page.click('button:has-text("Create Project with AI")');
    await page.fill('input[id="title"]', "Bathroom Update");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.click('button:has-text("Next")');

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "floor-plan.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image-content"),
    });

    // File should appear in the list
    await expect(page.locator('text="floor-plan.png"')).toBeVisible();

    // Should show file size
    await expect(page.locator('text="KB"')).toBeVisible();
  });

  test("should allow removing uploaded files in step 2", async ({ page }) => {
    // Complete step 1 and upload file
    await page.click('button:has-text("Create Project with AI")');
    await page.fill('input[id="title"]', "Deck Repair");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.click('button:has-text("Next")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });

    await expect(page.locator('text="test.pdf"')).toBeVisible();

    // Remove the file
    await page.click('button[title*="Remove"]');

    // File should be gone
    await expect(page.locator('text="test.pdf"')).not.toBeVisible();
    await expect(
      page.locator('text="No documents uploaded yet"')
    ).toBeVisible();
  });

  test("should navigate back and forth between steps", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Complete step 1
    await page.fill('input[id="title"]', "Test Project");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.click('button:has-text("Next")');

    await expect(page.locator('text="Supporting Documents"')).toBeVisible();

    // Go back
    await page.click('button:has-text("Back")');
    await expect(page.locator('text="Project Details"')).toBeVisible();

    // Data should be preserved
    await expect(page.locator('input[id="title"]')).toHaveValue("Test Project");

    // Go forward again
    await page.click('button:has-text("Next")');
    await expect(page.locator('text="Supporting Documents"')).toBeVisible();

    // Skip upload and go to step 3
    await page.click('button:has-text("Next")');

    // Should show loading state while generating plan
    await expect(
      page.locator('text="Generating plan..."', { timeout: 10000 })
    ).toBeVisible();
  });

  test("should generate AI plan in step 3", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Complete steps 1 and 2
    await page.fill('input[id="title"]', "Garden Landscaping");
    await page.fill(
      'textarea[id="description"]',
      "Create a sustainable garden with native plants"
    );
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.fill('input[id="budget"]', "5000");
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Wait for AI generation (this will take a few seconds)
    await expect(
      page.locator('text="Refined Description"', { timeout: 15000 })
    ).toBeVisible();

    // Should show suggested tasks and notes
    await expect(page.locator('text="Suggested Tasks"')).toBeVisible();
    await expect(
      page.locator('text="Research & Considerations"')
    ).toBeVisible();
  });

  test("should allow regenerating AI plan", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Complete steps to reach AI generation
    await page.fill('input[id="title"]', "Roof Replacement");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Wait for initial plan
    await expect(
      page.locator('text="Refined Description"', { timeout: 15000 })
    ).toBeVisible();

    // Click regenerate
    await page.click('button:has-text("Regenerate")');

    // Should show loading state
    await expect(page.locator('text="Generating plan..."')).toBeVisible();

    // Should show new plan
    await expect(
      page.locator('text="Refined Description"', { timeout: 15000 })
    ).toBeVisible();
  });

  test("should create project with all data", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Complete full flow
    await page.fill('input[id="title"]', "Window Replacement");
    await page.fill('textarea[id="description"]', "Replace all windows");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.fill('input[id="budget"]', "8000");
    await page.fill('input[id="tags"]', "windows, energy-efficiency");
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Wait for plan generation
    await expect(
      page.locator('text="Refined Description"', { timeout: 15000 })
    ).toBeVisible();

    // Create project
    await page.click('button:has-text("Create Project")');

    // Should show success message
    await expect(
      page.locator('text*="Project created"', { timeout: 10000 })
    ).toBeVisible();

    // Dialog should close
    await expect(page.locator('role=dialog')).not.toBeVisible();

    // Should be redirected to projects list
    await expect(page).toHaveURL(/.*\/app\/projects/);

    // New project should appear in list
    await expect(page.locator('text="Window Replacement"')).toBeVisible();
  });

  test("should cancel and close dialog", async ({ page }) => {
    await page.click('button:has-text("Create Project with AI")');

    await page.fill('input[id="title"]', "Test Project");

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Dialog should close
    await expect(page.locator('role=dialog')).not.toBeVisible();

    // Should not create project
    await expect(page.locator('text="Test Project"')).not.toBeVisible();
  });

  test("should handle errors gracefully", async ({ page }) => {
    // Mock API error by intercepting the request
    await page.route("**/api/projects/plan", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "API Error" }),
      });
    });

    await page.click('button:has-text("Create Project with AI")');

    await page.fill('input[id="title"]', "Error Test");
    await page.click('button:has-text("Select zones")');
    await page.click('role=checkbox').first();
    await page.keyboard.press("Escape");
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Should show error message
    await expect(
      page.locator('text*="Error generating plan"', { timeout: 10000 })
    ).toBeVisible();

    // Should allow retrying
    await expect(page.locator('button:has-text("Regenerate")')).toBeVisible();
  });

  test("should preserve form data when navigating away and back", async ({
    page,
  }) => {
    await page.click('button:has-text("Create Project with AI")');

    // Fill in some data
    await page.fill('input[id="title"]', "Persistent Data Test");
    await page.fill('input[id="budget"]', "3000");

    // Close dialog
    await page.click('button:has-text("Cancel")');

    // Reopen (data should reset for new wizard session)
    await page.click('button:has-text("Create Project with AI")');

    // Should be a fresh form
    await expect(page.locator('input[id="title"]')).toHaveValue("");
  });
});
