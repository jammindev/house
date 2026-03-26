#!/usr/bin/env python3
"""Script to create GitHub milestones, labels, and issues for jammindev/house using direct API calls."""

import urllib.request
import urllib.error
import json
import sys
import os
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or "YOUR_GITHUB_TOKEN_HERE"
if TOKEN == "YOUR_GITHUB_TOKEN_HERE":
    print("ERROR: Set GH_TOKEN or GITHUB_TOKEN environment variable", file=sys.stderr)
    sys.exit(1)
REPO = "jammindev/house"
BASE_URL = f"https://api.github.com/repos/{REPO}"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}

def api_get(path):
    url = f"{BASE_URL}/{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  GET {path} -> HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        return None

def api_post(path, data):
    url = f"{BASE_URL}/{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        if e.code == 422:
            return {"_skipped": True, "code": 422, "body": err_body}
        print(f"  POST {path} -> HTTP {e.code}: {err_body}", file=sys.stderr)
        return None

# =====================
# Step 1: Check existing
# =====================
print("=== Checking existing labels ===")
existing_labels_data = []
page = 1
while True:
    page_data = api_get(f"labels?per_page=100&page={page}")
    if not page_data:
        break
    existing_labels_data.extend(page_data)
    if len(page_data) < 100:
        break
    page += 1

existing_labels = {l["name"] for l in existing_labels_data}
print(f"Found {len(existing_labels)} existing labels: {sorted(existing_labels)}")

print("\n=== Checking existing milestones ===")
existing_milestones_data = api_get("milestones?per_page=100&state=all") or []
existing_milestones = {m["title"]: m["number"] for m in existing_milestones_data}
print(f"Found {len(existing_milestones)} existing milestones: {list(existing_milestones.keys())}")

# =====================
# Step 2: Create labels
# =====================
print("\n=== Creating labels ===")
labels = [
    ("blocker", "d73a4a", "Bloquant MVP : sans ce fix l'utilisateur ne peut pas utiliser l'app"),
    ("security", "e4e669", "Sécurité"),
    ("ux", "0075ca", "Expérience utilisateur"),
    ("backend", "0e8a16", "Backend Django"),
    ("frontend", "1d76db", "Frontend React"),
    ("i18n", "bfd4f2", "Internationalisation / traductions"),
    ("auth", "5319e7", "Authentification & utilisateurs"),
    ("feature", "a2eeef", "Nouvelle fonctionnalité"),
    ("enhancement", "84b6eb", "Amélioration d'existant"),
    ("missing-frontend", "f9d0c4", "Backend existe, frontend manquant"),
    ("integration", "c5def5", "Lien entre modules"),
    ("notifications", "e99695", "Système de notifications"),
    ("parcours:auth", "5319e7", "Parcours: Authentification"),
    ("parcours:household", "0075ca", "Parcours: Foyer & Membres"),
    ("parcours:zones", "0e8a16", "Parcours: Zones"),
    ("parcours:tasks", "1d76db", "Parcours: Tâches"),
    ("parcours:interactions", "e4e669", "Parcours: Interactions / Journal"),
    ("parcours:projects", "d93f0b", "Parcours: Projets"),
    ("parcours:equipment", "bfd4f2", "Parcours: Équipements"),
    ("parcours:documents", "c5def5", "Parcours: Documents"),
    ("parcours:electricity", "f9d0c4", "Parcours: Électricité"),
    ("parcours:stock", "e99695", "Parcours: Stock & Inventaire"),
    ("parcours:directory", "84b6eb", "Parcours: Répertoire"),
    ("parcours:insurance", "a2eeef", "Parcours: Assurances"),
]

labels_created = []
labels_skipped = []
for name, color, desc in labels:
    if name in existing_labels:
        labels_skipped.append(name)
        print(f"  Skipping (exists): {name}")
    else:
        result = api_post("labels", {"name": name, "color": color, "description": desc})
        if result and "_skipped" in result:
            labels_skipped.append(name)
            print(f"  Skipped (422 conflict): {name}")
        elif result:
            labels_created.append(name)
            print(f"  Created: {name}")
        else:
            print(f"  Failed: {name}")

