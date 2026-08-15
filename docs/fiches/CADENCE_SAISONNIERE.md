# Cadence saisonnière — une échéance qui n'est pas un intervalle

> Comment House exprime « la taille d'hiver, c'est entre novembre et mars » alors
> qu'il ne savait dire jusqu'ici que « tous les N jours ». Concept introduit par le
> module Verger ([parcours 30](../parcours/PARCOURS_30_SUIVRE_LE_VERGER.md)).
>
> Fiches connexes : [SNAPSHOT_ET_RECIT.md](SNAPSHOT_ET_RECIT.md) (l'autre endroit où
> une date de bascule est du métier et non de la plomberie).

## 1. Le problème

House sait déjà exprimer trois récurrences. Toutes les trois sont des **intervalles** :

| Mécanisme | Forme | Sens |
|---|---|---|
| `ChickenChore.interval_days` | « tous les 30 jours » | depuis la dernière fois |
| `Equipment.maintenance_interval_months` | « tous les 12 mois » | depuis le dernier entretien |
| `RecurringExpense` | « le 5 de chaque mois » | date fixe, ancrée sur le calendrier |

Aucune ne sait dire **« en hiver »**. Et un verger ne se conduit qu'avec ça : la
taille d'hiver se fait après les grands froids et **avant le débourrement**, la
taille en vert en été, un traitement à la chute des feuilles. Ce qui commande, ce
n'est pas le compteur depuis la dernière intervention — c'est le calendrier, parce
que c'est lui qui commande à l'arbre.

Forcer un intervalle sur ce geste casse de trois façons.

**La dérive.** « Tailler tous les 365 jours », ancré au 15 janvier. On taille en
retard, le 3 mars ; la prochaine échéance tombe au 3 mars suivant, puis on prend
encore deux semaines, et ainsi de suite. Au bout de cinq ans, l'app réclame la taille
d'hiver en avril — c'est-à-dire au débourrement, précisément le moment où il ne faut
pas tailler. **Un intervalle mémorise le retard ; une saison l'oublie.**

**L'absence de fenêtre.** Le geste n'a pas une date, il a une période. Un rappel qui
dit « c'est aujourd'hui » ment deux fois : il prétend qu'hier ne comptait pas, et que
demain sera trop tard.

**Le retard qui ne veut rien dire.** « En retard de 12 jours » sur une échéance
annuelle n'informe personne. Ce qui informe, c'est « la fenêtre s'est refermée » —
une information binaire et définitive, pas un compteur qui monte.

## 2. Le concept en deux phrases

Une cadence saisonnière ne dit pas *combien de temps après la dernière fois*, elle
dit *dans quelle partie de l'année*. Elle se définit par une **fenêtre de mois** et
se résout contre une **saison** — l'occurrence datée de cette fenêtre — de sorte que
l'échéance ne dépend jamais de la précédente, et donc ne dérive jamais.

## 3. Comment on l'a appliqué dans house

### La fenêtre

