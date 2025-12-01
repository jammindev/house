# Configuration MailerSend pour l'ingestion email

## Vue d'ensemble
Le système d'ingestion email permet aux utilisateurs d'envoyer des emails à `nom_utilisateur.mail.house.jammin-dev.com` qui sont automatiquement traités et affichés dans l'application House.

## Configuration MailerSend

### 1. Configuration du domaine inbound
1. Connectez-vous à votre dashboard MailerSend
2. Allez dans **Domains** → **Inbound routing**
3. Configurez le domaine `mail.house.jammin-dev.com`
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
MAILERSEND_WEBHOOK_SECRET=votre_secret_de_webhook_mailersend
```

## Structure des adresses email

Les utilisateurs peuvent envoyer des emails à :
- Format : `{household.inbound_email_alias}@mail.house.jammin-dev.com`
- Exemple : `martin123@mail.house.jammin-dev.com`

Chaque foyer reçoit automatiquement un alias unique lors de sa création.

## Traitement des emails

### Flux de données
1. Email envoyé → MailerSend
2. MailerSend → webhook `/api/inbound-email`
3. Webhook → stockage en base (`incoming_emails`)
4. UI → affichage dans `/app/emails`

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

Pour tester le webhook en local :
1. Utilisez ngrok : `ngrok http 3000`
2. Configurez l'URL webhook : `https://xyz.ngrok.io/api/inbound-email`
3. Envoyez un email test
4. Vérifiez les logs dans la console Next.js