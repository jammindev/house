# Parcours 28 — Ouvrir Maisonnée (open source, auto-hébergeable)

> Cadrage : 2026-07-31. **Chantier technique transverse** — il n'ajoute aucun
> usage métier. Il transforme un déploiement personnel en un **produit que
> quelqu'un d'autre peut installer, comprendre et faire tourner chez lui**.

Comme le parcours 21 (recherche sémantique), celui-ci ne crée quasiment aucune
surface utilisateur nouvelle. Ce qu'il change est ailleurs : jusqu'ici l'app avait
**un** utilisateur qui était aussi son auteur, son opérateur et son support. Après,
elle a des utilisateurs qui ne sont rien de tout ça.

Fiche concept (le cours) : [docs/fiches/AUTO_HEBERGEMENT.md](../fiches/AUTO_HEBERGEMENT.md).
Backlog technique : [PARCOURS_28_BACKLOG_TECHNIQUE.md](./PARCOURS_28_BACKLOG_TECHNIQUE.md).

## Résumé

Le problème que ce chantier résout, du point de vue de quelqu'un qui découvre le
dépôt :

> « J'ai trouvé ton projet et il a l'air d'être exactement ce que je cherche.
> Mais je ne peux pas voir à quoi il ressemble, je ne peux pas l'essayer sans
> lire un guide de déploiement de 400 lignes écrit pour ton VPS, et rien ne me
> dit si j'ai seulement le droit de m'en servir. »

Aucune de ces trois phrases ne parle de la qualité du code. Elles disent que le
dépôt est aujourd'hui **le plan de travail d'un auteur**, pas la **porte d'entrée
d'un produit**. Le `README.md` ouvre sur « backend Django (SSR + API REST) avec
mini-SPA React par page via Vite » — c'est une stack, et personne n'installe une
stack. Il n'y a **aucune capture d'écran** dans tout le dépôt, alors qu'une app
auto-hébergée est impossible à évaluer sans l'installer : les gens décident depuis
les images. Et il n'y a **pas de fichier LICENSE**, ce qui veut dire qu'en droit,
personne n'a l'autorisation d'utiliser ce code.

Ce chantier livre les quatre choses qui manquent — une **installation en une
commande**, une **licence et une gouvernance**, une **façade** (README, captures,
nom), et surtout le **durcissement** qui rend défendable une app qui contient les
relevés bancaires de gens qu'on ne connaît pas — puis s'arrête sur une **recette
par cinq à dix foyers pilotes** avant toute publication bruyante.

## Positionnement produit