`CareRule` porte `start_month` et `end_month` (1-12), plus sa portée (un sujet
précis, ou tous les sujets d'un type). Deux formes :

- **fenêtre normale** — `start <= end` : juin → août ;
- **fenêtre à cheval sur deux années** — `start > end` : novembre → mars.

Le second cas est le **cas normal** d'un verger, pas un cas limite. Tout code qui
teste naïvement `start <= mois <= end` est faux pour la moitié du catalogue.

### La saison

Une saison est **identifiée par l'année où sa fenêtre s'ouvre**. Pour une règle
novembre → mars :

- le 20 décembre 2026 appartient à la saison **2026** ;
- le 15 janvier 2027 appartient **aussi** à la saison **2026** ;
- le 15 avril 2027 n'appartient à aucune saison ouverte.

Conséquence directe, et c'est tout l'intérêt : un entretien consigné le 20 décembre
et un autre le 15 janvier satisfont **la même occurrence**. « A-t-on taillé cette
saison ? » devient une **égalité sur un entier**, jamais une soustraction de dates.

### Les quatre états, dérivés et jamais stockés

Un module `orchard/seasons.py` de fonctions **pures** (aucun accès base) :

```
season_of(rule, day)              -> int | None      # la saison à laquelle `day` appartient
window_bounds(rule, season)       -> (date, date)    # les bornes datées d'une saison
rule_status(rule, *, today, last_event_on) -> dict   # l'état, dérivé
```

`rule_status` rend **quatre** états, jamais un booléen :

| État | Sens |
|---|---|
| `upcoming` | hors fenêtre, la prochaine n'est pas ouverte — rien à dire |
| `due` | on est dans la fenêtre, aucun entretien pour cette saison |
| `done` | un entretien lié couvre la saison en cours |
| `missed` | la fenêtre s'est refermée sans entretien — la saison est perdue |

La signature est calquée sur `chickens.services.chore_status` **volontairement** :
qui a lu l'une lit l'autre. Ce qui change, c'est ce que `last_event_on` sert à
décider — une soustraction là-bas, une appartenance à une saison ici.

### Deux règles du projet, appliquées telles quelles

- **`next_due` ne se stocke jamais.** Même raison que `ChickenChore` et que le solde
  bancaire : une échéance dénormalisée dérive au premier événement édité ou supprimé,
  et un rappel qui se déclenche sur une date périmée est pire que pas de rappel.
- **`today`, c'est celui du foyer** (`core.timezones.household_today`), jamais
  `date.today()`. Une fenêtre qui s'ouvre « en novembre » s'ouvre au novembre du
  foyer.

### L'hémisphère se déclare, il ne se devine pas

La fenêtre est saisie **en mois par l'utilisateur** : elle marche à Sydney comme en
Normandie sans une ligne de code. Ce qui est hémisphère-dépendant, ce sont seulement
les **valeurs proposées** (« taille d'hiver : novembre → mars »). On les décale de six
mois quand `Household.latitude` est négative — la donnée existe déjà pour la météo —
et on ne propose rien quand le foyer n'a pas de localisation.

C'est exactement la doctrine de `banking.rules` : **« des valeurs de départ, jamais
des vérités »**. Proposer une fenêtre que l'utilisateur corrige est utile ; l'appliquer
sans qu'il la voie serait une devinette érigée en fait.

## 4. Pourquoi cette implémentation

**La saison est un identifiant, pas une durée.** C'est ce qui rend l'idempotence
gratuite. Sans elle, il aurait fallu demander « la dernière taille date-t-elle de
moins d'un an ? » — question qui répond *oui* le 2 janvier pour une taille faite le
20 décembre précédent, et conclut donc que la saison en cours est déjà faite alors
qu'elle vient de commencer.

**Quatre états, parce que `missed` n'est pas `due`.** Une fenêtre refermée ne se
rattrape pas : proposer la taille d'hiver au mois de juin n'est pas un rappel, c'est
un mauvais conseil. Et c'est la même règle que le parcours 26 a posée pour l'argent —
*toute entité est soit résolue, soit flaggée avec un motif ; rien ne reste dans un
entre-deux silencieux.* `missed` est le motif : il se dit, il se compte, il ne se tait
pas.

**La règle porte la cadence, le journal porte les occurrences.** Repris tel quel de
`ChickenChore` / `ChickenEvent` : consigner une taille écrit un `TreeEvent` qui pointe
la règle (`SET_NULL`). Le journal reste l'unique histoire de ce qui a été fait, il
survit à la suppression de la cadence, et il est déjà citable par l'agent sans une
ligne de plus.

**Aucun mécanisme de rappel nouveau.** Une règle échue remonte dans
`alerts.services`, comme les corvées du poulailler, et peut fabriquer une `Task` via
`tasks.services.create_task`. L'app a déjà trois définitions de « en retard » ; une
quatrième finirait par les contredire, et c'est l'utilisateur qui arbitrerait entre
deux écrans.

**La règle propose, l'utilisateur dispose.** Aucune tâche n'est matérialisée en tâche
de fond. Une règle qui fabrique ses occurrences toute seule remplit la liste de tâches
de choses que personne n'a demandées — et supprimer la règle laisse les tâches
orphelines derrière elle.

## 5. Ce qu'on a écarté et pourquoi

**Réutiliser `interval_days` du poulailler.** L'option la moins chère, et fausse :
c'est exactement la dérive du § 1. Elle ne se voit pas la première année, se voit mal
la deuxième, et devient un mauvais conseil la cinquième. Le fait qu'un mécanisme
existe déjà n'en fait pas le bon.

**RRULE / iCalendar (RFC 5545).** La vraie grammaire de récurrence, capable
d'exprimer `FREQ=YEARLY;BYMONTH=11,12,1,2,3`. Écartée parce qu'elle décrit des
**occurrences ponctuelles**, pas des **fenêtres** : elle donnerait une liste de dates,
et il resterait entièrement à écrire la partie qui compte — « cette occurrence
est-elle satisfaite ? ». On paierait une dépendance et une grammaire complète pour
n'utiliser qu'une seule règle, sans se dispenser du travail.

**Une date fixe (« tailler le 15 janvier »).** Précise, donc fausse : le bon jour
dépend du gel de l'année. Une date fixe transforme un conseil juste en rappel qu'on
ignore, puis qu'on désactive.

**Les degré-jours de croissance (GDD).** C'est la vraie réponse agronomique : cumuler
les températures au-dessus d'un seuil depuis le 1ᵉʳ janvier pour prédire le
débourrement, la floraison ou l'émergence d'un ravageur. On a déjà la météo, donc
c'est techniquement à portée. Écarté en V1 parce qu'il faudrait la **température de
base par espèce** et l'**historique** de températures du lieu — pas la prévision à
sept jours — et parce qu'un modèle qui se trompe sur une date de traitement coûte une
récolte. La porte reste ouverte : un GDD viendrait **affiner** la fenêtre de mois, pas
la remplacer.

**Une base de variétés embarquée.** Elle donnerait les bonnes fenêtres par espèce sans
saisie. Écartée : c'est un jeu de données à maintenir, fortement régional, et faux hors
de sa région d'origine. Le foyer connaît son verger mieux qu'une table générique — et
il a le droit de se tromper sur son propre verger, pas d'hériter d'une erreur qu'il ne
peut pas corriger.

**Stocker `next_due`.** Ce n'est pas une préférence, c'est la règle du projet, et elle
a déjà été payée ailleurs (solde bancaire, « dépensé » d'un budget, échéance d'une
corvée). Une valeur dérivée qu'on stocke est une valeur qui va diverger.

## 6. Pour aller plus loin

- [RFC 5545 — iCalendar](https://datatracker.ietf.org/doc/html/rfc5545), § 3.3.10 `RECUR` : la grammaire de récurrence de référence, et ce qu'elle ne modélise pas.
- [Échelle BBCH](https://fr.wikipedia.org/wiki/%C3%89chelle_BBCH) : la codification internationale des stades phénologiques — la façon rigoureuse de dire « en fleur ».
- [Growing degree day](https://en.wikipedia.org/wiki/Growing_degree_day) : le modèle thermique écarté en V1.
- `apps/chickens/services.py::chore_status` — la cadence **par intervalle** dans ce dépôt, dont `rule_status` copie la forme.
- `CLAUDE.md`, § « La clôture d'un mois » — le précédent le plus proche : une date de bascule qui est du métier et non de la plomberie.
