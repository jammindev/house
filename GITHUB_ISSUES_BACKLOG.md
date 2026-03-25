# GitHub Issues — Backlog initial

Issues à créer sur GitHub. Chaque section = une issue.
Référence de fichier incluse pour vérification.

---

## BUGS

### [BUG-01] Perte du thème (light/dark) au logout

**Labels :** `bug` `app:general`
**Milestone :** —

**Description :**
Quand l'utilisateur se déconnecte, le thème sélectionné (light ou dark) est perdu. Au reconnexion, le thème revient au défaut.

**Source :** `A_AMELIORER_STYLE.md`

---

### [BUG-02] Blink de thème au chargement de la page d'accueil

**Labels :** `bug` `app:general` `style`
**Milestone :** —

**Description :**
À l'arrivée sur le dashboard, on voit brièvement un thème incorrect avant que le bon thème soit appliqué. Il faudrait ne rien afficher tant que le thème n'est pas résolu (éviter le flash of unstyled content).

**Source :** `A_AMELIORER_STYLE.md`

---

### [BUG-03] La sidebar recharge au changement de page

**Labels :** `bug` `app:general`
**Milestone :** —

**Description :**
La sidebar se recharge (re-render complet ?) lors des navigations entre pages. Revoir le mécanisme de rendu de la sidebar pour éviter ce comportement.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 9

---

### [BUG-04] Blink de la sidebar au rechargement / navigation

**Labels :** `bug` `app:general` `style`
**Milestone :** —

**Description :**
La sidebar clignote brièvement au rechargement de page et lors de certaines navigations.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 11

---

### [BUG-05] La sidebar ne met pas en évidence la page active (sous-pages)

**Labels :** `bug` `app:general`
**Milestone :** —

**Description :**
Quand on navigue vers une page de détail (ex: détail d'une zone, d'un équipement), la sidebar ne met plus en surbrillance l'entrée correspondante. Le surlignage actif devrait persister sur les sous-pages.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 13

---

### [BUG-06] Impossible de créer une tâche sans date d'échéance

**Labels :** `bug` `app:tasks`
**Milestone :** —

**Description :**
Sur la page tasks, si aucune due date n'est renseignée, la création de tâche échoue. Le champ `occurred_at` semble être requis alors qu'il ne devrait pas l'être pour les tâches. À investiguer : mapping `occurred_at` → `metadata.due_date`.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 5

---

### [BUG-07] Filtrage par tags — split sans nettoyage des entrées vides

**Labels :** `bug` `app:general`
**Milestone :** —

**Description :**
Le filtrage par tags utilise un `split(',')` sans nettoyer les entrées vides générées par des virgules superflues. Fix suggéré : `[t.strip() for t in tags.split(',') if t.strip()]`

**Sévérité :** Medium

**Source :** `docs/SECURITY_REVIEW.md` lignes 128–135

---

## FEATURES

### [FEAT-01] Suppression des tâches

**Labels :** `feat` `app:tasks`
**Milestone :** —

**Description :**
Il n'est pas possible de supprimer une tâche. Implémenter la suppression avec le pattern `useDeleteWithUndo` (toast avec undo, pas de `window.confirm`), conformément aux patterns UI du projet.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 15

---

### [FEAT-02] Parcours 06 — Endpoint alertes `/api/alerts/summary/`

**Labels :** `feat` `app:general`
**Milestone :** `Parcours 06 — Alertes`

**Description :**
Créer un endpoint `GET /api/alerts/summary/` qui agrège :
- Tâches en retard (overdue)
- Garanties équipement arrivant à expiration (< 30 jours)
- Maintenances dues

Retourne un objet avec les compteurs et les items les plus urgents.

**Source :** `docs/JOURNAL_PRODUIT.md` · `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`

---

### [FEAT-03] Parcours 06 — Section "À surveiller" sur le dashboard

**Labels :** `feat` `app:general`
**Milestone :** `Parcours 06 — Alertes`

**Description :**
Ajouter une section "À surveiller" sur le dashboard, alimentée par `/api/alerts/summary/`. Affiche les alertes actives de façon condensée avec lien vers les ressources concernées.

**Source :** `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`

---

### [FEAT-04] Parcours 06 — Page Alertes dédiée (mini-SPA React)

**Labels :** `feat` `app:general`
**Milestone :** `Parcours 06 — Alertes`

**Description :**
Créer une page `/app/alerts/` en React mini-SPA listant toutes les alertes actives groupées par type (tâches, garanties, maintenances). Suit le pattern feature page standard du projet.

