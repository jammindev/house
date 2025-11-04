# Configuration Pinterest API

Ce guide explique comment configurer l'intégration Pinterest pour récupérer des boards et des pins.

## 📋 Prérequis

1. **Compte Pinterest Business** (recommandé)
2. **Application Pinterest Developer** enregistrée
3. **Token d'accès Pinterest** valide

## 🔧 Configuration étape par étape

### 1. Créer une application Pinterest

1. Allez sur [Pinterest Developer Portal](https://developers.pinterest.com)
2. Connectez-vous avec votre compte Pinterest
3. Créez une nouvelle application :
   - **App name** : House - Pinterest Integration
   - **Description** : Integration Pinterest pour l'application House
   - **Website** : votre domaine (ex: https://yourapp.com)

### 2. Obtenir un token d'accès

#### Option A : Token de développement (simple)
1. Dans votre app Pinterest, allez à l'onglet "Generate access token"
2. Sélectionnez les scopes nécessaires :
   - `boards:read`
   - `pins:read`
3. Générez et copiez le token

#### Option B : OAuth 2.0 (production)
Pour une application en production, implementez le flow OAuth complet.

### 3. Configuration dans l'application

1. Copiez le fichier d'exemple :
```bash
cp .env.pinterest.example .env.local
```

2. Éditez `.env.local` et ajoutez votre token :
```bash
NEXT_PUBLIC_PINTEREST_ACCESS_TOKEN=your_actual_token_here
```

### 4. Test de la configuration

1. Démarrez l'application : `yarn dev`
2. Naviguez vers un projet : `/app/projects/[id]`
3. Cliquez sur l'onglet "Pinterest"
4. Testez avec une URL publique, par exemple :
   - `https://pinterest.com/pinterest/home-decor/`
   - `https://pinterest.com/pinterest/interior-design/`

## 🔒 Sécurité et limitations

### Limitations de l'API Pinterest

- **Rate limiting** : 1000 requêtes/heure pour les applications non-vérifiées
- **Boards publics uniquement** : Les boards privés ne sont pas accessibles
- **Authentification requise** : Un token valide est obligatoire

### Bonnes pratiques

1. **Token de développement** : Utilisez `NEXT_PUBLIC_` uniquement pour les prototypes
2. **Production** : Implémentez OAuth côté serveur avec des tokens stockés de manière sécurisée
3. **Cache** : Considérez un cache Redis pour les réponses API (non implémenté)
4. **Fallback** : Prévoyez un mode dégradé si l'API est indisponible

## 🚨 Dépannage

### Erreurs courantes

**"Pinterest access token is required"**
- Vérifiez que `NEXT_PUBLIC_PINTEREST_ACCESS_TOKEN` est défini
- Redémarrez le serveur de développement

**"Board not found"**
- Vérifiez que l'URL du board est correcte
- Assurez-vous que le board est public
- Testez l'URL dans un navigateur

**"Access denied"**
- Le board pourrait être privé
- Vérifiez les permissions de votre token
- Assurez-vous d'avoir les scopes `boards:read` et `pins:read`

**"Too many requests"**
- Vous avez atteint la limite de taux
- Attendez ou implémentez un système de cache

### Logs de débogage

Les erreurs détaillées sont loggées dans la console du navigateur. Ouvrez les outils développeur pour plus d'informations.

## 🔮 Améliorations futures

1. **OAuth côté serveur** pour sécuriser les tokens
2. **Cache Redis** pour réduire les appels API
3. **Pagination** pour charger plus de pins
4. **Search** pour rechercher des pins spécifiques
5. **Sauvegarde** des boards favoris par projet
6. **Batch loading** pour optimiser les performances

## 📚 Ressources

- [Pinterest API Documentation](https://developers.pinterest.com/docs/api/v5/)
- [Pinterest OAuth Guide](https://developers.pinterest.com/docs/getting-started/authentication/)
- [API Rate Limits](https://developers.pinterest.com/docs/api/v5/#section/Rate-limiting)