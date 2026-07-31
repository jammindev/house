# Contribuer à Maisonnée

*English version: [CONTRIBUTING.md](CONTRIBUTING.md)*

Merci d'être là. Quelques points avant d'y passer du temps.

## Ce qu'est ce projet, et ce qu'il n'est pas

Maisonnée est un système d'exploitation du foyer : argent, tâches, documents,
compteurs, équipements, chantiers — et les poules. Il a été écrit pour la vie
réelle d'une famille, pas pour un marché. Ça décide de ce qui est accepté.

Il est maintenu par **une seule personne**, à côté d'un travail à plein temps.
Attends des réponses réfléchies, pas rapides.

## Avant d'écrire du code : ouvre une issue

**Ouvre une issue avant de commencer**, pour tout ce qui dépasse une faute de
frappe ou un bug évident.

Ce n'est pas de la bureaucratie. Refuser une PR sur laquelle quelqu'un a passé un
week-end est franchement désagréable, et ça arrive quand la feature ne colle pas à
une direction qui n'avait jamais été écrite. Cinq lignes d'issue d'abord évitent
ça.

Attends une réponse franche, y compris un « non » motivé. Un non ne juge pas
l'idée — il veut généralement dire une chose de plus à maintenir pendant dix ans.

## Faire tourner le projet

> **Le `docker compose up` en une commande est en cours de construction** et
> n'existe pas encore. En attendant, l'installation de développement ci-dessous
> est le seul chemin supporté.

En développement (Django sur `:8001`, Vite sur `:5174`) :

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements/dev.txt
npm install
python manage.py runserver 8001
npm run dev
```

## Lancer les tests

Les trois doivent être verts avant qu'une PR soit revue :

```bash
pytest                              # backend, ~4000 tests
npm run lint                        # ESLint sur ui/src
npx tsc -b ui/tsconfig.json         # typecheck
```

Les tests E2E ont besoin du serveur Django sur `:8001` :

```bash
npm run test:e2e
```

## Les règles qui reviendront en revue

Ce ne sont pas des préférences de style. Chacune existe parce que quelque chose a
cassé en production, et chacune est tenue par un test.

- **Jamais de `defaultValue` dans un `t()`.** Une clé manquante doit s'afficher
  brute, pas passer pour de l'anglais acceptable. Toute clé existe dans les quatre
  catalogues (`ui/src/locales/keys.test.ts`).
- **Jamais de couleur Tailwind fixe.** Les tokens du design-system (`bg-card`,
  `text-muted-foreground`, `border-border`…), jamais `bg-white`.
- **Jamais d'`<input type="number">` pour un décimal.** `DecimalInput`. Taper
  « 12,5 » au clavier français donnait **512 €** sur un moteur et **5 €** sur un
  autre — un montant faux enregistré sans un mot.
- **Jamais de `toISOString()` pour une date de calendrier.** `toLocalISODate` /
  `todayISO` : le passage en UTC recule d'un jour tout ce qui se produit entre
  minuit et 2 h.
- **Une mutation vit dans le `hooks.ts` de sa feature**, et son `onSuccess`
  déclare la racine écrite, pas la liste des caches.
- **L'argent se lit par `interactions.queries.expenses()`.** Jamais un cast JSON
  pour sommer un montant.

Le raisonnement complet — avec le bug qui l'a causé — est dans
[`CLAUDE.md`](CLAUDE.md).

## Commits

```
<type>(<scope>): <description>
```

`feat`, `fix` et `perf` apparaissent dans le changelog ; `refactor`, `chore`,
`docs`, `test`, `ci`, `build`, `style` sont internes. **Toujours un scope** — le
module concerné, qui devient le filtre de l'entrée.

## Signe tes commits (DCO)

Ce projet utilise le [Developer Certificate of Origin](https://developercertificate.org/)
plutôt qu'un CLA. Tu gardes ton copyright ; tu attestes simplement avoir le droit
de proposer ce code :

```bash
git commit -s -m "fix(tasks): ..."
```

Pas de CLA, délibérément : céder des droits est un coût réel pour un contributeur,
et ça n'achèterait que la possibilité de relicencier plus tard — une option
lointaine contre une friction immédiate.

## Licence

Maisonnée est en **AGPL-3.0-only**. Les contributions sont acceptées sous cette
licence.

Concrètement : tu peux l'utiliser, le modifier et le partager librement, y compris
pour ton propre foyer. Si tu *héberges une version modifiée pour d'autres
personnes*, tu dois publier tes modifications. S'auto-héberger pour sa famille
n'est pas « héberger pour d'autres » — c'est l'usage normal de ce logiciel.

**Le nom et le logo ne sont pas couverts par la licence.** Le code est libre,
l'identité non. Un fork qui n'est pas ce projet doit porter son propre nom.

## Sécurité

Pas d'issue publique pour une vulnérabilité. Voir [SECURITY.md](SECURITY.md).

## Un mot sur les droits d'écriture

Le déploiement de production tourne sur le serveur du mainteneur, déclenché par
les push sur `main`. **Un accès write à ce dépôt est donc un accès shell à cette
machine** — d'où le passage par fork et pull request, qui est de toute façon le
fonctionnement normal d'un projet open source. Rien de personnel : c'est une
propriété de l'installation.
