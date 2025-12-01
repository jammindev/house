#!/usr/bin/env node
// setup-mailersend-webhook.js
// Script pour configurer automatiquement le webhook MailerSend

const API_TOKEN = 'mlsn.a45e401a9501c0e361209eb4584246c58856328d1cbece6ce6600f75cd91a865';
const BASE_URL = 'https://api.mailersend.com/v1';
const NGROK_URL = 'https://3013732226f2.ngrok-free.app'; // URL de ngrok

async function setupWebhook() {
    console.log('🔗 Configuration du webhook MailerSend...\n');

    const webhookConfig = {
        name: 'House Email Ingestion Webhook',
        url: `${NGROK_URL}/api/inbound-email`,
        enabled: true,
        domain_id: 'zkq340e0dk6gd796', // ID du domaine test-ywj2lpnx78kg7oqz.mlsender.net
        events: ['inbound.received']
    };

    try {
        console.log('📡 URL du webhook:', webhookConfig.url);
        console.log('📋 Événements:', webhookConfig.events.join(', '));

        // D'abord, lister les webhooks existants
        console.log('\n📋 Vérification des webhooks existants...');
        const listResponse = await fetch(`${BASE_URL}/webhooks`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (listResponse.ok) {
            const existingWebhooks = await listResponse.json();
            console.log(`Found ${existingWebhooks.data?.length || 0} existing webhooks`);

            // Supprimer les webhooks existants pour éviter les doublons
            if (existingWebhooks.data?.length > 0) {
                console.log('🗑️  Suppression des webhooks existants...');
                for (const webhook of existingWebhooks.data) {
                    await fetch(`${BASE_URL}/webhooks/${webhook.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${API_TOKEN}`
                        }
                    });
                    console.log(`   Supprimé: ${webhook.name}`);
                }
            }
        }

        // Créer le nouveau webhook
        console.log('\n🆕 Création du nouveau webhook...');
        const response = await fetch(`${BASE_URL}/webhooks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookConfig)
        });

        const responseText = await response.text();

        if (response.ok) {
            const data = JSON.parse(responseText);
            console.log('✅ Webhook créé avec succès!');
            console.log('🆔 ID:', data.data?.id || 'N/A');
            console.log('🔗 URL:', data.data?.url || webhookConfig.url);
            console.log('📡 Status:', data.data?.enabled ? 'Activé' : 'Désactivé');

            console.log('\n🎯 Test du webhook...');
            return testWebhook();

        } else {
            console.log('⚠️  Statut:', response.status, response.statusText);
            console.log('📄 Réponse:', responseText);

            try {
                const errorData = JSON.parse(responseText);
                console.log('❌ Erreur:', errorData.message || 'Erreur inconnue');
            } catch (e) {
                console.log('❌ Erreur de parsing de la réponse');
            }
        }

    } catch (error) {
        console.error('❌ Erreur lors de la configuration:', error.message);
    }
}

async function testWebhook() {
    console.log('🧪 Test du webhook avec un email simulé...\n');

    const testPayload = {
        type: 'inbound.received',
        data: {
            message_id: `webhook-test-${Date.now()}`,
            from: {
                email: 'benjamin.vandamme@me.com',
                name: 'Benjamin Vandamme'
            },
            to: [{
                email: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net'
            }],
            subject: 'Test Webhook - Devis Électricité',
            text: 'Voici un devis pour l\'installation électrique. Total: 850€',
            html: '<p>Voici un devis pour l\'installation électrique.</p><p><strong>Total: 850€</strong></p>',
            timestamp: Math.floor(Date.now() / 1000),
            attachments: [{
                filename: 'devis_electricite.pdf',
                content_type: 'application/pdf',
                size: 2048,
                content: 'JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoK'
            }]
        }
    };

    try {
        const response = await fetch(`${NGROK_URL}/api/inbound-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        const responseData = await response.json();

        if (response.ok) {
            console.log('✅ Webhook testé avec succès!');
            console.log('📧 Email ID:', responseData.id);
            console.log('🏠 Foyer:', responseData.household);
            console.log('👤 Utilisateur:', responseData.user_email);
            console.log('📎 Pièces jointes:', responseData.attachments_count);
        } else {
            console.log('⚠️  Erreur lors du test:', responseData);
        }

    } catch (error) {
        console.error('❌ Erreur lors du test du webhook:', error.message);
    }

    console.log('\n🎉 Configuration terminée!');
    console.log('📧 Vous pouvez maintenant envoyer un email à:');
    console.log('   mail@test-ywj2lpnx78kg7oqz.mlsender.net');
    console.log('📱 Depuis votre adresse: benjamin.vandamme@me.com');
    console.log('🔍 L\'email sera automatiquement traité par House!');
}

// Lancer le setup
setupWebhook();