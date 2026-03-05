# AI Context — Migration Next.js/Supabase -> Django/DRF

Ce fichier sert de mémo rapide pour les requêtes IA après finalisation de la migration de données.

Voir aussi:
- `docs/README.md`
- `docs/PRODUCT_OVERVIEW.md`
- `docs/DOMAIN_MODEL_INTERACTIONS.md`
- `docs/FEATURE_STATUS_AND_RFCS.md`

## 1) Situation actuelle

- Historique: app Next.js + Supabase (dans `legacy/`)
- Cible active: Django + DRF + templates + React ciblé
- Réalité technique actuelle: racine du repo (`config/`, `apps/`, `templates/`, `ui/`)
- Statut mars 2026: migration de données finalisée sur le périmètre actif, priorité à la construction UI de toutes les apps

## 2) Principe de travail

1. Lire le code actif d’abord.
2. Utiliser `legacy/` uniquement pour comprendre le besoin métier.
3. En cas de divergence entre docs legacy et code actif, le code actif est la source de vérité.

## 3) Mapping de migration (fonctionnel)

- Auth Supabase -> `accounts` (session Django)
- Households/RLS -> `households` + permissions `core`
- Interactions timeline -> `interactions`
- Zones hiérarchiques -> `zones`
- Documents/attachments -> `documents`

Etat actuel permissions migration:
- logique legacy RLS reproduite côté DRF (membership household)
- actions household sensibles réservées aux owners (`invite`, `remove_member`, `update_role`, update/delete household)

## 4) État d'avancement

- Données métier du périmètre actif: migrées vers le schéma Django
- Priorité actuelle: UI Django/React par app (pages `/app/*`, composants et parcours utilisateur)
- Les workflows IA/OCR avancés restent des chantiers produit séparés, sans bloquer la phase UI

## 5) Docs legacy prioritaires

- `legacy/AGENTS.md`
- `legacy/README.md`
- `legacy/STRUCTURE.md`
- `legacy/RESUME-PROJECT.md`
- `legacy/AI_UPDATE_WORKFLOW.md`

## 6) Anti-erreurs fréquentes

- Ne pas copier-coller du code Next.js legacy dans Django.
- Ne pas documenter comme "implémenté" un module uniquement présent dans legacy.
- Vérifier les endpoints réels dans `config/urls.py` et les `urls.py` d’app.

## 7) Checklist avant réponse IA

- Feature demandée existe-t-elle dans le code actif?
- Sinon: est-elle seulement documentée dans `legacy/`?
- La réponse doit-elle prioriser l'implémentation UI/UX dans les apps actives?
