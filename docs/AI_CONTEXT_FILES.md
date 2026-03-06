# AI Context — Fichiers à lire en priorité

## Démarrage rapide (ordre recommandé)

1. `README.md`
2. `HYBRID_ARCHITECTURE.md`
3. `config/urls.py`
4. `config/settings/base.py`
5. App concernée:
   - `*/models.py`
   - `*/serializers.py`
   - `*/views.py`
   - `*/urls.py`

## Archive historique (référence métier)

1. `legacy/AGENTS.md` (source la plus complète sur la vision historique)
2. `legacy/README.md` (inventaire des fonctionnalités)
3. `legacy/STRUCTURE.md` (organisation feature-first de l'archive)
4. `legacy/RESUME-PROJECT.md` (modèle métier centré sur l'interaction)

## Fichiers transverses

- `core/models.py`
- `core/managers.py`
- `core/permissions.py`
- `templates/base.html`
- `ui/vite.config.ts`
- `ui/src/web-components/createWebComponent.tsx`

## Système CSS / styles

Documenté dans `HYBRID_ARCHITECTURE.md` → section **Système de styles**.

Fichiers clés :
- `ui/src/styles.css` — entrée Vite, `@theme inline` (Tailwind v4)
- `ui/src/styles/tokens.css` — variables CSS `:root`
- `ui/src/styles/themes.css` — 17 thèmes `.theme-*`
- `ui/src/styles/components.css` — classes utilitaires composant
- `ui/src/styles/tinymce.css` — overrides TinyMCE

Règle rapide : pour toucher aux styles, lire d'abord la section **Système de styles** de `HYBRID_ARCHITECTURE.md`.

## Test et validation

- `pytest.ini`
- `apps/accounts/tests/` (exemples existants)

## Règle de scope

- Implémenter dans le code actif Django/React.
- Utiliser `legacy/` pour récupérer le contexte fonctionnel historique si besoin.
