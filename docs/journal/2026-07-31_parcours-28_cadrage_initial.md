# 2026-07-31 — Parcours 28 cadrage initial

## Contexte

Session de cadrage du vingt-huitième chantier : **ouvrir Maisonnée** — publier le
projet en open source auto-hébergeable.

Déclencheur : une conversation de la veille (2026-07-30) partie de « tu me
conseilles la mise sur le marché de ce produit ? ». Conclusion de cette séance :
**pas en SaaS payant.** Une suite horizontale construite en solo est la chose la
plus difficile à vendre, et chaque axe affronte un spécialiste (YNAB, Bankin',
Todoist, Notion). La voie retenue est le modèle **Home Assistant** : publier,
auto-hébergeable, et laisser l'usage désigner le produit — l'utilisateur avait
déjà envisagé cette piste de son côté.

Le but explicite de cette session : **produire uniquement de la documentation, des
specs et les issues GitHub** — pas de code.

## Le constat qui a réordonné le chantier

Découverte pendant le cadrage, en interrogeant l'API GitHub pour créer les
issues : **`jammindev/house` est public depuis le 2025-09-21.** Dix mois. 0
étoile, 0 fork, 0 watcher, **aucune licence**.

Trois conséquences :

- le parcours ne « rend » rien public — il **assume une exposition existante** et
  décide *quand annoncer* ;
- l'hygiène du dépôt et la licence ne sont plus des préparatifs mais des **écarts
  ouverts aujourd'hui**. En particulier : un runner `self-hosted` sur un dépôt
  public, un déclencheur `@claude` payé par l'auteur et actionnable par n'importe
  quel commentateur, et un code sous « tous droits réservés » par défaut — la plus
  mauvaise des deux situations, visible mais inutilisable ;
- un scoping faible se **lit** dans le code pendant que l'instance de production
  du foyer tourne. Le durcissement multi-tenant protège des données réelles,
  maintenant, pas de futurs utilisateurs.

Le bon côté : rien n'a été gaspillé. La règle « on n'a qu'un seul coup par
communauté » est intacte, puisque aucune communauté n'est encore passée.

## Ce qui a été confirmé (décisions)

- **Le codebase est déjà écrit comme un projet open source.** Ce n'est pas une
  reconversion, c'est une publication : `CLAUDE.md` explique le *pourquoi* de
  chaque règle adossé à un bug réel, `docs/MODULES|parcours|fiches` existent, les
  tests portent le nom du défaut qu'ils empêchent, le déploiement est testé en CI,
  le changelog se génère depuis le `git log`, l'UI est en quatre langues. Et la
  seed de démo (`seed_demo_data`) est **déjà fictive** depuis toujours — « Famille
  Mercier », adresses `@demo.local`.

- **Nom : Maisonnée** — le foyer comme groupe de personnes, ce que le code
  modélise (`Household`) et ce que « house » ne dit pas. **En façade seulement** :
  README, UI, manifeste PWA, e-mails, image Docker. Les paquets Python, la base et
  les settings gardent `house` ; un renommage transverse coûterait une réécriture
  et un risque de casse au déploiement pour un bénéfice nul.

- **Licence AGPL-3.0-only.** Le copyleft *réseau* est le seul adapté à un produit
  dont l'usage normal est d'être hébergé : auto-hébergement totalement libre,
  option « hébergement payant » préservée (copyright unique), et impossibilité pour
  un tiers de fermer une version hébergée. Licence de Nextcloud, Mastodon, Immich.
  **DCO** plutôt que CLA.

- **Historique conservé.** 778 commits, 9,7 Mio, aucun secret ni média jamais
  commité (`.env*` et `media/` ignorés depuis le début). C'est le seul élément
  qu'un visiteur ne peut pas fabriquer ; un « initial commit » de 40 000 lignes
  envoie le signal inverse et casserait `generate_changelog`. La vérification reste
  obligatoire : scan de secrets sur **tout** l'historique.

- **Le livrable du durcissement n'est pas un audit mais un test.** Un audit est
  vrai le jour où il est fait. `test_tenant_isolation.py` parcourt le routeur DRF
  et vérifie qu'aucun endpoint ne laisse passer un foyer vers un autre — même
  mécanique que `banking.compliance.REGISTRY` (« ajouter un mécanisme à l'argent =
  ajouter son détecteur ») et que le test de parité i18n.

- **Une capacité tierce absente se déclare ; elle ne se casse pas et ne ment pas.**
  C'est la règle « un zéro a deux sens » transposée à la configuration. Cas
  bloquant identifié : **sans SMTP, l'invitation d'un second membre part dans le
  vide** — un produit dont l'unité est le foyer ne peut pas rester à une personne.

- **Pas de démo en ligne, pas de télémétrie.** Une app auto-hébergée qui téléphone
  chez elle contredit la raison pour laquelle on l'auto-héberge ; et la question
  « est-ce que les gens reviennent ? » se traite par **cinq conversations**, pas
  par des logs — un utilisateur qui abandonne ne laisse aucune trace exploitable.

- **L'ordre est un livrable.** On n'a qu'un seul coup par communauté : installation
  qui marche → façade → **5 à 10 foyers en privé** dont on corrige les plantages →
  seulement ensuite les canaux publics.

## Ce qu'on mesure

Pas des installations : de la **rétention**. Cent installations et zéro retour en
semaine 3 est un résultat négatif ; dix foyers qui saisissent encore leurs dépenses
à S+6 est un résultat positif. Trois questions : est-ce que ça tient une vraie vie
(un CSV sans colonne solde, une famille de cinq, un compte joint) ? quel module
retient ? le problème existe-t-il ailleurs que chez soi — sachant que la réponse
honnête peut être non, et que ce serait une information qui vaut un an.

## Livrables de la session

- Doc produit : [`PARCOURS_28_OUVRIR_MAISONNEE.md`](../parcours/PARCOURS_28_OUVRIR_MAISONNEE.md)
- Fiche concept : [`AUTO_HEBERGEMENT.md`](../fiches/AUTO_HEBERGEMENT.md)
- Backlog technique : [`PARCOURS_28_BACKLOG_TECHNIQUE.md`](../parcours/PARCOURS_28_BACKLOG_TECHNIQUE.md)
- Issues : **#485** (ombrelle), **#486 → #493** (lots 0 à 7)

Zéro ligne de code applicatif.
