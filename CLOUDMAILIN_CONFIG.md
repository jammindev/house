# Configuration CloudMailin pour l'ingestion email

Ce guide explique comment configurer CloudMailin pour recevoir des emails et les traiter avec notre application.

## Configuration CloudMailin

### 1. Créer un compte CloudMailin

1. Connectez-vous à votre dashboard CloudMailin : https://www.cloudmailin.com/
2. Créez un compte si vous n'en avez pas
3. Obtenez votre clé API depuis Settings > API Keys

### 2. Configuration du webhook

1. Dans CloudMailin, allez dans **Addresses**
2. Créez une nouvelle adresse email ou utilisez une existante
3. Configurez l'URL de destination (webhook) : `https://votredomaine.com/api/inbound-email`
4. Optionnel : Configurez un secret pour vérifier les webhooks

## Variables d'environnement

Ajoutez ces variables à votre fichier `.env.local` :

```bash
# CloudMailin Configuration
CLOUDMAILIN_API_KEY=votre_cle_api_cloudmailin
CLOUDMAILIN_WEBHOOK_SECRET=votre_secret_de_webhook_cloudmailin
CLOUDMAILIN_SETUP_TOKEN=token_utilisé_pour_l'endpoint_de_setup

# Sécurisation du webhook
CLOUDMAILIN_WEBHOOK_USERNAME=admin_webhook
CLOUDMAILIN_WEBHOOK_PASSWORD=motdepasse_tres_long

# (Optionnel) Script d'envoi de test
CLOUDMAILIN_SMTP_USERNAME=votre_utilisateur_smtp
CLOUDMAILIN_SMTP_PASSWORD=votre_mot_de_passe_smtp
CLOUDMAILIN_SMTP_HOST=smtp.cloudmta.net
CLOUDMAILIN_SMTP_PORT=587
CLOUDMAILIN_TEST_TO=house-test@cloudmailin.net
CLOUDMAILIN_TEST_FROM=house-test@cloudmailin.net
```

## Workflow des emails entrants

1. Email envoyé à votre adresse CloudMailin → CloudMailin
2. CloudMailin → webhook `/api/inbound-email` (auth via Basic si `CLOUDMAILIN_WEBHOOK_USERNAME/PASSWORD`, sinon signature `CLOUDMAILIN_WEBHOOK_SECRET`)
3. L'adresse destinataire (alias) est mappée au `household.inbound_email_alias`
4. Application traite l'email et l'enregistre en base
5. Optionnel : L'email peut être converti en interaction

## Format des données CloudMailin

CloudMailin envoie les emails dans ce format :

```json
{
  "envelope": {
    "to": "recipient@yourdomain.com",
    "from": "sender@example.com",
    "helo_domain": "mail.example.com",
    "remote_ip": "192.168.1.1",
    "spf": {
      "result": "pass",
      "domain": "example.com"
    }
  },
  "headers": {
    "from": "Sender Name <sender@example.com>",
    "to": "recipient@yourdomain.com",
    "subject": "Test Email",
    "date": "Wed, 01 Dec 2025 10:00:00 +0000",
    "message_id": "<unique-message-id@example.com>"
  },
  "plain": "Text content of the email",
  "html": "<html><body>HTML content</body></html>",
  "attachments": [
    {
      "file_name": "document.pdf",
      "content_type": "application/pdf",
      "size": 12345,
      "content": "base64-encoded-content",
      "disposition": "attachment"
    }
  ]
}
```

## Test de configuration

### Test avec ngrok (développement local)

1. **Démarrer votre serveur local** :
   ```bash
   cd nextjs && yarn dev
   ```

2. **Démarrer ngrok** (dans un autre terminal) :
   ```bash
   ngrok http 3000
   ```

3. **Configuration CloudMailin** :
   - Dans CloudMailin, configurez l'adresse avec l'URL : `https://abc123.ngrok.io/api/inbound-email`
   - Ajoutez soit la section **Authorization** (Basic) avec les mêmes valeur que `CLOUDMAILIN_WEBHOOK_USERNAME/PASSWORD`, soit un secret dans **Callbacks** qui correspond à `CLOUDMAILIN_WEBHOOK_SECRET`
   - Sauvegardez la configuration

4. **Envoyer un email de test** :
   - Utilisez le script `node send-test-email-cloudmailin.js` (variables d'env requises)
   - ou envoyez un email manuel à votre adresse CloudMailin
   - Vérifiez les logs de votre application pour confirmer la réception

### Test local (sans CloudMailin)

Vous pouvez tester le endpoint directement avec curl :

```bash
curl -X POST http://localhost:3000/api/inbound-email \
  -H "Content-Type: application/json" \
  -d '{
    "envelope": {
      "to": "test@votredomain.com",
      "from": "test@example.com"
    },
    "headers": {
      "from": "Test User <test@example.com>",
      "to": "test@votredomain.com", 
      "subject": "Test Email",
      "date": "Wed, 01 Dec 2025 10:00:00 +0000",
      "message_id": "<test-message-id@example.com>"
    },
    "plain": "Ceci est un email de test",
    "html": "<p>Ceci est un email de test</p>",
    "attachments": []
  }'
```

## Configuration API

Utilisez l'endpoint `/api/cloudmailin/setup` pour gérer votre configuration :

### Voir la configuration actuelle
```bash
curl http://localhost:3000/api/cloudmailin/setup \
  -H "x-internal-task-token: $CLOUDMAILIN_SETUP_TOKEN"
```

### Créer une nouvelle adresse
```bash
curl -X POST http://localhost:3000/api/cloudmailin/setup \
  -H "Content-Type: application/json" \
  -H "x-internal-task-token: $CLOUDMAILIN_SETUP_TOKEN" \
  -d '{
    "action": "create_address",
    "email_address": "mail@example.com",
    "target_url": "https://yourapp.com/api/inbound-email"
  }'
```

### Activer/désactiver une adresse
```bash
curl -X POST http://localhost:3000/api/cloudmailin/setup \
  -H "Content-Type: application/json" \
  -H "x-internal-task-token: $CLOUDMAILIN_SETUP_TOKEN" \
  -d '{
    "action": "update_address",
    "address_id": "address-id",
    "enabled": true
  }'
```

## Sécurité

- Configurez toujours un secret webhook pour vérifier l'authenticité des emails
- Utilisez HTTPS pour votre endpoint de webhook
- Le webhook `/api/cloudmailin/setup` nécessite maintenant l'en-tête `x-internal-task-token` qui doit correspondre à `CLOUDMAILIN_SETUP_TOKEN`
- Le webhook `/api/inbound-email` rejette toute requête dont la signature ne correspond pas à `CLOUDMAILIN_WEBHOOK_SECRET`
- Validez et sanitisez toutes les données reçues
- Limitez la taille des pièces jointes si nécessaire

## Dépannage

- Vérifiez que votre endpoint est accessible publiquement
- Confirmez que les variables d'environnement sont correctement configurées
- Consultez les logs CloudMailin pour voir si les webhooks sont envoyés
- Testez avec l'endpoint de santé : `GET /api/inbound-email`
