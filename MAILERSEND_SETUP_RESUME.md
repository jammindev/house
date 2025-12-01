# Configuration MailerSend - Résumé des Actions

## ✅ Actions Terminées

1. **Domaine configuré** : `test-ywj2lpnx78kg7oqz.mlsender.net`
2. **Endpoint API créé** : `/api/inbound-email` 
3. **Tunnel ngrok actif** : `https://3013732226f2.ngrok-free.app`
4. **Tests endpoint** : ✅ Fonctionne correctement

## 🔧 Actions Manuelles Requises

### Sur MailerSend Dashboard

1. **Ouvrir le dashboard** : https://app.mailersend.com/domains
2. **Sélectionner le domaine** : `test-ywj2lpnx78kg7oqz.mlsender.net`
3. **Aller dans "Inbound routing"**
4. **Activer "Inbound routing"** si pas déjà fait
5. **Créer une route inbound** :
   - **Name**: `House Email Processing Route`
   - **Forward URL**: `https://3013732226f2.ngrok-free.app/api/inbound-email`
   - **Match filter**: `Match all emails`
   - **Status**: `Enabled`

## 🧪 Test du Système

Une fois la route configurée, envoyer un email test :

- **À** : `mail@test-ywj2lpnx78kg7oqz.mlsender.net`
- **De** : `benjamin.vandamme@me.com`
- **Sujet** : `Test - Devis Électricité`
- **Corps** : Tout contenu avec montants en euros

## 📊 Vérification

L'email devrait apparaître :
1. Dans les logs Next.js (terminal)
2. Dans le dashboard ngrok (http://127.0.0.1:4040)
3. Comme nouvelle interaction dans House

## 🚫 Limitations Actuelles

- Les routes inbound ne peuvent pas être créées via API avec le plan gratuit
- Configuration manuelle requise via l'interface web
- Une fois configuré, le système fonctionnera automatiquement

## 📝 Format des Webhooks Attendus

```json
{
  "data": {
    "type": "inbound",
    "recipient": "mail@test-ywj2lpnx78kg7oqz.mlsender.net",
    "sender": "benjamin.vandamme@me.com", 
    "subject": "Devis électricité",
    "text": "Contenu texte...",
    "html": "<p>Contenu HTML...</p>",
    "message_id": "unique-id",
    "timestamp": 1234567890,
    "attachments": [...]
  }
}
```

## 🎯 Prochaines Étapes

1. Configurer la route inbound manuellement
2. Tester avec un vrai email
3. Vérifier que l'interaction est créée dans House
4. Ajuster le parsing si nécessaire