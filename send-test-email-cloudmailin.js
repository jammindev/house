const nodemailer = require('nodemailer');

const requiredEnvVars = ['CLOUDMAILIN_SMTP_USERNAME', 'CLOUDMAILIN_SMTP_PASSWORD', 'CLOUDMAILIN_TEST_TO'];
const missingEnv = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
    console.error('❌ Variables d’environnement manquantes:', missingEnv.join(', '));
    console.error('   Définissez-les avant d’exécuter ce script.');
    process.exit(1);
}

const CLOUDMAILIN_USERNAME = process.env.CLOUDMAILIN_SMTP_USERNAME;
const CLOUDMAILIN_PASSWORD = process.env.CLOUDMAILIN_SMTP_PASSWORD;
const CLOUDMAILIN_HOST = process.env.CLOUDMAILIN_SMTP_HOST || 'smtp.cloudmta.net';
const CLOUDMAILIN_PORT = Number(process.env.CLOUDMAILIN_SMTP_PORT || 587);
const FROM_EMAIL = process.env.CLOUDMAILIN_TEST_FROM || CLOUDMAILIN_USERNAME;
const TO_EMAIL = process.env.CLOUDMAILIN_TEST_TO;

async function sendTestEmail() {
    console.log('📧 Création du transporteur SMTP CloudMailin...');

    const transporter = nodemailer.createTransport({
        host: CLOUDMAILIN_HOST,
        port: CLOUDMAILIN_PORT,
        secure: CLOUDMAILIN_PORT === 465,
        auth: {
            user: CLOUDMAILIN_USERNAME,
            pass: CLOUDMAILIN_PASSWORD
        },
        requireTLS: CLOUDMAILIN_PORT !== 465
    });

    // Vérification de la connexion
    try {
        await transporter.verify();
        console.log('✅ Connexion SMTP établie avec succès');
    } catch (error) {
        console.error('❌ Erreur de connexion SMTP:', error);
        return;
    }

    // Configuration de l'email de test
    const mailOptions = {
        from: `"Test House App" <${FROM_EMAIL}>`,
        to: TO_EMAIL,
        subject: 'Test Email via CloudMailin - ' + new Date().toISOString(),
        text: `Ceci est un email de test envoyé via CloudMailin.
        
Date: ${new Date().toLocaleString('fr-FR')}
Type: Email de test pour l'application House

Cet email devrait être reçu par le webhook et créer une nouvelle interaction dans l'application.

---
Test message sent via CloudMailin SMTP`,
        html: `
            <h2>Email de test CloudMailin</h2>
            <p>Ceci est un email de test envoyé via CloudMailin.</p>
            <ul>
                <li><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</li>
                <li><strong>Type:</strong> Email de test pour l'application House</li>
            </ul>
            <p>Cet email devrait être reçu par le webhook et créer une nouvelle interaction dans l'application.</p>
            <hr>
            <p><em>Test message sent via CloudMailin SMTP</em></p>
        `
    };

    try {
        console.log('📧 Envoi de l\'email de test...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email envoyé avec succès !');
        console.log('📧 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
        console.log('');
        console.log('🔍 Vérifiez maintenant votre terminal ngrok et les logs de votre application');
        console.log('🔍 L\'email devrait apparaître dans votre dashboard CloudMailin dans quelques secondes');
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    }
}

sendTestEmail().catch(console.error);
