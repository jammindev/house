# Parcours 09 — Backlog technique V1

> **À démarrer** — cadrage réalisé le 2026-07-03. Terrain vierge : aucune notion de device connecté dans le code, aucun client HTTP sortant vers un constructeur, aucun scheduler de fond. Le premier device réel est un **Shelly 2PM Gen2 en mode volet roulant** : le piloter de bout en bout est le critère de réussite de la base.

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Socle backend `apps/domotics` — modèles Integration / Device / DeviceCommand | ⏳ À démarrer | #183 |
| 2 | Couche providers + adaptateur Shelly Cloud | ⏳ À démarrer | #185 |
| 3 | Services + API DRF (sync, refresh TTL, commandes auditées) | ⏳ À démarrer | #186 |
| 4 | Frontend `/app/domotics` — page, widgets capability, connexion compte | ⏳ À démarrer | #187 |
| 5 | Intégration agent — SearchableSpec device + tool `control_device` | ⏳ À démarrer | #188 |

**Issue annexe** : **#189** — capture des sujets V2 délibérément différés (historique de mesures, cron, webhooks, chiffrement credentials).

## Doc associée

- Doc produit : [PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md](./PARCOURS_09_PILOTER_LA_MAISON_CONNECTEE.md)
- CLAUDE.md, sections « Agent — actions d'écriture » et « Pattern standard — Feature page »
- Pattern de référence pour les registries : `apps/agent/searchables.py` (le registry providers suit la même philosophie)

## Flow cible

1. connecter un compte Shelly Cloud (serveur + auth key), tester, synchroniser
2. voir les devices groupés par zone avec état courant (position volet, on/off, W, °C, en ligne)
3. piloter : ouvrir/stop/fermer le volet, allumer/éteindre un relais — résultat réel affiché
4. ancrer un device : renommer, affecter à une zone, lier à une fiche équipement
5. agent : « le volet du séjour est-il ouvert ? » (lecture) et « ferme le volet » (action explicite)

## Décisions de cadrage MVP (toutes appliquées V1)

