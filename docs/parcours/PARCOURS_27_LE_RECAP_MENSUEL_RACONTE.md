# Parcours 27 — Le récap mensuel raconté

Ce document détaille le vingt-septième parcours à travailler dans House.

Il s'appuie sur les vingt-six parcours précédents, et surtout sur ce qu'ils ont
accumulé : trente-trois modules qui enregistrent, chaque jour, ce que fait le foyer.
Ce parcours est le premier qui ne demande **rien de nouveau** à l'utilisateur — il ne
fait que lui rendre ce qu'il a déjà donné.

- Doc technique : [PARCOURS_27_BACKLOG_TECHNIQUE.md](./PARCOURS_27_BACKLOG_TECHNIQUE.md)
- Fiche concept : [../fiches/SNAPSHOT_ET_RECIT.md](../fiches/SNAPSHOT_ET_RECIT.md)

## Résumé

Le vingt-septième usage fondamental du produit est le suivant :

> « Je saisis, je saisis, je saisis — et je ne vois jamais rien revenir. »

House est devenu un excellent outil de gestion et un piètre compagnon. Chaque module
demande quelque chose : note tes œufs, importe ton relevé, coche ta tâche, relève ton
compteur. Aucun ne raconte jamais ce que tout ça donne. L'application est
**entièrement tournée vers le devoir**, et un devoir, on l'ouvre par obligation.

Ce parcours introduit le **récap** : une fois par mois, le foyer reçoit son mois
raconté. Pas un tableau — une **suite de cartes qu'on fait défiler**, une idée par
écran, un gros chiffre et une phrase.

> En juillet, vos poules ont pondu **112 œufs** — 18 de plus qu'en juin.
> Vous avez dépensé **12 % de moins** en courses.
> Le chantier salle de bain a avancé de **3 tâches**.
> Et vous avez ajouté **27 photos**.

Le mécanisme n'est pas neuf dans House : le bilan budgétaire du parcours 21 fait déjà
exactement ça, sur l'argent seul, et il le fait bien — un instantané chiffré figé à la
clôture du mois, une prose rendue plus tard dans la langue du lecteur, un vernis IA
optionnel par-dessus. Ce parcours **élargit ce bilan d'argent en récit de foyer** :
un chapitre par module au lieu d'un seul, et une forme qui donne envie de le lire.

## Positionnement produit

Les parcours 01 à 26 ont construit une mémoire, l'ont rendue interrogeable
(parcours 07), puis fiable (parcours 26). House sait aujourd'hui **répondre** quand on
lui demande. Il ne sait pas encore **parler sans qu'on lui demande** — sauf pour
signaler un devoir : une tâche en retard, un stock bas, une anomalie électrique, un
écart de conformité. Le digest du parcours 19 est proactif, mais il est proactif
*sur des reproches*.

Le récap est la première parole gratifiante de l'application. Il lève une limite qui
n'est pas technique mais affective : **rien, dans House, ne récompense jamais d'avoir
tenu ses données à jour.** Or c'est précisément l'effort le plus coûteux et le plus
fragile du produit. Un foyer qui voit son mois raconté a une raison de continuer à
noter ses œufs en février.

C'est aussi le meilleur rendement du projet à ce stade : les chiffres existent déjà,
les agrégats sont écrits, le rendez-vous mensuel est câblé, le repolissage IA est en
place. Presque tout le travail consiste à **composer** ce qui est là et à lui donner
une forme qu'on a envie de regarder.

### Ce que le récap n'est pas

Il ne mesure personne. Un récap de foyer dit « vous », jamais « toi plus que lui » :
aucun chiffre n'est ventilé par membre, et il n'y a ni classement, ni score, ni badge.
Chiffrer que l'un en a fait moins que l'autre serait la seule façon certaine de
transformer un moment de fierté en dispute — et la personne qui perd désinstalle.
C'est une contrainte de conception, pas une préférence : elle est tenue par un test.

