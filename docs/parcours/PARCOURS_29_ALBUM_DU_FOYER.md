# Parcours 29 — L'album du foyer

Ce document cadre le vingt-neuvième chantier de House. Il fait des photos le
**point d'entrée** de l'application, et non plus une vue secondaire du module
Documents.

- Fiche concept : [PIPELINE_MEDIA.md](../fiches/PIPELINE_MEDIA.md)
- Backlog technique : [PARCOURS_29_BACKLOG_TECHNIQUE.md](./PARCOURS_29_BACKLOG_TECHNIQUE.md)
- Module concerné : [documents](../MODULES/documents.md)

## Résumé

Le problème, dit par l'utilisateur :

> « Je photographie le numéro de série d'une chaudière, une fissure qui
> m'inquiète, et l'anniversaire de ma fille. Les trois finissent au même endroit,
> dans le même ordre. »

Une photo dans House porte aujourd'hui trois axes : la **zone** dit *où*,
l'**entité** liée (projet, équipement, tâche) dit *sur quoi*, la **phase**
avant/pendant/après dit *quand dans le chantier*. Aucun des trois ne dit
**pourquoi cette photo existe** — et c'est précisément la question qui sépare une
preuve technique d'un souvenir.

Ce parcours ajoute ce quatrième axe, l'**intention**, et en fait la première
chose que la galerie demande. Il assume dans la foulée la conséquence de
l'ambition retenue — House devient l'endroit où l'on range *toutes* ses photos,
souvenirs compris —, ce qui fait entrer le foyer dans un ordre de grandeur que le
module ne sait pas encore encaisser.

C'est le même raisonnement que « le budget est la catégorie » côté argent : un
projet et une zone disent sur quoi et où porte un euro, jamais de quelle nature
il est. Un euro sans budget est un écart ; une photo sans intention aussi.

## Positionnement produit

Les parcours 02 à 05 ont construit la mémoire du foyer, le parcours 20 a donné
aux projets leurs photos avant/après, et le parcours 21 a rendu la galerie
triable par date de prise de vue. Toutes ces briques traitent la photo comme
**une pièce jointe à autre chose**.

Le parcours 29 renverse la relation : la photo devient une entrée à part entière,
qu'on ouvre pour elle-même, et la première question posée n'est plus « à quoi
est-elle rattachée » mais « à quoi sert-elle ». C'est aussi le premier chantier
qui vise explicitement l'**ouverture quotidienne** de l'application : une galerie
qu'on consulte, et pas seulement un classeur qu'on alimente.

## Le pari, et ce qu'il coûte

Deux ambitions étaient sur la table le 2026-08-03.

**Le classeur du foyer** — House prend le technique, l'observation, et un album
*du foyer* curaté ; les souvenirs personnels restent dans la pellicule du
téléphone. Volume faible, quota bon marché, forfait gratuit crédible, et une
catégorie que personne ne sert bien.

**L'album complet** — House vise à remplacer la pellicule comme point d'entrée
photo, souvenirs inclus. **C'est celle qui a été retenue.**

Il faut écrire ici ce qu'elle coûte, parce que la suite du backlog n'a de sens
qu'à cette lumière :

- **Le volume change d'ordre de grandeur.** Un foyer « classeur » stocke quelques
  centaines de photos ; un foyer « album » en stocke des dizaines de milliers.
  Trois mécanismes qui tenaient très bien jusqu'ici cessent de tenir : la galerie
  charge tout d'un coup, les fichiers vivent sur le disque d'un VPS, et le
  traitement d'une image occupe le thread de la requête.
- **Le quota devient une contrainte réelle, pas une précaution.** Les souvenirs
  sont la catégorie la plus lourde en octets et la moins spécifique à House :
  c'est elle qui décidera du coût par foyer.
- **La comparaison devient frontale.** Un utilisateur qui range ses souvenirs
  dans House les compare à ce que fait son téléphone — sauvegarde automatique,
  recherche par visage, retouche. House ne gagnera pas sur ce terrain, et ne doit
  pas essayer : ce qu'il apporte, c'est le **contexte du foyer** que la pellicule
  n'aura jamais (cette photo est la chaudière, elle est dans la buanderie, elle
  date du chantier de 2024).