print(f"\nLabels created: {len(labels_created)}, skipped: {len(labels_skipped)}")

# =====================
# Step 3: Create milestones
# =====================
print("\n=== Creating milestones ===")
milestones_to_create = [
    ("MVP - Phase 1 : Inscription & Accès utilisateur",
     "Éléments bloquants sans lesquels un utilisateur ne peut pas s'inscrire et utiliser l'application de manière autonome."),
    ("MVP - Phase 2 : Réinitialisation mot de passe & Notifications",
     "Flux critiques pour la rétention : mot de passe oublié, centre de notifications, envoi d'emails."),
    ("MVP - Phase 3 : Robustesse & Qualité",
     "Améliorations non-bloquantes pour atteindre un niveau de qualité MVP solide avant ouverture."),
    ("Post-MVP : Alertes & Intégrations",
     "Améliorations futures : alertes automatiques, récurrence tâches, intégrations entre modules."),
]

milestone_numbers = {}
for title, desc in milestones_to_create:
    if title in existing_milestones:
        milestone_numbers[title] = existing_milestones[title]
        print(f"  Existing milestone #{existing_milestones[title]}: {title}")
    else:
        result = api_post("milestones", {"title": title, "description": desc})
        if result and "_skipped" not in result:
            num = result["number"]
            milestone_numbers[title] = num
            print(f"  Created milestone #{num}: {title}")
        else:
            print(f"  Failed/skipped: {title}")

print(f"\nMilestone numbers: {milestone_numbers}")

# =====================
# Step 4: Create issues
# =====================
print("\n=== Creating issues ===")

MS1 = "MVP - Phase 1 : Inscription & Accès utilisateur"
MS2 = "MVP - Phase 2 : Réinitialisation mot de passe & Notifications"
MS3 = "MVP - Phase 3 : Robustesse & Qualité"
MS4 = "Post-MVP : Alertes & Intégrations"

