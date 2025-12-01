#!/bin/bash
# setup-inbound-domain.sh
# Script pour vous guider dans la configuration du domaine inbound MailerSend

echo "📧 Configuration du domaine inbound MailerSend"
echo "============================================="
echo ""

echo "1️⃣ Étapes dans le dashboard MailerSend:"
echo "   • Allez sur https://app.mailersend.com/"
echo "   • Cliquez sur 'Domains' dans le menu"
echo "   • Cliquez sur 'Add Domain' ou 'Inbound'"
echo "   • Entrez un sous-domaine (ex: mail.house-app.com)"
echo ""

echo "2️⃣ Configuration DNS requise:"
echo "   MailerSend va vous donner des enregistrements MX à ajouter:"
echo "   • Type: MX"
echo "   • Nom: mail (ou votre sous-domaine choisi)"
echo "   • Valeur: inbound.mailersend.net"
echo "   • Priorité: 10"
echo ""

echo "3️⃣ Test de la configuration:"
echo "   Une fois les DNS propagés (peut prendre jusqu'à 24h):"
echo "   • Testez en envoyant un email à: test@mail.votre-domaine.com"
echo "   • Vérifiez dans les logs MailerSend si l'email arrive"
echo ""

echo "4️⃣ Configuration webhook:"
echo "   • Dans MailerSend: Webhooks → Add webhook"
echo "   • URL: https://votre-app.com/api/inbound-email"
echo "   • Événements: Cochez 'Inbound Email'"
echo "   • Enabled: Oui"
echo ""

echo "✅ Une fois configuré, les emails envoyés à votre domaine"
echo "   seront automatiquement transmis à votre application!"

# Proposer de créer un webhook automatiquement
echo ""
read -p "🤖 Voulez-vous que je vous aide à créer le webhook automatiquement ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Lancement de la configuration automatique..."
    cd nextjs && npm run dev &
    DEV_PID=$!
    sleep 3
    
    echo "🌐 Application démarrée en local"
    echo "📋 Utilisez cette URL pour votre webhook: http://localhost:3000/api/inbound-email"
    echo "⚠️  Pour la production, utilisez votre vraie URL de domaine"
    
    # Arrêter le serveur dev après quelques secondes
    sleep 5
    kill $DEV_PID 2>/dev/null
fi

echo ""
echo "📖 Documentation complète: README-email-ingestion.md"