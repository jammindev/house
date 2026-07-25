# Parcours 25 — Les relevés bancaires comme source de vérité des dépenses

Ce document détaille le vingt-cinquième parcours métier de House.

Il s'appuie sur le socle dépenses du parcours 08, sur les budgets et récurrences du parcours 21, et retourne leur hypothèse de départ : la dépense cesse d'être une déclaration pour devenir un fait constaté.

- Fiche concept : [IMPORT_ET_RAPPROCHEMENT.md](../fiches/IMPORT_ET_RAPPROCHEMENT.md)
- Backlog technique : [PARCOURS_25_BACKLOG_TECHNIQUE.md](./PARCOURS_25_BACKLOG_TECHNIQUE.md)
- Cartographie de l'existant : [CARTOGRAPHIE_DEPENSES.md](../fiches/CARTOGRAPHIE_DEPENSES.md)

## Résumé

Le vingt-cinquième usage fondamental du produit est le suivant :

> « Je saisis mes achats dans l'app, mais je ne sais pas si ça couvre vraiment ce qui sort de mon compte. »

Aujourd'hui, une dépense n'existe dans House que si quelqu'un a pensé à la saisir. C'est vrai pour les achats de stock, d'équipement, de projet, de poule, comme pour les dépenses manuelles. Le journal est donc **structurellement incomplet**, et rien ne le confronte jamais à la réalité du compte en banque. L'utilisateur voit « 340 € dépensés ce mois-ci » et n'a aucun moyen de savoir si le vrai chiffre est 340 € ou 900 €.

Ce parcours inverse le sens de la vérité. L'utilisateur dépose l'export de sa banque ; **chaque ligne du relevé devient une dépense** (ou une recette). Il ne saisit plus, il **qualifie** : à quel budget, à quelle pièce, à quel projet appartient cette ligne. Une ligne peut être **ventilée** en plusieurs postes — 120 € au supermarché, c'est 80 € de courses et 40 € de bricolage.

Les achats saisis directement dans l'app ne disparaissent pas pour autant. Ils restent le geste naturel au moment de l'achat, et le **rapprochement automatique** les colle à leur ligne bancaire quand le relevé arrive, quelques jours plus tard. Rien n'est compté deux fois.

Enfin, House suit le **solde** de chaque compte, y compris celui des espèces. Le solde n'est pas un confort : c'est le contrôle qui prouve que l'import est juste.

## Positionnement produit

Le parcours 08 a posé les dépenses, le parcours 21 leur a donné des enveloppes (budgets) et un rythme (récurrences). Les deux reposent sur la même hypothèse : *l'utilisateur saisit ce qu'il dépense*. C'est cette hypothèse qui plafonne aujourd'hui la valeur du module — un budget « Courses » à 400 € ne veut rien dire si la moitié des courses n'a jamais été saisie.

Le parcours 25 lève ce plafond. Il ne remplace pas les budgets : il les **alimente enfin avec des données complètes**. Un budget devient un vrai plafond, un dépassement devient un vrai signal, et le bilan mensuel cesse d'être une estimation optimiste.

C'est aussi le premier parcours où House cesse d'être uniquement un lieu de saisie pour devenir un lieu de **réconciliation** — la même bascule que le parcours 10 a opérée pour l'électricité, où l'import du fichier Enedis a remplacé le relevé de compteur à la main.

## Concept interne

Trois concepts nouveaux, portés par une nouvelle app `apps/banking/`.

### Compte (`BankAccount`)

Un compte du foyer : un nom (« Compte joint »), une banque, une devise, et un **type** — `bank` pour un compte bancaire, `cash` pour les espèces. Il porte son **solde d'ouverture** (montant + date), qui sert de point de départ au calcul du solde, ainsi que le **mapping de colonnes mémorisé** de sa banque : on décrit le format une seule fois, pas à chaque import.

L'utilisateur a deux banques : ce sont deux comptes. Rien dans le code ne connaît le nom d'une banque en particulier.

### Import de relevé (`StatementImport`)

