import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY!;

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

interface TestData {
    user: {
        id: string;
        email: string;
        password: string;
    };
    household: {
        id: string;
        name: string;
    };
    project: {
        id: string;
        title: string;
        description: string;
    };
    zone: {
        id: string;
        name: string;
    };
}

// Helper function to create test data
async function createTestData(): Promise<TestData> {
    const email = faker.internet.email();
    const password = 'test123456!';
    const householdName = faker.company.name();
    const projectTitle = faker.lorem.words(3);
    const projectDescription = faker.lorem.paragraph();
    const zoneName = faker.lorem.word();

    // Create user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });
    if (authError || !authData.user) {
        throw new Error(`Failed to create user: ${authError?.message}`);
    }

    // Create household
    const { data: household, error: householdError } = await adminClient
        .from('households')
        .insert({ name: householdName })
        .select()
        .single();
    if (householdError || !household) {
        throw new Error(`Failed to create household: ${householdError?.message}`);
    }

    // Add user to household
    const { error: memberError } = await adminClient
        .from('household_members')
        .insert({
            household_id: household.id,
            user_id: authData.user.id,
            role: 'owner'
        });
    if (memberError) {
        throw new Error(`Failed to add user to household: ${memberError.message}`);
    }

    // Create zone
    const { data: zone, error: zoneError } = await adminClient
        .from('zones')
        .insert({
            household_id: household.id,
            name: zoneName,
            created_by: authData.user.id
        })
        .select()
        .single();
    if (zoneError || !zone) {
        throw new Error(`Failed to create zone: ${zoneError?.message}`);
    }

    // Create project
    const { data: project, error: projectError } = await adminClient
        .from('projects')
        .insert({
            household_id: household.id,
            title: projectTitle,
            description: projectDescription,
            status: 'active',
            priority: 3,
            created_by: authData.user.id
        })
        .select()
        .single();
    if (projectError || !project) {
        throw new Error(`Failed to create project: ${projectError?.message}`);
    }

    return {
        user: {
            id: authData.user.id,
            email,
            password
        },
        household: {
            id: household.id,
            name: householdName
        },
        project: {
            id: project.id,
            title: projectTitle,
            description: projectDescription
        },
        zone: {
            id: zone.id,
            name: zoneName
        }
    };
}

// Helper function to cleanup test data
async function cleanupTestData(data: TestData) {
    // Delete project (cascades to threads/messages)
    await adminClient.from('projects').delete().eq('id', data.project.id);

    // Delete zone
    await adminClient.from('zones').delete().eq('id', data.zone.id);

    // Delete household (cascades to members)
    await adminClient.from('households').delete().eq('id', data.household.id);

    // Delete user
    await adminClient.auth.admin.deleteUser(data.user.id);
}

test.describe('Project AI Chat - Enhanced Tests', () => {
    let testData: TestData;

    test.beforeEach(async () => {
        testData = await createTestData();
    });

    test.afterEach(async () => {
        await cleanupTestData(testData);
    });

    test('should open AI chat dialog and display welcome message', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');

        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('text=How can I help with this project?')).toBeVisible();
    });

    test('should handle new chat creation', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');
        await expect(page.locator('button:has-text("New Chat")')).toBeVisible();

        const testMessage = 'What is the status of this project?';
        await page.fill('textarea[placeholder*="Ask about your project"]', testMessage);
        await page.press('textarea[placeholder*="Ask about your project"]', 'Enter');

        await expect(page.locator(`text=${testMessage}`)).toBeVisible();
    });

    test('should display error messages properly', async ({ page }) => {
        await page.route('**/api/projects/*/ai-chat', (route) => {
            route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'AI service quota exceeded. Please try again later.' })
            });
        });

        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');
        await page.fill('textarea[placeholder*="Ask about your project"]', 'Test message');
        await page.press('textarea[placeholder*="Ask about your project"]', 'Enter');

        await expect(page.locator('text=AI service quota exceeded')).toBeVisible();
        await expect(page.locator('button:has-text("Try again")')).toBeVisible();
    });

    test('should handle conversation selection dropdown', async ({ page }) => {
        // Create a conversation via API
        const { data: thread } = await adminClient
            .from('project_ai_threads')
            .insert({
                project_id: testData.project.id,
                household_id: testData.household.id,
                user_id: testData.user.id,
                title: 'Test Conversation'
            })
            .select()
            .single();

        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');
        await page.click('button:has-text("Test Conversation")');

        // Verify dropdown opens with "New Chat" option
        await expect(page.locator('[role="menuitem"]:has-text("New Chat")')).toBeVisible();

        // Click "New Chat"
        await page.click('[role="menuitem"]:has-text("New Chat")');

        // Verify selector shows "New Chat" again
        await expect(page.locator('button:has-text("New Chat")')).toBeVisible();
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');

        const textarea = page.locator('textarea[placeholder*="Ask about your project"]');

        // Test Shift+Enter for new line
        await textarea.fill('First line');
        await page.keyboard.press('Shift+Enter');
        await textarea.type('Second line');

        // Verify multiline content
        await expect(textarea).toHaveValue('First line\nSecond line');

        // Test Enter to send
        await textarea.fill('Test message');
        await page.keyboard.press('Enter');

        // Verify message was sent (input should be cleared)
        await expect(textarea).toHaveValue('');
    });

    test('should maintain conversation history', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        // Create a thread with messages via API
        const { data: thread } = await adminClient
            .from('project_ai_threads')
            .insert({
                project_id: testData.project.id,
                household_id: testData.household.id,
                user_id: testData.user.id,
                title: 'Test Thread'
            })
            .select()
            .single();

        await adminClient.from('project_ai_messages').insert([
            {
                thread_id: thread!.id,
                role: 'user',
                content: 'Hello AI'
            },
            {
                thread_id: thread!.id,
                role: 'assistant',
                content: 'Hello! How can I help you?'
            }
        ]);

        await page.click('button:has-text("Ask AI")');
        await page.click('button:has-text("Test Thread")');

        // Verify messages are loaded
        await expect(page.locator('text=Hello AI')).toBeVisible();
        await expect(page.locator('text=Hello! How can I help you?')).toBeVisible();
    });

    test('should close dialog properly', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await page.click('button:has-text("Ask AI")');
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        await page.click('button:has-text("Close")');
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should display AI chat button in project header', async ({ page }) => {
        await page.goto('/auth');
        await page.fill('input[type="email"]', testData.user.email);
        await page.fill('input[type="password"]', testData.user.password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/app');
        await page.goto(`/app/projects/${testData.project.id}`);

        await expect(page.locator('button:has-text("Ask AI")')).toBeVisible();
    });
});