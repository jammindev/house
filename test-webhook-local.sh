#!/bin/bash
# Test rapide de l'endpoint webhook

echo "🧪 Test de l'endpoint /api/inbound-email..."

# Health check
echo "📋 Health check (GET):"
curl -s http://localhost:3000/api/inbound-email | jq '.' || echo "Erreur health check"

echo ""
echo "📧 Test webhook simulé (POST):"

# Exemple de payload MailerSend simplifié
TIMESTAMP=$(date +%s)
TEST_PAYLOAD="{
  \"type\": \"activity.inbound\",
  \"email\": {
    \"message_id\": \"test-$TIMESTAMP\",
    \"from\": {
      \"email\": \"test@example.com\",
      \"name\": \"Test User\"
    },
    \"to\": [{
      \"email\": \"mail@test-ywj2lpnx78kg7oqz.mlsender.net\"
    }],
    \"subject\": \"Test email\",
    \"text\": \"Ceci est un test\",
    \"html\": \"<p>Ceci est un test</p>\",
    \"timestamp\": $TIMESTAMP,
    \"attachments\": []
  }
}"

curl -s -X POST http://localhost:3000/api/inbound-email \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD" | jq '.' || echo "Erreur POST"

echo ""
echo "✅ Test terminé"