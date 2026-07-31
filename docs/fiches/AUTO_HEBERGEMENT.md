# Auto-hébergement — d'un déploiement à un produit installable

> Fiche concept du [parcours 28](../parcours/PARCOURS_28_OUVRIR_MAISONNEE.md).
> Ce qui change quand le logiciel quitte la machine de son auteur : le modèle de
> menace, le contrat de licence, et la différence — beaucoup plus large qu'elle
> n'en a l'air — entre *déployable* et *installable*.

## 1. Le problème

Maisonnée tourne en production depuis des mois. Le déploiement est documenté
(`DEPLOYMENT.md`), testé (`nginx/test-resilience.sh`, bloquant en CI), résilient
(le proxy ne tombe pas avec l'app). On pourrait croire le travail fait.

Il ne l'est pas, parce que **tout ce déploiement s'exécute avec son auteur dans la
boucle**. Il suppose un VPS choisi, un domaine à soi, un `.env` rempli à la main,
des clés d'API souscrites, un serveur SMTP, une base déjà migrée, et surtout
quelqu'un qui sait *ce qu'il voulait obtenir*. Aucune de ces conditions n'est
vraie pour un inconnu.

Trois questions distinctes, qu'on confond facilement :

- **Est-ce que ça se déploie ?** Oui, depuis longtemps — par son auteur.
- **Est-ce que ça s'installe ?** C'est-à-dire : quelqu'un sans contexte
  obtient-il une app qui marche, sans lire le code ni deviner une valeur ?
- **Est-ce que ça s'exploite ?** C'est-à-dire : cette personne peut-elle la
  mettre à jour, la sauvegarder, la **restaurer**, et comprendre ce qui casse ?

Les trois demandent des livrables différents. La deuxième est un problème de
valeurs par défaut. La troisième est un problème de documentation *et* d'outils.

## 2. Le concept en deux phrases

**Auto-héberger, c'est transférer à l'utilisateur le rôle d'opérateur** — donc
tout ce que l'auteur savait sans l'écrire doit devenir soit une valeur par défaut
qui marche, soit une question posée explicitement, soit une page de documentation.

Et comme ce transfert expose le logiciel à des réseaux et à des gens que son
auteur n'a pas choisis, il change aussi le **modèle de menace** : d'un logiciel
qui sépare les membres d'une famille de bonne foi, on passe à un logiciel qui doit
résister à quelqu'un qui *cherche* à passer à travers.

## 3. Comment on l'applique dans Maisonnée

### 3.1 Le défaut est l'interface

Un self-hoster ne lit pas la doc avant de lancer la commande, il la lit **quand
ça casse**. Chaque valeur qu'il doit fournir avant d'avoir vu l'app est un endroit
où il abandonne. D'où la règle du parcours : **`docker compose up` sur une machine
nue doit donner une app fonctionnelle**, avec un `SECRET_KEY` généré au premier
démarrage plutôt que réclamé, une base incluse, les migrations appliquées et un
foyer de démonstration déjà rempli (`seed_demo_data`, « Famille Mercier », déjà
fictive depuis le début).

Ce qui reste à saisir — un domaine, un mot de passe — se demande **après** que la
personne a vu de quoi il s'agit.

### 3.2 Une capacité absente se déclare ; elle ne se casse pas et elle ne ment pas

Maisonnée s'appuie sur des services tiers : Claude pour l'assistant, le récap et
le changelog, Voyage pour les embeddings, un SMTP pour les e-mails, VAPID pour le
push, Telegram pour le canal bot. Un foyer qui s'auto-héberge n'a **aucun** de
ces comptes le premier jour, et n'en aura peut-être jamais.

Il y a trois façons de traiter ça, et une seule est acceptable :

- **planter** — l'app ne démarre pas sans clé : disqualifiant ;
- **faire semblant** — l'onglet Assistant s'ouvre, la question part, la réponse
  est « je ne sais pas ». C'est l'état actuel : `agent.service.ask` dégrade
  proprement, mais l'interface promet quand même quelque chose qu'elle ne peut pas
  tenir. L'utilisateur en conclut que le produit est mauvais, pas qu'il lui manque
  une clé ;
- **déclarer** — le serveur dit ce dont il est capable, l'interface s'aligne, et
  l'endroit où la capacité manque explique comment l'obtenir.

C'est la même règle que la conformité de l'argent, transposée à la configuration :
**un zéro a deux sens** — « rien à dire » et « rien d'évaluable » — et les
confondre produit un silence qu'on prend pour une réponse.

Un cas mérite d'être isolé parce qu'il n'est pas cosmétique : **sans SMTP,
l'invitation d'un second membre part dans le vide.** Un « système d'exploitation du
foyer » qui ne peut pas dépasser une personne n'est pas dégradé, il est inutile.
L'invitation doit donc produire un **lien copiable** ; l'e-mail n'en est que le
véhicule de confort.

### 3.3 Le modèle de menace change de nature

Le scope `household` traverse 33 apps. Aujourd'hui il sépare des gens qui vivent
sous le même toit ; publié, il sépare des inconnus dont l'un peut être hostile.
Trois zones concentrent le risque, parce qu'elles contournent le chemin normal :

- **les FK polymorphes** (`Interaction.source`, `resolve_allocation_source`,
  `EmbeddingChunk`) — un identifiant arbitraire y désigne un objet d'un autre
  foyer si personne ne revérifie ;
- **l'agent**, dont les tools s'adressent en `entity_type:id` et qui *écrit*
  (`create_entity`) ;
- **les fichiers** (`core/views_media.py`) — un document servi par son chemin
  n'est protégé que par ce que fait cette vue.

Le livrable qui compte ici n'est pas un audit : un audit est vrai le jour où il
est fait. C'est un **test générique** qui parcourt le routeur DRF et vérifie,
pour chaque endpoint enregistré, qu'un foyer B ne lit ni n'écrit rien du foyer A.
Ajouter un endpoint, c'est alors le faire passer sous ce test sans y penser —
même logique que `banking.compliance.REGISTRY` (« ajouter un mécanisme à l'argent
= ajouter son détecteur ») ou que le test de parité des catalogues i18n.

### 3.4 La sauvegarde est une fonctionnalité, pas une consigne

Les gens vont mettre leurs relevés bancaires, leurs factures et leurs contrats
d'assurance dedans. Sur un VPS d'auteur, une sauvegarde ratée se rattrape. Chez
un inconnu, elle ne se rattrape pas et c'est le logiciel qu'on accuse.

Donc : une commande de sauvegarde qui marche sans contexte, une procédure de
**restauration écrite et vérifiée** (une sauvegarde jamais restaurée n'est pas une
sauvegarde), et la règle déjà tenue en interne — **une migration destructive se
livre en deux fois** — devient une promesse publique de compatibilité, puisque
personne ne contrôle plus quand ses utilisateurs mettent à jour.

## 4. Pourquoi cette implémentation — décisions et trade-offs

**AGPL-3.0 plutôt qu'une licence permissive.** Le copyleft *réseau* — l'obligation
de publier ses modifications quand on **héberge** le logiciel pour d'autres, pas
seulement quand on le distribue — est la seule qui corresponde à un produit dont
l'usage normal est d'être hébergé. Elle laisse l'auto-hébergement totalement libre
(un foyer n'est pas un public), elle n'empêche pas l'auteur de vendre un
hébergement puisqu'il détient seul le copyright, et elle empêche un tiers de
fermer une version hébergée du travail. C'est la licence de Nextcloud, Mastodon,
Immich. Le coût : quelques entreprises l'interdisent par politique interne — un
non-sujet pour un logiciel domestique.

**Le dépôt existant devient public, historique compris.** 778 commits, 9,7 Mio,
aucun secret ni média jamais commité (`.env*` et `media/` sont ignorés depuis le
début). Cet historique est le seul élément qu'un visiteur ne peut pas fabriquer :
il montre le raisonnement, les corrections, les tests nommés d'après le bug qu'ils
empêchent. Un « initial commit » de 40 000 lignes envoie le signal inverse — du
code jeté par-dessus un mur — et remettrait à zéro un changelog dont la génération
lit précisément ce `git log`.

**Le nom change en façade seulement.** *Maisonnée* pour le produit, `house` pour
les paquets Python et la base. Un renommage transverse coûterait une réécriture et
un risque de casse au déploiement, pour un bénéfice nul : personne n'installe un
logiciel en lisant ses noms de modules.

**Pas de télémétrie, même anonyme.** Une app auto-hébergée qui téléphone chez elle
par défaut contredit la raison pour laquelle on l'auto-héberge. La question à
laquelle on veut répondre — *est-ce que les gens reviennent ?* — se traite par cinq
conversations avec des foyers pilotes. Un utilisateur qui abandonne ne laisse
aucune trace exploitable de toute façon : l'analytique dit qu'il est parti, jamais
pourquoi.

**Pas de démo en ligne en V1.** Le taux d'essai serait meilleur, mais ça ajoute un
serveur, un cron de remise à zéro, une surface d'abus et une astreinte implicite
le jour même du lancement. Les captures d'écran couvrent 90 % du besoin
d'évaluation pour 0 € par mois.

**L'ordre est un livrable à part entière.** On n'a **qu'un seul coup par
communauté** : trente personnes qui tombent sur une installation cassée partent et
ne reviennent pas, et on ne reposte pas. D'où la séquence imposée — installation
qui marche, puis façade, puis **cinq à dix foyers en privé** dont on corrige les
plantages, et *seulement ensuite* les canaux publics.

## 5. Ce qu'on a écarté et pourquoi

- **Ne publier que le module Argent.** C'est la seule partie avec une promesse que
  personne d'autre ne tient (*chaque euro est rangé ou signalé avec un motif*), et
  ce serait le bon découpage pour *vendre*. Mais en auto-hébergé, la suite est un
  atout : le module poules-et-œufs à côté d'un moteur de rapprochement bancaire
  est exactement ce qui fait qu'un projet est **aimé** plutôt que toléré — il dit
  qu'il a été écrit pour un foyer réel.
- **Un CLA** (transfert de droits par les contributeurs). Utile seulement pour
  relicencier plus tard ; c'est une friction immédiate contre une option lointaine.
  On retient le **DCO** (`Signed-off-by`), qui atteste l'origine sans rien céder.
- **Réécrire l'historique** (`git filter-repo`) « par précaution ». Une réécriture
  sans fuite à supprimer détruit un actif pour traiter un risque déjà mesuré comme
  nul. La vérification, elle, reste obligatoire : un scan de secrets sur les 778
  commits, pas seulement sur l'arbre courant.
- **Vendre un SaaS tout de suite.** Une suite horizontale construite en solo est
  la chose la plus difficile à vendre qui soit, et chaque axe affronte un
  spécialiste. L'ouverture construit une audience et une crédibilité sans porter la
  DPA, la TVA de vingt-sept pays, ni le support téléphonique de gens dont on
  détient les relevés bancaires.
- **Traduire le code et la doc interne en anglais.** `CLAUDE.md` et `docs/` valent
  par la fidélité du raisonnement conservé. Une traduction figée qui dérive vaut
  moins qu'une doc vraie en français, et l'interface est déjà en quatre langues.

## 6. Pour aller plus loin

- [Choose a License — AGPL-3.0](https://choosealicense.com/licenses/agpl-3.0/) — le
  texte et ses obligations en clair.
- [Developer Certificate of Origin](https://developercertificate.org/) — les onze
  lignes du DCO.
- [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) —
  critères d'entrée : licence, doc d'installation, captures.
- [Home Assistant](https://github.com/home-assistant/core) puis
  [Nabu Casa](https://www.nabucasa.com/) — la séquence de référence : projet
  auto-hébergé d'abord, hébergement payant ensuite, pour ceux qui ne veulent pas
  gérer un serveur.
- [Immich](https://github.com/immich-app/immich) — comparable en nature (données
  personnelles très sensibles, AGPL, install Docker en une commande) ; son
  `docker-compose.yml` et sa page « backup & restore » sont de bons modèles.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  — grille de vérification pour le lot de durcissement.

---

Fiches connexes : [CARTOGRAPHIE_DEPENSES.md](CARTOGRAPHIE_DEPENSES.md) (ce que le
durcissement doit protéger côté argent), [RAG.md](RAG.md) et
[EMBEDDINGS.md](EMBEDDINGS.md) (les capacités qui dépendent d'une clé d'API tierce).
