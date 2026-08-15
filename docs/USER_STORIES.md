# Glossaire des user stories

> Le registre unique de ce que House **promet** à un foyer, story par story, et de
> ce qui le **prouve**. Il se complète module par module, au fil des parcours.

## À quoi ça sert

Une user story vit aujourd'hui dans trois endroits qui divergent : la doc produit
d'un parcours, l'issue GitHub d'un lot, et — parfois — un test. Trois copies d'une
même phrase finissent toujours par se contredire, et c'est alors l'utilisateur qui
arbitre. Ce fichier est **la** copie : la doc produit raconte *pourquoi*, l'issue
suit *l'avancement*, le glossaire dit *ce qui est promis et ce qui le vérifie*.

## Les trois règles

1. **Un identifiant stable, jamais réutilisé.** `<MODULE>-<NN>`, ex. `ORCH-04`. Une
   story supprimée garde sa ligne, barrée, avec la raison — un identifiant recyclé
   fait mentir tous les commits qui le citaient.
2. **Une story est vérifiée par un test Playwright qui cite son identifiant** dans
   son titre. Playwright, et pas un test unitaire : une user story est une promesse
   faite au foyer *à travers l'interface et jusqu'à la base*, et c'est la chaîne
   entière qui doit tenir. Les specs seedent par l'API avec le JWT du navigateur,
   puis pilotent l'UI — le test traverse donc le vrai backend.
3. **Une story qu'aucun test ne cite est marquée ⬜, jamais ✅.** Le tableau dit ce
   qui est prouvé, pas ce qu'on croit avoir fait.

> **État — c'est une direction, pas encore un contrat.** Le glossaire démarre avec
> le parcours 30 et se complétera module par module. Le jour où il couvre assez de
> surface pour qu'on s'y fie, il faudra le **tenir par un test** — une spec qui lit
> ce fichier, extrait les identifiants marqués ✅ et échoue si l'un d'eux n'apparaît
> dans le titre d'aucune spec. Sans ce contrôle il deviendra ce que devient toute
> documentation de couverture : un état des lieux d'il y a six mois qui a l'air
> d'être à jour. Tant que le test n'existe pas, **le tableau se relit à la main**,
> et une ligne ✅ n'engage que celui qui l'a écrite.

## Format d'une ligne

| Champ | Sens |
|---|---|
| **ID** | `<MODULE>-<NN>`, stable à vie |
| **Story** | « En tant que … je veux … afin de … », en une ligne |
| **Statut** | ✅ prouvé par un test · 🚧 livré, test manquant · ⬜ pas livré |
| **Preuve** | le fichier de spec, ou `—` |

## Relation avec `e2e/COVERAGE.md`

Les deux ne disent pas la même chose et ne doivent pas se recopier :
`e2e/COVERAGE.md` est une vue **par spec** (« que couvre `tasks.spec.ts` ? »), utile
quand on ouvre un fichier de test ; ce glossaire est une vue **par promesse**. Une
story peut traverser trois specs, une spec peut couvrir zéro story.

---

## Verger (`orchard`) — [parcours 30](parcours/PARCOURS_30_SUIVRE_LE_VERGER.md)

| ID | Story | Statut | Preuve |
|---|---|---|---|
| ORCH-01 | En tant que membre, je veux créer, modifier et supprimer les sujets de mon verger, afin de tenir le registre de ce que je possède | ✅ | `e2e/orchard.spec.ts` |
| ORCH-02 | En tant que membre, je veux que chaque sujet soit rattaché à une zone, afin de retrouver mon verger par l'endroit — et que supprimer une zone occupée me soit refusé plutôt que d'effacer l'historique | ✅ | `e2e/orchard.spec.ts` |
| ORCH-03 | En tant que membre, je veux consigner ce que je fais à un sujet (taille, traitement, observation), afin de m'en souvenir un an plus tard | ✅ | `e2e/orchard.spec.ts` |
| ORCH-04 | En tant que membre, je veux déclarer que « la taille d'hiver, c'est entre novembre et mars », afin de savoir en ouvrant l'app ce que la saison réclame | ✅ | `e2e/orchard-seasons.spec.ts` |
| ORCH-05 | En tant que membre, je veux transformer une règle échue en tâche datée, afin de la voir avec le reste de ce que j'ai à faire | ✅ | `e2e/orchard-seasons.spec.ts` |
| ORCH-06 | En tant que membre, je veux noter combien j'ai récolté et quand, afin de comparer les années | ✅ | `e2e/orchard-harvests.spec.ts` |
| ORCH-07 | En tant que membre, je veux voir ce que chaque sujet a donné année après année, afin de lire une production qui alterne naturellement | ✅ | `e2e/orchard-harvests.spec.ts` |
| ORCH-08 | En tant que membre, je veux être prévenu quand un gel menace des sujets en fleur, afin de pouvoir les protéger la veille | ⬜ | — |
| ORCH-09 | En tant que membre, je veux déclarer le prix d'achat d'un arbre, afin de suivre ce que mon verger m'a coûté sans double saisie | ⬜ | — |
| ORCH-10 | En tant que membre, je veux attacher des photos à un sujet, afin de le voir changer d'une année sur l'autre | ⬜ | — |
| ORCH-11 | En tant que membre, je veux voir l'essentiel du verger sur le dashboard, afin de ne pas rater une fenêtre saisonnière | ⬜ | — |
| ORCH-12 | En tant que membre, je veux interroger l'agent sur mon verger, afin d'obtenir des réponses citées sans naviguer | ⬜ | — |
| ORCH-13 | En tant que membre, je veux dicter « j'ai taillé le prunier » ou « note 12 kg de pommes », afin de consigner sans ouvrir l'app | ⬜ | — |
| ORCH-14 | En tant que membre non anglophone, je veux le module dans ma langue, afin de l'utiliser comme le reste de l'app | ⬜ | — |

> `ORCH-14` est la seule story de ce module **volontairement** hors Playwright : la
> parité des quatre catalogues et l'absence de `defaultValue` sont vérifiées
> statiquement par `ui/src/locales/keys.test.ts`, qui lit le *code* et pas un rendu.
> Un test navigateur ne dirait rien de plus et manquerait les clés jamais affichées.

---

## Modules antérieurs — à rétro-documenter

Les modules livrés avant l'existence de ce glossaire ont leurs user stories dans la
doc produit de leur parcours, et une couverture E2E décrite par spec dans
`e2e/COVERAGE.md`. Les rapatrier ici est un chantier à part : **ne pas les inventer
de mémoire**, les relire dans leur parcours d'origine.

Ordre suggéré, du plus couvert au moins couvert : tâches (parcours 03), zones
(05), projets (04), argent (08/21/25/26), poulailler (14), documents (02),
agent (07).