Le projet a été construit pour un foyer réel, pas pour un marché. C'est ce qui
l'a rendu bon, et c'est aussi ce qui le rend difficile à vendre : une suite
horizontale, en solo, face à un spécialiste sur chaque axe (YNAB sur le budget,
Bankin' sur la banque, Todoist sur les tâches). La voie retenue n'est donc pas le
SaaS payant mais le modèle **Home Assistant** : publier, auto-hébergeable, et
laisser l'usage désigner le produit.

L'argument qui rend ce chantier court plutôt que long : **le codebase est déjà
écrit comme un projet open source.** Ce n'est pas une reconversion, c'est une
publication. Ce que la plupart des projets doivent construire *après* avoir
décidé de s'ouvrir existe déjà ici :

- un `CLAUDE.md` qui explique le *pourquoi* de chaque règle, adossé à un bug qui a
  réellement eu lieu en prod — c'est un document d'onboarding contributeur, il se
  trouve qu'il s'adresse à une IA ;
- `docs/MODULES/`, `docs/parcours/`, `docs/fiches/` — la doc par module et par
  chantier ;
- des tests de régression **nommés d'après le défaut qu'ils empêchent**
  (`TestTheTwoScreensAgree`, `TestSavingASplitNeverUndoesAReconciliation`) : un
  contributeur qui casse un invariant comprend immédiatement lequel ;
- un déploiement documenté **et testé** (`nginx/test-resilience.sh`, bloquant en
  CI) ;
- un changelog généré depuis le `git log`, avec un contrat de forme de commit déjà
  tenu ;
- quatre langues d'interface et un test de parité des catalogues ;
- une seed de démo **déjà fictive** (`seed_demo_data`, « Famille Mercier »,
  adresses `@demo.local`) — le travail le plus fastidieux d'une démo publique est
  fait depuis longtemps.

La plupart des projets s'ouvrent avec un README et de la dette invisible. Celui-ci
s'ouvre avec le raisonnement conservé.

**Ce qu'on cherche à apprendre.** L'objectif n'est pas d'être installé, c'est
d'être **réutilisé la semaine suivante**. Cent installations et zéro retour en
semaine trois est un résultat négatif, même si le post a bien marché ; dix foyers
qui saisissent encore leurs dépenses au bout de six semaines est un résultat
positif, même si personne n'a rien remarqué. Les étoiles GitHub mesurent la
qualité d'un post. La rétention mesure le produit. Trois questions, dans l'ordre :

1. **Est-ce que ça tient une vraie vie ?** Un autre foyer arrive avec une banque
   dont le CSV n'a pas de colonne solde, une famille de cinq, un compte joint. Les
   invariants du module Argent n'ont jamais été éprouvés hors d'un seul échantillon.
2. **Quel module retient ?** Dix portes ont été construites ; l'usage dira laquelle
   est franchie, et c'est probablement une seule.
3. **Est-ce que le problème existe ailleurs que chez soi ?** La réponse honnête
   peut être non. Ce serait une information qui vaut un an.

## Ce que le chantier change, concrètement

| Question d'un visiteur | Aujourd'hui | Après |
|---|---|---|
| « À quoi ça ressemble ? » | ❌ aucune capture dans le dépôt | ✅ 6 captures + un GIF de l'import d'un relevé qui se ventile |
| « Comment j'essaie ? » | ❌ venv, `pip install -r` ×3, `npm`, deux serveurs, des `.env` | ✅ `docker compose up`, un foyer de démo pré-rempli |
| « J'ai le droit ? » | ❌ pas de LICENSE — donc non | ✅ AGPL-3.0, et l'auto-hébergement est explicitement le cas nominal |
| « Ça fait quoi, au juste ? » | 🟡 un README qui décrit une stack | ✅ un README qui ouvre sur la promesse : *chaque euro est rangé ou signalé* |
| « Je n'ai pas de clé d'API Anthropic. » | 🟡 l'assistant répond « je ne sais pas », mais l'onglet promet quand même | ✅ une capacité indisponible **se déclare**, elle ne se casse pas et ne ment pas |
| « Je n'ai pas de serveur SMTP. » | ❌ l'invitation d'un second membre part dans le vide — le foyer reste à une personne | ✅ lien d'invitation copiable, l'e-mail devient une commodité |
| « Mes relevés bancaires sont dedans. Et si je perds tout ? » | 🟡 un `backup_db.sh` écrit pour un VPS précis, restauration jamais décrite | ✅ sauvegarde et **restauration testée**, documentées pour une machine quelconque |
| « Et si un autre foyer voit mes données ? » | 🟡 le scope `household` protège des membres d'une famille | ✅ il protège de gens qui *cherchent* à passer à travers, et un test générique le vérifie sur chaque endpoint |

## Le nom : Maisonnée

Le produit publié s'appelle **Maisonnée** — le foyer comme groupe de personnes,
pas comme bâtiment. C'est ce que l'app modélise depuis le premier jour
(`Household`, `HouseholdMember`), et c'est ce que « house » ne dit pas.

Décision de portée, tranchée : **le nom change en façade, pas dans le code.**
README, interface, manifeste PWA, e-mails, image Docker, dépôt : *Maisonnée*. Les
paquets Python (`config/`, `apps/`), la base, les settings et le pipeline de
déploiement gardent `house`. Renommer le code coûterait une réécriture transverse
et un risque de casse sur le déploiement, pour zéro bénéfice utilisateur — un
self-hoster ne lit jamais un nom de module Python.

## Ce qu'on ne fait pas en V1

Explicitement différé, et pourquoi :

- **Une instance de démo en ligne** (`demo.maisonnee.app`). Meilleur taux d'essai,
  mais un VPS de plus, un cron de remise à zéro, une surface d'abus publique et
  une promesse de disponibilité dès le premier post. Les captures font le travail
  d'évaluation. Une démo tombée le jour du post vaut pire que pas de démo.
- **Toute télémétrie, même anonyme.** Une app auto-hébergée qui appelle la maison
  par défaut trahit la raison pour laquelle on l'auto-héberge. La mesure de la
  rétention passe par **cinq conversations**, pas par un mouchard. Réévaluable
  plus tard, en opt-in franc.
- **Le packaging communautaire** (Unraid, Umbrel, CasaOS, TrueNAS, Helm). Ça se
  mérite après avoir prouvé qu'une installation Docker nue tient chez cinq
  inconnus.
- **La traduction du code et de la doc interne en anglais.** Le code, les
  commentaires, `CLAUDE.md` et `docs/` restent en français : c'est l'origine du
  projet et le raisonnement y est intact. Seule la **façade** est bilingue
  (README, `CONTRIBUTING`, modèles d'issue). L'interface, elle, est déjà en quatre
  langues. Barrière contributeur assumée : mieux vaut une doc vraie en français
  qu'une traduction morte.
- **L'hébergement payant** (séquence Home Assistant → Nabu Casa) et
  **l'agrégation bancaire**. Ce sont les portes de sortie que l'AGPL garde
  ouvertes, pas des chantiers de ce parcours.
- **Un renommage du code en `maisonnee`** — voir ci-dessus.

## Le dépôt est déjà public — depuis dix mois, sans que personne le sache

Constat fait au cadrage : `jammindev/house` est **public depuis le 21 septembre
2025**. Zéro étoile, zéro fork, zéro watcher, **aucune licence**. Le code est
lisible par n'importe qui depuis dix mois ; il n'a simplement jamais été annoncé.

Trois conséquences, et elles réordonnent le chantier :

- **Ce parcours ne « rend pas public » quoi que ce soit.** Il assume une
  exposition qui existe déjà. La question n'est plus *quand ouvrir* mais *quand
  annoncer* — et ce qui doit être vrai avant.
- **Ce qui devait être un prérequis est un retard.** Le durcissement de la CI (un
  runner `self-hosted`, un déclencheur `@claude` payé par l'auteur et actionnable
  par n'importe quel commentateur) et l'absence de `LICENSE` — qui, en droit, veut
  dire *tous droits réservés* — ne sont pas des travaux préparatoires : ce sont
  des écarts ouverts aujourd'hui.
- **Un scoping faible se lit dans le code.** L'instance de production du foyer
  tourne pendant que ses sources sont publiques. Le durcissement multi-tenant
  n'est donc pas une précaution pour de futurs utilisateurs : c'est la protection
  des données réelles du foyer, maintenant.

Le bon côté : **rien n'a été gaspillé.** La règle « on n'a qu'un seul coup par
communauté » est intacte, puisque aucune communauté n'est encore passée.

## Le risque assumé

Publier une app qui contient les relevés bancaires, les documents et l'adresse
d'un foyer change la nature des défauts. Un bug de scoping n'est plus « ma femme
voit ma liste de courses », c'est « un inconnu lit mes factures ». Le lot de
durcissement multi-tenant est donc **non négociable et bloquant** : rien ne
s'annonce avant lui.

Le contrepoids est que l'ouverture est aussi ce qui améliore ce point — des yeux
extérieurs sur ce code valent mieux que les seuls yeux de son auteur — et qu'un
`SECURITY.md` avec un canal de signalement fait partie du lot licence pour cette
raison précise.

Enfin : **rien ne presse.** Le projet ne prend l'argent de personne et ne porte
aucune promesse de disponibilité. L'open source n'a pas de date d'échéance, ce qui
autorise à ne pas conclure trop vite — dans un sens comme dans l'autre.
