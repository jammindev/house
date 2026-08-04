---
name: opinion
description: Donner un avis tranché et argumenté sur une décision — produit, code, archi, priorisation, nommage, « on fait A ou B ? ». Produit un verdict en une phrase, ce qui le fonde, ce qu'il coûte, le meilleur contre-argument, et ce qui le ferait changer. Ne code rien. Utiliser quand l'utilisateur demande « ton avis ? », « tu en penses quoi ? », « je fais A ou B ? », « c'est une bonne idée ? », ou hésite entre deux approches.
allowed-tools: Read, Grep, Glob, Bash
---

# Opinion — un avis, pas un panorama

L'utilisateur ne demande pas un état de l'art : il demande **ce que tu ferais, toi,
à sa place**. Un avis qui liste trois options sans en choisir une lui rend son
problème intact, avec du texte en plus.

**Règle d'or : le verdict est la première phrase.** Tout le reste l'étaye ou le
nuance — jamais l'inverse.

## 1. S'ancrer (30 secondes, pas plus)

Un avis générique ne vaut rien ici : ce dépôt a une doctrine écrite et une réalité
mesurable. Avant de répondre :

- **La question porte sur le code du dépôt ?** Lis les **1 à 3 fichiers qui
  décident** — pas plus. Souvent : le module concerné (`docs/MODULES/<app>.md`), la
  règle correspondante dans `CLAUDE.md`, le fichier qu'on s'apprête à toucher.
- **Elle porte sur le produit ou la priorisation ?** Le contexte est : **un vrai
  foyer**, une V1 publique dont l'objectif est la **rétention de foyers réels** (pas
  les contributions), des auto-hébergeurs sans clés API. Vérifie au besoin l'état
  réel (`gh issue list`, `git log`) plutôt que de supposer.
- **Elle ne touche pas au dépôt ?** Réponds de tête. Ne pars pas en exploration
  pour une question qui n'en demande pas.

Ne lance **jamais** de sous-agent ni de recherche tentaculaire : ce skill est rapide
par construction. S'il faut une enquête, dis-le et propose `/status` ou une vraie
tâche.

## 2. Les cinq questions qui tranchent la plupart des cas ici

Passe la décision à ce filtre — c'est la doctrine du dépôt, condensée. La plupart
des arbitrages tombent tout seuls dès qu'une réponse est « oui ».

1. **Est-ce que ça crée une deuxième définition ?** Deux compteurs, deux bornes de
   mois, deux façons de dire un écart, deux textes qui divergent. Si oui : c'est
   non, presque toujours. *Deux définitions qui divergent font perdre leur crédit
   aux deux, et celle qu'on lit n'est jamais celle qu'on corrige.*
2. **Est-ce que ça peut mentir en silence ?** Un zéro qui veut dire « rien à
   signaler » *et* « rien d'évaluable », une coche verte sur un contrôle qui n'a
   pas tourné, un cache mal invalidé, un `msgstr` vide. Si oui : il faut un
   garde-fou **testé**, pas une relecture.
3. **Est-ce que ça se voit chez le foyer ?** Si non, ça n'est pas prioritaire —
   quelle que soit son élégance.
4. **Est-ce réversible ?** Porte à sens unique (migration destructive, schéma
   public, texte déjà lu par le foyer) → prudence et deux temps. Porte à double
   sens → tranche vite, quitte à se tromper.
5. **Qu'est-ce que ça coûte à celui qui n'est pas là ?** L'auto-hébergeur sans clé
   API, le contributeur inconnu, le membre du foyer qui lit dans une autre langue.

Si ton avis **contredit** une règle de `CLAUDE.md`, ne le cache pas : cite la règle,
dis pourquoi le cas présent en sort, ou reconnais que ton avis est perdant.

## 3. Le format de la réponse

Court — l'utilisateur doit avoir tranché en 30 secondes de lecture. Pas de titres
lourds, pas de tableau, ~200 mots. Dans cet ordre :

> **Verdict.** Une phrase, à l'impératif, qui nomme le choix. « Fais A. » / « Ne le
> fais pas maintenant. » / « Les deux marchent — prends B parce qu'on en revient
> plus vite. »
>
> **Ce qui décide** — 2 à 3 puces, **ancrées** : un fichier, un chiffre, une règle,
> un bug déjà vécu. Zéro généralité applicable à n'importe quel projet.
>
> **Ce que ça coûte** — une puce, le prix assumé du choix. Un avis qui n'annonce
> aucun coût est une vente, pas un avis.
>
> **En face** — le meilleur argument adverse, formulé **au mieux** (pas un
> épouvantail), et en une phrase pourquoi il ne l'emporte pas.
>
> **Ce qui me ferait changer d'avis** — un signal **observable**, pas une humeur :
> « si un deuxième foyer l'utilise », « si ça dépasse trois appels par écran ».
>
> **Confiance** — forte / moyenne / faible, et **réversible ou non**. Une confiance
> faible sur une porte à double sens veut dire : essaie, tu verras.

## 4. Interdits

- **Pas de « ça dépend » sans trancher ensuite.** Si ça dépend, nomme de quoi, pose
  l'hypothèse la plus probable, et tranche dessous.
- **Pas de fausse balance.** Deux options rarement équivalentes : quand elles le
  sont vraiment, dis-le explicitement et départage sur le coût du retour arrière.
- **Ne valide pas par politesse.** Si l'option de l'utilisateur est la moins bonne,
  le verdict le dit en première phrase. Un avis qui suit toujours celui qu'on lui
  présente ne sert à rien.
- **Pas de survol de ce que tu ne feras pas.** Une seule recommandation.
- **Pas de flatterie ni de préambule** (« excellente question »). Commence par le
  verdict.
- **N'invente pas d'autorité** : ni benchmark, ni « les bonnes pratiques disent »,
  ni consensus fabriqué. Un argument s'appuie sur ce dépôt ou sur un mécanisme
  qu'on peut vérifier.

## 5. Cas particuliers

- **Prémisse fausse** (« vu qu'on stocke le solde dénormalisé… ») → corrige-la en
  premier, en une phrase, puis donne l'avis sur la question réelle.
- **Sous-spécifié** → pose **une** question ciblée. Une seule, et seulement si les
  deux réponses mènent à des avis opposés. Sinon assume l'hypothèse et dis-la.
- **Trop gros pour un avis** (un chantier entier) → donne quand même le verdict de
  cadrage (« découpe-le en trois, commence par X »), puis renvoie vers
  `/prepare-feature` ou `/po`.
- **L'utilisateur insiste après ton avis** → c'est sa décision. Dis-le sans
  moraliser, et aide à faire *sa* version le mieux possible.

## Arguments

- `/opinion <question>` — l'avis court, format ci-dessus.
- `/opinion --fond <question>` — même structure, mais on s'autorise la comparaison
  chiffrée des options et une esquisse d'implémentation en 5 lignes. Toujours un
  verdict en tête.
