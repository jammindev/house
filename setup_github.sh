#!/bin/bash
set -e

REPO="jammindev/house"

echo "=== Checking existing labels ==="
gh api repos/$REPO/labels --paginate | python3 -c "import sys,json; [print(l['name']) for l in json.load(sys.stdin)]" || echo "No labels found"

echo "=== Checking existing milestones ==="
gh api repos/$REPO/milestones | python3 -c "import sys,json; [print(str(m['number']) + ':' + m['title']) for m in json.load(sys.stdin)]" || echo "No milestones found"

echo "=== Creating labels ==="

create_label() {
  local name="$1"
  local color="$2"
  local desc="$3"
  gh api repos/$REPO/labels -X POST -f name="$name" -f color="$color" -f description="$desc" 2>&1 && echo "Created: $name" || echo "Skipped (exists?): $name"
}

create_label "blocker" "d73a4a" "Bloquant MVP : sans ce fix l'utilisateur ne peut pas utiliser l'app"
create_label "security" "e4e669" "Sécurité"
create_label "ux" "0075ca" "Expérience utilisateur"
create_label "backend" "0e8a16" "Backend Django"
create_label "frontend" "1d76db" "Frontend React"
create_label "i18n" "bfd4f2" "Internationalisation / traductions"
create_label "auth" "5319e7" "Authentification & utilisateurs"
create_label "feature" "a2eeef" "Nouvelle fonctionnalité"
create_label "enhancement" "84b6eb" "Amélioration d'existant"
create_label "missing-frontend" "f9d0c4" "Backend existe, frontend manquant"
create_label "integration" "c5def5" "Lien entre modules"
create_label "notifications" "e99695" "Système de notifications"
create_label "parcours:auth" "5319e7" "Parcours: Authentification"
create_label "parcours:household" "0075ca" "Parcours: Foyer & Membres"
create_label "parcours:zones" "0e8a16" "Parcours: Zones"
create_label "parcours:tasks" "1d76db" "Parcours: Tâches"
create_label "parcours:interactions" "e4e669" "Parcours: Interactions / Journal"
create_label "parcours:projects" "d93f0b" "Parcours: Projets"
create_label "parcours:equipment" "bfd4f2" "Parcours: Équipements"
create_label "parcours:documents" "c5def5" "Parcours: Documents"
create_label "parcours:electricity" "f9d0c4" "Parcours: Électricité"
create_label "parcours:stock" "e99695" "Parcours: Stock & Inventaire"
create_label "parcours:directory" "84b6eb" "Parcours: Répertoire"
create_label "parcours:insurance" "a2eeef" "Parcours: Assurances"

echo "=== Labels done ==="

echo "=== Creating milestones ==="

