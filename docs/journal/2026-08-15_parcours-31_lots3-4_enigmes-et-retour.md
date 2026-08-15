# 2026-08-15 — Parcours 31, lots 3 et 4 livrés (V1 complète)

> Compte rendu d'implémentation. Ce document dit ce qui a été livré, **ce qui a
> résisté**, et comment chaque arbitrage a été tranché. Les décisions de *cadrage*
> sont dans le backlog ; celles-ci ont été prises **pendant** l'écriture, et
> aucune n'était prévue.
>
> Suite de [`2026-08-15_parcours-31_lots1-2_ancrage-et-chasse.md`](./2026-08-15_parcours-31_lots1-2_ancrage-et-chasse.md).

## Contexte

Deuxième moitié du parcours 31, écrite dans la foulée de la première, même
journée, même worktree isolé.

| | |
|---|---|
| Lot 3 — énigmes par l'assistant | PR **#623**, mergée, issue #610 |
| Lot 4 — rejouer + ping du samedi pluvieux | PR **#…**, issue #611 |
| Issue parente **#607** | reste ouverte jusqu'à la recette du foyer (imprimer, coller, jouer avec un vrai téléphone) |

## Ce qui est livré

**Lot 3 — l'aide à l'écriture.** `generate_riddles` (un seul appel pour toutes
les pièces, JSON strict), capacité `hunt_riddles` au registre, endpoint
capability-gated avec cap dédié, bouton « Proposer des énigmes » + tranche d'âge
dans le composeur. 23 tests backend, 3 specs Playwright. `CHAS-11`/`CHAS-12` ✅.

**Lot 4 — le retour du jeu.** `POST /hunts/{id}/replay/` (copie mélangée en
brouillon, originale intacte), `PingSpec('hunt_suggestion')` à quatre conditions,
type de notification déclaré et silenciable, bouton « Rejouer ». 22 tests
backend, 3 specs Playwright. `CHAS-13`/`CHAS-14` ✅.

**Le parcours.** Guide « Chasse au trésor » ajouté à la page Tutoriel (5 étapes,
4 langues), `docs/MODULES/games.md` complétée, backlog et glossaire à jour.

## Soucis rencontrés, et comment ils ont été tranchés

### 1. L'endpoint du cadrage rendait la relecture impossible

Le backlog prévoyait `POST /hunts/{id}/generate-riddles/` — une action de
**détail**. Or le geste a lieu *pendant* la composition, le plus souvent sur une
chasse qui n'existe pas encore en base : une route de détail obligerait à
enregistrer une chasse vide avant de pouvoir demander de l'aide à l'écrire. C'est
l'inverse du premier critère du lot, qui veut qu'aucune énigme ne soit écrite
sans être passée sous les yeux du parent.

**Tranché** : action de **liste**, corps `{zones, age}`. Bénéfice secondaire qui
a emporté la décision — « rien n'est écrit en base » cesse d'être une promesse à
tenir : l'endpoint ne sait pas où écrire. Écart noté dans le backlog, avec son
pourquoi ; un cadrage qu'on contredit sans l'écrire redevient faux en silence.

### 2. Le champ `zones` acceptait les pièces du voisin

`PrimaryKeyRelatedField(queryset=Zone.objects.all())` + une validation maison du
foyer dans `validate_zones`. Ça marchait — et
`core/tests/test_write_isolation.py` l'a refusé quand même, parce que la règle du
dépôt n'est pas « valider », c'est « le champ **refuse** ».

**Tranché** : `HouseholdScopedPrimaryKeyRelatedField`. La différence est réelle
ici : les noms des pièces sont ce qu'on envoie au modèle, donc une chasse
composée sur les zones d'un autre foyer aurait fait **écrire les noms de leurs
pièces** dans une réponse. Le garde-fou a vu ce que la relecture n'avait pas vu.

### 3. Une chasse laissée active faisait tomber une spec sans rapport

`zone-qr.spec.ts` était vert seul, rouge dès qu'il tournait après `hunt.spec.ts`.
Ce n'était pas de l'instabilité : une chasse `active` détourne **tous** les scans
du foyer vers l'écran de jeu — c'est exactement ce qu'on lui demande de faire, et
la suite partage une base non réinitialisée.