## Ce que l'utilisateur gagne

| Question | Aujourd'hui | Après |
|---|---|---|
| « Qu'est-ce qu'on a fait ce mois-ci ? » | Nulle part. Il faudrait ouvrir six écrans et comparer soi-même. | Une story de cinq cartes, le 1er du mois. |
| « Est-ce que noter les œufs sert à quelque chose ? » | Aucun retour. La donnée entre et ne ressort jamais. | « 112 œufs en juillet, votre meilleur mois. » |
| « On avance, sur la salle de bain ? » | Le détail projet donne un état, pas une progression. | « 3 tâches terminées ce mois-ci. » |
| « On a dépensé plus ou moins que d'habitude ? » | `/app/money/reports` le dit — en un paragraphe gris qu'on ne relit pas. | La même vérité, en un chiffre qu'on voit. |
| « Il s'est passé quoi, en juillet ? » | Rien ne s'en souvient à la maille du mois. | Un historique de récaps, un par mois. |

## Comment ça se présente

Une **story** : des cartes plein écran qu'on fait défiler une par une, comme un
carrousel. Une carte = une idée = un gros chiffre + une phrase courte. Cinq à huit
cartes, jamais plus — un récap qui demande de la patience n'est plus un cadeau.

Le récap se trouve tout seul : le 1er du mois, une carte apparaît sur le dashboard
(« Juillet est prêt »), et un message part sur Telegram pour ceux qui l'ont activé.
Ce message est un **teaser avec un lien**, pas le récap entier : une story se regarde,
elle ne se lit pas dans un fil de discussion.

Les mois précédents restent consultables. On ne « rejoue » pas la story de mars —
l'historique est une liste sobre, et c'est la story du mois qui vient de se clore qui
a droit à la mise en scène.

### Les chapitres de la V1

1. **Argent** — total dépensé, tendance contre le mois précédent, budgets tenus ou
   dépassés, plus grosse dépense. Entièrement adossé au bilan budgétaire déjà figé.
2. **Ce qu'on a accompli** — tâches terminées par le foyer, avancement des chantiers.
3. **La maison** — œufs pondus, consommation d'électricité et d'eau, avec leur
   tendance.
4. **Souvenirs** — les photos ajoutées dans le mois, en mosaïque.

Un chapitre dont le module est désactivé n'existe pas — il n'apparaît pas vide. Un
foyer sans poules n'a pas de carte œufs, et personne ne lui explique qu'il pourrait
en avoir.

## Ce qu'on ne fait pas en V1

- **Aucun partage hors du foyer.** Ni lien public, ni export image. Le récap contient
  des montants, des noms de pièces, des photos de l'intérieur ; ouvrir cette porte
  demande un cadrage de sécurité à part, et on ne sait pas encore quelles cartes
  valent vraiment le coup d'être montrées. On l'apprendra en regardant lesquelles
  sont revues.
- **Pas de bilan annuel.** C'est le vrai moment « Wrapped », et il est tentant — mais
  il obligerait chaque chapitre à savoir agréger sur douze mois autant que sur un,
  et à valider cette seconde échelle sans aucun recul d'usage sur la première. Douze
  rendez-vous par an suffisent à installer l'habitude.
- **Pas de récap hebdomadaire.** Une semaine de foyer contient rarement une histoire,
  et un récap qui dit peu use le rendez-vous.
- **Pas de réactions ni de commentaires** sur les cartes. C'est le chantier voisin
  (le fil du foyer), et il mérite son propre parcours.
- **Pas de rattrapage historique.** Le récap commence au premier mois qui se clôt
  après la livraison. Reconstruire des mois anciens produirait des récaps pauvres et
  faux — les données des premiers mois du foyer sont incomplètes par nature.
- **Pas de choix de cartes par l'utilisateur** au-delà de couper un chapitre entier.
  Une story qu'on configure n'est plus une surprise.