issues_to_create = [
    # Milestone 1
    {
        "title": "Page d'inscription (Signup) — Frontend manquant",
        "labels": ["blocker", "frontend", "auth", "parcours:auth"],
        "milestone": MS1,
        "body": """## Contexte
Le backend expose l'endpoint `POST /api/accounts/users/` avec `AllowAny`, mais aucune page frontend ne permet à un utilisateur de créer un compte de manière autonome.

## Problème
- Aucune route `/signup` ou `/register` dans `ui/src/router.tsx`
- Aucune page `SignupPage.tsx` dans `ui/src/features/auth/`
- Aucun lien vers l'inscription depuis `LoginPage.tsx`
- Clés i18n manquantes dans les 4 fichiers de langue

## Travail requis
- [ ] Créer `ui/src/features/auth/SignupPage.tsx` (champs : email, prénom, nom, mot de passe, confirmation)
- [ ] Ajouter la route `/signup` dans `ui/src/router.tsx`
- [ ] Ajouter un lien "Pas encore inscrit ?" dans `LoginPage.tsx`
- [ ] Ajouter les clés i18n signup dans les 4 fichiers de traduction (`en`, `fr`, `de`, `es`)

## Fichiers concernés
- `ui/src/features/auth/LoginPage.tsx`
- `ui/src/router.tsx`
- `ui/src/locales/*/translation.json`"""
    },
    {
        "title": "Validation du mot de passe absente à l'inscription — Backend",
        "labels": ["blocker", "backend", "security", "auth", "parcours:auth"],
        "milestone": MS1,
        "body": """## Contexte
`UserSerializer.create()` n'appelle pas `validate_password()`. Les validateurs Django sont configurés dans `base.py` (longueur min, mots de passe communs, similarité email) mais **ne sont pas appliqués à l'inscription**.

## Problème
Un mot de passe `"123"` peut être accepté à l'inscription alors qu'il serait refusé au changement de mot de passe.

```python
# apps/accounts/serializers.py — create() actuel
user = User(**validated_data)
user.set_password(password)  # ← pas de validate_password() avant
```

## Correction
Ajouter `validate_password(password, user=user)` dans `UserSerializer.create()` **avant** `user.set_password()`.

## Fichiers concernés
- `apps/accounts/serializers.py`"""
    },
    {
        "title": "Message d'erreur de login hardcodé en français",
        "labels": ["blocker", "frontend", "i18n", "auth", "parcours:auth"],
        "milestone": MS1,
        "body": """## Contexte
L'application supporte 4 langues (en, fr, de, es) mais le message d'erreur de connexion est hardcodé en français.

## Problème
```typescript
// ui/src/features/auth/LoginPage.tsx
} catch {
  setError('Email ou mot de passe incorrect.'); // ← hardcodé en français
}
```

## Correction
- [ ] Remplacer par `setError(t('auth.invalidCredentials'))`
- [ ] Ajouter la clé `auth.invalidCredentials` dans les 4 fichiers de traduction

## Fichiers concernés
- `ui/src/features/auth/LoginPage.tsx`
- `ui/src/locales/*/translation.json`"""
    },
    {
        "title": "Page Assurances — Frontend manquant",
        "labels": ["blocker", "frontend", "missing-frontend", "parcours:insurance"],
        "milestone": MS1,
        "body": """## Contexte
Le backend dispose d'un modèle Assurances complet (modèle, migrations, tests), mais **aucune page frontend n'existe** pour y accéder.

## Problème
Les utilisateurs ne peuvent pas consulter, créer ou gérer leurs contrats d'assurance depuis l'interface.

## Travail requis
- [ ] Créer `ui/src/features/insurance/InsurancePage.tsx`
- [ ] Créer `ui/src/features/insurance/InsuranceCard.tsx`
- [ ] Créer `ui/src/features/insurance/InsuranceDialog.tsx` (create/edit)
- [ ] Créer `ui/src/features/insurance/hooks.ts`
- [ ] Ajouter la route dans `ui/src/router.tsx`
- [ ] Ajouter le lien dans la navigation
- [ ] Ajouter les clés i18n dans les 4 fichiers de traduction

Suivre le pattern standard des features (cf. CLAUDE.md)."""
    },
    # Milestone 2
    {
        "title": "Réinitialisation de mot de passe — Backend & Frontend",
        "labels": ["blocker", "backend", "frontend", "auth", "parcours:auth"],
        "milestone": MS2,
        "body": """## Contexte
Il n'existe aucun flux "mot de passe oublié". Un utilisateur qui perd son mot de passe est définitivement bloqué sans intervention admin.

## Travail requis

### Backend
- [ ] Endpoint `POST /api/accounts/password-reset/` (génération token + envoi email)
- [ ] Endpoint `POST /api/accounts/password-reset/confirm/` (token + nouveau mot de passe)

### Frontend
- [ ] Créer `ui/src/features/auth/ForgotPasswordPage.tsx` (saisie email)
- [ ] Créer `ui/src/features/auth/ResetPasswordPage.tsx` (token + nouveau mot de passe)
- [ ] Ajouter les routes correspondantes
- [ ] Ajouter un lien "Mot de passe oublié ?" dans `LoginPage.tsx`
- [ ] Ajouter les clés i18n dans les 4 fichiers de traduction

> Note : `EMAIL_BACKEND` est configuré dans `.env.example`, la plomberie email est prête."""
    },
    {
        "title": "Centre de notifications — Frontend manquant",
        "labels": ["blocker", "frontend", "missing-frontend", "notifications", "parcours:household"],
        "milestone": MS2,
        "body": """## Contexte
Le modèle `Notification` existe côté backend (type `household_invitation`, etc.) et des notifications sont créées lors des invitations, mais **aucun centre de notifications n'existe dans l'UI**.

## Problème
Un utilisateur invité à rejoindre un foyer ne voit aucune indication dans l'interface.

## Travail requis
- [ ] Ajouter un badge de notifications dans la navbar (compteur des non-lues)
- [ ] Créer un dropdown ou une page `/notifications`
- [ ] Permettre de marquer les notifications comme lues
- [ ] Gérer les actions depuis la notification (ex: accepter une invitation)
- [ ] Ajouter les clés i18n

## Fichiers concernés
- `ui/src/components/` (navbar)
- Backend : vérifier que l'endpoint `GET /api/notifications/` existe"""
    },
    {
        "title": "Vérifier et activer l'envoi d'email — Invitations foyer",
        "labels": ["backend", "auth", "parcours:household"],
        "milestone": MS2,
        "body": """## Contexte
Le flux d'invitation crée une `HouseholdInvitation` en base de données, mais il n'est pas certain qu'un email soit effectivement envoyé à l'invité.

## À vérifier
- [ ] Vérifier que `InvitationViewSet` envoie bien un email (signal ou appel direct)
- [ ] Tester le flux complet : invitation → email reçu → lien → acceptation
- [ ] Vérifier la template d'email si elle existe

## Fichiers concernés
- `apps/accounts/views.py` (InvitationViewSet)
- `apps/accounts/signals.py` (si existant)"""
    },
    # Milestone 3
    {
        "title": "Tokens JWT stockés dans localStorage — Sécurité",
        "labels": ["security", "frontend", "auth", "parcours:auth"],
        "milestone": MS3,
        "body": """## Contexte
Les tokens JWT sont stockés dans `localStorage`, ce qui les expose au vol par attaque XSS.

## Problème
`localStorage.setItem('access_token', ...)` — tout script malveillant injecté dans la page peut lire et exfiltrer le token.

## Solution recommandée
Migrer vers des cookies `HttpOnly` + `Secure` + `SameSite=Strict` pour stocker les tokens, ce qui les rend inaccessibles au JavaScript.

## Fichiers concernés
- `ui/src/features/auth/` (gestion des tokens)
- Backend : endpoint de refresh à adapter pour cookies"""
    },
    {
        "title": "Filtres avancés manquants — Page Interactions",
        "labels": ["frontend", "enhancement", "parcours:interactions"],
        "milestone": MS3,
        "body": """## Contexte
Le backend supporte le filtrage par `zone`, `contact`, `structure`, `tags`, `date_range`, `created_by` sur les interactions, mais l'UI n'expose que `type` + `statut` + recherche texte.

## Travail requis
- [ ] Ajouter un filtre par zone (select)
- [ ] Ajouter un filtre par contact/prestataire
- [ ] Ajouter un filtre par plage de dates (date range picker)
- [ ] Ajouter un filtre par tags

## Fichiers concernés
- `ui/src/features/interactions/InteractionsPage.tsx`"""
    },
    {
        "title": "Champ montant structuré pour les dépenses (Interactions type expense)",
        "labels": ["backend", "frontend", "enhancement", "parcours:interactions", "parcours:projects"],
        "milestone": MS3,
        "body": """## Contexte
Les interactions de type `expense` n'ont pas de champ montant dédié dans le modèle — le montant est probablement stocké dans `metadata` (JSON). Il n'y a pas de saisie structurée du montant dans le formulaire.

## Problème
- Impossible de calculer un total de dépenses automatiquement
- `actual_cost_cached` des projets reste à 0 sauf saisie manuelle
- Pas de suivi financier fiable

## Travail requis
- [ ] Backend : ajouter un champ `amount` (DecimalField) sur le modèle `Interaction` (ou via un modèle lié)
- [ ] Créer la migration
- [ ] Exposer le champ dans le serializer
- [ ] Frontend : ajouter le champ montant dans le formulaire de création d'interaction (conditionnel sur le type `expense`)
- [ ] Calculer et mettre à jour `actual_cost_cached` des projets liés automatiquement

## Fichiers concernés
- `apps/interactions/models.py`
- `apps/interactions/serializers.py`
- `ui/src/features/interactions/InteractionNewPage.tsx`
- `ui/src/features/interactions/InteractionEditPage.tsx`"""
    },
    {
        "title": "defaultValue dans les appels t() — ProfileSection",
        "labels": ["frontend", "i18n", "enhancement"],
        "milestone": MS3,
        "body": """## Contexte
Selon les règles du projet (CLAUDE.md), l'usage de `defaultValue` dans les appels `t()` est interdit car il masque les traductions manquantes.

## Problème
`ui/src/features/settings/ProfileSection.tsx` utilise des `defaultValue` dans ses appels `t()`.

## Correction
Remplacer tous les `t('key', 'default value')` par `t('key')` et vérifier que les clés existent dans les 4 fichiers de traduction.

## Fichiers concernés
- `ui/src/features/settings/ProfileSection.tsx`
- `ui/src/locales/*/translation.json`"""
    },
    {
        "title": "Page 404 et Error Boundary global",
        "labels": ["frontend", "ux", "enhancement"],
        "milestone": MS3,
        "body": """## Contexte
Il n'existe pas de page 404 ni d'error boundary global dans l'application.

## Problème
- Une URL invalide ne donne pas de retour visuel adapté à l'utilisateur
- Une erreur JavaScript non catchée peut crasher toute l'application sans message utile

## Travail requis
- [ ] Créer un composant `NotFoundPage.tsx` (page 404)
- [ ] Ajouter une route catch-all `*` dans le router
- [ ] Ajouter un `ErrorBoundary` global dans `ProtectedLayout.tsx`
- [ ] Ajouter les clés i18n correspondantes

## Fichiers concernés
- `ui/src/router.tsx`
- `ui/src/components/ProtectedLayout.tsx`"""
    },
    {
        "title": "Changement d'email impossible dans les Settings",
        "labels": ["frontend", "ux", "enhancement", "parcours:auth"],
        "milestone": MS3,
        "body": """## Contexte
La page Settings permet de changer le nom, le mot de passe, etc., mais pas l'adresse email.

## Problème
Un utilisateur qui a fait une faute de frappe dans son email ou qui souhaite le changer n'a aucun moyen de le faire sans intervention admin.

## Travail requis
- [ ] Ajouter un champ email dans `ProfileSection.tsx` avec un bouton de mise à jour
- [ ] Backend : vérifier que `PATCH /api/accounts/users/me/` accepte la modification de l'email
- [ ] Idéalement : ajouter une vérification par email après changement

## Fichiers concernés
- `ui/src/features/settings/SettingsPage.tsx`
- `ui/src/features/settings/ProfileSection.tsx`"""
    },
    {
        "title": "Maintenance préventive équipement — Alertes non activées",
        "labels": ["backend", "frontend", "enhancement", "parcours:equipment"],
        "milestone": MS3,
        "body": """## Contexte
Le champ `maintenance_interval_months` existe sur le modèle Equipment, mais aucun système ne génère automatiquement une tâche ou une alerte quand la prochaine maintenance est due.

## Problème
La donnée est stockée mais non exploitée. L'utilisateur doit se souvenir lui-même des échéances.

## Travail requis
- [ ] Backend : tâche Celery (ou commande management) qui vérifie les équipements dont la maintenance est due
- [ ] Créer une `Notification` ou une `Task` automatique lorsque la date est dépassée
- [ ] Frontend : indicateur visuel sur la fiche équipement si maintenance due/en retard

## Fichiers concernés
- `apps/equipment/models.py`
- Backend : scheduler/tasks"""
    },
    {
        "title": "Alertes expiration de garantie — Équipements",
        "labels": ["backend", "frontend", "enhancement", "parcours:equipment"],
        "milestone": MS3,
        "body": """## Contexte
Le champ `warranty_expires_on` est suivi sur les équipements, mais aucune alerte n'est générée avant son expiration.

## Problème
Un utilisateur ne sait pas que sa garantie expire dans 30 jours.

## Travail requis
- [ ] Backend : tâche planifiée pour détecter les garanties expirant dans 30/60 jours
- [ ] Créer une `Notification` automatique
- [ ] Frontend : badge ou indicateur sur la fiche équipement

## Fichiers concernés
- `apps/equipment/models.py`"""
    },
    # Milestone 4
    {
        "title": "Récurrence des tâches",
        "labels": ["backend", "frontend", "feature", "parcours:tasks"],
        "milestone": MS4,
        "body": """## Contexte
Les tâches n'ont aucun système de récurrence. Pour les maintenances périodiques (chaudière tous les ans, filtre tous les 3 mois), l'utilisateur doit créer manuellement chaque occurrence.

## Travail requis
- [ ] Backend : ajouter un champ `recurrence` sur `Task` (quotidien, hebdomadaire, mensuel, annuel)
- [ ] Créer la migration
- [ ] Logique de génération de la prochaine occurrence à la complétion
- [ ] Frontend : ajouter le sélecteur de récurrence dans `TaskDialog`

## Fichiers concernés
- `apps/tasks/models.py`
- `ui/src/features/tasks/TaskDialog.tsx`"""
    },
    {
        "title": "Créer une tâche depuis une interaction",
        "labels": ["frontend", "integration", "enhancement", "parcours:tasks", "parcours:interactions"],
        "milestone": MS4,
        "body": """## Contexte
Le modèle `Task` a un champ `source_interaction`, mais l'UI ne propose pas de créer une tâche directement depuis une fiche interaction.

## Workflow cible
Je vois un problème dans mon journal → je clique "Créer une tâche" → la tâche est pré-remplie avec le contexte de l'interaction.

## Travail requis
- [ ] Ajouter un bouton "Créer une tâche" sur la page de détail d'une interaction
- [ ] Pré-remplir le dialog de création de tâche avec le titre et la zone de l'interaction
- [ ] Lier automatiquement `source_interaction` à la tâche créée

## Fichiers concernés
- `ui/src/features/interactions/InteractionDetailPage.tsx` (ou équivalent)"""
    },
    {
        "title": "Historique des interventions par contact",
        "labels": ["frontend", "integration", "enhancement", "parcours:directory"],
        "milestone": MS4,
        "body": """## Contexte
Les contacts sont liés aux interactions côté backend (`InteractionContact`), mais il n'existe pas de vue "toutes les interventions de ce contact" depuis la fiche contact.

## Travail requis
- [ ] Ajouter un onglet "Activité" sur la fiche contact/structure
- [ ] Lister les interactions liées, triées par date décroissante
- [ ] Permettre de naviguer vers chaque interaction

## Fichiers concernés
- `ui/src/features/directory/` (fiche contact)"""
    },
    {
        "title": 'Champ "équipement concerné" dans le formulaire d\'interaction',
        "labels": ["frontend", "integration", "enhancement", "parcours:interactions", "parcours:equipment"],
        "milestone": MS4,
        "body": """## Contexte
`EquipmentInteraction` existe pour lier une intervention à un équipement, mais le formulaire de création d'interaction n'a pas de champ "équipement concerné".

## Problème
Ce lien ne peut être créé que depuis la fiche équipement, pas depuis le formulaire d'interaction.

## Travail requis
- [ ] Ajouter un champ optionnel "Équipement concerné" dans `InteractionNewPage.tsx` et `InteractionEditPage.tsx`
- [ ] Alimenter `EquipmentInteraction` lors de la sauvegarde

## Fichiers concernés
- `ui/src/features/interactions/InteractionNewPage.tsx`
- `ui/src/features/interactions/InteractionEditPage.tsx`"""
    },
    {
        "title": "Alertes stock faible — Stock & Inventaire",
        "labels": ["backend", "frontend", "enhancement", "notifications", "parcours:stock"],
        "milestone": MS4,
        "body": """## Contexte
Le statut `low_stock` / `out_of_stock` est calculé automatiquement sur les articles de stock, mais aucune alerte ou tâche n'est générée.

## Travail requis
- [ ] Backend : détecter les items passant en `low_stock` ou `out_of_stock`
- [ ] Créer une `Notification` automatique
- [ ] Frontend : indicateur visuel sur la page Stock (badge ou bannière d'alerte)

## Fichiers concernés
- `apps/stock/models.py`"""
    },
    {
        "title": "Multi-upload de documents dans le formulaire d'interaction",
        "labels": ["frontend", "ux", "enhancement", "parcours:documents", "parcours:interactions"],
        "milestone": MS4,
        "body": """## Contexte
Il est impossible d'uploader plusieurs documents d'un coup lors de la création d'une interaction. L'upload et la création d'interaction sont deux étapes séparées, créant de la friction pour les factures ou rapports d'intervention.

## Travail requis
- [ ] Permettre la sélection de plusieurs fichiers dans le formulaire d'interaction
- [ ] Upload automatique après création de l'interaction
- [ ] Afficher les documents uploadés dans le formulaire (liste + suppression)

## Fichiers concernés
- `ui/src/features/interactions/InteractionNewPage.tsx`"""
    },
    {
        "title": "Supprimer une zone avec enfants — Message d'erreur clair",
        "labels": ["frontend", "ux", "enhancement", "parcours:zones"],
        "milestone": MS4,
        "body": """## Contexte
Il est impossible de supprimer une zone qui a des sous-zones (contrainte métier), mais l'UI ne le signale pas clairement — l'utilisateur reçoit une erreur API brute.

## Correction
- [ ] Intercepter l'erreur de suppression dans le frontend
- [ ] Afficher un message explicite : "Cette zone contient des sous-zones. Supprimez-les d'abord."
- [ ] Idéalement : détecter avant la tentative si la zone a des enfants et désactiver/masquer le bouton supprimer

## Fichiers concernés
- `ui/src/features/zones/ZonesPage.tsx` ou le composant de card zone"""
    },
    {
        "title": "Champ contact/prestataire dans le formulaire d'interaction",
        "labels": ["frontend", "integration", "enhancement", "parcours:interactions", "parcours:directory"],
        "milestone": MS4,
        "body": """## Contexte
`InteractionContact` et `InteractionStructure` existent côté backend pour lier une interaction à un contact ou une entreprise, mais le formulaire de création d'interaction n'expose pas ces champs.

## Travail requis
- [ ] Ajouter un champ "Contact" (select ou autocomplete) dans `InteractionNewPage.tsx`
- [ ] Ajouter un champ "Prestataire/Structure" dans `InteractionNewPage.tsx`
- [ ] Alimenter les tables de liaison lors de la sauvegarde

## Fichiers concernés
- `ui/src/features/interactions/InteractionNewPage.tsx`
- `ui/src/features/interactions/InteractionEditPage.tsx`"""
    },
]

