# Parcours 11 — Lot 6 : trackers de consommation (V1.1)

> Avenant au parcours 11, cadré le 2026-07-05 après la livraison V1. Issues : **#214** (backend), **#215** (frontend), **#216** (agent).

## Le scénario qui manque à la V1

"J'ai donné 3 verres de nourriture à mes poules — combien de temps je tiens ?"

La V1 tracke des **valeurs ponctuelles** : un compteur, un poids, un niveau. Chaque entrée est l'état à l'instant T, la dernière valeur est l'info principale, le delta se lit entre deux relevés.

Le scénario poules est une **consommation** :

- « 3 verres » n'est pas un état, c'est une **quantité consommée à chaque événement** — la dernière valeur ne veut rien dire, la sparkline des valeurs brutes non plus
- ce qu'on veut lire, c'est le **rythme** (« ≈ 3 verres/jour ») et surtout l'**autonomie** (« à ce rythme, tu tiens ~12 jours, jusqu'au 17 juillet »)
- l'autonomie exige une donnée que le tracker V1 n'a pas : la **réserve** (ce qu'il reste du sac)

## Décisions de cadrage (confirmées avec l'utilisateur le 2026-07-05)

- **`Tracker.kind`** : `measure` (défaut — comportement V1 strictement inchangé) | `consumption`, choisi à la création, immuable ensuite (changer le sens d'un historique n'a pas de sens).
- **La réserve vit sur le tracker** (`reserve`, même unité que les entrées) — pas de couplage au module stock en V1.1. Le lien optionnel « réserve = article de stock lié » est capturé en V2 (#197), l'ancrage `target → stock_item` de la V1 le prépare déjà.
- **Chaque entrée de consommation décrémente la réserve** (create/update/delete ajustent le delta, en transaction, dans `services.py` — l'undo re-crédite). Ajustement incrémental : la réserve est un fait externe, non recalculable depuis la DB. Négatif autorisé, jamais plafonné en silence.
- **Rythme** : fenêtre glissante 14 jours par `occurred_at` (repli « depuis la première entrée »), caché dans `rate_per_day` via `refresh_tracker_cache`. **Autonomie** : `reserve / rate_per_day`, calculée au serializer.
- **Réapprovisionner** = mettre à jour `reserve` (PATCH, nouveau total ; le front propose « + quantité »). Pas d'historique de recharges en V1.1 (#197).
- **Pont RAG inchangé dans son mécanisme** : l'en-tête d'`entries_summary` d'un tracker consommation porte rythme + réserve + autonomie — « combien de temps je tiens ? » se répond par le retrieval standard, zéro tool dédié.
- **Sparkline consommation** = totaux par jour (30 derniers jours), pas les valeurs brutes.

## Découpage

| Lot | Sujet | Issue |
|---|---|---|
| 6a | Backend — `kind`, `reserve`, `rate_per_day`, décrément transactionnel, summary conso, API | #214 |
| 6b | Frontend — choix du type à la création, card rythme + autonomie, Réapprovisionner, i18n | #215 |
| 6c | Agent — descriptions tools, kind/reserve dans les writables, tests du scénario poules | #216 |

Une branche `feat/trackers-consumption`, une PR (ou 6a séparé si la revue le justifie).

## Définition de done

1. créer « 🐔 Nourriture poules » (consommation, verres, réserve 36) ; saisir « 3 » deux jours de suite → la card affiche « ≈ 3 verres/jour · ⏳ ~11 j » et la réserve décrémentée
2. réapprovisionner +60 → autonomie recalculée
3. dans le chat : « j'ai donné 3 verres de nourriture aux poules » → entrée créée (undo re-crédite la réserve) ; « combien de temps je tiens ? » → réponse citée avec rythme et date de fin estimée
4. les trackers mesure existants sont strictement inchangés (tests V1 verts sans modification)
