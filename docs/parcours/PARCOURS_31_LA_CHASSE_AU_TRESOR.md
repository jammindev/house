# Parcours 31 — La chasse au trésor dans la maison

> Un jeu familial qui ne se joue pas dans l'app : il se joue **dans la maison**,
> et l'app n'est que l'arbitre. Le seul jeu que House puisse offrir et qu'aucune
> autre app ne peut copier, parce qu'il faut connaître les pièces.

- Fiche concept : [ANCRAGE_PHYSIQUE.md](../fiches/ANCRAGE_PHYSIQUE.md)
- Backlog technique : [PARCOURS_31_BACKLOG_TECHNIQUE.md](./PARCOURS_31_BACKLOG_TECHNIQUE.md)
- User stories : [USER_STORIES.md](../USER_STORIES.md) — `CHAS-01` à `CHAS-16`

## Résumé

> « Il pleut, les enfants tournent en rond, et je n'ai rien à leur proposer. »

House sait une chose qu'aucune autre application n'a : **la liste des pièces de
la maison**, nommées par le foyer, ordonnées comme il les habite. C'est un actif
dormant — il sert à ranger des tâches et des photos, jamais à faire quoi que ce
soit dans le monde physique.

Une chasse au trésor est une suite d'énigmes ; chaque énigme désigne une pièce ;
arriver dans la pièce donne l'énigme suivante ; la dernière révèle où est caché
le trésor. L'app compose le parcours, garde l'état, et **valide l'arrivée** —
parce qu'un jeu où l'on s'auto-déclare arrivé n'est plus un jeu au bout de trois
minutes. La validation passe par une **étiquette QR collée une fois pour toutes
dans chaque pièce**, scannée avec l'appareil photo du téléphone.

Le foyer joue avec **un seul téléphone qui passe de main en main**. C'est un
choix, pas une limite subie : il rend le jeu accessible aux enfants sans leur
créer de compte, et il transforme l'app en objet partagé le temps d'une partie au
lieu d'un écran de plus par personne.

## Positionnement produit

**Pourquoi maintenant.** Les modules livrés jusqu'ici répondent tous à une
obligation : ranger, payer, réparer, suivre. Aucun ne donne au foyer une raison
d'ouvrir l'app qui ne soit pas une corvée. Ce parcours est le premier qui ne rend
aucun service — et c'est le sujet.

**Ce qu'il faut dire honnêtement.** Une chasse au trésor est un **événement**,
quelques fois par an, pas une boucle quotidienne. Ce parcours n'achète pas de la
rétention par habitude ; il achète le fait que l'app ait fait, une fois, quelque
chose dont on se souvient. C'est un pari différent, et il ne doit pas être vendu
pour autre chose au moment de mesurer.

**La limite qu'il lève, elle, est durable.** Le lot 1 — l'étiquette QR par pièce —
n'est pas de l'infrastructure de jeu, c'est de l'**infrastructure de zone**. Une
fois les étiquettes posées, scanner celle du garage ouvre le garage dans l'app :
ce qui y est stocké, les tâches qui s'y rattachent, ses photos. Le jeu paie la
pose ; tout le reste du foyer l'amortit. Si le jeu ne prend pas, ce lot reste.

## Ce que l'utilisateur gagne

| Question | Aujourd'hui | Après |
|---|---|---|
| « On fait quoi, il pleut ? » | rien dans l'app | une chasse prête en deux minutes, énigmes comprises |
| « C'est quoi cette pièce dans l'app ? » | ouvrir l'app, chercher la zone | scanner l'étiquette de la porte |
| « Les enfants peuvent jouer ? » | non, pas de compte | oui, le téléphone circule — aucun compte requis |
| « J'ai pas d'idées d'énigmes » | en inventer douze | l'assistant les propose, on les relit et on corrige |
| « On refait celle de Noël ? » | tout ressaisir | rejouer, dans un ordre mélangé |

## Scénario de bout en bout

1. Un samedi de pluie, le ping du foyer propose : « journée dedans — une chasse
   au trésor ? »
2. Le parent ouvre l'app, choisit six pièces, demande les énigmes à l'assistant,
   en réécrit deux qui ne lui plaisent pas, tape « le trésor est dans le four
   éteint », et lance.
3. Il tend le téléphone au plus grand. L'écran affiche la première énigme.
4. Les enfants courent, trouvent la pièce, scannent l'étiquette collée derrière la
   porte avec l'appareil photo. L'app dit « trouvé ! » et affiche l'énigme
   suivante.
5. Une mauvaise pièce scannée répond « pas ici » — sans rien révéler, et sans
   faire avancer.
6. La sixième étiquette révèle le trésor. L'écran affiche la durée de la partie.

## Ce qu'on ne fait pas en V1

- **Pas de comptes enfants, pas de score individuel, pas de classement.** La
  chasse est une session de foyer. Qui a scanné n'est pas enregistré : le jour où
  on le fera, ça deviendra une compétition entre frères et sœurs, et ce n'est pas
  ce qu'on construit.
- **Pas de scanner intégré à l'app.** L'appareil photo natif ouvre l'URL du QR ;
  c'est suffisant, et un scanner in-app se heurterait à l'en-tête
  `Permissions-Policy: camera=()` posé par nginx en production (voir la fiche).
- **Pas de chasse à plusieurs téléphones en simultané.** Une seule chasse active
  par foyer, un seul appareil.
- **Pas d'indices photo, audio, ni de cadenas à code.** Du texte, rien d'autre.
- **Pas de chasse en extérieur ni de géolocalisation.** L'ancrage est une
  étiquette, pas un point GPS — c'est ce qui la rend jouable dans un couloir.
- **Pas d'historique de scores ni de statistiques.** Une durée de partie affichée
  à la fin, et c'est tout.
