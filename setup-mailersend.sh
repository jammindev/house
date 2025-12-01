#!/bin/bash
# Script pour configurer MailerSend via l'API

# Configuration
API_TOKEN="mlsn.283e6636641277dee23e72aeff126d500ee6c179ac05494de5a2afeba9ff21b0"
BASE_URL="https://api.mailersend.com/v1"

echo "🚀 Configuration MailerSend pour House..."

# 1. Lister les domaines existants
echo "📋 Domaines configurés :"
curl -X GET \
  "$BASE_URL/email-domains" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | {id: .id, name: .name, status: .domain_settings.send_paused}'

echo ""

# 2. Lister les webhooks existants
echo "🔗 Webhooks configurés :"
curl -X GET \
  "$BASE_URL/webhooks" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | {id: .id, name: .name, url: .url, events: .events}'

echo ""

# 3. Proposer la création d'un webhook pour localhost (développement)
read -p "📧 Voulez-vous créer un webhook pour localhost:3000 ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Création du webhook..."
    curl -X POST \
      "$BASE_URL/webhooks" \
      -H "Authorization: Bearer $API_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "House Local Development",
        "url": "http://localhost:3000/api/inbound-email",
        "events": ["activity.email_delivered", "activity.inbound"],
        "enabled": true
      }' | jq '.'
fi

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "📖 Prochaines étapes :"
echo "1. Configurez un domaine inbound dans le dashboard MailerSend"
echo "2. Ajoutez les enregistrements DNS MX"
echo "3. Générez un secret de webhook et ajoutez-le à votre .env.local"
echo "4. Testez l'envoi d'emails vers votre adresse configurée"