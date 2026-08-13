# Distribution par registre — l'artefact vit hors du dépôt

> Fiche écrite le 2026-08-13, en publiant la première image publique de Maisonnée
> (parcours 28, lots 5 et 7). Instance dans le dépôt :
> [`.github/workflows/release.yml`](../../.github/workflows/release.yml),
> [`docs/self-hosting/releases.md`](../self-hosting/releases.md).

## 1. Le problème

Jusqu'ici, « livrer » voulait dire une seule chose : pousser sur `main`, et le VPS
de l'auteur reconstruit son image chez lui. Le code et l'exécutable sont au même
endroit, l'un produit l'autre, et personne d'autre ne regarde.

Distribuer, c'est autre chose. Le README ouvre sur trois lignes dont la deuxième
est `docker compose up`, et cette ligne **ne dépend d'aucun fichier du dépôt** :
elle dépend d'un artefact hébergé ailleurs, dans un **registre**, sous un modèle
de permissions qui n'a rien à voir avec celui du dépôt.

C'est le seul énoncé de tout le projet qu'aucun test ne peut tenir. `pytest` lit
le `docker-compose.yml` ; il ne sait pas si l'image que ce fichier désigne est
tirable par quelqu'un qui n'a pas de compte. Et personne n'installe un produit
en compilant un bundle React sur un Raspberry Pi : sans image publiée, la
promesse d'installation n'existe pas.

## 2. Le concept en deux phrases

Un **registre** (`ghcr.io`, Docker Hub, ECR…) n'est pas un serveur de fichiers :
il stocke des **couches** adressées par leur empreinte, et des **manifestes** qui
les assemblent — un tag n'est qu'un *nom qui pointe* sur un manifeste, et il peut
être redirigé, alors que l'empreinte, elle, désigne pour toujours le même octet.

Une image **multi-architecture** n'est pas une image : c'est un **index** — un
manifeste de manifestes, un par plateforme — et c'est le client qui choisit sa
variante au moment du `pull`, ce qui fait qu'un seul tag sert un Mac ARM, un NAS
et un serveur x86 sans que personne ait à le savoir.

## 3. Comment on l'applique dans Maisonnée

### 3.1 Un tag git déclenche, un push sur `main` non

`release.yml` se déclenche sur `v*`, jamais sur `main`. Une image que quelqu'un
installe est une **release** : une chose datée, nommable, sur laquelle on peut
revenir et dont on peut dire ce qu'elle contient. Republier `latest` à chaque
commit viderait « j'ai la dernière version » de son sens, et ferait d'un
`docker compose pull` un pari.

Conséquence directe : le déploiement de l'auteur ne passe **pas** par ce
workflow. Il construit toujours son image chez lui depuis `docker-compose.prod.yml`.
Ce sont deux chaînes distinctes, et les confondre ferait dépendre la prod de la
disponibilité d'un registre tiers.

### 3.2 Deux architectures, une émulation, un index

Le Raspberry Pi et le NAS sont **la moitié du public** de l'auto-hébergement. Une
image `amd64` seule leur répond `exec format error` — un message qui n'apprend
rien à personne.

On construit donc `linux/amd64` **et** `linux/arm64` sur un runner GitHub, qui est
x86 : `setup-qemu-action` installe l'émulation, `setup-buildx-action` le
constructeur qui sait produire un index. Le résultat est un seul tag,
`ghcr.io/jammindev/maisonnee:latest`, derrière lequel il y a deux manifestes.

```bash
# ce que le registre renvoie vraiment derrière un tag
curl -sH "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.oci.image.index.v1+json" \
     https://ghcr.io/v2/jammindev/maisonnee/manifests/latest | jq '.manifests[].platform'
```

**Construire arm64 ne prouve rien du démarrage.** Une roue Python native
compilée pour la mauvaise architecture ne se voit qu'à l'import. D'où le
smoke test du workflow, qui démarre l'image **avec `--platform` explicite, pour
les deux valeurs** : sans lui, `docker run` prend la variante du runner et
l'arm64 partirait sans que personne ne l'ait jamais lancée.

### 3.3 Les tags disent une intention, l'empreinte dit l'identité

Un tag est un pointeur **mutable**. `latest` bouge à chaque release, `0.1` bouge à
chaque correctif du même mineur, `0.1.0` ne bouge plus. C'est pour ça que
`docs/self-hosting/releases.md` explique lequel choisir : `0.1` est celui qu'on
veut sur une machine à laquelle on ne veut pas penser — les correctifs arrivent,
jamais les changements de fonctionnalité.

`metadata-action` produit ces trois-là, et `latest` **seulement si le tag n'est
pas une préversion** (`enable=${{ !contains(..., '-') }}`) : une `v0.2.0-rc1` ne
doit pas devenir la version par défaut de tout le monde.

### 3.4 La visibilité du paquet est un réglage à part — et il y en a deux

C'est le piège de cette fiche, et il coûte cher parce qu'il ne ressemble pas à un
piège.

1. **Un paquet `ghcr.io` fraîchement créé est privé**, même poussé par le workflow
   d'un dépôt **public**. Le dépôt et le paquet sont deux objets distincts, avec
   deux réglages de visibilité, et rien dans l'interface ne relie l'un à l'autre.
2. **Une organisation peut interdire les paquets publics.** Le bouton « Public »
   est alors grisé sur la page du paquet, sous un message qui ne nomme ni le
   réglage, ni la page, ni le fait qu'on en est soi-même l'administrateur :
   *« Setting is disabled by organization administrators »*. Le levier est un cran
   au-dessus — `Organisation → Settings → Packages → Package creation`.