**Tranché** : `afterEach` de nettoyage dans les trois specs de jeu. Nettoyer
avant sa propre exécution protège de ce qui précède ; ça ne protège pas **les
autres** de ce qu'on laisse.

### 4. Enchaîner les scans « comme un téléphone » perdait des scans

Le parcours de rejeu joue une chasse de quatre pièces par `page.goto(label.path)`
en boucle. La navigation suivante partait avant que le `POST /zones/scan/` de la
précédente ait répondu, et la chasse n'arrivait jamais au bout. Attendre l'URL
n'y changeait rien : elle vaut **déjà** `/app/games/play` au tour d'avant, donc
l'assertion passait sans rien attendre.

**Tranché** : attendre le **compteur d'avancement** (« 2 sur 4 trouvées »), seule
chose qui ne bouge qu'une fois la réponse du serveur arrivée. Règle générale :
dans un flux redirigé, ce qu'il faut attendre est ce que le serveur a écrit, pas
l'endroit où l'on est.

### 5. Le throttle du produit tombait sur la suite de tests

En ajoutant un troisième fichier de spec au module, plusieurs specs se sont
mises à échouer sur une **redirection vers le login**. Aucune trace de bug : le
plancher global (240 requêtes/min/utilisateur, `core.throttles`) était atteint
par la suite elle-même, l'API répondait 429 à tout — `/api/accounts/me/` compris,
que le front lit comme « pas connecté ».

Le diagnostic a coûté du temps parce que le symptôme mentait deux fois : il
désignait l'authentification, et il touchait des specs qu'on venait de ne pas
modifier. Ce sont d'ailleurs les mêmes échecs qu'on avait classés « préexistants
et instables » plus tôt dans la journée.

**Tranché** : desserrer le **plancher** dans `config/settings/e2e.py`, et lui
seul. Le cap existe pour qu'une boucle emballée s'arrête avant la facture — « un
humain derrière un navigateur ne l'atteint pas, un script l'atteint en quelques
secondes » —, or une suite Playwright *est* ce script. Les caps **nommés**
(connexion, inscription, invitation, agent, énigmes) restent intacts : ce sont
eux qui portent une règle métier, et une suite E2E doit continuer à les
rencontrer.

### 6. `random.shuffle` a le droit de ne rien mélanger

Rejouer « dans un ordre mélangé » avec `shuffle` rend la permutation identité une
fois sur deux à deux étapes, une fois sur six à trois. Le bouton n'aurait alors
rien fait — sans le dire, ce qui est le pire des deux.

**Tranché** : retirer tant que l'ordre ne bouge pas, borné à vingt tours (le
hasard ne garantit pas la terminaison, et une boucle infinie dans une requête
HTTP coûte un worker), puis une rotation en dernier recours. Le test injecte un
générateur qui **ne mélange jamais** : c'est le seul moyen de prouver que le code
ne se contente pas du premier tirage.

### 7. Le seuil de pluie décide si le ping est un service ou du bruit

Le cadrage disait « précipitations annoncées » sans chiffre. À 30 % de
probabilité, l'invitation part presque tous les week-ends de l'année et redevient
exactement le rappel périodique qu'on voulait éviter.

**Tranché** : 60 %, et les quatre conditions en `AND` (week-end dans le fuseau du
foyer, pluie, ≥ 3 zones, aucune chasse active), avec **un test par condition**.
Le risque de ce ping n'est pas de rater un envoi, c'est d'en faire un rappel :
un bruit régulier emporte avec lui la notification rare qui comptait.

## Ce qui reste

- **La recette du foyer** — imprimer la planche, coller, jouer une vraie partie
  avec un vrai téléphone. C'est ce qui garde **#607** ouverte : rien de ce qui
  précède ne prouve qu'une étiquette scotchée derrière une porte se scanne bien
  dans la pénombre du couloir.
- Les cinq échecs locaux de `apps/core/tests/test_selfhost_settings.py` — ils
  échouent aussi sur `main` dans un worktree, à cause du `.env.local` présent ;
  la CI n'en a pas. À traiter à part, ce n'est pas un défaut du parcours.
