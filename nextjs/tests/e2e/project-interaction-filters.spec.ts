// nextjs/tests/e2e/project-interaction-filters.spec.ts
import { test, expect } from "@playwright/test";
import {
    createTestUser,
    cleanupTestUser,
    createTestProject,
    createTestInteraction,
    type TestUserContext
} from "./utils/supabaseAdmin";

test.describe("Project Interaction Filters", () => {
    let testUserContext: TestUserContext;
    let projectId: string;

    test.beforeEach(async ({ page }) => {
        // Create test user and household
        testUserContext = await createTestUser();

        // Create test project
        projectId = await createTestProject(testUserContext.householdId, {
            title: "Test Project",
            description: "Test project for filter testing"
        });

        // Create test interactions with different types and statuses
        await createTestInteraction(testUserContext.householdId, {
            subject: "Completed Task",
            type: "todo",
            status: "done",
            project_id: projectId
        });

        await createTestInteraction(testUserContext.householdId, {
            subject: "Pending Task",
            type: "todo",
            status: "pending",
            project_id: projectId
        });

        await createTestInteraction(testUserContext.householdId, {
            subject: "In Progress Task",
            type: "todo",
            status: "in_progress",
            project_id: projectId
        });

        await createTestInteraction(testUserContext.householdId, {
            subject: "Regular Note",
            type: "note",
            status: null,
            project_id: projectId
        });

        await createTestInteraction(testUserContext.householdId, {
            subject: "Archived Expense",
            type: "expense",
            status: "archived",
            project_id: projectId
        });

        // Navigate to project page
        await page.goto(`/app/projects/${projectId}`);
        await expect(page).toHaveURL(`/app/projects/${projectId}`);
    });

    test.afterEach(async () => {
        await cleanupTestUser(testUserContext);
    });

    test("should hide incomplete tasks by default", async ({ page }) => {
        // Wait for project page to load
        await expect(page.locator('h1')).toContainText('Test Project');

        // Check that completed task is visible
        await expect(page.getByText("Completed Task")).toBeVisible();

        // Check that regular note is visible
        await expect(page.getByText("Regular Note")).toBeVisible();

        // Check that archived expense is visible
        await expect(page.getByText("Archived Expense")).toBeVisible();

        // Check that incomplete tasks are hidden
        await expect(page.getByText("Pending Task")).not.toBeVisible();
        await expect(page.getByText("In Progress Task")).not.toBeVisible();
    });

    test("should show filter toggle with correct count", async ({ page }) => {
        // Look for filter button
        const filterButton = page.getByRole('button', { name: /Filters \(1\)/ });
        await expect(filterButton).toBeVisible();
    });

    test("should allow toggling filters", async ({ page }) => {
        // Click filter button to open dropdown
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();

        // Check that filter dropdown is visible
        await expect(page.getByText("Filter interactions")).toBeVisible();
        await expect(page.getByText("Hide Incomplete Tasks")).toBeVisible();

        // The hideIncompleteTasks filter should be checked by default
        const hideIncompleteCheckbox = page.locator('input[type="checkbox"]').first();
        await expect(hideIncompleteCheckbox).toBeChecked();

        // Uncheck the filter to show all interactions
        await hideIncompleteCheckbox.uncheck();

        // Close dropdown by clicking outside
        await page.click('body', { position: { x: 10, y: 10 } });

        // Now incomplete tasks should be visible
        await expect(page.getByText("Pending Task")).toBeVisible();
        await expect(page.getByText("In Progress Task")).toBeVisible();
    });

    test("should allow selecting multiple filters", async ({ page }) => {
        // Open filter dropdown
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();

        // Enable "Hide Archived" filter
        const hideArchivedLabel = page.getByText("Hide Archived");
        await hideArchivedLabel.click();

        // Close dropdown
        await page.click('body', { position: { x: 10, y: 10 } });

        // Should show filter count of 2
        await expect(page.getByRole('button', { name: /Filters \(2\)/ })).toBeVisible();

        // Archived expense should now be hidden
        await expect(page.getByText("Archived Expense")).not.toBeVisible();

        // But other items should still be visible
        await expect(page.getByText("Completed Task")).toBeVisible();
        await expect(page.getByText("Regular Note")).toBeVisible();
    });

    test("should allow clearing all filters", async ({ page }) => {
        // Open filter dropdown
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();

        // Click "Clear all" button
        await page.getByText("Clear all").click();

        // Close dropdown
        await page.click('body', { position: { x: 10, y: 10 } });

        // Should show filter count of 0
        await expect(page.getByRole('button', { name: /Filters \(0\)/ })).toBeVisible();

        // All interactions should now be visible
        await expect(page.getByText("Completed Task")).toBeVisible();
        await expect(page.getByText("Pending Task")).toBeVisible();
        await expect(page.getByText("In Progress Task")).toBeVisible();
        await expect(page.getByText("Regular Note")).toBeVisible();
        await expect(page.getByText("Archived Expense")).toBeVisible();
    });

    test("should allow resetting to default filters", async ({ page }) => {
        // First, clear all filters
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();
        await page.getByText("Clear all").click();

        // Verify all interactions are visible
        await expect(page.getByText("Pending Task")).toBeVisible();
        await expect(page.getByText("In Progress Task")).toBeVisible();

        // Now reset to default
        await page.getByText("Default").click();

        // Close dropdown
        await page.click('body', { position: { x: 10, y: 10 } });

        // Should be back to filter count of 1
        await expect(page.getByRole('button', { name: /Filters \(1\)/ })).toBeVisible();

        // Incomplete tasks should be hidden again
        await expect(page.getByText("Pending Task")).not.toBeVisible();
        await expect(page.getByText("In Progress Task")).not.toBeVisible();

        // But completed task should be visible
        await expect(page.getByText("Completed Task")).toBeVisible();
    });

    test("should persist filter state when navigating", async ({ page }) => {
        // Open filter dropdown and clear all filters
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();
        await page.getByText("Clear all").click();
        await page.click('body', { position: { x: 10, y: 10 } });

        // Verify incomplete tasks are visible
        await expect(page.getByText("Pending Task")).toBeVisible();

        // Navigate away and back
        await page.goto('/app');
        await page.goto(`/app/projects/${projectId}`);

        // Filter state should persist (incomplete tasks still visible)
        await expect(page.getByText("Pending Task")).toBeVisible();
        await expect(page.getByRole('button', { name: /Filters \(0\)/ })).toBeVisible();
    });

    test("should show empty state when all interactions are filtered out", async ({ page }) => {
        // Open filter dropdown and select a very restrictive filter
        const filterButton = page.getByRole('button', { name: /Filters/ });
        await filterButton.click();

        // Enable "Show Only Expenses" filter
        const showOnlyExpensesLabel = page.getByText("Show Only Expenses");
        await showOnlyExpensesLabel.click();

        // Also enable "Hide Archived" filter
        const hideArchivedLabel = page.getByText("Hide Archived");
        await hideArchivedLabel.click();

        // Close dropdown
        await page.click('body', { position: { x: 10, y: 10 } });

        // Should show empty state since archived expense is hidden
        await expect(page.getByText("No interactions linked to this project yet.")).toBeVisible();
    });
});