Tant que l'une des deux est fermée, un inconnu qui suit le README à la lettre
reçoit `denied`. Ça ne ressemble pas à une permission manquante : ça ressemble à
un projet cassé, et c'est le tout premier geste qu'on lui demande.

Le workflow, lui, n'a jamais besoin de plus que `packages: write` sur le
`GITHUB_TOKEN` — écrire dans le registre et rendre lisible par tous sont deux
droits différents.

### 3.5 Donc : une promesse qui vit hors du dépôt se vérifie de dehors

Pas en relisant le workflow. Pas en regardant la coche verte de la release. En se
mettant **dans la position du lecteur** — sans compte :

```bash
docker logout ghcr.io && docker pull ghcr.io/jammindev/maisonnee:latest
```

Et la porte ouverte ne suffit pas, il faut vérifier ce qu'il y a derrière : le
README promet un Raspberry Pi, donc l'index doit annoncer `arm64` **et** `amd64` ;
il fait `curl` sur un `docker-compose.yml` brut, donc cette URL aussi doit
répondre sans authentification.

C'est la même famille que deux règles déjà tenues ailleurs dans ce projet — « une
sauvegarde jamais restaurée n'est pas une sauvegarde »
([AUTO_HEBERGEMENT.md](AUTO_HEBERGEMENT.md) § 3.4) et « une image qu'on n'a pas
démarrée n'est pas une image publiée, c'est un espoir publié ». À chaque fois, le
contrôle consiste à **occuper la position de celui qui subira le défaut**, parce
que c'est la seule d'où il est visible.

## 4. Pourquoi cette implémentation — décisions et trade-offs

**`ghcr.io` plutôt que Docker Hub.** Le registre est adossé au dépôt : rien à
créer, pas de second compte à gérer, authentification par le `GITHUB_TOKEN`
éphémère du job plutôt que par un secret à faire tourner. Docker Hub impose en
plus des **limites de tirage anonyme** qui frapperaient exactement le public
visé — quelqu'un qui essaie le produit pour la première fois. Le coût assumé :
un projet distribué uniquement sur `ghcr.io` est moins « trouvable » que sur
Docker Hub, ce qui est un problème d'audience, pas d'installation.

**Multi-arch par émulation plutôt que par runner natif.** QEMU est lent (le smoke
test arm64 se paie en minutes), mais un runner ARM demanderait une configuration
supplémentaire pour une release publiée quelques fois par an. On échange du temps
machine contre de la simplicité, dans le sens qui coûte le moins.

**Cache de build `type=gha`.** Les couches se rechargent depuis le cache
d'Actions entre deux releases. Sans lui, chaque publication reconstruit deux
images complètes, `npm ci` compris.

**Le round-trip de sauvegarde est bloquant ici, informatif ailleurs.** Sur une PR,
bloquer un correctif urgent sur une restauration ferait payer à la prod un risque
qui pèse sur les instances tierces. Au moment de **distribuer**, l'arbitrage
s'inverse : on va donner cette image à des gens qui y mettront leurs relevés
bancaires.

**Les notes de release sont dérivées, pas rédigées.** Même contrat que le
changelog in-app : `feat`/`fix`/`perf` seulement, et surtout **la présence d'une
migration**, calculée sur le diff des `*/migrations/*.py`. C'est l'information la
plus utile et la moins retrouvable soi-même — c'est elle qui décide s'il faut
sauvegarder avant de mettre à jour.

## 5. Ce qu'on a écarté et pourquoi

- **Publier `:main` à chaque push.** Donne l'illusion d'un flux continu et retire
  toute possibilité de dire « reviens à la version d'avant ». Une version qui n'a
  pas de nom ne se recommande pas.
- **Une image `amd64` seule, « on ajoutera arm64 si on nous le demande ».** La
  demande ne vient pas : celui qui reçoit `exec format error` s'en va. La moitié
  du public part sans laisser de trace.
- **Publier sans démarrer l'image.** Le build vert ne dit rien d'un
  `collectstatic` raté, d'un module qui ne s'importe pas, d'une dépendance native
  absente d'une architecture. Le smoke test est minuscule et attrape exactement
  ces trois-là.
- **Signer les images (cosign / attestations de provenance).** Le bon réflexe pour
  une chaîne d'approvisionnement, et le bon moment est plus tard : la vérification
  n'a de valeur que si quelqu'un la fait, et personne ne vérifie la signature d'un
  projet à zéro utilisateur. À reprendre quand la distribution compte vraiment.
- **Un registre auto-hébergé.** Ajoute la disponibilité d'un serveur de plus à la
  promesse d'installation, pour aucun bénéfice envers l'installateur.

## 6. Pour aller plus loin

- [OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/spec.md)
  — ce qu'est vraiment une image : manifeste, couches, descripteurs.
- [OCI Image Index](https://github.com/opencontainers/image-spec/blob/main/image-index.md)
  — la structure derrière le multi-architecture.
- [GitHub — Configuring a package's access control and visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)
  — les deux portes de la § 3.4.
- [`docker/metadata-action`](https://github.com/docker/metadata-action) — la
  grammaire des tags (`type=semver`, `type=raw`, `enable=`).
- [Docker — Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
  — buildx, QEMU, et quand un runner natif devient rentable.

---

Fiches connexes : [AUTO_HEBERGEMENT.md](AUTO_HEBERGEMENT.md) — ce que le passage à
l'auto-hébergement change par ailleurs (modèle de menace, capacités optionnelles,
licence, sauvegarde comme fonctionnalité).
