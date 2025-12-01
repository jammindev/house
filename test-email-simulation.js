#!/usr/bin/env node
// test-email-simulation.js
// Simulation d'emails entrants pour tester le système sans MailerSend payant

const NGROK_URL = 'https://3013732226f2.ngrok-free.app';

async function simulateInboundEmails() {
    console.log('🧪 SIMULATION D\'EMAILS ENTRANTS');
    console.log('===============================\n');

    const testEmails = [
        {
            name: 'Devis Électricité',
            payload: {
                type: 'inbound',
                data: {
                    recipient: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net',
                    sender: 'benjamin.vandamme@me.com',
                    subject: 'Devis électricité - Cuisine',
                    text: 'Bonjour,\n\nVoici le devis pour la rénovation électrique de la cuisine.\n\nTotal: 1,250€ TTC\n\nCordialement,\nÉlectricien Martin',
                    html: '<p>Bonjour,</p><p>Voici le devis pour la rénovation électrique de la cuisine.</p><p><strong>Total: 1,250€ TTC</strong></p><p>Cordialement,<br>Électricien Martin</p>',
                    message_id: `test-electricite-${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000),
                    attachments: [
                        {
                            filename: 'devis_electricite_cuisine.pdf',
                            content_type: 'application/pdf',
                            size: 156789,
                            content: 'JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoK'
                        }
                    ]
                }
            }
        },
        {
            name: 'Facture Plomberie',
            payload: {
                type: 'inbound',
                data: {
                    recipient: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net',
                    sender: 'contact@plomberie-dupont.fr',
                    subject: 'Facture - Réparation fuite salle de bain',
                    text: 'Bonjour,\n\nSuite à notre intervention du 28/11/2025.\n\nDétail:\n- Réparation fuite robinet: 85€\n- Remplacement joint: 15€\n- Déplacement: 35€\n\nTotal: 135€ TTC\n\nMerci.',
                    html: '<p>Bonjour,</p><p>Suite à notre intervention du 28/11/2025.</p><h3>Détail:</h3><ul><li>Réparation fuite robinet: 85€</li><li>Remplacement joint: 15€</li><li>Déplacement: 35€</li></ul><p><strong>Total: 135€ TTC</strong></p><p>Merci.</p>',
                    message_id: `test-plomberie-${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000) - 3600,
                    attachments: []
                }
            }
        },
        {
            name: 'Maintenance Chauffage',
            payload: {
                type: 'inbound',
                data: {
                    recipient: 'mail@test-ywj2lpnx78kg7oqz.mlsender.net',
                    sender: 'service@chauffage-pro.com',
                    subject: 'Rapport maintenance annuelle chaudière',
                    text: 'Bonjour,\n\nMaintenance annuelle effectuée le 01/12/2025.\n\nTout est en ordre. Prochaine maintenance prévue en décembre 2026.\n\nCoût intervention: 120€\n\nBonne journée.',
                    html: '<p>Bonjour,</p><p>Maintenance annuelle effectuée le 01/12/2025.</p><p>Tout est en ordre. Prochaine maintenance prévue en décembre 2026.</p><p><strong>Coût intervention: 120€</strong></p><p>Bonne journée.</p>',
                    message_id: `test-chauffage-${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000) - 1800,
                    attachments: [
                        {
                            filename: 'rapport_maintenance_chaudiere.pdf',
                            content_type: 'application/pdf',
                            size: 245678,
                            content: 'JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoK'
                        }
                    ]
                }
            }
        }
    ];

    console.log('📧 Simulation de 3 emails de test...\n');

    for (let i = 0; i < testEmails.length; i++) {
        const email = testEmails[i];
        console.log(`${i + 1}. 📨 ${email.name}...`);

        try {
            const response = await fetch(`${NGROK_URL}/api/inbound-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(email.payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                console.log(`   ✅ Email traité avec succès!`);
                console.log(`   🆔 ID interaction: ${result.id}`);
                console.log(`   🏠 Foyer: ${result.household || 'N/A'}`);
                console.log(`   💰 Montant détecté: ${result.amount || 'N/A'}`);
                if (result.attachments_count > 0) {
                    console.log(`   📎 ${result.attachments_count} pièce(s) jointe(s)`);
                }
            } else {
                console.log(`   ⚠️  Statut: ${response.status}`);
                console.log(`   📄 Réponse: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
        }

        console.log('');

        // Pause entre les emails
        if (i < testEmails.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('🎯 Simulation terminée!');
    console.log('📱 Vérifiez dans House :');
    console.log('   - Nouvelles interactions créées');
    console.log('   - Montants extraits automatiquement');
    console.log('   - Pièces jointes uploadées');
    console.log('   - Classification par type (expense/maintenance)');
    console.log('');
    console.log('🌐 Consultez aussi le dashboard ngrok:');
    console.log('   http://127.0.0.1:4040');
}

// Lancer la simulation
simulateInboundEmails();