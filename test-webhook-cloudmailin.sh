#!/bin/bash
# Script de test pour le webhook CloudMailin avec ngrok

echo "🚀 Test du webhook CloudMailin avec ngrok existant..."

# URL ngrok prédéfinie
NGROK_URL="https://2a806a199b2e.ngrok-free.app"

echo "🔗 URL ngrok: $NGROK_URL"
echo ""

# Tester l'endpoint distant
echo "🧪 Test de l'endpoint distant..."
HEALTH_CHECK=$(curl -s "$NGROK_URL/api/inbound-email" | jq -r '.status' 2>/dev/null)

if [ "$HEALTH_CHECK" = "ok" ]; then
    echo "✅ Endpoint accessible"
else
    echo "❌ Problème avec l'endpoint ou ngrok non actif"
    echo "   Vérifiez que votre serveur Next.js tourne et que ngrok est connecté"
    exit 1
fi

echo ""
echo "📋 Configuration CloudMailin:"
echo "   Webhook URL: $NGROK_URL/api/inbound-email"
echo ""
echo "📝 Étapes suivantes:"
echo "   1. Configurez le webhook dans CloudMailin avec l'URL ci-dessus"
echo "   2. Créez ou mettez à jour une adresse email"
echo "   3. Envoyez un email de test à cette adresse"
echo ""
echo "🔧 Configuration automatique via API:"
echo "   curl -X POST $NGROK_URL/api/cloudmailin/setup \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"action\": \"create_address\", \"email_address\": \"test@votre-domaine.com\", \"target_url\": \"$NGROK_URL/api/inbound-email\"}'"
echo ""

# Surveiller les logs en temps réel
echo "📊 Test d'envoi d'un webhook CloudMailin simulé..."
echo ""

# Test du webhook avec un payload CloudMailin
echo "🧪 Envoi d'un payload de test..."
curl -X POST "$NGROK_URL/api/inbound-email" \
  -H "Content-Type: application/json" \
  -H "X-CloudMailin-Signature: test-signature" \
  -d '{
    "envelope": {
      "to": "test@example.com",
      "from": "sender@example.com",
      "helo_domain": "mail.example.com",
      "remote_ip": "192.168.1.1",
      "spf": {
        "result": "pass",
        "domain": "example.com"
      }
    },
    "headers": {
      "from": "Test Sender <sender@example.com>",
      "to": "test@example.com",
      "subject": "Test Email CloudMailin",
      "date": "Wed, 01 Dec 2025 10:00:00 +0000",
      "message_id": "<test-cloudmailin-message-id@example.com>"
    },
    "plain": "Ceci est un email de test pour CloudMailin",
    "html": "<p>Ceci est un <strong>email de test</strong> pour CloudMailin</p>",
    "attachments": []
  }'

echo ""
echo ""
echo "✅ Test terminé ! Vérifiez les logs de votre application."