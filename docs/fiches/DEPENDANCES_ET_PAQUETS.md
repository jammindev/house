# Dépendances et paquets — ce qu'on exécute sans l'avoir écrit

> Fiche amont de [DISTRIBUTION_ET_REGISTRE.md](DISTRIBUTION_ET_REGISTRE.md), qui
> traite de *publier* sa propre image. Celle-ci traite de *consommer* le code des
> autres : bibliothèque, paquet, registre, gestionnaire, verrou — et de ce que ces
> cinq mots recouvrent réellement dans ce dépôt.

## 1. Le problème

Personne n'écrit tout. Maisonnée s'appuie sur Django pour le web, React pour
l'interface, psycopg pour parler à Postgres, pgvector pour la recherche
sémantique. Aucun n'est de l'auteur.

D'où la question fondatrice, dont tout le vocabulaire qui suit découle :

> Comment récupérer le code de quelqu'un d'autre, dans la bonne version, sans que
> ça casse — et comment obtenir **exactement la même chose** demain, sur une autre
> machine, dans deux ans ?

La dernière partie est la difficile. « Ça marche chez moi » est un constat, pas
une propriété.

## 2. Le concept en deux phrases

Une **bibliothèque** est du code fait pour être appelé ; un **paquet** est cette
bibliothèque plus ses papiers (nom, version, ce dont *elle* dépend) sous un format
d'archive convenu — c'est l'unité qu'on publie, jamais « du code » tout court.

Un **registre** garde les paquets par nom et par version, un **gestionnaire** lit
ce que tu as déclaré et descend récursivement l'arbre des dépendances, et un
**verrou** note ce que cette descente a donné — parce qu'une résolution rejouée
six mois plus tard ne donne pas forcément le même résultat.

## 3. Comment ça se présente dans Maisonnée

### 3.1 Trois gestionnaires, et c'est la situation normale

| | Déclaré dans | Gestionnaire | Registre | Exemples |
|---|---|---|---|---|
| Python | `requirements/*.txt` | `pip` | PyPI | Django, DRF, psycopg |
| JavaScript | `package.json` | `npm` | npmjs.com | React, Vite, TanStack Query |
| Conteneurs | `docker-compose*.yml` | `docker` | `ghcr.io`, Docker Hub | l'image Maisonnée, `pgvector/pgvector:pg16` |

Trois écosystèmes, trois formats, trois registres, et aucun ne connaît les autres.
Tout projet qui mêle plusieurs langages est dans cet état.

### 3.2 Le chiffre qui justifie l'existence des verrous

Mesuré sur ce dépôt :

```
JavaScript    45 paquets déclarés dans package.json
              591 entrées verrouillées dans package-lock.json
```

On demande 45 choses, on en obtient plus de dix fois plus. Les autres sont les
dépendances des dépendances, et ainsi de suite. **C'est ça, la résolution** — et
c'est pourquoi `package-lock.json` existe : il fige chaque maillon avec son
empreinte, pour que la prochaine installation soit identique à la lettre.

### 3.3 L'asymétrie assumée entre Python et JavaScript

`requirements/base.txt` épingle ses 34 lignes **exactement** (`Django==5.2.11`,
jamais `>=`), et il descend même d'un cran en épinglant des transitives connues
(`asgiref`, `sqlparse`). Mais la fermeture n'est pas complète : `certifi`, `idna`,
`urllib3` arrivent par `requests` et consorts, et sont résolues librement à
l'installation.

**Conséquence à connaître : côté Python, deux installations à six mois d'écart
peuvent différer.** Côté JavaScript, non.

Ce qui rattrape en pratique : **l'image Docker est le verrou effectif.** Une fois
construite, elle contient un jeu figé, et c'est *elle* qu'on distribue et qu'on
déploie — pas un `pip install`. Le flottement existe donc entre deux **builds**,
jamais entre deux **démarrages**. Voir
[DISTRIBUTION_ET_REGISTRE.md](DISTRIBUTION_ET_REGISTRE.md) § 3.3.

### 3.4 Deux natures de paquet : l'ingrédient et le plat

C'est la distinction qui manque le plus souvent, et sans elle « paquet » désigne
deux choses très différentes.

| | Paquet de bibliothèque | Image de conteneur |
|---|---|---|
| Contient | du code à appeler | un système entier : OS, runtime, dépendances, code |
| S'exécute seul | non | **oui** |
| Client | un développeur qui **construit** | un opérateur qui **fait tourner** |
| Registre | PyPI, npmjs.com | `ghcr.io`, Docker Hub |
| Analogie | un ingrédient | le plat fini |

Django ne sert à rien sans cuisinier. `ghcr.io/jammindev/maisonnee` contient déjà
Debian, Python 3.12, les dépendances installées, le bundle React compilé et le
code — assemblés. C'est exactement pourquoi un inconnu tape trois lignes au lieu
de passer un après-midi : **il ne cuisine pas, il réchauffe.**

### 3.5 Où GitHub Packages se range

GitHub Packages n'est pas un écosystème de plus : c'est GitHub qui héberge des
registres **aux formats existants**, sous le même compte que le dépôt.

