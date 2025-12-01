# Configuration MailerSend pour l'ingestion email

# Configuration MailerSend pour l'ingestion email

## Vue d'ensemble
Le système d'ingestion email permet aux utilisateurs d'envoyer des emails à `mail@test-ywj2lpnx78kg7oqz.mlsender.net` qui sont automatiquement traités et affichés dans l'application House. L'utilisateur est détecté automatiquement grâce à son adresse email d'expédition.

## Configuration MailerSend

### 1. Configuration du domaine inbound
1. Connectez-vous à votre dashboard MailerSend
2. Allez dans **Domains** → **Inbound routing**
3. Configurez le domaine `test-ywj2lpnx78kg7oqz.mlsender.net`
4. Ajoutez les enregistrements DNS requis

### 2. Configuration du webhook
1. Dans MailerSend, allez dans **Webhooks**
2. Créez un nouveau webhook avec :
   - **URL** : `https://votre-domaine.com/api/inbound-email`
   - **Événements** : Cochez "Inbound Email"
   - **Secret de signature** : Générez un secret sécurisé

### 3. Variables d'environnement
Ajoutez dans votre `.env.local` :
```bash
MAILERSEND_API_TOKEN=mlsn.283e6636641277dee23e72aeff126d500ee6c179ac05494de5a2afeba9ff21b0
MAILERSEND_WEBHOOK_SECRET=votre_secret_de_webhook_mailersend
```

**⚠️ Important :** Votre token API est maintenant configuré. N'oubliez pas de :
1. Générer un secret de webhook sécurisé
2. Configurer le domaine inbound dans MailerSend
3. Pointer le webhook vers votre endpoint `/api/inbound-email`

## Structure des adresses email

**Adresse unique commune** : `mail@test-ywj2lpnx78kg7oqz.mlsender.net`

Tous les utilisateurs envoient leurs emails à cette même adresse. L'identification se fait automatiquement grâce à l'adresse email de l'expéditeur qui doit correspondre à un compte utilisateur existant dans l'application.

## Traitement des emails

### Flux de données
1. Email envoyé à `mail@test-ywj2lpnx78kg7oqz.mlsender.net` → MailerSend
2. MailerSend → webhook `/api/inbound-email`
3. Système recherche l'utilisateur par son adresse email d'expédition
4. Webhook → stockage en base (`incoming_emails`) associé au foyer de l'utilisateur
5. UI → affichage dans `/app/emails`

### Détection de l'utilisateur
L'utilisateur et son foyer sont automatiquement détectés grâce à :
- L'adresse email de l'expéditeur (`from_email`)
- Recherche dans les comptes utilisateurs Supabase Auth
- Récupération du foyer via `household_members`

### Statuts de traitement
- **pending** : Email reçu, en attente
- **processing** : En cours de traitement
- **completed** : Converti en interaction
- **failed** : Erreur de traitement
- **ignored** : Ignoré par l'utilisateur

### Pièces jointes
- Décodage base64 automatique
- Stockage dans Supabase Storage
- Prévisualisation dans l'UI

## Utilisation côté utilisateur

1. **Envoi** : Utilisateur envoie email à son adresse de foyer
2. **Réception** : Email apparaît dans `/app/emails` 
3. **Traitement** : Utilisateur peut :
   - Convertir en interaction (note/dépense/tâche)
   - Ignorer l'email
   - Télécharger les pièces jointes

## Sécurité

- Vérification de signature webhook obligatoire
- RLS sur toutes les tables
- Scoping par foyer automatique
- Validation des adresses de destination

## Débogage

### Test en localhost avec ngrok

1. **Installation ngrok** (si pas déjà fait) :
   ```bash
   brew install ngrok/ngrok/ngrok
   ```

2. **Démarrage du tunnel** :
   ```bash
   # Option 1 : Script automatisé
   ./test-webhook-ngrok.sh
   
   # Option 2 : Manuel
   npm run dev  # dans /nextjs
   ngrok http 3000
   ```

3. **Configuration MailerSend** :
   - Copiez l'URL HTTPS de ngrok (ex: `https://abc123.ngrok.io`)
   - Dans MailerSend, configurez le webhook : `https://abc123.ngrok.io/api/inbound-email`

4. **Test** :
   - Envoyez un email à `mail@test-ywj2lpnx78kg7oqz.mlsender.net`
   - Vérifiez les logs dans la console Next.js

### Test local (sans MailerSend)

```bash
# Test rapide de l'endpoint
./test-webhook-local.sh
```

### Logs de débogage
- Console Next.js : Logs du webhook avec emoji 📧
- Supabase : Vérifiez les tables `incoming_emails` et `incoming_email_attachments`
- ngrok : Interface web sur http://localhost:4040