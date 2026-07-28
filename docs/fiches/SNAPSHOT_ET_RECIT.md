# Instantané figé & récit tardif

> Comment House garde une mémoire de ses mois passés, et la raconte dans la langue
> du lecteur sans jamais réécrire l'histoire. Concept posé par le bilan budgétaire
> (parcours 21), généralisé par le récap mensuel
> ([parcours 27](../parcours/PARCOURS_27_LE_RECAP_MENSUEL_RACONTE.md)).
>
> Fiches connexes : [RAG.md](RAG.md) (l'autre façon de faire parler la mémoire, à la
> demande celle-là), [CARTOGRAPHIE_DEPENSES.md](CARTOGRAPHIE_DEPENSES.md) (les
> agrégats que l'instantané consomme).

## 1. Le problème

Une application qui accumule veut, à un moment, raconter ce qu'elle a accumulé :
« votre mois de juillet », « votre année ». Trois exigences se contredisent.

**On veut un chiffre stable.** « En juillet vous avez dépensé 1 240 € » doit dire la
même chose en septembre qu'au 1er août. Or les données bougent : on corrige une
dépense antidatée, on supprime un budget, on rattache une facture oubliée. Un récap
recalculé à chaque lecture **réécrit le passé** — et un passé qui change n'est pas une
mémoire, c'est une rumeur.

**On veut la langue du lecteur.** House sert quatre langues, et un foyer peut mêler
deux locales. Un récap stocké en français est faux pour la moitié de ses lecteurs.

**On veut que ça se lise.** Une liste de chiffres est juste et illisible. On aimerait
une prose chaleureuse — donc un LLM — sans faire dépendre un rendez-vous mensuel de la
disponibilité d'une API tierce, ni payer un appel à chaque affichage.

Ajoutez une quatrième contrainte, qui n'apparaît qu'au deuxième mois : le code va
changer. On ajoutera des chapitres, on renommera des choses. **Les instantanés déjà
figés doivent rester lisibles par le code de dans deux ans.**

## 2. Le concept en deux phrases

On sépare **ce qui est vrai** de **ce qui est dit** : à la clôture de la période, on
calcule une fois un instantané purement numérique, sans un mot de langue, et on le
gèle ; plus tard, à chaque lecture, on en dérive un texte dans la langue du lecteur.

Le texte est donc **toujours dérivable et jamais faisant foi** — ce qui permet de le
regénérer, de le traduire, ou de le confier à un LLM sans qu'aucun de ces trois
services ne devienne un maillon critique.

## 3. Comment on l'a appliqué dans house

Trois couches, deux instances.

**La couche « instantané » — figée une fois.** `BudgetReport(household, month, stats)`
avec une contrainte d'unicité sur `(household, month)`, et son pendant
`HouseholdRecap` pour le récap. `stats` est un JSON **sans un mot de langue** : des
nombres, des `str(Decimal)`, des noms propres saisis par l'utilisateur, des clés
techniques (`"state": "over"`). Le calcul vit dans `report/stats.py` et
`recap/chapters.py` ; il ne tourne **qu'une fois**, à la première demande du mois clos
(`get_or_generate_report`), et un create concurrent qui collisionne se contente de
relire — l'idempotence est portée par la contrainte, pas par un verrou.

**La couche « récit » — dérivée à la lecture.** `report/render.py` traduit
l'instantané en lignes localisées via `gettext`, appelé dans un
`translation.override(lang)`. C'est le **fond de secours permanent** : il n'appelle
rien, ne peut pas échouer, et existe dans les quatre langues.

**La couche « vernis » — optionnelle et sans pouvoir.** `report/polish.py` propose
l'instantané à Claude pour en faire un paragraphe chaleureux. S'il répond, on garde
son texte ; s'il échoue, est désactivé, ou n'a pas de clé, on garde le déterministe.
Le résultat est **mémoïsé par langue** dans `stats['_polished'][lang]`, ce qui borne
le coût à un appel par mois et par langue.

**Le registre de collecteurs.** Le récap ne code pas la liste de ses chapitres : chaque
module en déclare un (`ChapterSpec`), avec la clé du module qui le conditionne — le
même pattern que `agent.searchables`, `agent.writables`, `pings.REGISTRY` et
`digest.SECTION_SPECS`. Un collecteur est aveugle aux autres, et une exception dans
l'un ne coule pas le récap.

### La différence importante avec le digest

Le digest du parcours 19 partage le registre mais **pas** le contrat : ses collecteurs
renvoient des chaînes **déjà traduites** (`gettext` au moment de la collecte). C'est
correct pour lui — un digest est un message jetable, envoyé maintenant, à un
destinataire dont on connaît la langue, et jamais relu.

Un récap est l'inverse : persistant, relu, potentiellement par quelqu'un d'autre. Ses
collecteurs doivent donc rendre des **données**, pas des phrases. Le nommer
explicitement évite l'erreur naturelle qui consiste à copier le digest.

## 4. Pourquoi cette implémentation

**Geler, plutôt que recalculer avec les paramètres de l'époque.** L'alternative aurait
été de tout recalculer à la lecture. Elle est séduisante — pas de duplication, pas de
JSON à faire vivre — et elle est fausse : les plafonds de budget, les catégories, la
composition du foyer changent, et un mois d'il y a un an se relirait avec les règles
d'aujourd'hui. Le coût assumé est double : les corrections tardives n'entrent jamais
dans un bilan clos, et les chiffres existent en deux endroits (le vif et le gelé).

**Un instantané est un format public, donc on ne renomme jamais une clé.** On en
**ajoute**. Les remboursements du parcours 26 ont ajouté `refunded` / `net_spent` à
côté de `spent` sans y toucher, et les plafonds optionnels ont rendu `amount` nullable
— d'où la règle qui traverse tout `render.py` : accepter la string **et** le `null`,
pour toujours. Corollaire pour le récap : un chapitre ajouté plus tard n'apparaît pas
rétroactivement dans les mois déjà gelés, et le rendu doit tolérer un chapitre inconnu
comme un chapitre absent.

**Le déterministe part toujours ; l'IA n'a jamais le droit de bloquer.** C'est la même
règle que `releases.polish_descriptions` sur le changelog. Un rendez-vous mensuel qui
saute parce qu'un fournisseur a un incident coûte plus que la tiédeur d'un texte
gabarit. La conséquence à tenir en revue : `polish_*` renvoie `None` sur **toute**
anomalie, jamais une exception, et l'appelant ne sait même pas qu'il y a eu une
tentative.

**L'instantané ne recalcule pas ce qu'un autre écran affiche.** Le chapitre Argent du
récap lit le `BudgetReport` déjà gelé au lieu de resommer les dépenses du mois. C'est
l'application directe de la règle transverse du projet : *un compteur ne peut pas avoir
deux définitions.* Deux sommes écrites indépendamment finissent par diverger d'un
centime d'arrondi ou d'une borne de fuseau, et deux écrans qui se contredisent perdent
tous les deux leur crédit.

**Un instantané de foyer ne peut pas contenir de données à visibilité variable.**
Le digest peut filtrer les tâches privées selon son destinataire, parce qu'il est
composé pour lui. Un instantané est gelé **une fois pour le foyer** et lu par tous ses
membres : tout ce qui n'est pas visible par tout le monde doit être exclu du calcul,
pas masqué à l'affichage. C'est le piège le plus facile à tomber en copiant un
collecteur de digest.

## 5. Ce qu'on a écarté et pourquoi

**Stocker la prose au lieu des chiffres.** Le plus simple : générer le texte une fois,
le sauver, l'afficher. Écarté parce qu'il fige la langue — un texte français est un
cul-de-sac pour un membre germanophone — et parce qu'il rend le texte faisant foi :
plus aucun moyen d'améliorer un rendu maladroit sur l'historique, ni de vérifier qu'un
chiffre cité est le bon.

**Tout recalculer à la lecture** (« pas de dénormalisation »). Voir plus haut : c'est
la bonne règle pour un solde bancaire ou un « dépensé » du mois courant — que House
calcule effectivement à la lecture, exprès — et la mauvaise pour une période **close**.
La ligne de partage est la clôture : avant, on veut la vérité du moment ; après, on
veut la mémoire.

**Un journal d'événements (event sourcing).** Reconstruire n'importe quel mois en
rejouant les écritures serait plus puissant, et hors de proportion : il faudrait
capturer chaque mutation de trente-trois modules pour produire douze pages par an.

**Un appel LLM à chaque affichage.** Écarté pour le coût, mais surtout pour la
stabilité : le même mois se raconterait différemment à chaque visite, ce qui ruine
exactement la propriété qu'on cherchait — un souvenir qui ne bouge pas. D'où la
mémoïsation par langue.

**Laisser chaque module écrire son propre récap.** Écarté : quatre modules qui rendent
chacun leur page produisent quatre mises en page, quatre définitions du mois et aucun
récit. Le registre impose un contrat unique et laisse la mise en scène à un seul
endroit.

## 6. Pour aller plus loin

- [Django `JSONField`](https://docs.djangoproject.com/en/stable/topics/db/queries/#querying-jsonfield)
  — les limites du requêtage sur JSON, et pourquoi ce qu'on filtre finit en colonne
  (voir `CARTOGRAPHIE_DEPENSES.md`).
- [Django translation — `override`](https://docs.djangoproject.com/en/stable/topics/i18n/translation/#django.utils.translation.override)
  — composer dans la langue d'un destinataire hors cycle requête/réponse.
- [Martin Fowler — *Snapshot*](https://martinfowler.com/eaaDev/Snapshot.html) et
  [*Event Sourcing*](https://martinfowler.com/eaaDev/EventSourcing.html) — les deux
  approches de la mémoire temporelle, et ce que coûte la seconde.
- [Point-in-time / slowly changing dimensions](https://en.wikipedia.org/wiki/Slowly_changing_dimension)
  — le même problème en entrepôt de données : conserver la vérité telle qu'elle était.
