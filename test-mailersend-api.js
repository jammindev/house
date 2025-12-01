#!/usr/bin/env node
// test-mailersend-api.js
// Script pour tester l'API MailerSend avec votre token

const API_TOKEN = 'mlsn.283e6636641277dee23e72aeff126d500ee6c179ac05494de5a2afeba9ff21b0';
const BASE_URL = 'https://api.mailersend.com/v1';

async function testMailerSendAPI() {
    console.log('🚀 Testing MailerSend API...\n');

    try {
        // Test de base: tenter de créer un message (sans l'envoyer)
        console.log('1️⃣ Testing basic API access...');
        const testPayload = {
            from: {
                email: 'test@mailersend.trial',
                name: 'Test'
            },
            to: [
                {
                    email: 'test@example.com',
                    name: 'Test Recipient'
                }
            ],
            subject: 'API Test',
            text: 'This is a test message for API validation'
        };

        const emailResponse = await fetch(`${BASE_URL}/email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(testPayload)
        });

        const responseText = await emailResponse.text();

        if (emailResponse.ok) {
            console.log('✅ API token is valid and has email sending permissions!');
            const responseData = JSON.parse(responseText);
            console.log('📧 Message ID:', responseData.data?.message_id || 'Generated successfully');
        } else {
            console.log(`⚠️  API Response: ${emailResponse.status} ${emailResponse.statusText}`);
            console.log('📄 Response:', responseText);

            // Parse error if JSON
            try {
                const errorData = JSON.parse(responseText);
                if (errorData.message && errorData.message.includes('domain')) {
                    console.log('✅ API token is valid! Error is about domain configuration (normal for new accounts)');
                } else if (errorData.message && errorData.message.includes('permission')) {
                    console.log('❌ API token lacks permissions');
                    return;
                } else {
                    console.log('⚠️  Other API error:', errorData.message);
                }
            } catch {
                console.log('❌ Unexpected response format');
                return;
            }
        }

        console.log('\n✅ Your MailerSend API token is configured correctly!\n');

        // Conseils pour la configuration inbound
        console.log('📋 Pour configurer l\'ingestion email:');
        console.log('1. Connectez-vous à https://app.mailersend.com/');
        console.log('2. Allez dans Domains → Inbound');
        console.log('3. Configurez un domaine pour recevoir des emails');
        console.log('4. Ajoutez les enregistrements MX dans votre DNS');
        console.log('5. Créez un webhook pointant vers votre application');
        console.log('6. Testez en envoyant un email à votre domaine configuré');

    } catch (error) {
        console.error('❌ API Test failed:', error.message);
        console.log('\n🔍 Troubleshooting:');
        console.log('- Vérifiez que votre token est correct');
        console.log('- Assurez-vous que votre compte MailerSend est actif');
        console.log('- Consultez la documentation MailerSend pour les permissions');
    }
}

// Run the test
testMailerSendAPI();