```
GitHub Packages
├── npm.pkg.github.com       format npm
├── maven.pkg.github.com     format Maven
├── nuget.pkg.github.com     format NuGet
├── rubygems.pkg.github.com  format RubyGems
└── ghcr.io                  format conteneur (OCI)   ← le seul utilisé ici
```

Le format n'appartient pas à GitHub : `ghcr.io` parle **OCI**, comme Docker Hub,
et l'image marcherait à l'identique publiée ailleurs. Ce que GitHub apporte est le
**rattachement** — même compte, `GITHUB_TOKEN` du workflow, permissions au même
endroit — au prix des trois étages de réglages décrits dans l'autre fiche.

### 3.6 La chaîne d'approvisionnement : on exécute du code d'inconnus

La contrepartie de tout ce qui précède : ce dépôt fait tourner le code de
plusieurs centaines de personnes qu'il n'a jamais rencontrées. Un mainteneur
piraté publie une version malveillante, et elle arrive à la prochaine
installation.

Trois défenses, toutes en place :

- **Le verrou** fige l'empreinte : republier du code différent sous le même numéro
  ne passe pas.
- **`sha_pinning_required`** sur les GitHub Actions : une action s'épingle par
  **empreinte de commit**, jamais par tag. *Un tag est un nom, une empreinte est
  une identité* — un nom se redirige, une identité non.
- **`allowed_actions: selected`** (lot 0 du parcours 28) : six actions autorisées,
  point. C'est cette liste qui a bloqué `release-please` en août 2026 — et c'est la
  même qui bloquerait une action hostile.

## 4. Pourquoi cette implémentation — décisions et trade-offs

**Trois niveaux de `requirements`, chaînés.** `base.txt` (prod) → `test.txt`
(`-r base.txt` + pytest, coverage, factories) → `dev.txt` (`-r test.txt` +
ipython). L'image de production n'installe que `base.txt` : elle n'embarque ni
pytest ni ipython. Le coût est une discipline — un paquet mal rangé dans `base`
grossit l'image de tout le monde.

**Épinglage exact côté Python, `^` côté JavaScript.** L'asymétrie n'est pas une
négligence : elle suit ce que chaque écosystème rend praticable. `pip` sans
lockfile impose d'épingler à la main pour être reproductible ; `npm` a un verrou,
donc `^` dans `package.json` dit ce qu'on **accepte** pendant que le lock dit ce
qu'on **a**. Les deux sont nécessaires : sans le `^` on ne peut plus mettre à
jour, sans le lock on ne sait plus ce qu'on exécute.

**`package-lock.json` est versionné, `venv/` et `node_modules/` ne le sont pas.**
On versionne la *recette exacte*, jamais le *résultat* : `node_modules` pèse des
centaines de mégaoctets et dépend de la plateforme. Les deux sont aussi exclus du
contexte de build (`.dockerignore`) — sans ça, un venv macOS partait dans une
image Linux.

**Les images tierces sont épinglées au mineur, pas au correctif.**
`pgvector/pgvector:pg16` suit les correctifs de Postgres 16 sans jamais basculer en
17 — un changement de majeur de base de données n'est pas une mise à jour, c'est
une migration.

## 5. Ce qu'on a écarté et pourquoi

- **`pip-tools` / `uv.lock` / Poetry pour verrouiller Python.** Ce serait la
  correction propre de l'asymétrie du § 3.3. Écarté pour l'instant parce que
  l'image joue déjà ce rôle là où ça compte — en production. À reprendre le jour
  où un build échoue à cause d'une transitive qui a bougé : ce jour-là, la dette
  aura nommé son intérêt.
- **Renovate / Dependabot en automatique.** Utile sur un projet à plusieurs ; sur
  un projet solo, un flux de PR de mise à jour qu'on ne lit pas est pire que rien —
  il apprend à fusionner sans regarder, ce qui est exactement le geste qu'une
  attaque de chaîne d'approvisionnement espère.
- **Publier des morceaux de Maisonnée sur PyPI ou npm.** Aucun n'est réutilisable
  hors du produit, et publier un paquet crée une promesse de compatibilité envers
  des gens qu'on ne connaît pas.
- **Un miroir de registre interne.** Il protège d'un paquet supprimé en amont, et
  ajoute un serveur à maintenir pour un risque qui, à cette échelle, se traite en
  reconstruisant une image.

## 6. Pour aller plus loin

- [Semantic Versioning](https://semver.org/lang/fr/) — les onze règles derrière
  `MAJEUR.MINEUR.CORRECTIF`, et ce que `^` accepte vraiment.
- [pip — Requirements files](https://pip.pypa.io/en/stable/reference/requirements-file-format/)
  et [npm — package-lock.json](https://docs.npmjs.com/cli/configuring-npm/package-lock-json).
- [OpenSSF — Supply chain best practices](https://openssf.org/) — l'épinglage par
  empreinte et les listes blanches, sous leur nom savant.
- [`event-stream` (2018)](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident)
  — le cas d'école : un mainteneur cède son paquet, la version suivante vole des
  portefeuilles. Deux millions de téléchargements par semaine, et personne n'avait
  lu le diff.

---

Fiche aval : [DISTRIBUTION_ET_REGISTRE.md](DISTRIBUTION_ET_REGISTRE.md) — publier
sa propre image, l'index multi-architecture, et les trois étages de permissions de
GitHub Packages.