La trace d'un dépôt de fichier : le format détecté, le nom du fichier, le nombre de lignes créées, ignorées, rapprochées automatiquement, et l'erreur éventuelle. Un import qui échoue ne casse rien et n'écrit rien — il se raconte.

Réimporter le même fichier ne crée aucun doublon. Importer deux fichiers qui se chevauchent (janvier, puis janvier-février) ne crée que les lignes réellement nouvelles.

### Ligne bancaire (`BankTransaction`)

Une ligne de relevé : une date, un libellé brut **jamais réécrit**, un montant **signé** (négatif = sortie), et le solde du compte après l'opération quand la banque l'exporte. Elle est **immuable** dans son fond : c'est le relevé, on ne le corrige pas.

Ce qu'on peut faire d'une ligne, en revanche, c'est la **qualifier** — la marquer comme mouvement interne (retrait, virement entre les deux banques), lui ajouter une note — et surtout la **ventiler**.

### La ventilation — le point clé

**Une dépense de House est une part de ligne bancaire.** Une ligne de 120 € ventilée en 80 € de courses et 40 € de bricolage produit **deux dépenses**, chacune avec son budget, sa pièce, ses documents — et toutes deux rattachées à la même ligne.

C'est ce qui permet au split d'exister sans rien casser : une dépense reste ce qu'elle a toujours été dans House (un fait daté du journal, cherchable par l'agent, comptée dans le coût d'un projet). On lui ajoute seulement un lien vers la ligne bancaire qui la justifie.

## Concept visible côté utilisateur

Le vocabulaire de l'interface :

- vue principale : `Comptes`
- l'objet : `Compte` (`Compte bancaire` / `Espèces`)
- le geste d'entrée : `Importer un relevé`
- une ligne : `Opération` (jamais « transaction », trop technique)
- le geste central : `Ventiler` (« Ventiler cette opération »)
- le lien avec un achat déjà saisi : `Rapprocher`
- l'indicateur de complétude : `X % de vos sorties sont ventilées`

Les mots « rapprochement bancaire », « déduplication » et « allocation » restent internes. L'utilisateur *range ses opérations*.

## Objectif produit

Permettre à un membre du foyer de :

1. déclarer ses comptes, banques et espèces, avec leur solde de départ
2. déposer un export de sa banque (CSV ou Excel) et voir ses opérations apparaître, sans jamais créer de doublon même en réimportant
3. décrire le format de sa banque **une seule fois** — les imports suivants sont un simple glisser-déposer
4. ventiler une opération en un ou plusieurs postes, chacun avec son budget et sa pièce
5. voir ses achats saisis dans l'app se rapprocher automatiquement de la ligne bancaire correspondante, et arbitrer les cas douteux
6. suivre le solde de chaque compte, et être averti quand la chaîne des relevés est rompue
7. distinguer ses recettes de ses dépenses, et exclure les mouvements internes des deux
8. gérer ses dépenses en espèces, alimentées par ses retraits

## Ce que le projet a déjà aujourd'hui

- **Un pattern d'import générique complet et testé** ([apps/electricity/importers/](../../apps/electricity/importers/)) — `BaseImporter` abstrait, registry de formats, adaptateur `generic_csv` avec mapping de colonnes fourni par l'utilisateur. C'est exactement l'architecture multi-banques recherchée : elle sera décalquée, pas réinventée.
- **Un service d'import idempotent de référence** ([apps/electricity/services.py](../../apps/electricity/services.py)) — validation intégrale du fichier avant toute écriture, déduplication sur clé naturelle, trace d'import qui raconte les échecs sans faire échouer la requête.
- **Les dépenses en colonnes réelles** ([apps/interactions/queries.py](../../apps/interactions/queries.py)) — `amount`, `kind` et `supplier` sont des vraies colonnes depuis le refactor de juillet 2026, et les quatre agrégations passent par un helper unique. Sans ce travail préalable, ce parcours aurait coûté le double.
- **Les budgets et leurs enveloppes** ([apps/budget/](../../apps/budget/)) — le rattachement dépense → budget existe déjà en FK ; la ventilation le réutilise tel quel.
- **Le socle multi-tenant, le pattern feature frontend et l'agent extensible** — inchangés.