**Source :** `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`

---

### [FEAT-05] Parcours 06 — Badge de navigation avec compteur d'alertes

**Labels :** `feat` `app:general`
**Milestone :** `Parcours 06 — Alertes`

**Description :**
Ajouter un badge sur l'entrée "Alertes" de la sidebar affichant le nombre d'alertes actives. Alimenté par `/api/alerts/summary/`.

**Source :** `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`

---

### [FEAT-06] OCR automatique à l'upload de document

**Labels :** `feat` `app:documents`
**Milestone :** —

**Description :**
Actuellement, la tâche OCR est commentée dans le flow d'upload (`# TODO: Queue OCR task`). Implémenter la mise en queue automatique du traitement OCR après upload d'un document.

**Source :** `apps/documents/views.py` ligne 242

---

### [FEAT-07] Export vCard — contact unique et export global

**Labels :** `feat` `app:directory`
**Milestone :** —

**Description :**
Phase 1 du RFC vCard : permettre l'export d'un contact individuel et l'export de tous les contacts du household en format vCard (.vcf). Décision architecturale prise : pas de sync CardDAV (conflits multi-membres), house est la source de vérité.

**Source :** `docs/SYNC_CONTACTS_STRUCTURES.md`

---

### [FEAT-08] Import vCard avec preview et détection de doublons

**Labels :** `feat` `app:directory`
**Milestone :** —

**Description :**
Phase 2 du RFC vCard : import de contacts depuis un fichier .vcf. Afficher un aperçu avant import et détecter les doublons potentiels.

**Source :** `docs/SYNC_CONTACTS_STRUCTURES.md`

---

### [FEAT-09] Séparer Documents et Photos

**Labels :** `feat` `app:documents`
**Milestone :** —

**Description :**
Documents et photos sont actuellement gérés ensemble. Les séparer en deux types distincts avec leurs propres vues et logiques de traitement.

**Source :** `docs/TODO.md` ligne 1

---

### [FEAT-10] Assignation de tâche + notifications (Parcours 06 V2)

**Labels :** `feat` `app:tasks` `idea`
**Milestone :** `Idées futures`

**Description :**
Pouvoir assigner une tâche à un membre du household et déclencher une notification. Planifié comme Parcours 06 étendu.

**Source :** `docs/TASK_V2.md`

---

## REFACTORING

### [REFACTOR-01] Revue du champ `occurred_at` sur le modèle Interaction

**Labels :** `refactor` `app:interactions`
**Milestone :** `Backlog technique`

**Description :**
Auditer l'utilisation du champ `occurred_at` sur le modèle Interaction : est-il réellement utilisé partout ? Si non, le passer en nullable ou le supprimer (avec migration). Ce champ crée des bugs sur les tâches car il est requis alors qu'il ne devrait pas l'être pour tous les types d'interaction.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 7

---

### [REFACTOR-02] Créer `HouseholdDetailView` dans `apps/core/views.py`

**Labels :** `refactor` `app:general`
**Milestone :** `Backlog technique`

**Description :**
Créer une classe de base `HouseholdDetailView` dans `apps/core/views.py` pour encapsuler le scoping household et éviter le boilerplate répété dans chaque vue. Référence : `docs/REFACTO_HOUSEHOLD_DETAIL_VIEW.md`.

**Effort :** ~1h

**Source :** `docs/RETOUR_A_TRAITER.md` lignes 1–3 · `docs/ARCHITECTURE_AUDIT_2026_03.md`

---

### [REFACTOR-03] Déplacer `HouseholdScopedModelSerializer` vers `apps/core/`

**Labels :** `refactor` `app:general`
**Milestone :** `Backlog technique`

**Description :**
`HouseholdScopedModelSerializer` est actuellement dans `apps/electricity/serializers.py`. Le déplacer dans `apps/core/serializers.py` et mettre à jour les imports dans toutes les apps qui l'utilisent.

**Effort :** ~30 min

**Source :** `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 61–70

---

### [REFACTOR-04] Uniformiser la structure des tests (tests/ directory)

**Labels :** `refactor` `app:general`
**Milestone :** `Backlog technique`

**Description :**
Standardiser toutes les apps qui ont encore un `tests.py` → `tests/` directory avec `test_models.py`, `test_views.py`, `test_serializers.py`, `factories.py`. Harmonise la structure avec les apps déjà migrées.

**Effort :** 1–2h

**Source :** `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 79–90

