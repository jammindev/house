# Parcours 23 — Briefings personnalisés (l'agent m'écrit selon mes propres règles)

> Cadrage : 2026-07-23. Successeur **programmable** du digest (parcours 19).
>
> Là où le digest agrège des rubriques **figées, codées en dur** (tâches, météo,
> stock, élec, ponte) à heure fixe, un **briefing** est une règle **écrite par
> l'utilisateur en langage naturel** :
>
> | Dimension | Question | Exemple |
> |-----------|----------|---------|
> | **Quand** (planning) | À quel moment ? | tous les matins à 6h / 2×/jour / le lundi |
> | **Si** (condition, optionnelle) | Sous quelle condition ? | « s'il pleut aujourd'hui », « si la France joue cette semaine » |
> | **Quoi** (contenu) | Quel message ? | « mes tâches de la semaine + la météo » |
>
> Le point qui fait la valeur **et** la difficulté : la **condition est
> arbitraire**. L'agent doit aller chercher lui-même le contexte nécessaire
> (RAG foyer, météo déjà livrée au parcours 17, `web_search` livré PR #271) puis
> rendre un verdict `{envoyer, raison}`. Aucune liste figée de conditions.
>
> Réutilise le socle **pings** (parcours 16) : opt-in `(household, user)`, tick
> idempotent (`PingLog`), fuseau, langue (`translation.override`), gating module,
> livraison Telegram. Réutilise le **repolissage IA** du digest (parcours 19).

## Décisions produit (actées)

1. **Visibilité privé / partagé.** Un briefing est soit **privé** (destinataire =
   créateur) soit **partagé** (destinataires = tous les membres du foyer ayant
   Telegram lié). Un member peut créer les deux. Édition/suppression d'un partagé :
   créateur **et** owners.
2. **Création ouverte à member + owner** (conséquence du privé : chacun gère ses
   propres briefings).
3. **Telegram uniquement en V1.** Le modèle porte un `channel` pour rester ouvert,
   mais un seul canal sortant existe.
4. **Condition arbitraire en langage naturel** — pas de DSL, pas de liste. L'agent
   l'évalue via ses tools au moment du créneau et renvoie `{envoyer: bool, raison}`.
   Trois niveaux, tous couverts par le même mécanisme : données foyer (RAG),
   web (`web_search`), météo (parcours 17).
5. **Fail-safe = ne pas envoyer.** Condition inévaluable / ambiguë / web
   indisponible → aucun envoi, tracé avec la raison. Jamais de spam par doute.
6. **Garde-fous anti-coût** (raisonnables, à ajuster) : ≤ **10 briefings actifs par
   user**, créneaux espacés de ≥ **1h**, **1 évaluation par créneau**, plafond de
   tours d'outils **et** de requêtes web par évaluation.
7. **`type` dès la V1** (`recurring` / `event`) même si l'événementiel (lot 6)
   n'arrive qu'en V1.1 — éviter une migration douloureuse plus tard.

## Backlog

### Lot 1 — Modèle & gestion des briefings

| # | Story | État |
|---|---|---|
| 1.1 | Définir un briefing en langage naturel : titre + prompt libre + visibilité (privé/partagé) + canal (Telegram). Inactif tant qu'aucun planning. | ⏳ |
| 1.2 | Gérer mes briefings : liste (titre, planning, visibilité, actif/inactif), toggle inline, édition, **suppression avec undo**, état vide, i18n. | ⏳ |
| 1.3 | Permissions : un member ne voit/édite pas les briefings privés des autres ; il voit les partagés du foyer (édition = créateur + owners). | ⏳ |

### Lot 2 — Génération du contenu + aperçu + envoi manuel

| # | Story | État |
|---|---|---|
| 2.1 | Générer le contenu via l'agent (RAG foyer + météo + web), rendu lisible Telegram, scopé aux permissions du **destinataire**. | ⏳ |
| 2.2 | « Aperçu » : génère et affiche dans l'UI sans envoi (+ verdict de condition si présente). « Envoyer maintenant » : pousse réellement. État de chargement + erreurs. | ⏳ |
| 2.3 | Telegram non lié → CTA de liaison, aucun envoi tenté. | ⏳ |

### Lot 3 — Planification & envoi automatique

| # | Story | État |
|---|---|---|
| 3.1 | Programmer la récurrence : quotidien / plusieurs fois par jour / jours de semaine ; heures dans le fuseau du foyer ; activer/désactiver ; « prochain envoi : … ». Refus si créneaux < 1h. | ⏳ |
| 3.2 | Tick d'envoi (réutilise le socle pings) : évalue → génère → envoie aux destinataires. Idempotent, fault-isolé (un briefing en échec ne coule pas les autres), destinataire sans Telegram ignoré et tracé. | ⏳ |

### Lot 4 — Conditions arbitraires évaluées par l'agent

| # | Story | État |
|---|---|---|
| 4.1 | Condition libre (texte). À l'évaluation, l'agent va chercher le contexte foyer (RAG) et rend `{envoyer, raison}`. `false` → sauté (tracé) ; inévaluable → ne pas envoyer. | ⏳ |
| 4.2 | Conditions alimentées par le web (`web_search`) : « si la France joue cette semaine ». Verdict cite la source. Web indisponible → non-évaluable → pas d'envoi. Nb de requêtes borné. | ⏳ |

### Lot 5 — Historique & suivi

| # | Story | État |
|---|---|---|
| 5.1 | Par briefing : dernier envoi + statut (envoyé / sauté-condition / échec) + raison ; aperçu du dernier contenu ; distinction « sauté (condition) » vs « échec technique ». | ⏳ |

### Lot 6 — Déclencheur événementiel (timing dérivé du web) — V1.1

| # | Story | État |
|---|---|---|
| 6.1 | Briefing `type=event` : l'agent découvre une date-cible sur le web (« la veille du prochain match ») et programme l'envoi **relativement** à elle. Vérif récurrente (~1×/jour) rafraîchit la cible ; envoi 1× par occurrence puis réarmement ; événement introuvable → pas d'envoi. | ⏳ (V1.1) |

## Limites V1 assumées

- **Un seul canal** : Telegram.
- **Pas d'événementiel** (lot 6) en V1 : une récurrence quotidienne « y a-t-il un
  match bientôt ? » (lot 4.2) couvre déjà l'essentiel du besoin.
- **Fiabilité des conditions web** : dépend de `web_search` (sources parfois
  contradictoires) — le fail-safe « ne pas envoyer » borne le risque de faux positif.
- **Coût** : chaque créneau = 1 boucle d'outils (évaluation) + 1 génération. Les
  garde-fous (≤ 10 actifs, ≥ 1h, plafonds d'outils/requêtes) bornent la dépense.

## Pistes techniques (à confirmer à l'implémentation)

- **Réutiliser le socle pings** (`apps/agent/` + parcours 16) plutôt qu'un nouveau
  scheduler : opt-in, tick idempotent, fuseau, langue, gating, livraison Telegram.
- **Réutiliser le repolissage IA** du digest (`digest/polish.py`, parcours 19).
- Nouvelle table `Briefing (household, creator, title, prompt, condition, channel,
  visibility, type, schedule, is_active)` + trace d'exécution (statut/raison/aperçu)
  — soit un `BriefingRun`, soit extension de `PingLog`.
- Évaluation de condition = run agent avec function calling terminant sur une sortie
  structurée `{envoyer: bool, raison: str}` (plafond de tours d'outils).
- Frontend : `ui/src/features/briefings/` (Page + Card + SheetDialog create/edit +
  hooks), route + entrée sidebar (groupe Compte, à côté du digest), namespace i18n
  `briefings` (4 langues).
