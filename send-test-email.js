#!/usr/bin/env node
// send-test-email.js
// Script pour envoyer un email de test et voir la réception

const API_TOKEN = 'mlsn.283e6636641277dee23e72aeff126d500ee6c179ac05494de5a2afeba9ff21b0';
const BASE_URL = 'https://api.mailersend.com/v1';

async function sendTestEmail() {
    console.log('📧 Envoi d\'un email de test...\n');

    const testEmail = {
        from: {
            email: 'test@trial-3z0vklo67nyl7qrx.mlsender.net',  // Domaine de test MailerSend
            name: 'Test House App'
        },
        to: [
            {
                email: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net',  // Votre domaine inbound
                name: 'House App Inbox'
            }
        ],
        subject: 'Test Email Ingestion - Devis Plomberie',
        html: `
            <h2>Devis Plomberie - Test</h2>
            <p>Bonjour,</p>
            <p>Voici le devis pour les travaux de plomberie comme demandé.</p>
            <ul>
                <li>Réparation évier cuisine : 150€</li>
                <li>Changement robinet : 80€</li>
                <li>Main d'œuvre : 100€</li>
            </ul>
            <p><strong>Total : 330€ TTC</strong></p>
            <p>Cordialement,<br>Jean Dupont Plomberie</p>
        `,
        text: `
            Devis Plomberie - Test
            
            Bonjour,
            
            Voici le devis pour les travaux de plomberie comme demandé.
            
            - Réparation évier cuisine : 150€
            - Changement robinet : 80€
            - Main d'œuvre : 100€
            
            Total : 330€ TTC
            
            Cordialement,
            Jean Dupont Plomberie
        `
    };

    try {
        console.log('📤 Envoi vers:', testEmail.to[0].email);
        console.log('📋 Sujet:', testEmail.subject);

        const response = await fetch(`${BASE_URL}/email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(testEmail)
        });

        const responseText = await response.text();

        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('✅ Email envoyé avec succès!');
            console.log('📨 Message ID:', data.data?.message_id || 'N/A');
        } else {
            console.log('⚠️  Statut:', response.status, response.statusText);
            console.log('📄 Réponse:', responseText);

            try {
                const errorData = JSON.parse(responseText);
                if (errorData.message?.includes('domain')) {
                    console.log('\n💡 Conseil: Vous devez d\'abord vérifier un domaine d\'envoi dans MailerSend');
                    console.log('   1. Allez sur https://app.mailersend.com/domains');
                    console.log('   2. Ajoutez votre domaine ou utilisez le domaine trial fourni');
                    console.log('   3. Vérifiez les enregistrements DNS');
                }
            } catch (e) {
                console.log('❌ Erreur inattendue');
            }
        }

        console.log('\n🔍 Pour vérifier la réception:');
        console.log('1. Regardez les logs de votre application Next.js');
        console.log('2. Vérifiez les webhooks reçus sur votre endpoint');
        console.log('3. Consultez la base de données pour les nouvelles entrées');

    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi:', error.message);
    }
}

// Fonction pour tester directement le webhook (simulation)
async function testWebhookDirectly() {
    console.log('\n🧪 Test direct du webhook...');

    const mockPayload = {
        type: 'activity.inbound',
        email: {
            message_id: 'test_' + Date.now(),
            from: {
                email: 'benjamin.vandamme@me.com', // Utilisez un email d'un utilisateur existant
                name: 'Benjamin Test'
            },
            to: [
                {
                    email: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net',
                    name: 'House Inbox'
                }
            ],
            subject: 'Test Webhook Direct',
            text: 'Ceci est un test direct du webhook',
            html: '<p>Ceci est un test direct du webhook</p>',
            timestamp: Math.floor(Date.now() / 1000),
            attachments: []
        }
    };

    try {
        const webhookUrl = 'http://localhost:3000/api/inbound-email'; // Port corrigé
        console.log('🎯 Test vers:', webhookUrl);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-MailerSend-Signature': 'test_signature'
            },
            body: JSON.stringify(mockPayload)
        });

        const result = await response.text();
        console.log('📊 Statut:', response.status);
        console.log('📄 Réponse:', result);

        if (response.ok) {
            console.log('✅ Webhook testé avec succès!');
        } else {
            console.log('⚠️  Problème avec le webhook');
        }

    } catch (error) {
        console.error('❌ Erreur webhook:', error.message);
        console.log('💡 Vérifiez que ngrok et votre app sont démarrés');
    }
}

// Menu interactif
async function main() {
    console.log('🏠 House Email Ingestion Test\n');
    console.log('Que voulez-vous tester ?');
    console.log('1. Envoyer un vrai email via MailerSend');
    console.log('2. Tester le webhook directement');
    console.log('3. Les deux\n');

    // Pour la démo, on fait les deux
    console.log('🚀 Lancement des tests...\n');

    await sendTestEmail();
    await testWebhookDirectly();
}

main();