MS1=$(gh api repos/$REPO/milestones -X POST \
  -f title="MVP - Phase 1 : Inscription & Accès utilisateur" \
  -f description="Éléments bloquants sans lesquels un utilisateur ne peut pas s'inscrire et utiliser l'application de manière autonome." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
echo "Milestone 1 number: $MS1"

MS2=$(gh api repos/$REPO/milestones -X POST \
  -f title="MVP - Phase 2 : Réinitialisation mot de passe & Notifications" \
  -f description="Flux critiques pour la rétention : mot de passe oublié, centre de notifications, envoi d'emails." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
echo "Milestone 2 number: $MS2"

MS3=$(gh api repos/$REPO/milestones -X POST \
  -f title="MVP - Phase 3 : Robustesse & Qualité" \
  -f description="Améliorations non-bloquantes pour atteindre un niveau de qualité MVP solide avant ouverture." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
echo "Milestone 3 number: $MS3"

MS4=$(gh api repos/$REPO/milestones -X POST \
  -f title="Post-MVP : Alertes & Intégrations" \
  -f description="Améliorations futures : alertes automatiques, récurrence tâches, intégrations entre modules." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
echo "Milestone 4 number: $MS4"

echo "=== Milestones done ==="
echo "MS1=$MS1 MS2=$MS2 MS3=$MS3 MS4=$MS4"

echo "=== Creating issues ==="

# Issue 1
I1=$(gh issue create --repo $REPO \
  --title "Page d'inscription (Signup) — Frontend manquant" \
  --label "blocker,frontend,auth,parcours:auth" \
  --milestone "MVP - Phase 1 : Inscription & Accès utilisateur" \
  --body "## Contexte
Le backend expose l'endpoint \`POST /api/accounts/users/\` avec \`AllowAny\`, mais aucune page frontend ne permet à un utilisateur de créer un compte de manière autonome.

## Problème
- Aucune route \`/signup\` ou \`/register\` dans \`ui/src/router.tsx\`
- Aucune page \`SignupPage.tsx\` dans \`ui/src/features/auth/\`
- Aucun lien vers l'inscription depuis \`LoginPage.tsx\`
- Clés i18n manquantes dans les 4 fichiers de langue

## Travail requis
- [ ] Créer \`ui/src/features/auth/SignupPage.tsx\` (champs : email, prénom, nom, mot de passe, confirmation)
- [ ] Ajouter la route \`/signup\` dans \`ui/src/router.tsx\`
- [ ] Ajouter un lien \"Pas encore inscrit ?\" dans \`LoginPage.tsx\`
- [ ] Ajouter les clés i18n signup dans les 4 fichiers de traduction (\`en\`, \`fr\`, \`de\`, \`es\`)

## Fichiers concernés
- \`ui/src/features/auth/LoginPage.tsx\`
- \`ui/src/router.tsx\`
- \`ui/src/locales/*/translation.json\`")
echo "Issue 1: $I1"

# Issue 2
I2=$(gh issue create --repo $REPO \
  --title "Validation du mot de passe absente à l'inscription — Backend" \
  --label "blocker,backend,security,auth,parcours:auth" \
  --milestone "MVP - Phase 1 : Inscription & Accès utilisateur" \
  --body "## Contexte
\`UserSerializer.create()\` n'appelle pas \`validate_password()\`. Les validateurs Django sont configurés dans \`base.py\` (longueur min, mots de passe communs, similarité email) mais **ne sont pas appliqués à l'inscription**.

## Problème
Un mot de passe \`\"123\"\` peut être accepté à l'inscription alors qu'il serait refusé au changement de mot de passe.

\`\`\`python
# apps/accounts/serializers.py — create() actuel
user = User(**validated_data)
user.set_password(password)  # ← pas de validate_password() avant
\`\`\`

## Correction
Ajouter \`validate_password(password, user=user)\` dans \`UserSerializer.create()\` **avant** \`user.set_password()\`.

## Fichiers concernés
- \`apps/accounts/serializers.py\`")
echo "Issue 2: $I2"

# Issue 3
I3=$(gh issue create --repo $REPO \
  --title "Message d'erreur de login hardcodé en français" \
  --label "blocker,frontend,i18n,auth,parcours:auth" \
  --milestone "MVP - Phase 1 : Inscription & Accès utilisateur" \
  --body "## Contexte
L'application supporte 4 langues (en, fr, de, es) mais le message d'erreur de connexion est hardcodé en français.

## Problème
\`\`\`typescript
// ui/src/features/auth/LoginPage.tsx
} catch {
  setError('Email ou mot de passe incorrect.'); // ← hardcodé en français
}
\`\`\`

## Correction
- [ ] Remplacer par \`setError(t('auth.invalidCredentials'))\`
- [ ] Ajouter la clé \`auth.invalidCredentials\` dans les 4 fichiers de traduction

## Fichiers concernés
- \`ui/src/features/auth/LoginPage.tsx\`
- \`ui/src/locales/*/translation.json\`")
echo "Issue 3: $I3"

# Issue 4
I4=$(gh issue create --repo $REPO \
  --title "Page Assurances — Frontend manquant" \
  --label "blocker,frontend,missing-frontend,parcours:insurance" \
  --milestone "MVP - Phase 1 : Inscription & Accès utilisateur" \
  --body "## Contexte
Le backend dispose d'un modèle Assurances complet (modèle, migrations, tests), mais **aucune page frontend n'existe** pour y accéder.

## Problème
Les utilisateurs ne peuvent pas consulter, créer ou gérer leurs contrats d'assurance depuis l'interface.

## Travail requis
- [ ] Créer \`ui/src/features/insurance/InsurancePage.tsx\`
- [ ] Créer \`ui/src/features/insurance/InsuranceCard.tsx\`
- [ ] Créer \`ui/src/features/insurance/InsuranceDialog.tsx\` (create/edit)
- [ ] Créer \`ui/src/features/insurance/hooks.ts\`
- [ ] Ajouter la route dans \`ui/src/router.tsx\`
- [ ] Ajouter le lien dans la navigation
- [ ] Ajouter les clés i18n dans les 4 fichiers de traduction

Suivre le pattern standard des features (cf. CLAUDE.md).")
echo "Issue 4: $I4"

# Issue 5
I5=$(gh issue create --repo $REPO \
  --title "Réinitialisation de mot de passe — Backend & Frontend" \
  --label "blocker,backend,frontend,auth,parcours:auth" \
  --milestone "MVP - Phase 2 : Réinitialisation mot de passe & Notifications" \
  --body "## Contexte
Il n'existe aucun flux \"mot de passe oublié\". Un utilisateur qui perd son mot de passe est définitivement bloqué sans intervention admin.

## Travail requis

### Backend
- [ ] Endpoint \`POST /api/accounts/password-reset/\` (génération token + envoi email)
- [ ] Endpoint \`POST /api/accounts/password-reset/confirm/\` (token + nouveau mot de passe)

### Frontend
- [ ] Créer \`ui/src/features/auth/ForgotPasswordPage.tsx\` (saisie email)
- [ ] Créer \`ui/src/features/auth/ResetPasswordPage.tsx\` (token + nouveau mot de passe)
- [ ] Ajouter les routes correspondantes
- [ ] Ajouter un lien \"Mot de passe oublié ?\" dans \`LoginPage.tsx\`
- [ ] Ajouter les clés i18n dans les 4 fichiers de traduction

> Note : \`EMAIL_BACKEND\` est configuré dans \`.env.example\`, la plomberie email est prête.")
echo "Issue 5: $I5"

# Issue 6
I6=$(gh issue create --repo $REPO \
  --title "Centre de notifications — Frontend manquant" \
  --label "blocker,frontend,missing-frontend,notifications,parcours:household" \
  --milestone "MVP - Phase 2 : Réinitialisation mot de passe & Notifications" \
  --body "## Contexte
Le modèle \`Notification\` existe côté backend (type \`household_invitation\`, etc.) et des notifications sont créées lors des invitations, mais **aucun centre de notifications n'existe dans l'UI**.

## Problème
Un utilisateur invité à rejoindre un foyer ne voit aucune indication dans l'interface.

## Travail requis
- [ ] Ajouter un badge de notifications dans la navbar (compteur des non-lues)
- [ ] Créer un dropdown ou une page \`/notifications\`
- [ ] Permettre de marquer les notifications comme lues
- [ ] Gérer les actions depuis la notification (ex: accepter une invitation)
- [ ] Ajouter les clés i18n

## Fichiers concernés
- \`ui/src/components/\` (navbar)
- Backend : vérifier que l'endpoint \`GET /api/notifications/\` existe")
echo "Issue 6: $I6"

# Issue 7
I7=$(gh issue create --repo $REPO \
  --title "Vérifier et activer l'envoi d'email — Invitations foyer" \
  --label "backend,auth,parcours:household" \
  --milestone "MVP - Phase 2 : Réinitialisation mot de passe & Notifications" \
  --body "## Contexte
Le flux d'invitation crée une \`HouseholdInvitation\` en base de données, mais il n'est pas certain qu'un email soit effectivement envoyé à l'invité.

## À vérifier
- [ ] Vérifier que \`InvitationViewSet\` envoie bien un email (signal ou appel direct)
- [ ] Tester le flux complet : invitation → email reçu → lien → acceptation
- [ ] Vérifier la template d'email si elle existe

## Fichiers concernés
- \`apps/accounts/views.py\` (InvitationViewSet)
- \`apps/accounts/signals.py\` (si existant)")
echo "Issue 7: $I7"

# Issue 8
I8=$(gh issue create --repo $REPO \
  --title "Tokens JWT stockés dans localStorage — Sécurité" \
  --label "security,frontend,auth,parcours:auth" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Les tokens JWT sont stockés dans \`localStorage\`, ce qui les expose au vol par attaque XSS.

## Problème
\`localStorage.setItem('access_token', ...)\` — tout script malveillant injecté dans la page peut lire et exfiltrer le token.

## Solution recommandée
Migrer vers des cookies \`HttpOnly\` + \`Secure\` + \`SameSite=Strict\` pour stocker les tokens, ce qui les rend inaccessibles au JavaScript.

## Fichiers concernés
- \`ui/src/features/auth/\` (gestion des tokens)
- Backend : endpoint de refresh à adapter pour cookies")
echo "Issue 8: $I8"

# Issue 9
I9=$(gh issue create --repo $REPO \
  --title "Filtres avancés manquants — Page Interactions" \
  --label "frontend,enhancement,parcours:interactions" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Le backend supporte le filtrage par \`zone\`, \`contact\`, \`structure\`, \`tags\`, \`date_range\`, \`created_by\` sur les interactions, mais l'UI n'expose que \`type\` + \`statut\` + recherche texte.

## Travail requis
- [ ] Ajouter un filtre par zone (select)
- [ ] Ajouter un filtre par contact/prestataire
- [ ] Ajouter un filtre par plage de dates (date range picker)
- [ ] Ajouter un filtre par tags

## Fichiers concernés
- \`ui/src/features/interactions/InteractionsPage.tsx\`")
echo "Issue 9: $I9"

# Issue 10
I10=$(gh issue create --repo $REPO \
  --title "Champ montant structuré pour les dépenses (Interactions type expense)" \
  --label "backend,frontend,enhancement,parcours:interactions,parcours:projects" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Les interactions de type \`expense\` n'ont pas de champ montant dédié dans le modèle — le montant est probablement stocké dans \`metadata\` (JSON). Il n'y a pas de saisie structurée du montant dans le formulaire.

## Problème
- Impossible de calculer un total de dépenses automatiquement
- \`actual_cost_cached\` des projets reste à 0 sauf saisie manuelle
- Pas de suivi financier fiable

## Travail requis
- [ ] Backend : ajouter un champ \`amount\` (DecimalField) sur le modèle \`Interaction\` (ou via un modèle lié)
- [ ] Créer la migration
- [ ] Exposer le champ dans le serializer
- [ ] Frontend : ajouter le champ montant dans le formulaire de création d'interaction (conditionnel sur le type \`expense\`)
- [ ] Calculer et mettre à jour \`actual_cost_cached\` des projets liés automatiquement

## Fichiers concernés
- \`apps/interactions/models.py\`
- \`apps/interactions/serializers.py\`
- \`ui/src/features/interactions/InteractionNewPage.tsx\`
- \`ui/src/features/interactions/InteractionEditPage.tsx\`")
echo "Issue 10: $I10"

# Issue 11
I11=$(gh issue create --repo $REPO \
  --title "defaultValue dans les appels t() — ProfileSection" \
  --label "frontend,i18n,enhancement" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Selon les règles du projet (CLAUDE.md), l'usage de \`defaultValue\` dans les appels \`t()\` est interdit car il masque les traductions manquantes.

## Problème
\`ui/src/features/settings/ProfileSection.tsx\` utilise des \`defaultValue\` dans ses appels \`t()\`.

## Correction
Remplacer tous les \`t('key', 'default value')\` par \`t('key')\` et vérifier que les clés existent dans les 4 fichiers de traduction.

## Fichiers concernés
- \`ui/src/features/settings/ProfileSection.tsx\`
- \`ui/src/locales/*/translation.json\`")
echo "Issue 11: $I11"

# Issue 12
I12=$(gh issue create --repo $REPO \
  --title "Page 404 et Error Boundary global" \
  --label "frontend,ux,enhancement" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Il n'existe pas de page 404 ni d'error boundary global dans l'application.

## Problème
- Une URL invalide ne donne pas de retour visuel adapté à l'utilisateur
- Une erreur JavaScript non catchée peut crasher toute l'application sans message utile

## Travail requis
- [ ] Créer un composant \`NotFoundPage.tsx\` (page 404)
- [ ] Ajouter une route catch-all \`*\` dans le router
- [ ] Ajouter un \`ErrorBoundary\` global dans \`ProtectedLayout.tsx\`
- [ ] Ajouter les clés i18n correspondantes

## Fichiers concernés
- \`ui/src/router.tsx\`
- \`ui/src/components/ProtectedLayout.tsx\`")
echo "Issue 12: $I12"

# Issue 13
I13=$(gh issue create --repo $REPO \
  --title "Changement d'email impossible dans les Settings" \
  --label "frontend,ux,enhancement,parcours:auth" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
La page Settings permet de changer le nom, le mot de passe, etc., mais pas l'adresse email.

## Problème
Un utilisateur qui a fait une faute de frappe dans son email ou qui souhaite le changer n'a aucun moyen de le faire sans intervention admin.

## Travail requis
- [ ] Ajouter un champ email dans \`ProfileSection.tsx\` avec un bouton de mise à jour
- [ ] Backend : vérifier que \`PATCH /api/accounts/users/me/\` accepte la modification de l'email
- [ ] Idéalement : ajouter une vérification par email après changement

## Fichiers concernés
- \`ui/src/features/settings/SettingsPage.tsx\`
- \`ui/src/features/settings/ProfileSection.tsx\`")
echo "Issue 13: $I13"

# Issue 14
I14=$(gh issue create --repo $REPO \
  --title "Maintenance préventive équipement — Alertes non activées" \
  --label "backend,frontend,enhancement,parcours:equipment" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Le champ \`maintenance_interval_months\` existe sur le modèle Equipment, mais aucun système ne génère automatiquement une tâche ou une alerte quand la prochaine maintenance est due.

## Problème
La donnée est stockée mais non exploitée. L'utilisateur doit se souvenir lui-même des échéances.

## Travail requis
- [ ] Backend : tâche Celery (ou commande management) qui vérifie les équipements dont la maintenance est due
- [ ] Créer une \`Notification\` ou une \`Task\` automatique lorsque la date est dépassée
- [ ] Frontend : indicateur visuel sur la fiche équipement si maintenance due/en retard

## Fichiers concernés
- \`apps/equipment/models.py\`
- Backend : scheduler/tasks")
echo "Issue 14: $I14"

# Issue 15
I15=$(gh issue create --repo $REPO \
  --title "Alertes expiration de garantie — Équipements" \
  --label "backend,frontend,enhancement,parcours:equipment" \
  --milestone "MVP - Phase 3 : Robustesse & Qualité" \
  --body "## Contexte
Le champ \`warranty_expires_on\` est suivi sur les équipements, mais aucune alerte n'est générée avant son expiration.

## Problème
Un utilisateur ne sait pas que sa garantie expire dans 30 jours.

## Travail requis
- [ ] Backend : tâche planifiée pour détecter les garanties expirant dans 30/60 jours
- [ ] Créer une \`Notification\` automatique
- [ ] Frontend : badge ou indicateur sur la fiche équipement

## Fichiers concernés
- \`apps/equipment/models.py\`")
echo "Issue 15: $I15"

# Issue 16
I16=$(gh issue create --repo $REPO \
  --title "Récurrence des tâches" \
  --label "backend,frontend,feature,parcours:tasks" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Les tâches n'ont aucun système de récurrence. Pour les maintenances périodiques (chaudière tous les ans, filtre tous les 3 mois), l'utilisateur doit créer manuellement chaque occurrence.

## Travail requis
- [ ] Backend : ajouter un champ \`recurrence\` sur \`Task\` (quotidien, hebdomadaire, mensuel, annuel)
- [ ] Créer la migration
- [ ] Logique de génération de la prochaine occurrence à la complétion
- [ ] Frontend : ajouter le sélecteur de récurrence dans \`TaskDialog\`

## Fichiers concernés
- \`apps/tasks/models.py\`
- \`ui/src/features/tasks/TaskDialog.tsx\`")
echo "Issue 16: $I16"

# Issue 17
I17=$(gh issue create --repo $REPO \
  --title "Créer une tâche depuis une interaction" \
  --label "frontend,integration,enhancement,parcours:tasks,parcours:interactions" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Le modèle \`Task\` a un champ \`source_interaction\`, mais l'UI ne propose pas de créer une tâche directement depuis une fiche interaction.

## Workflow cible
Je vois un problème dans mon journal → je clique \"Créer une tâche\" → la tâche est pré-remplie avec le contexte de l'interaction.

## Travail requis
- [ ] Ajouter un bouton \"Créer une tâche\" sur la page de détail d'une interaction
- [ ] Pré-remplir le dialog de création de tâche avec le titre et la zone de l'interaction
- [ ] Lier automatiquement \`source_interaction\` à la tâche créée

## Fichiers concernés
- \`ui/src/features/interactions/InteractionDetailPage.tsx\` (ou équivalent)")
echo "Issue 17: $I17"

# Issue 18
I18=$(gh issue create --repo $REPO \
  --title "Historique des interventions par contact" \
  --label "frontend,integration,enhancement,parcours:directory" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Les contacts sont liés aux interactions côté backend (\`InteractionContact\`), mais il n'existe pas de vue \"toutes les interventions de ce contact\" depuis la fiche contact.

## Travail requis
- [ ] Ajouter un onglet \"Activité\" sur la fiche contact/structure
- [ ] Lister les interactions liées, triées par date décroissante
- [ ] Permettre de naviguer vers chaque interaction

## Fichiers concernés
- \`ui/src/features/directory/\` (fiche contact)")
echo "Issue 18: $I18"

# Issue 19
I19=$(gh issue create --repo $REPO \
  --title "Champ \"équipement concerné\" dans le formulaire d'interaction" \
  --label "frontend,integration,enhancement,parcours:interactions,parcours:equipment" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
\`EquipmentInteraction\` existe pour lier une intervention à un équipement, mais le formulaire de création d'interaction n'a pas de champ \"équipement concerné\".

## Problème
Ce lien ne peut être créé que depuis la fiche équipement, pas depuis le formulaire d'interaction.

## Travail requis
- [ ] Ajouter un champ optionnel \"Équipement concerné\" dans \`InteractionNewPage.tsx\` et \`InteractionEditPage.tsx\`
- [ ] Alimenter \`EquipmentInteraction\` lors de la sauvegarde

## Fichiers concernés
- \`ui/src/features/interactions/InteractionNewPage.tsx\`
- \`ui/src/features/interactions/InteractionEditPage.tsx\`")
echo "Issue 19: $I19"

# Issue 20
I20=$(gh issue create --repo $REPO \
  --title "Alertes stock faible — Stock & Inventaire" \
  --label "backend,frontend,enhancement,notifications,parcours:stock" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Le statut \`low_stock\` / \`out_of_stock\` est calculé automatiquement sur les articles de stock, mais aucune alerte ou tâche n'est générée.

## Travail requis
- [ ] Backend : détecter les items passant en \`low_stock\` ou \`out_of_stock\`
- [ ] Créer une \`Notification\` automatique
- [ ] Frontend : indicateur visuel sur la page Stock (badge ou bannière d'alerte)

## Fichiers concernés
- \`apps/stock/models.py\`")
echo "Issue 20: $I20"

# Issue 21
I21=$(gh issue create --repo $REPO \
  --title "Multi-upload de documents dans le formulaire d'interaction" \
  --label "frontend,ux,enhancement,parcours:documents,parcours:interactions" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Il est impossible d'uploader plusieurs documents d'un coup lors de la création d'une interaction. L'upload et la création d'interaction sont deux étapes séparées, créant de la friction pour les factures ou rapports d'intervention.

## Travail requis
- [ ] Permettre la sélection de plusieurs fichiers dans le formulaire d'interaction
- [ ] Upload automatique après création de l'interaction
- [ ] Afficher les documents uploadés dans le formulaire (liste + suppression)

## Fichiers concernés
- \`ui/src/features/interactions/InteractionNewPage.tsx\`")
echo "Issue 21: $I21"

# Issue 22
I22=$(gh issue create --repo $REPO \
  --title "Supprimer une zone avec enfants — Message d'erreur clair" \
  --label "frontend,ux,enhancement,parcours:zones" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
Il est impossible de supprimer une zone qui a des sous-zones (contrainte métier), mais l'UI ne le signale pas clairement — l'utilisateur reçoit une erreur API brute.

## Correction
- [ ] Intercepter l'erreur de suppression dans le frontend
- [ ] Afficher un message explicite : \"Cette zone contient des sous-zones. Supprimez-les d'abord.\"
- [ ] Idéalement : détecter avant la tentative si la zone a des enfants et désactiver/masquer le bouton supprimer

## Fichiers concernés
- \`ui/src/features/zones/ZonesPage.tsx\` ou le composant de card zone")
echo "Issue 22: $I22"

# Issue 23
I23=$(gh issue create --repo $REPO \
  --title "Champ contact/prestataire dans le formulaire d'interaction" \
  --label "frontend,integration,enhancement,parcours:interactions,parcours:directory" \
  --milestone "Post-MVP : Alertes & Intégrations" \
  --body "## Contexte
\`InteractionContact\` et \`InteractionStructure\` existent côté backend pour lier une interaction à un contact ou une entreprise, mais le formulaire de création d'interaction n'expose pas ces champs.

## Travail requis
- [ ] Ajouter un champ \"Contact\" (select ou autocomplete) dans \`InteractionNewPage.tsx\`
- [ ] Ajouter un champ \"Prestataire/Structure\" dans \`InteractionNewPage.tsx\`
- [ ] Alimenter les tables de liaison lors de la sauvegarde

## Fichiers concernés
- \`ui/src/features/interactions/InteractionNewPage.tsx\`
- \`ui/src/features/interactions/InteractionEditPage.tsx\`")
echo "Issue 23: $I23"

echo "=== ALL DONE ==="
echo "Summary:"
echo "Milestone 1 (Phase 1): $MS1 — Issues: $I1, $I2, $I3, $I4"
echo "Milestone 2 (Phase 2): $MS2 — Issues: $I5, $I6, $I7"
echo "Milestone 3 (Phase 3): $MS3 — Issues: $I8, $I9, $I10, $I11, $I12, $I13, $I14, $I15"
echo "Milestone 4 (Post-MVP): $MS4 — Issues: $I16, $I17, $I18, $I19, $I20, $I21, $I22, $I23"