Le pari est donc : *l'intention et le contexte valent plus que les visages et les
filtres.* Il est assumé, et il oriente tout le reste — notamment le fait qu'on ne
construira **jamais** de reconnaissance de visages ni d'éditeur d'image.

## Le concept : l'intention d'une photo

Une nouvelle valeur portée par le document lui-même, et non par un de ses liens :

| Intention | Ce que c'est | Exemple |
|---|---|---|
| `technical` | Une **preuve**. On la reprendra pour lire quelque chose dessus. | Numéro de série, index de compteur, plan, plaque signalétique |
| `observation` | Un **fait daté** qu'on remarque, et qui appellera peut-être une action. | Une fissure, une fuite, la pousse d'un semis, une poule qui boite |
| `memory` | Un **souvenir** du foyer. | Un repas, un anniversaire, le jardin sous la neige |
| *(vide)* | **Personne n'a encore trié.** | Ce qui vient d'être importé |

Le point qui structure tout le reste : **le vide n'est pas « souvenir ».** Vide
signifie que personne n'a regardé — c'est un écart, et il alimente une file
« À trier ». `memory` signifie qu'on a choisi. Confondre les deux rendrait la
file aveugle et l'utilisateur croirait avoir rangé.

C'est exactement la règle établie côté banque (`inflow_nature == ""` n'est pas
`"other"`), et la déclinaison du principe du parcours 26 : *toute entité est soit
résolue, soit flaggée avec un motif ; rien ne reste dans un entre-deux
silencieux.*

Conséquence directe sur l'écran : **la galerie ne s'ouvre plus sur tout.** Elle
s'ouvre sur une intention. Le mélange dont se plaint l'utilisateur n'est pas un
problème d'affichage, c'est une donnée absente ; l'ajouter suffit à le résoudre,
et aucun filtre n'y suffirait sans elle.

## Le tri se fait par groupe, jamais photo par photo

Trente photos rapportées d'un week-end forment **une session**, pas trente
décisions. Le tri se présente donc par grappes — des photos prises dans le même
créneau —, et une intention s'attribue à la grappe entière.

Ce n'est pas un confort : c'est la condition de survie de la fonctionnalité. Une
file qui demande trente gestes pour trente photos ne se vide jamais, et une file
qu'on ne vide jamais cesse d'être lue au bout d'une semaine — exactement ce qui
est arrivé aux compteurs du Contrôle avant qu'ils ne soient bornés.

Avec la garde-fou que l'application connaît déjà côté argent : **une action de
lot ne doit jamais écraser un travail déjà fait.** Une grappe dont certaines
photos portent déjà une intention ne se réassigne pas en bloc sans le dire.

## Ce que l'utilisateur gagne

| Question | Aujourd'hui | Après |
|---|---|---|
| « Montre-moi les photos du chantier » | Elles sont mêlées aux repas de famille | La galerie s'ouvre sur une intention |
| « Où est la photo du numéro de série ? » | On fait défiler par mois | Intention `technical` + la zone ou l'équipement |
| « Qu'est-ce qui traîne sans être rangé ? » | Rien ne le dit | La file « À trier », avec son compte |
| « J'ai 200 photos à importer » | Dix ouvertures d'un dialogue, une modale bloquée 40 min | Une page d'import, une file qui survit à la navigation |
| « Combien de place j'occupe ? » | Rien ne le dit | Un compteur, visible avant de mordre |
| « Je viens de rentrer, j'ai pris 15 photos » | On ouvre House, on retrouve les fichiers, on les envoie | Feuille de partage du téléphone, puis une automatisation qui ne propose que ce qui vient de la maison |

## Envoyer depuis son téléphone, sans ouvrir House

