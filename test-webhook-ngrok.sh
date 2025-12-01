#!/bin/bash
# Script de test pour le webhook MailerSend avec ngrok

echo "🚀 Démarrage du test webhook MailerSend..."

# 1. Démarrer Next.js en arrière-plan si pas déjà fait
echo "📦 Vérification de Next.js..."
if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "⚡ Démarrage de Next.js..."
    cd nextjs && npm run dev &
    NEXTJS_PID=$!
    echo "✅ Next.js démarré (PID: $NEXTJS_PID)"
    sleep 5
else
    echo "✅ Next.js déjà en cours d'exécution"
fi

# 2. Démarrer ngrok
echo "🌐 Démarrage de ngrok..."
ngrok http 3000 --log stdout &
NGROK_PID=$!

# Attendre que ngrok démarre
sleep 3

# 3. Récupérer l'URL publique ngrok
echo "🔗 Récupération de l'URL ngrok..."
NGROK_URL=$(curl -s localhost:4040/api/tunnels | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnel = next(t for t in data['tunnels'] if t['proto'] == 'https')
    print(tunnel['public_url'])
except:
    print('ERROR')
")

if [ "$NGROK_URL" = "ERROR" ] || [ -z "$NGROK_URL" ]; then
    echo "❌ Impossible de récupérer l'URL ngrok"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "🎯 URL publique ngrok: $NGROK_URL"
echo "📧 URL webhook: $NGROK_URL/api/inbound-email"
echo ""
echo "📋 Configuration MailerSend:"
echo "   Webhook URL: $NGROK_URL/api/inbound-email"
echo "   Test endpoint: $NGROK_URL/api/inbound-email (GET pour health check)"
echo ""
echo "🧪 Pour tester:"
echo "   1. Configurez le webhook dans MailerSend avec l'URL ci-dessus"
echo "   2. Envoyez un email à: mail@test-ywj2lpnx78kg7oqz.mlsender.net"
echo "   3. Vérifiez les logs dans cette console"
echo ""
echo "🛑 Appuyez sur Ctrl+C pour arrêter ngrok"

# Attendre l'interruption
trap 'echo "🛑 Arrêt de ngrok..."; kill $NGROK_PID 2>/dev/null; exit 0' INT
wait $NGROK_PID