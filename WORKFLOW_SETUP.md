# Mise en place du workflow — étapes concrètes

Ce document est la checklist d'implémentation one-shot.

**Repo GitHub :** `jammindev/house` (vérifier avec `gh repo view`)
**Outil CLI :** utiliser `gh` (GitHub CLI) pour toutes les étapes automatisables.

---

## Ce qui est automatisable via `gh` CLI / commandes

- Étape 1 : Labels
- Étape 2 : Milestones
- Étape 3 : Issues (depuis `GITHUB_ISSUES_BACKLOG.md`)
- Étape A : Branche `develop` + protection des branches
- Étape B : `docker-compose.staging.yml` + `.env.staging` sur le Mac Mini
- Étape C : Mise à jour du CI/CD (`.github/workflows/ci.yml`)

## Ce qui nécessite l'UI GitHub (non automatisable via CLI)

- Étape 4 : Création du Project Kanban et de ses colonnes
- Étape 5 : Configuration des automations du Project

---

## Étape 1 — Créer les labels

Commandes `gh` à exécuter :

```bash
# Labels de type
gh label create "bug"      --color "d73a4a" --description "Quelque chose qui casse ou se comporte mal"
gh label create "feat"     --color "0075ca" --description "Nouvelle fonctionnalité"
gh label create "style"    --color "e4e669" --description "UI/UX, design system, cosmétique"
gh label create "refactor" --color "cfd3d7" --description "Code fonctionnel à revoir"
gh label create "security" --color "b60205" --description "Audit sécu, vulnérabilités, hardening"
gh label create "idea"     --color "d4c5f9" --description "Pas encore arbitré, juste capturé"
gh label create "docs"     --color "0052cc" --description "Documentation technique ou produit"

# Labels d'app
gh label create "app:tasks"        --color "f9d0c4" --description ""
gh label create "app:zones"        --color "f9d0c4" --description ""
gh label create "app:electricity"  --color "f9d0c4" --description ""
gh label create "app:directory"    --color "f9d0c4" --description ""
gh label create "app:equipment"    --color "f9d0c4" --description ""
gh label create "app:documents"    --color "f9d0c4" --description ""
gh label create "app:stock"        --color "f9d0c4" --description ""
gh label create "app:projects"     --color "f9d0c4" --description ""
gh label create "app:interactions" --color "f9d0c4" --description ""
gh label create "app:general"      --color "f9d0c4" --description ""
```

Note : certains labels par défaut GitHub (`bug`, `documentation`, etc.) existent peut-être déjà. Utiliser `--force` si besoin pour écraser, ou vérifier d'abord avec `gh label list`.

---

## Étape 2 — Créer les Milestones

```bash
gh api repos/jammindev/house/milestones \
  --method POST \
  --field title="Parcours 06 — Alertes" \
  --field description="Alertes proactives, rappels, badges navigation"

gh api repos/jammindev/house/milestones \
  --method POST \
  --field title="Backlog technique" \
  --field description="Refactos, audits, dettes techniques sans urgence produit"

gh api repos/jammindev/house/milestones \
  --method POST \
  --field title="Idées futures" \
  --field description="Features à long terme, non planifiées"
```

---

## Étape 3 — Créer les issues

Toutes les issues sont dans `GITHUB_ISSUES_BACKLOG.md`. Pour chaque issue, utiliser :

```bash
gh issue create \
  --title "TITRE" \
  --body "CORPS" \
  --label "label1,label2" \
  --milestone "NOM_MILESTONE"
```

Pour les issues sans milestone, omettre `--milestone`.

Récupérer le numéro de milestone avec `gh api repos/jammindev/house/milestones` si besoin.

**Ordre recommandé :** Bugs en premier (plus urgents), puis Features, Refactors, Sécurité, Idées.

---

## Étape 4 — Créer le Project Kanban (UI GitHub — manuel)

**Non automatisable proprement via CLI.**

Instructions :
1. Aller sur `github.com/jammindev/house` → onglet **Projects** → **New project**
2. Choisir **Board**
3. Nommer : `house`
4. Créer 4 colonnes : `Inbox`, `Todo`, `In Progress`, `Done`

---

## Étape 5 — Configurer les automations du Project (UI GitHub — manuel)

Dans le Project créé → **...** → **Settings** → **Workflows** :

- Activer : `Item added to project` → Status = **Inbox**
- Activer : `Issue closed` → Status = **Done**
- Activer : `Pull request merged` → Status = **Done**

---

## Étape 6 — Nettoyer les fichiers de notes devenus obsolètes

Une fois les issues créées et vérifiées sur GitHub :

```bash
git rm A_AMELIORER_STYLE.md
git rm docs/TODO.md
git rm docs/RETOUR_A_TRAITER.md
git commit -m "chore: migrate scattered notes to GitHub Issues"
```

