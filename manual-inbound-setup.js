#!/usr/bin/env node
// manual-inbound-setup.js
// Instructions pour configurer manuellement les emails entrants sur MailerSend

const NGROK_URL = 'https://3013732226f2.ngrok-free.app';
const DOMAIN_ID = 'zkq340e0dk6gd796';
const DOMAIN_NAME = 'test-ywj2lpnx78kg7oqz.mlsender.net';

console.log('📋 CONFIGURATION MANUELLE DES EMAILS ENTRANTS');
console.log('='.repeat(50));
console.log();

console.log('🌐 1. Ouvrez votre tableau de bord MailerSend:');
console.log('   https://app.mailersend.com/domains');
console.log();

console.log('🏷️  2. Sélectionnez le domaine:');
console.log(`   ${DOMAIN_NAME} (ID: ${DOMAIN_ID})`);
console.log();

console.log('📥 3. Allez dans l\'onglet "Inbound routing"');
console.log();

console.log('🔧 4. Activez "Inbound routing" si ce n\'est pas déjà fait');
console.log();

console.log('➕ 5. Créez une nouvelle route inbound avec:');
console.log('   📌 Name: House Email Processing Route');
console.log(`   🔗 Forward URL: ${NGROK_URL}/api/inbound-email`);
console.log('   🎯 Match filter: Match all emails');
console.log('   ✅ Status: Enabled');
console.log();

console.log('🧪 6. Pour tester, envoyez un email à:');
console.log(`   📧 mail@${DOMAIN_NAME}`);
console.log('   📤 Depuis: benjamin.vandamme@me.com');
console.log();

console.log('📊 7. Vérifiez les logs dans:');
console.log('   🖥️  Votre terminal Next.js (localhost:3000)');
console.log('   🌐 Le dashboard ngrok (http://127.0.0.1:4040)');
console.log();

console.log('❓ ALTERNATIVE: Configuration via API');
console.log('Si vous avez un plan payant MailerSend, vous pourriez');
console.log('avoir accès aux endpoints d\'API pour les routes inbound.');
console.log();

console.log('🎯 Une fois configuré, votre endpoint recevra des webhooks');
console.log('au format suivant pour chaque email entrant:');
console.log();

const examplePayload = {
    "data": {
        "type": "inbound",
        "recipient": `mail@${DOMAIN_NAME}`,
        "sender": "benjamin.vandamme@me.com",
        "subject": "Devis électricité",
        "text": "Voici le devis demandé...",
        "html": "<p>Voici le devis demandé...</p>",
        "message_id": "unique-message-id",
        "timestamp": Math.floor(Date.now() / 1000),
        "attachments": [
            {
                "filename": "devis.pdf",
                "content_type": "application/pdf",
                "content": "base64-encoded-content"
            }
        ]
    }
};

console.log(JSON.stringify(examplePayload, null, 2));
console.log();

console.log('✨ C\'est tout! Votre système House sera prêt à recevoir');
console.log('et traiter automatiquement les emails entrants.');

// Test de l'endpoint local
console.log();
console.log('🧪 Test de l\'endpoint local...');

const testPayload = {
    type: 'inbound',
    data: {
        recipient: `mail@${DOMAIN_NAME}`,
        sender: 'benjamin.vandamme@me.com',
        subject: 'Test Configuration - Devis Électricité',
        text: 'Ceci est un test de configuration. Devis: 850€',
        html: '<p>Ceci est un test de configuration.</p><p><strong>Devis: 850€</strong></p>',
        message_id: `test-${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        attachments: []
    }
};

fetch(`${NGROK_URL}/api/inbound-email`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPayload)
})
    .then(res => {
        console.log('📡 Test endpoint status:', res.status);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            console.log('✅ Endpoint local fonctionne!');
            console.log('📧 Interaction créée:', data.id);
        } else {
            console.log('⚠️  Erreur:', data.error);
        }
    })
    .catch(err => {
        console.log('❌ Erreur lors du test:', err.message);
        console.log('🔧 Assurez-vous que Next.js tourne sur localhost:3000');
        console.log('🌐 Et que ngrok tunnel est actif');
    });