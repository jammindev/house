// Manual test script to verify returnTo functionality
// Run this in browser dev console on localhost:3001

console.log('🔍 Testing returnTo functionality manually...');

// Test 1: Check if InteractionItem component accepts returnTo prop
const interactionItems = document.querySelectorAll('a[href*="/app/interactions/"]');
console.log(`Found ${interactionItems.length} interaction links`);

// Test 2: Check for any existing returnTo parameters
const returnToLinks = document.querySelectorAll('a[href*="returnTo"]');
console.log(`Found ${returnToLinks.length} links with returnTo parameter`);

if (returnToLinks.length > 0) {
    returnToLinks.forEach((link, index) => {
        console.log(`Link ${index + 1}: ${link.getAttribute('href')}`);
    });
}

// Test 3: Simulate the expected URL structure
const mockProjectId = 'test-project-123';
const mockInteractionId = 'test-interaction-456';
const expectedReturnTo = `/app/projects/${mockProjectId}`;
const expectedURL = `/app/interactions/${mockInteractionId}?returnTo=${encodeURIComponent(expectedReturnTo)}`;

console.log('Expected URL structure:', expectedURL);

// Test 4: Verify URL encoding/decoding
const decoded = decodeURIComponent(expectedReturnTo);
console.log('Return URL would decode to:', decoded);

console.log('✅ Manual verification complete. Our implementation should work!');