**Ne pas supprimer :**
- `docs/IDEES_FUTURES.md` — contexte plus riche que les issues
- `docs/JOURNAL_PRODUIT.md` — historique produit
- `docs/ARCHITECTURE_AUDIT_2026_03.md` — référence architecture
- `docs/SECURITY_REVIEW.md` — référence sécurité
- `docs/SYNC_CONTACTS_STRUCTURES.md` — RFC vCard
- `docs/parcours/*.md` — backlogs techniques de référence

---

## Étape 7 — Protéger les branches (UI GitHub — manuel)

**Settings → Branches → Add rule** sur `main` :
- ✅ Require a pull request before merging
- ❌ Require approvals (inutile solo)

Répéter pour `develop` (même règle).

---

## Étape 8 — Tester le Claude GitHub app

1. Ouvrir une issue de test
2. Commenter : `@claude Confirme que tu as accès au repo`
3. Si réponse reçue → OK
4. Fermer l'issue de test

---

## Étape A — Créer la branche `develop`

```bash
git checkout -b develop
git push -u origin develop
```

Sur GitHub, aller dans **Settings → General → Default branch** et laisser `main` comme branche par défaut (les PRs Claude cibleront `develop` explicitement).

---

## Étape B — Staging sur le Mac Mini

### B1 — Créer `docker-compose.staging.yml` dans le repo

Le fichier `docker-compose.staging.yml` est déjà créé dans le repo (voir ci-dessous). Il définit un stack identique à la prod mais :
- Nom de projet Docker : `house-staging`
- Volumes séparés : `postgres-data-staging`, `media-files-staging`
- Traefik route sur `staging.house.jammin-dev.com`
- Lit `.env.staging` au lieu de `.env`

### B2 — Sur le Mac Mini : cloner le repo dans un second répertoire

```bash
# Sur le Mac Mini (SSH ou terminal local)
cd ~/jammin-dev/apps
git clone git@github.com:jammindev/house.git house-staging
cd house-staging
git checkout develop
```

### B3 — Créer `.env.staging` sur le Mac Mini

```bash
# Dans ~/jammin-dev/apps/house-staging/
cp .env.production.example .env.staging
```

Éditer `.env.staging` avec ces valeurs spécifiques au staging :
```env
DJANGO_SETTINGS_MODULE=config.settings.production
SECRET_KEY=<nouvelle clé différente de la prod>
DEBUG=False
ALLOWED_HOSTS=staging.house.jammin-dev.com
CSRF_TRUSTED_ORIGINS=https://staging.house.jammin-dev.com
CORS_ALLOWED_ORIGINS=https://staging.house.jammin-dev.com

DATABASE_URL=postgres://house_user:POSTGRES_STAGING_PASSWORD@db:5432/house_staging
POSTGRES_DB=house_staging
POSTGRES_PASSWORD=<mot de passe différent de la prod>

SECURE_SSL_REDIRECT=True
USE_X_FORWARDED_PROTO=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

DOMAIN=staging.house.jammin-dev.com
```

### B4 — Premier démarrage du staging

```bash
cd ~/jammin-dev/apps/house-staging
COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml build
COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml up -d
COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml exec -T web python manage.py migrate
```

### B5 — DNS : ajouter le sous-domaine staging

Chez ton registrar / DNS provider, ajouter un enregistrement A :
```
staging.house.jammin-dev.com  →  <IP publique du Mac Mini>
```
(Même IP que `house.jammin-dev.com`. Traefik gère le routage par hostname.)

---

## Étape C — Mettre à jour le CI/CD

Modifier `.github/workflows/ci.yml` pour ajouter le déploiement staging sur push `develop`.

Ajouter après le job `deploy` existant :

```yaml
  deploy-staging:
    name: Deploy to Staging
    needs: [backend, frontend]
    runs-on: self-hosted
    if: github.ref == 'refs/heads/develop' && github.event_name == 'push'
    steps:
      - name: Deploy to staging
        run: |
          cd ~/jammin-dev/apps/house-staging
          git fetch origin develop
          git reset --hard origin/develop
          COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml build
          COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml up -d
          COMPOSE_PROJECT_NAME=house-staging docker compose -f docker-compose.staging.yml exec -T web python manage.py migrate
```

Et modifier le job `deploy` existant pour qu'il ne tourne que sur `main` :
```yaml
  deploy:
    ...
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

---

## Récapitulatif

| Étape | Méthode | Durée |
|---|---|---|
| Labels | `gh` CLI | ~2 min |
| Milestones | `gh` CLI | ~1 min |
| Issues | `gh` CLI | ~10 min |
| Project + colonnes | UI GitHub | ~5 min |
| Automations Project | UI GitHub | ~2 min |
| Nettoyage fichiers | `git rm` | ~1 min |
| Protection `main` + `develop` | UI GitHub | ~3 min |
| Test Claude app | UI GitHub | ~2 min |
| Branche `develop` | `git` CLI | ~1 min |
| Staging Mac Mini (clone + env) | Terminal Mac Mini | ~10 min |
| DNS staging | Registrar | ~2 min + propagation |
| CI/CD update | Éditeur | ~5 min |
| **Total** | | **~45 min** |
