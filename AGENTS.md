# AGENTS.md — Contexte projet (racine active)

Ce document donne le contexte rapide pour toute IA intervenant sur ce repo.

## 1) Scope

- **Code actif principal**: racine Django + `frontend/`
- **Contexte produit/migration**: `legacy/` (source documentaire)
- **Règle**: on implémente dans le code actif; on consulte `legacy/` pour comprendre l’intention fonctionnelle

## 1.1) Statut du projet (important)

Le projet est en **migration progressive de Next.js/Supabase vers Django/DRF + templates + React ciblé**.

Conséquence pour l’IA:

- Les docs `legacy/` décrivent souvent des features plus avancées que le code Django actuel.
- Elles servent de **référence métier**, pas de vérité technique d’implémentation.
- En cas d’écart: la vérité runtime est dans `config/`, les apps Django, `templates/`, `frontend/`.

## 2) Stack

- Backend: Django 5, DRF, auth session Django, django-filter
- DB: PostgreSQL (local/prod), SQLite in-memory (tests)
- Frontend: React 19, TypeScript, Vite
- Intégration Django/React: `django-vite`

## 3) Apps Django

- `accounts`: utilisateur custom + auth session Django
- `households`: entité multi-tenant de base
- `zones`: hiérarchie spatiale
- `interactions`: journal (note, todo, expense, maintenance...)
- `documents`: fichiers/ocr/métadonnées
- `contacts`: contacts + addresses/emails/phones
- `structures`: structures/prestataires/organisations
- `tags`: tags + liens interaction-tags
- `todo_list`: table legacy template `todo_list`
- `core`: modèles abstraits, managers, permissions

## 3.1) Correspondance migration (legacy -> actif)

- `legacy` interactions/timeline -> `interactions` Django
- `legacy` zones hiérarchiques -> `zones` Django
- `legacy` documents/files -> `documents` Django
- `legacy` households/multi-tenant -> `households` + permissions `core`
- `legacy` auth Supabase -> `accounts` (session Django)

Encore principalement côté `legacy` (pas porté complètement côté Django):

- modules `projects`, `contacts`, `structures`, `equipment`
- pipeline IA avancé (threads/messages projet), OCR/ingestion complet
- certaines pages shell/layout feature-first Next.js

## 4) Conventions techniques importantes

- Modèle user custom: `AUTH_USER_MODEL = "accounts.User"`
- Les modèles métier utilisent souvent `HouseholdScopedModel`
- Permissions multi-tenant via `IsHouseholdMember`
- Résolution household API: `X-Household-Id` -> `household_id` (query/body) -> auto-select si membership unique
- Routes API principales dans `config/urls.py`
- Pages SSR dans `templates/`

## 5) Endpoints clés

- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET|POST /api/users/`
- `GET|POST|... /api/households/`
- `GET|POST|... /api/zones/`
- `GET|POST|... /api/documents/documents/`
- `GET|POST|... /api/interactions/interactions/`
- `GET|POST|... /api/contacts/contacts/`
- `GET|POST|... /api/contacts/addresses/`
- `GET|POST|... /api/contacts/emails/`
- `GET|POST|... /api/contacts/phones/`
- `GET|POST|... /api/structures/`
- `GET|POST|... /api/tags/tags/`
- `GET|POST|... /api/tags/interaction-tags/`
- `GET|POST|... /api/interactions/interaction-contacts/`
- `GET|POST|... /api/interactions/interaction-structures/`
- `GET|POST|... /api/todo/`

### Permissions (legacy RLS -> Django)

- `zones`, `interactions`, `documents`: accès membre household (lecture/écriture)
- `households`:
	- membre: `retrieve`, `members`, `leave`
	- owner: `update`, `delete`, `invite`, `remove_member`, `update_role`

## 6) Frontend hybride

- `frontend/src/web-components/*`: composants React exposés en Web Components
- `templates/test_components.html`: exemple réel d’usage `<ui-button>`
- `frontend/src/lib/mount.tsx`: utilitaire de montage React ciblé

## 7) Démarrage local

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
python manage.py migrate
python manage.py runserver 8000
```

```bash
npm install
npm run dev
```

## 8) Tests

```bash
pytest
```

## 9) Règles IA recommandées

- Lire d’abord `config/urls.py`, les `views.py` et `serializers.py` concernés
- Éviter les refactors larges sans demande explicite
- Préserver le pattern Django-first + React ciblé
- Utiliser `legacy/` comme documentation fonctionnelle de migration, pas comme base de code à copier

## 10) Docs legacy à consulter quand on manque de contexte

- `legacy/AGENTS.md`: contexte produit complet historique (haute valeur)
- `legacy/README.md`: vision produit/features globales
- `legacy/STRUCTURE.md`: organisation feature-first Next.js
- `legacy/AI_UPDATE_WORKFLOW.md`: checklist de modification utile
- `legacy/RESUME-PROJECT.md`: intention métier centrée sur le modèle interaction