- **Modèle par capabilities, pas par type de device** — un 2PM peut être volet ou double relais selon sa config ; c'est le statut rapporté par le provider qui détermine les capabilities (`cover`, `switch`, `power_meter`, `temperature`). L'UI et l'agent ne raisonnent qu'en capabilities. Une table Entity séparée (façon Home Assistant) viendra seulement si un besoin réel l'exige — V1 : JSONField `capabilities` sur `Device`.
- **Connexion V1 = Shelly Cloud API** — la prod tourne sur le VPS OVH, pas sur le LAN du foyer ; le cloud constructeur est le seul chemin qui marche partout sans exposer le réseau local. Local/webhooks/MQTT : différés (#189), l'abstraction provider les prévoit.
- **Pas d'historique de mesures en V1** — sans scheduler, des mesures ponctuelles au moment où on regarde la page n'ont pas de valeur de série. Le cache d'état donne la puissance instantanée. Cf. #189.
- **Rafraîchissement on-demand avec TTL serveur 15 s** — `GET /devices/?refresh=1` + `refetchInterval: 15_000` monté sur la page seulement. Le TTL serveur borne les appels sortants (rate limit Shelly : 1 req/s). Pas de Celery/Huey pour un foyer solo ; une management command `domotics_poll` pour cron viendra avec l'historique de mesures.
- **Pas d'état optimiste, pas d'undo** — une commande est un effet physique irréversible. Le bouton attend la réponse serveur (qui embarque l'état re-lu), l'échec provider s'affiche. La sécurité = demande explicite + compte-rendu fidèle + audit `DeviceCommand`.
- **Échec provider ≠ erreur HTTP** — `POST /devices/{id}/command/` répond 200 avec `command.status="failed"` + message : c'est un résultat métier, pas une panne de l'API House.
- **Credentials write-only, pas de chiffrement applicatif V1** — la DB et `SECRET_KEY` vivent sur le même VPS : chiffrer avec une clé locale ne protège que les dumps. `credentials` n'est jamais re-sérialisé (lecture : `has_credentials: bool`), admin masqué, écritures d'intégration réservées au owner. Upgrade path Fernet documenté dans #189.
- **`Device.state_summary` est le pont vers l'agent** — texte horodaté régénéré à chaque refresh, inclus dans les `search_fields` du `SearchableSpec` : l'état devient citable via le RAG standard, **zéro modification de `apps/agent/`**.
- **Pilotage agent = tool dédié `control_device`, pas un `WritableSpec`** — `create_entity` couvre les créations réversibles (undo) ; commander un device est irréversible → tool distinct avec ses propres garde-fous, pas d'entrée `UNDO_HANDLERS`.
- **Une intégration par provider et par foyer** (`UniqueConstraint(household, provider)`) — multi-comptes différé.
- **Dépendances nouvelles** : `requests` (base) + `responses` (test) — aucun client HTTP n'existe dans le projet aujourd'hui.

## API Shelly Cloud — référence vérifiée

Auth : `auth_key` en query param + `server` (ex. `https://shelly-73-eu.shelly.cloud`), récupérables dans l'app Shelly (*User settings → Authorization cloud key*). Rate limit officiel : **1 req/s**.

| Usage | Endpoint |
|---|---|
| Énumération (v1 dépréciée, seul listing existant) | `GET {server}/device/all_status?auth_key=&show_info=true&no_shared=true` |
| Statut (v2, max 10 ids/appel → chunker + sleep 1.1 s) | `POST {server}/v2/devices/api/get?auth_key=` body `{"ids": [...], "select": ["status"]}` |
| Cover | `POST {server}/v2/devices/api/set/cover?auth_key=` body `{"id", "channel": 0, "position": "open"\|"close"\|"stop"\|0-100}` |
| Switch | `POST {server}/v2/devices/api/set/switch?auth_key=` body `{"id", "channel": 0, "on": bool}` |

Shape `cover:N` (Gen2) : `state` ∈ `open|closed|opening|closing|stopped|calibrating`, `current_pos` (0-100 ou null si non calibré), `apower` (W), `temperature.tC`, `errors[]`.

Doc : <https://shelly-api-docs.shelly.cloud/cloud-control-api/>

## Lot 1 — Socle backend `apps/domotics` (#183)

### But

Poser l'app et les trois modèles, sans logique provider.

### Modèles (tous `HouseholdScopedModel`, PK UUID)

- **`DomoticsIntegration`** (`domotics_integrations`) : `provider` choices (`shelly_cloud`), `name`, `credentials` JSONField (`{"server", "auth_key"}`), `is_active`, `last_sync_at`, `last_error`. Unique `(household, provider)`.
- **`Device`** (`domotics_devices`) : `integration` FK, `external_id` (unique avec integration), `name` (éditable user), `model_code`, `raw_type`, `zone` FK SET_NULL, `equipment` FK SET_NULL, `capabilities` JSONField list, `state` JSONField (cache normalisé), `state_summary` TextField (pont agent), `state_updated_at`, `is_active`. Index `(household, is_active)`, `(zone)`.
- **`DeviceCommand`** (`domotics_device_commands`, audit immuable) : `device` FK, `capability`, `channel`, `action`, `params`, `source` (`app|agent`), `status` (`pending|success|failed`), `error`, `result`, `executed_at`. Qui = `created_by` hérité.

### Fichiers

`apps/domotics/` (app complète), `config/settings/base.py` (INSTALLED_APPS), `config/urls.py`, tests factories + modèles.

## Lot 2 — Couche providers + adaptateur Shelly Cloud (#185)

### But

Le contrat multi-constructeurs et sa première implémentation, testée contre des payloads réels mockés.

### Fichiers

- `apps/domotics/providers/base.py` — dataclasses `ExternalDevice`, `DeviceState`, `CommandResult` + ABC `BaseProvider` (`test_connection`, `list_devices`, `get_states`, `execute`)
- `apps/domotics/providers/registry.py` — `PROVIDERS` dict + `register`/`get_provider_class`/`provider_choices`
- `apps/domotics/providers/exceptions.py`
- `apps/domotics/providers/shelly_cloud.py` — endpoints ci-dessus, `_detect_capabilities` (clé `cover:N` → cover + power_meter ; `switch:N` → switch ; `temperature:N` → temperature ; inconnu ignoré), chunks de 10 + sleep 1.1 s, timeouts 10 s
- `requirements/base.txt` (+`requests`), `requirements/test.txt` (+`responses`)

### Critères

Détection capabilities depuis un `all_status` réel d'un 2PM ; normalisation cover/switch/temperature ; chunking ; erreurs HTTP/`isok=false`/timeout ; `ProviderAuthError` sur mauvaise clé.

## Lot 3 — Services + API DRF (#186)

### But

La logique métier (sync, refresh TTL, commande auditée) et ses endpoints. Livrable : piloter le volet via curl.

### Services (`apps/domotics/services.py`)

`get_provider`, `sync_devices` (upsert par external_id, n'écrase jamais name/zone édités), `refresh_states` (TTL 15 s sauf force, écrit state + state_summary + state_updated_at), `execute_command` (**point d'entrée unique view + agent** : valide capability, command pending → execute → success/failed, puis re-lecture forcée), `build_state_summary`.

### Endpoints (`/api/domotics/`)

CRUD `/integrations/` (credentials write-only, owner-only en écriture) + `test/` + `sync/` ; `GET /devices/?refresh=1&zone=&capability=` ; `PATCH /devices/{id}/` (name/zone/equipment/is_active) ; `POST /devices/{id}/refresh/` ; `POST /devices/{id}/command/` (200 même si failed) ; `GET /devices/{id}/commands/`.

### Critères

TTL effectif ; credentials jamais dans une réponse ; 403 non-owner sur intégrations ; audit complet succès/échec ; resync préserve les éditions user.

## Lot 4 — Frontend `/app/domotics` (#187)

### But

**Preuve V1 du parcours : ouvrir/stop/fermer le 2PM réel avec position + puissance depuis l'appli.**

### Fichiers

`ui/src/lib/api/domotics.ts`, `ui/src/features/domotics/{hooks.ts, DomoticsPage.tsx, DeviceCard.tsx, CoverControl.tsx, SwitchControl.tsx, IntegrationDialog.tsx, DeviceEditDialog.tsx}`, `router.tsx`, `Sidebar.tsx` (groupe Home), i18n 4 locales `domotics.*`, `npm run gen:api:refresh`.

### Points clés

Groupement par zone (`full_path`, null → « Sans pièce ») ; `useDevices` avec `refresh: true` + `refetchInterval: 15_000` sur la page seulement ; contrôles non-optimistes (spinner pendant mutation, état = réponse serveur) ; `command.status === "failed"` → toast destructive avec l'erreur ; EmptyState → CTA « Connecter un compte » ; auth_key en input password ; pattern Feature page du CLAUDE.md.

## Lot 5 — Intégration agent (#188)

### But

L'agent lit l'état (RAG standard) et pilote sur demande explicite. Tout depuis `apps/domotics/apps.py::ready()`, zéro modif `apps/agent/`.

### Contenu

- `SearchableSpec(entity_type='device', search_fields=('name', 'state_summary'), url_template='/app/domotics?device={id}', related=zone+equipment)`
- `AgentTool control_device` : input `{device_id, action ∈ open|close|stop|set_position|turn_on|turn_off|refresh_status, position?, channel?}` ; description garde-fous (action physique SANS undo, uniquement sur demande explicite et immédiate, jamais spéculativement ; `refresh_status` safe ; rapporter le résultat RÉEL) ; handler : `resolve_entity` → mapping action→capability d'après `device.capabilities` → `services.execute_command(source="agent")` → `ToolResult` avec état frais
- Pas de `WritableSpec`, pas d'`UNDO_HANDLERS`
- Vérifier `apps/agent/prompts.py` (paraphrase éventuelle de la liste des tools)

### Critères

`dispatch("control_device")` succès/échec/device inconnu/capability absente ; `state_summary` visible via `get_entity` et `search_household` ; `DeviceCommand(source="agent")` avec le bon user ; recette manuelle dans `/app/agent/`.

## Ordre recommandé d'implémentation

1. Lot 1 — socle (tables + admin)
2. Lot 2 — provider Shelly (testable sans DB réelle, payloads mockés)
3. Lot 3 — services + API (premier pilotage réel via curl)
4. Lot 4 — frontend (**preuve V1 avec le volet réel**)
5. Lot 5 — agent (« ferme le volet du séjour » dans le chat)

Branches : une feature branch par lot ou par paire de lots (`feat/domotics-socle`, `feat/domotics-provider-api`, `feat/domotics-front`, `feat/domotics-agent`), PR vers `main`.

## Points de vigilance

- **rate limit Shelly 1 req/s** : le TTL 15 s + sleep entre chunks suffisent V1 (quelques devices), mais toute boucle sur devices doit passer par `get_states` groupé, jamais un appel par device
- l'énumération repose sur un endpoint v1 **déprécié** (`/device/all_status`) — seul listing existant ; prévoir le fallback « ajout manuel par device ID » si Shelly le coupe
- `current_pos` est **null si le volet n'est pas calibré** — l'UI doit afficher l'état sans position plutôt que 0 %
- ne jamais laisser un concept Shelly fuiter hors de `providers/shelly_cloud.py` (ni dans les modèles, ni dans l'API interne, ni dans l'UI)
- `state_summary` doit être régénéré **à chaque écriture d'état** (y compris après commande) — c'est la seule vue de l'agent sur l'état
- le refus d'une action non supportée par les capabilities du device doit être propre côté service (pas seulement côté UI) — l'agent passe par le même chemin
- `pytest` local : penser à `TEST_DATABASE_NAME=test_house` (cf. mémoire projet)

## Définition de done technique

1. le 2PM réel se pilote depuis `/app/domotics` (ouvrir/stop/fermer + position + W)
2. un échec cloud s'affiche honnêtement (toast + `DeviceCommand.status="failed"`)
3. credentials invisibles dans toute réponse API ; écritures intégration owner-only
4. deux refreshs < 15 s ne déclenchent qu'un appel provider (TTL testé)
5. l'agent répond sur l'état (citation + horodatage) et exécute une commande explicite avec compte-rendu fidèle
6. audit `DeviceCommand` complet pour les sources `app` et `agent`
7. i18n 4 langues, lint propre, tests pytest des 5 lots verts
