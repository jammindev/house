# AI Context — Stack active (Django + React)

Ce fichier sert de mémo rapide pour les requêtes IA sur la stack active.

Voir aussi:
- `docs/README.md`
- `docs/PRODUCT_OVERVIEW.md`
- `docs/DOMAIN_MODEL_INTERACTIONS.md`
- `docs/FEATURE_STATUS_AND_RFCS.md`

## 1) Situation actuelle

- Stack: Django + DRF + templates + React ciblé (Vite, `django-vite`)
- DB: PostgreSQL (prod), SQLite in-memory (tests)
- Auth: session Django (cookies + CSRF)
- Source de vérité technique: racine du repo (`config/`, `apps/`, `templates/`, `ui/`)
- Phase actuelle (mars 2026): construction/complétion UI de toutes les apps actives

## 2) Principe de travail

1. Lire le code actif d'abord.
2. Consulter `legacy/` uniquement pour comprendre le besoin métier historique.
3. En cas de divergence entre docs legacy et code actif, le code actif est la source de vérité.

## 3) État d'avancement

- Modèles et APIs: en place pour toutes les apps actives
- Priorité actuelle: UI Django/React par app (pages `/app/*`, composants et parcours utilisateur)
- Les workflows IA/OCR avancés restent des chantiers produit séparés

## 4) Anti-erreurs fréquentes

- Ne pas supposer qu'une feature présente dans `legacy/` est implémentée côté Django.
- Ne pas documenter comme "implémenté" un module uniquement présent dans `legacy/`.
- Vérifier les endpoints réels dans `config/urls.py` et les `urls.py` d'app.
- Ne pas utiliser les patterns de routing/data-loading de l'archive `legacy/` comme référence runtime.

## 5) Checklist avant réponse IA

- Feature demandée existe-t-elle dans le code actif?
- Sinon: est-elle seulement documentée dans `legacy/`?
- La réponse doit-elle prioriser l'implémentation UI/UX dans les apps actives?
