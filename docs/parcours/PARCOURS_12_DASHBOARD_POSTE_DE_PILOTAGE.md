# Parcours 12 — Dashboard « poste de pilotage »

> Refonte complète du dashboard, cadrée le 2026-07-07. Issues : **#226** (backend), **#227** (rangée haute), **#228** (métriques), **#229** (bas de page + nettoyage).

## Le problème avec le dashboard actuel

Le dashboard V1 est générique : 4 compteurs (« 12 projets », « 34 documents »…) et 4 listes brutes (tâches pending, projets actifs, interactions, documents récents). Il compte des objets, il n'aide pas à **piloter le foyer**. Pendant ce temps, l'app a accumulé des données à forte valeur de synthèse qui n'apparaissent nulle part en page d'accueil :

- les dépenses agrégées par mois (`expenses/summary`)
- la consommation électrique en kWh **et en €** (parcours 10, lot 5)
- la consommation d'eau (parcours 11)
- les autonomies des trackers de consommation (« fioul : ~23 j restants », lot 6)
- les statuts de stock (bas, expiré)

## La cible

Un poste de pilotage en trois rangées, du plus urgent au plus contextuel :

```
┌─────────────────────────────────────────────────┐
│  Bonjour Ben — 3 choses demandent ton attention │  ← héros compact
│  [À TRAITER : tâches ⚠ · garanties 🛡 · maint. 🔧│
│   · stock 📦 · autonomies ⏳]   [MA SEMAINE ✅]  │  ← action
├──────────────┬──────────────┬───────────────────┤
│ 💶 Dépenses  │ ⚡ Électricité│ 💧 Eau │ ⏳ Autono. │  ← pouls chiffré
├──────────────┴──────────────┴───────────────────┤
│  Actions rapides · Activité récente · Projets 📌 │  ← contexte
└─────────────────────────────────────────────────┘
```

- **Rangée 1 — action** : ce qui demande une intervention. Alertes multi-modules enrichies + mes tâches de la semaine (cochables avec undo).
- **Rangée 2 — pouls** : dépenses du mois (delta vs M-1, 6 mois de barres), électricité 30 j (kWh + €), eau 30 j, autonomies des consommables.
- **Rangée 3 — contexte** : actions rapides (dépense, tâche, note, relevés, agent), timeline condensée, projets épinglés.

## Décisions de cadrage (confirmées avec l'utilisateur le 2026-07-07)

- **Concept hybride** action + métriques (préféré à un dashboard tout-alertes ou tout-graphes).
- **Layout fixe, pas de widgets configurables** en V1 — la configurabilité par user est une idée V2, à ne capturer que si le besoin apparaît.
- **Pas de méga-endpoint `/api/dashboard/`** : chaque card interroge l'endpoint d'agrégation de son module (ils existent tous déjà). Résilience (une card en erreur ne casse pas la page), skeletons indépendants, réutilisation du gen API. Le seul travail backend est l'enrichissement d'`/api/alerts/summary/`.
- **Alertes enrichies dans `apps/alerts`** (pas un module à part) : + `low_stock` (statuts `low_stock`/`expired`) et + `low_runway_trackers` (autonomie ≤ 14 j, critique ≤ 7 j). Assurance hors scope (module sans UI à ce jour).
- **Une card sans données est masquée**, pas d'empty state : un foyer sans compteur électrique ne doit pas voir de card électricité. Même règle pour les actions rapides de relevé.
- **« Ma semaine » = tâches pending dues sous 7 jours** (nouveau filtre `?due_before=` sur l'API tasks) ; les tâches déjà en retard restent dans « À traiter », pas de doublon.
- **Sparklines SVG maison** (celle des trackers, extraite en composant partagé), pas de Recharts sur le dashboard — la page reste légère, les gros graphes vivent dans les modules.
- **Suppression assumée** : compteurs génériques, panel documents récents, gros héros gradient. Les documents restent à un clic dans la nav.

## Découpage

| Lot | Sujet | Issue |
|---|---|---|
| 1 | Backend — alertes enrichies (stock, autonomies) + filtre `due_before` | #226 |
| 2 | Frontend — héros, « À traiter » v2, « Ma semaine » | #227 |
| 3 | Frontend — rangée métriques (dépenses, élec, eau, autonomies) | #228 |
| 4 | Frontend — actions rapides, activité, projets épinglés, nettoyage + E2E | #229 |

Lot 1 en PR séparée (`feat/dashboard-alerts-backend`). Lots 2–4 sur `feat/dashboard-pilotage`, en une PR ou découpée si la revue le justifie. Lot 3 est indépendant du lot 2 côté API mais s'insère dans son layout.

## Définition de done

1. Foyer avec données réelles : le héros annonce « n choses demandent ton attention », le bloc « À traiter » mêle une tâche en retard, un stock expiré et un tracker fioul à 5 j (critique, rouge) ; chaque item mène à la bonne entité.
2. Cocher « Relever compteur » dans « Ma semaine » → tâche done + toast undo qui la restaure.
3. La card Dépenses affiche le total du mois et un delta correct vs M-1 ; les chiffres élec/eau 30 j correspondent à ceux des onglets Consommation.
4. Foyer neuf (aucun compteur, aucun tracker, aucun relevé) : rangée métriques absente, dashboard propre sans cards vides ni erreurs.
5. Plus aucune trace des 4 compteurs génériques ni du panel documents ; i18n complet en/fr/de/es sans clé morte ; E2E verts.
