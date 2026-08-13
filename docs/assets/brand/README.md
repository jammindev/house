# La marque Maisonnée

## Ce que la licence couvre, et ce qu'elle ne couvre pas

Le code de ce dépôt est sous **AGPL-3.0** : il se copie, se modifie et se
redistribue librement, y compris pour en faire autre chose.

**Le nom « Maisonnée » et le signe de ce dossier ne sont pas couverts par cette
licence.** Une licence de logiciel libre porte sur du logiciel ; elle n'a jamais
transféré de marque, et l'AGPL ne fait pas exception (voir son § 7e, qui autorise
explicitement à refuser l'usage des noms et marques des auteurs).

Concrètement, et sans piège :

- **Vous pouvez** utiliser le nom et le signe pour *parler* de Maisonnée : un
  billet, une capture, un tutoriel, un paquet communautaire qui installe
  Maisonnée, une liste de logiciels auto-hébergeables.
- **Vous pouvez** faire tourner Maisonnée chez vous, la modifier, y ajouter ce
  que vous voulez, sans rien changer au nom : c'est du logiciel qui tourne chez
  vous, pas une redistribution.
- **Un fork redistribué doit se renommer.** Si vous publiez une version modifiée
  pour que d'autres l'installent, elle ne peut pas se présenter comme
  Maisonnée — changez le nom, le signe, et l'aperçu social. Ce n'est pas une
  chicane juridique : quelqu'un qui installe « Maisonnée » et rencontre un bug
  ouvrira une issue **ici**, et personne n'y pourra rien.
- **Pas d'usage qui suggère un adossement.** Ne présentez pas votre produit,
  service ou offre d'hébergement comme officiel, approuvé, ou « propulsé par
  l'équipe Maisonnée » : il n'y a pas d'équipe, et l'ambiguïté se paierait en
  confiance des utilisateurs.

En cas de doute, demandez — l'auteur répond, et l'intention n'est pas de dire
non.

## Les fichiers

| Fichier | Usage |
|---|---|
| `logo-mark.svg` | Le signe seul, en `currentColor`. C'est la source. |
| `logo.svg` | Signe + mot, en bloc horizontal. |
| `logo-wordmark.svg` | Le mot seul. |
| `social-preview.png` | 1280×640, l'aperçu GitHub / Slack / Mastodon. |

Les icônes dérivées vivent ailleurs, parce qu'elles sont servies par l'app :
`static/icons/` (PWA, apple-touch, favicon). Elles se **régénèrent** depuis
`logo-mark.svg` — voir « Régénérer les icônes » plus bas.

## Le signe

Un abri, et dans l'abri un vide en forme de feuille. La masse est ce que le foyer
tient ; le vide est la place qu'il laisse à ce qui pousse.

**Pourquoi pas une maison.** « Maisonnée » désigne les *gens*, pas le bâti — c'est
ce que l'app modélise depuis le premier jour (`Household`, `HouseholdMember`) — et
les modules potager et élevage arrivent. Un toit, des murs et une cheminée
auraient dit l'inverse du nom, et auraient enfermé le produit dans le dedans.

**Deux contraintes ont dicté le dessin, pas le goût.**

1. **16 px.** À cette taille on ne lit qu'une silhouette et, au mieux, une
   contre-forme. Tout dessin à trois éléments ou plus se referme en tache. D'où
   un seul tracé et une seule règle de remplissage (`evenodd`).
2. **17 thèmes.** `ui/src/styles/themes.css` laisse l'utilisateur choisir la
   couleur de l'interface. Une marque adossée à `--primary` serait donc repeinte
   par le thème du foyer : verte chez l'un, violette chez l'autre. Ce n'est plus
   une marque. `logo-mark.svg` n'a par conséquent **aucune couleur** et hérite de
   celle du texte autour.

### Ce qui a été essayé et écarté

Gardé ici parce que ces essais sont la raison du dessin final, et qu'un
successeur qui les ignore les refera.

| Piste | Pourquoi non |
|---|---|
| Arche tracée + feuille pleine à l'intérieur | Se lit comme un **cadenas** à toutes les tailles, et la feuille percutait le jambage droit. |
| Canopée large + feuille posée au sol | Les deux formes ne se parlent pas ; la feuille n'est plus qu'un grain à 16 px. |
| Une feuille seule avec sa nervure | Le plus joli en grand, mais ça dit « application de plantes », pas « foyer ». La nervure claire imposait en plus une couleur en dur, donc cassait le fond sombre. |
| Dôme + trois montants (les membres du foyer) | Le plus juste sur le concept, illisible en pratique : à 16 px les montants sont à 2,7 px l'un de l'autre et fusionnent. |
| Dôme plein échancré d'un passage | Belle silhouette, mais purement de l'abri : rien n'y accueille le dehors. |

Le dessin retenu est le dernier de cette liste **dont on a fait du vide une
feuille** : la silhouette forte est conservée, et la contre-forme porte enfin le
dehors.

## La couleur de marque

`#3F5741` — un vert mousse sombre.

**Elle n'apparaît que là où le thème du foyer ne va jamais** : favicon, icônes
PWA, `theme_color` du manifeste, aperçu social, README. Dans l'interface, le
signe est en `currentColor` et n'a pas de couleur propre.

Ne pas l'ajouter à `themes.css`. Si une couleur de marque doit un jour exister
dans l'app, elle passera par un token dédié (`--brand`), indépendant de
`--primary` — sinon on réintroduit exactement le défaut que ce lot corrige.

## Régénérer les icônes

Les PNG de `static/icons/` sont rendus depuis `logo-mark.svg` dans un navigateur
(canvas), et non par un outil de rastérisation installé sur la machine : c'est le
même moteur qui les affichera, et c'est le seul moyen de *vérifier* la lisibilité
à 16 px au lieu de la supposer.

La procédure et le harnais de rendu sont dans
[`docs/assets/brand/regenerate-icons.md`](./regenerate-icons.md).

Deux règles à ne pas perdre :

- **`any` et `maskable` sont deux fichiers distincts.** Ils l'étaient déjà dans
  le manifeste avant ce lot… mais pointaient le même PNG, avec
  `"purpose": "any maskable"`. Android rogne jusqu'à 20 % de chaque bord d'une
  icône `maskable` : il rognait donc *dans le dessin*. La variante `maskable`
  remplit le carré et garde le signe dans les 56 % centraux.
- **Le signe ne descend pas sous 16 px.** En dessous, la contre-forme se comble
  et il ne reste qu'une tache : mieux vaut afficher le mot.