Le geste le plus fréquent n'est pas « j'ouvre House pour importer », c'est « je viens
de photographier quelque chose ». Il doit donc partir de l'app Photos, pas de House :
on sélectionne, on partage, c'est fini. Ce chemin ne dépend d'aucun lot de ce
parcours et se livre à part (#535 pour iOS, #537 pour Android).

Il faut assumer que **les deux plateformes ne coûtent pas la même chose à
l'utilisateur** :

- **Android** — il installe House sur son écran d'accueil, et « Maisonnée » apparaît
  dans le menu de partage du système. Rien d'autre à faire, jamais.
- **iOS** — il importe un raccourci et y colle un jeton, une fois. Deux minutes.

L'écart ne vient pas de House : Safari ne permet pas à une application web de
recevoir du contenu partagé, là où Android le permet. Le raccourci est le
contournement, et il n'y en a pas d'autre sans publier une application native — ce
qu'on ne fera pas.

Deux conséquences produit à tenir :

- **Le raccourci se distribue déjà construit.** Le monter à la main demande une
  quarantaine de minutes et se trompe cinq fois ; personne ne le fera. L'utilisateur
  ouvre un lien, répond à deux questions posées par le raccourci lui-même, et c'est
  tout.
- **Ce qui part du téléphone n'est jamais classé au départ.** Le raccourci envoie,
  House range. Mettre l'intelligence dans le téléphone la met dans un endroit qu'on
  ne peut ni corriger ni tester sans la réinstaller chez chaque membre du foyer.

## Ce qu'on ne fait pas en V1

Explicitement différé, et pour la plupart **définitivement écarté** :

- **Les forfaits payants.** Le compteur de stockage est construit ; la
  facturation (paiement, TVA, factures, remboursements) est un chantier entier,
  et invendable tant que la rétention n'est pas prouvée. On ne vend pas un quota
  qu'on n'a jamais mesuré — mais on ne mesure pas pour vendre demain.
- **La reconnaissance de visages.** Écartée durablement : coût, dépendance à un
  fournisseur, et un risque disproportionné sur des photos d'enfants.
- **L'édition d'image** (recadrage, filtres, retouche). Le téléphone le fait
  mieux, et House n'a aucune raison de rentrer là.
- **Le partage hors du foyer** (lien public, album invité).
- **La déduplication perceptuelle** — repérer deux photos quasi identiques. Utile
  à gros volume, mais ça suppose des empreintes d'image et une file de calcul
  qu'on n'aura qu'après le lot 3.
- **Une application iOS native.** La synchronisation passe par un raccourci
  Shortcuts, qui couvre le besoin sans rien publier sur l'App Store.
- **La déduction de la zone depuis le GPS.** Le positionnement ne descend jamais
  au niveau de la pièce, et encore moins en intérieur. La zone restera un geste.

## Les quatre choses qui n'existent pas encore

Le chantier bute sur quatre manques réels, vérifiés dans le code au cadrage. Ils
expliquent l'ordre des lots :

1. **La galerie n'est pas paginée.** `DocumentViewSet` n'a pas de
   `pagination_class`, et il n'y a pas de `PAGE_SIZE` global : la liste complète
   du foyer part dans une seule réponse. C'est déjà signalé dans la fiche du
   module, et c'est le blocage n°1 — aucune feature d'import massif n'a de sens
   avant.
2. **La taille d'un fichier vit dans `metadata`.** Un quota est une agrégation ;
   `metadata` doit rester affiché, jamais requêté ni contraint. Il faut promouvoir
   `size_bytes` en colonne, comme `amount` / `kind` / `supplier` l'ont été sur
   `Interaction`.
3. **Il n'y a aucune infrastructure de tâches de fond.** Ni Celery, ni django-q,
   ni Redis. OCR, normalisation et vignettes tournent dans le thread de la requête
   HTTP — une « décision assumée en phase solo » que ce parcours révise.
4. **Les fichiers vivent sur le disque du serveur.** Servis par
   `X-Accel-Redirect` en production, par Django en auto-hébergement. Un album
   complet ne tient pas sur un volume de VPS, et migrer *après* le gros volume
   coûte beaucoup plus cher que de le décider avant.

## Une contrainte que ce chantier ne doit pas casser

House est auto-hébergeable depuis le parcours 28, et sa pile
`docker compose up` tient en trois conteneurs, sans Nginx et sans stockage
externe. Le stockage objet et la file de tâches doivent donc être des
**capacités déclarées et optionnelles**, sur le modèle de `PROTECTED_MEDIA_ACCEL`
— jamais des prérequis. Un foyer auto-hébergé qui range ses photos sur son propre
disque doit continuer de fonctionner sans compte S3 et sans conteneur
supplémentaire, avec pour seule contrepartie un traitement synchrone et un quota
adossé à son disque.