Ce qui n'existe pas encore : aucune notion de compte, aucune notion de recette (zéro occurrence dans le code), aucun moyen de ventiler une dépense sur plusieurs budgets.

## Problème utilisateur précis

Quand l'utilisateur se demande « où est passé mon argent ce mois-ci », il doit aujourd'hui :

- ouvrir l'app de sa banque **et** House, et comparer de tête
- accepter que le total de House soit faux, sans savoir de combien
- renoncer à classer une dépense mixte : un passage en caisse à 120 € tombe entièrement dans un seul budget, ou dans aucun
- ressaisir dans House ce qu'il vient déjà de voir sur son relevé

House connaît déjà les pièces, les projets, les équipements et les budgets. Ce qui lui manque, c'est **la liste exhaustive de ce qui est réellement sorti du compte** — et c'est précisément ce qu'une banque sait exporter en trois clics.

## Ce que l'utilisateur gagne

| Question | Aujourd'hui | Après |
|---|---|---|
| Combien j'ai dépensé ce mois-ci ? | Le total de ce que j'ai pensé à saisir | Le total réel, avec le % restant à qualifier |
| Ces 120 € au supermarché, c'est quel budget ? | Un seul budget, ou aucun | 80 € Courses + 40 € Bricolage |
| Mon budget Courses est-il tenu ? | Indicatif — dépend de ma discipline de saisie | Fiable |
| Combien il me reste sur le compte joint ? | House ne sait pas | Le solde, et une alerte si un relevé manque |
| Combien j'ai en liquide ? | House ne sait pas | Le solde espèces, alimenté par mes retraits |
| Combien ce projet m'a vraiment coûté ? | Les achats que j'ai saisis | Idem, plus les lignes bancaires que je lui rattache |
| Est-ce que j'ai reçu le remboursement ? | Aucune trace des entrées d'argent | Les recettes sont listées |

## Ce qu'on ne fait pas en V1

Explicitement différé, et assumé :

- **L'import PDF et photo.** Demandé au départ, mais les deux banques du foyer exportent du CSV ou de l'Excel — le besoin n'est donc pas bloquant. Le pipeline de vision existe déjà pour les documents ; il lui manque un extracteur qui rende du **JSON structuré** plutôt que du texte brut, et une exécution hors requête HTTP (un relevé PDF de dix pages, c'est dix appels au modèle). Cadré comme lot différé.
- **Les formats bancaires normalisés (OFX, QIF, CAMT.053).** Ils porteraient un identifiant de transaction natif, donc une déduplication exacte plutôt qu'heuristique. À reconsidérer si une banque les propose.
- **La catégorisation apprise.** Reconnaître que `CB LECLERC` va toujours dans « Courses » et pré-remplir la ventilation. C'est le confort qui décidera de l'usage à long terme, mais il n'a de sens qu'une fois le socle éprouvé sur des données réelles.
- **Les remboursements rattachés à leur dépense d'origine.** Un retour de marchandise ou un remboursement de mutuelle apparaît en V1 comme une recette, sans lien avec la dépense qu'il annule.
- **Le multi-devises.** Un compte a une devise ; on ne convertit pas.
- **La synchronisation bancaire automatique** (agrégateurs type DSP2). Hors sujet : House reste une app locale sans intermédiaire financier.

## Limites structurelles assumées

Deux limites méritent d'être écrites avant de commencer, parce qu'elles sont des conséquences directes des choix ci-dessus.

**Le suivi de solde impose la continuité.** Si l'utilisateur saute un relevé, le solde dérive. House ne peut pas l'inventer — mais il peut le **détecter** et le dire, ce qu'il fera. Un solde faux affiché avec aplomb serait pire que pas de solde du tout.

**Le total « banque » et le total « dépenses » ne s'additionnent jamais.** Ce sont deux vues du même argent : ce qui est sorti du compte, et ce que l'utilisateur a rangé dans ses budgets. Tant que tout n'est pas ventilé, les deux diffèrent — et c'est normal. Le pont entre eux est le **taux de couverture**, pas une somme.
