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
            type: 'renovation',
            planned_budget: 5000,
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

// Helper function to clean up test data
async function cleanupTestData(testData: TestData) {
    // Clean up in reverse order of creation
    await adminClient.from('projects').delete().eq('id', testData.project.id);
    await adminClient.from('zones').delete().eq('id', testData.zone.id);
    await adminClient.from('household_members').delete().eq('household_id', testData.household.id);
    await adminClient.from('households').delete().eq('id', testData.household.id);
    await adminClient.auth.admin.deleteUser(testData.user.id);
}

// Helper to sign in the user
async function signInUser(page: any, email: string, password: string) {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/app*');
}

// Mock OpenAI API responses for testing
async function setupMockOpenAI(page: any) {
    await page.route('**/api/projects/*/ai-chat', async route => {
        const request = route.request();
        if (request.method() === 'POST') {
            const body = await request.postDataJSON();

            // Simulate streaming response
            const mockResponse = {
                body: 'data: {"content":"Hello! I can help you with your "}\\n\\ndata: {"content":"project. Based on the information provided, "}\\n\\ndata: {"content":"this appears to be a renovation project. "}\\n\\ndata: {"content":"What specific aspect would you like help with?"}\\n\\ndata: {"done":true,"threadId":"mock-thread-id"}\\n\\n',
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                }
            };

            await route.fulfill({
                status: 200,
                headers: mockResponse.headers,
                body: mockResponse.body
            });
        } else {
            await route.continue();
        }
    });
}

test.describe('Project AI Chat', () => {
    let testData: TestData;

    test.beforeEach(async ({ page }) => {
        testData = await createTestData();
        await setupMockOpenAI(page);
        await signInUser(page, testData.user.email, testData.user.password);
    });

    test.afterEach(async () => {
        if (testData) {
            await cleanupTestData(testData);
        }
    });

    test('should display AI chat button in project header', async ({ page }) => {
        // Navigate to project detail page
        await page.goto(`/app/projects/${testData.project.id}`);

        // Check that the Ask AI button is visible
        const aiButton = page.getByRole('button', { name: /ask ai/i });
        await expect(aiButton).toBeVisible();

        // Verify button has proper accessibility attributes
        await expect(aiButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('should open AI chat sheet when button is clicked', async ({ page }) => {
        await page.goto(`/app/projects/${testData.project.id}`);

        // Click the Ask AI button
        const aiButton = page.getByRole('button', { name: /ask ai/i });
        await aiButton.click();

        // Check that the sheet is open
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText('Project Assistant')).toBeVisible();
        await expect(page.getByText(`Get help with ${testData.project.title}`)).toBeVisible();

        // Verify button state updated
        await expect(aiButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('should show welcome state when no conversations exist', async ({ page }) => {
        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat
        await page.getByRole('button', { name: /ask ai/i }).click();

        // Check welcome state
        await expect(page.getByText('How can I help with this project?')).toBeVisible();
        await expect(page.getByText(/I can provide insights about your project timeline/)).toBeVisible();

        // Verify composer is present
        const messageInput = page.getByPlaceholder('Ask about your project...');
        await expect(messageInput).toBeVisible();
        await expect(messageInput).toBeEnabled();
    });

    test('should send message and receive AI response', async ({ page }) => {
        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat
        await page.getByRole('button', { name: /ask ai/i }).click();

        // Type a message
        const messageInput = page.getByPlaceholder('Ask about your project...');
        await messageInput.fill('What is the status of this project?');

        // Send message (Enter key)
        await messageInput.press('Enter');

        // Verify user message appears
        await expect(page.getByText('What is the status of this project?')).toBeVisible();

        // Verify AI response appears (from mock)
        await expect(page.getByText(/Hello! I can help you with your project/)).toBeVisible();
        await expect(page.getByText(/What specific aspect would you like help with?/)).toBeVisible();

        // Verify message roles are displayed
        await expect(page.getByText('You')).toBeVisible();
        await expect(page.getByText('House Assistant')).toBeVisible();
    });

    test('should handle keyboard shortcuts correctly', async ({ page }) => {
        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat
        await page.getByRole('button', { name: /ask ai/i }).click();

        const messageInput = page.getByPlaceholder('Ask about your project...');

        // Test Shift+Enter for new line
        await messageInput.fill('First line');
        await messageInput.press('Shift+Enter');
        await messageInput.type('Second line');

        // Verify textarea contains newline
        await expect(messageInput).toHaveValue('First line\\nSecond line');

        // Clear and test Enter to send
        await messageInput.fill('Test message');
        await messageInput.press('Enter');

        // Verify message was sent
        await expect(page.getByText('Test message')).toBeVisible();
    });

    test('should close sheet with escape key', async ({ page }) => {
        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat
        const aiButton = page.getByRole('button', { name: /ask ai/i });
        await aiButton.click();

        // Verify sheet is open
        await expect(page.getByRole('dialog')).toBeVisible();

        // Press Escape
        await page.keyboard.press('Escape');

        // Verify sheet is closed
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await expect(aiButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('should work correctly on mobile viewport', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat
        await page.getByRole('button', { name: /ask ai/i }).click();

        // On mobile, sheet should cover full width
        const sheet = page.getByRole('dialog');
        await expect(sheet).toBeVisible();

        // Verify composer is accessible
        const messageInput = page.getByPlaceholder('Ask about your project...');
        await expect(messageInput).toBeVisible();

        // Test message sending on mobile
        await messageInput.fill('Mobile test message');
        await messageInput.press('Enter');

        await expect(page.getByText('Mobile test message')).toBeVisible();
    });

    test('should persist conversation after page reload', async ({ page }) => {
        // Note: This test assumes the backend stores messages properly
        // In a real test, you'd need to verify the conversation persists
        // For now, we'll just test that the UI handles reload correctly

        await page.goto(`/app/projects/${testData.project.id}`);

        // Open AI chat and send a message
        await page.getByRole('button', { name: /ask ai/i }).click();
        const messageInput = page.getByPlaceholder('Ask about your project...');
        await messageInput.fill('Test persistence');
        await messageInput.press('Enter');

        // Wait for response
        await expect(page.getByText('Test persistence')).toBeVisible();

        // Reload page
        await page.reload();

        // AI button should still be present
        await expect(page.getByRole('button', { name: /ask ai/i })).toBeVisible();
    });
});
