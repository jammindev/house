#!/usr/bin/env node
// setup-inbound-routing.js
// Script pour activer le routage des emails entrants sur MailerSend

const API_TOKEN = 'mlsn.a45e401a9501c0e361209eb4584246c58856328d1cbece6ce6600f75cd91a865';
const BASE_URL = 'https://api.mailersend.com/v1';
const DOMAIN_ID = 'zkq340e0dk6gd796';
const NGROK_URL = 'https://3013732226f2.ngrok-free.app';

async function enableInboundRouting() {
    console.log('🔧 Configuration du routage des emails entrants...\n');

    try {
        // Étape 1: Activer le routage inbound sur le domaine
        console.log('📥 Activation du routage inbound sur le domaine...');
        const domainUpdateResponse = await fetch(`${BASE_URL}/domains/${DOMAIN_ID}/settings`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inbound_routing_enabled: true
            })
        });

        if (domainUpdateResponse.ok) {
            console.log('✅ Routage inbound activé sur le domaine!');
        } else {
            const errorData = await domainUpdateResponse.text();
            console.log('⚠️  Erreur lors de l\'activation:', errorData);
            return;
        }

        // Étape 2: Créer une route inbound
        console.log('\n📮 Création de la route inbound...');
        const inboundRouteConfig = {
            domain_id: DOMAIN_ID,
            name: 'House Email Processing Route',
            forward_url: `${NGROK_URL}/api/inbound-email`,
            match_filter: {
                type: 'match_all'
            },
            enabled: true
        };

        const routeResponse = await fetch(`${BASE_URL}/inbound`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inboundRouteConfig)
        });

        const routeResponseText = await routeResponse.text();

        if (routeResponse.ok) {
            const routeData = JSON.parse(routeResponseText);
            console.log('✅ Route inbound créée avec succès!');
            console.log('🆔 ID de la route:', routeData.data?.id);
            console.log('🔗 URL de forward:', routeData.data?.forward_url);
            console.log('📧 Pattern:', routeData.data?.match_filter?.type);

        } else {
            console.log('⚠️  Statut:', routeResponse.status, routeResponse.statusText);
            console.log('📄 Réponse:', routeResponseText);
        }

        // Étape 3: Vérifier la configuration finale
        console.log('\n🔍 Vérification de la configuration...');
        const domainCheckResponse = await fetch(`${BASE_URL}/domains/${DOMAIN_ID}`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`
            }
        });

        if (domainCheckResponse.ok) {
            const domainData = await domainCheckResponse.json();
            const inboundEnabled = domainData.data?.domain_settings?.inbound_routing_enabled;
            console.log('📥 Routage inbound activé:', inboundEnabled ? '✅' : '❌');
            
            if (inboundEnabled) {
                console.log('\n🎉 Configuration terminée avec succès!');
                console.log('📧 Adresse email de test:');
                console.log('   mail@test-ywj2lpnx78kg7oqz.mlsender.net');
                console.log('🔗 Les emails seront forwarded vers:');
                console.log(`   ${NGROK_URL}/api/inbound-email`);
                console.log('\n📝 Vous pouvez maintenant tester en envoyant un email!');
            }
        }

    } catch (error) {
        console.error('❌ Erreur lors de la configuration:', error.message);
    }
}

// Lancer le setup
enableInboundRouting();