created_issues = []
failed_issues = []

for issue in issues_to_create:
    ms_title = issue["milestone"]
    ms_num = milestone_numbers.get(ms_title)
    if not ms_num:
        print(f"  WARNING: No milestone number found for '{ms_title}', skipping: {issue['title']}")
        failed_issues.append(issue["title"])
        continue

    payload = {
        "title": issue["title"],
        "body": issue["body"],
        "labels": issue["labels"],
        "milestone": ms_num,
    }
    result = api_post("issues", payload)
    if result and "_skipped" not in result:
        url = result.get("html_url", f"#{result.get('number', '?')}")
        num = result.get("number", "?")
        created_issues.append((issue["title"], url, num, ms_title))
        print(f"  Created #{num}: {issue['title']}")
    else:
        print(f"  Failed: {issue['title']}")
        failed_issues.append(issue["title"])

# =====================
# Final Summary
# =====================
print("\n" + "="*60)
print("FINAL SUMMARY")
print("="*60)

print(f"\nLabels: {len(labels_created)} created, {len(labels_skipped)} already existed")

print(f"\nMilestones ({len(milestone_numbers)}):")
for title, num in milestone_numbers.items():
    print(f"  #{num}: {title}")

print(f"\nIssues created ({len(created_issues)}):")
ms_groups = {}
for title, url, num, ms in created_issues:
    ms_groups.setdefault(ms, []).append((num, title, url))

for ms, iss in ms_groups.items():
    print(f"\n  {ms}:")
    for num, title, url in iss:
        print(f"    #{num}: {title}")
        print(f"        {url}")

if failed_issues:
    print(f"\nFailed issues ({len(failed_issues)}):")
    for t in failed_issues:
        print(f"  - {t}")