---

### [REFACTOR-05] Supprimer l'état `isLoading` redondant sur les pages React

**Labels :** `refactor` `app:general`
**Milestone :** `Backlog technique`

**Description :**
Passer en revue les pages React qui gèrent encore un état `isLoading` manuel alors que `useDelayedLoading` + skeleton est le pattern standard. Nettoyer pour homogénéiser.

**Source :** `docs/RETOUR_A_TRAITER.md` ligne 17

---

### [REFACTOR-06] Activer `autocomplete_fields` dans l'admin Interactions (post-projects app)

**Labels :** `refactor` `app:interactions`
**Milestone :** `Backlog technique`

**Description :**
Dans `apps/interactions/admin.py`, décommenter `autocomplete_fields = ['project']` et le fieldset Relations une fois que l'app projects est stabilisée.

**Source :** `apps/interactions/admin.py` lignes 20 et 34

---

## SÉCURITÉ

### [SEC-01] Migrer les JWT de localStorage vers cookies httpOnly

**Labels :** `security` `refactor`
**Milestone :** `Backlog technique`

**Description :**
Les tokens JWT sont actuellement stockés en `localStorage`, ce qui les expose aux attaques XSS. Les migrer vers des cookies `httpOnly; Secure; SameSite=Strict`. Le contexte d'impersonation devrait aussi passer en session server-side.

**Effort :** Moyen (refactoring significatif côté auth)
**Priorité :** Post-mise en production

**Source :** `docs/SECURITY_REVIEW.md` lignes 25–42

---

### [SEC-02] Implémenter un audit log pour les actions sensibles

**Labels :** `security` `feat`
**Milestone :** `Backlog technique`

**Description :**
Pas de trail d'audit pour les modifications sensibles (changement de mot de passe, suppressions, changements de permissions). Implémenter via middleware ou Django signals.

**Priorité :** Post-mise en production

**Source :** `docs/SECURITY_REVIEW.md` lignes 139–142

---

### [SEC-03] Authentification deux facteurs (2FA/TOTP)

**Labels :** `security` `feat`
**Milestone :** `Idées futures`

**Description :**
Implémenter le TOTP optionnel via `django-otp`. Obligatoire pour les comptes staff/admin. Requis avant les actions d'impersonation.

**Priorité :** Post-mise en production

**Source :** `docs/SECURITY_REVIEW.md` lignes 146–149

---

## IDÉES FUTURES

### [IDEA-01] Capture d'interaction depuis WhatsApp / email / IA

**Labels :** `idea` `feat` `app:interactions`
**Milestone :** `Idées futures`

**Description :**
Permettre la création d'une interaction depuis WhatsApp, email ou chat IA sans passer par le formulaire web. L'IA produit un candidat structuré soumis à validation — elle ne pilote pas le formulaire. RFC à définir (zone obligatoire, confiance, draft vs validation, origine, household et identité).

**Lié à :** Parcours 01

**Source :** `docs/IDEES_FUTURES.md` lignes 15–23

---

### [IDEA-02] Chat IA sur le household

**Labels :** `idea` `feat` `app:general`
**Milestone :** `Idées futures`

**Description :**
Permettre à l'utilisateur de poser des questions en langage naturel sur l'ensemble de son household ("quand a-t-on changé la chaudière ?", "quels équipements sont sous garantie ?"). RFC à préciser.

**Source :** `docs/IDEES_FUTURES.md` lignes 25–31

---

### [IDEA-03] Compte démo en lecture seule / non-persistant

**Labels :** `idea` `feat` `app:general`
**Milestone :** `Idées futures`

**Description :**
Créer un compte démo avec données fictives en mode lecture seule ou avec reset automatique, pour encourager les créations de compte et l'employer branding.

**Source :** `docs/IDEES_FUTURES.md` ligne 33

---

## DOCUMENTATION

### [DOCS-01] Documenter les patterns avancés React

**Labels :** `docs`
**Milestone :** `Backlog technique`

**Description :**
Documenter les patterns qui existent dans le code mais ne sont pas documentés dans CLAUDE.md :
- `useSessionState` — persistance d'état via `window.history.state`
- `useDeleteWithUndo` — suppression optimiste avec toast undo
- Query key factory patterns (`zoneKeys`, `electricityKeys`, etc.)

**Effort :** ~30 min

**Source :** `docs/ARCHITECTURE_AUDIT_2026_03.md` lignes 92–98
