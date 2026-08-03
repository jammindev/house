# Module — app_settings

> Audit : 2026-08-03. Rôle : namespace UI pour les paramètres utilisateur (profil, thème, mot de passe, gestion du foyer) **et** registre des capacités optionnelles de l'instance.

## État synthétique

- **Backend** : pas de modèle, mais un registre (`capabilities.py`) et un endpoint (`views.py`, `urls.py`)
- **Frontend** : Complet dans `ui/src/features/settings/` (`SettingsPage`, components `ProfileSection`, `ThemeSection`, `ChangePasswordSection`, `AvatarSection`, `HouseholdManagement`, `PendingInvitations`, `CapabilitiesSection`)
- **Locales (en/fr/de/es)** : ok (namespaces `settings` et `capabilities` présents dans les 4 locales)
- **Tests** : 2 fichiers (`test_switch_household.py`, `test_capabilities.py`)
- **Migrations** : 0

## Modèles & API

- Modèles principaux : aucun — toutes les données sont stockées dans `accounts` (User, profil) et `households` (membership, invitations)
- Endpoints exposés : `GET /api/capabilities/` (`CapabilitiesView`, `IsAuthenticated`, **non household-scopé**) ; la page consomme aussi `/api/accounts/` (user + change password + avatar) et `/api/households/switch/`
- Permissions : héritées des apps consommées

## Capacités optionnelles — le registre (parcours 28, lot 3)

Doc utilisateur : `docs/self-hosting/ai-providers.md`. Règle structurante :

> Une capacité absente doit se **déclarer** — dire qu'elle manque, pourquoi, et
> comment l'activer. Jamais un écran vide, jamais une erreur technique, jamais
> une réponse inventée.

Sans clé, rien ne plantait déjà : l'agent répondait « je ne sais pas », la jambe
sémantique renvoyait `[]`, l'e-mail partait dans les logs. Le défaut était que
**l'interface promettait quand même**, et l'utilisateur en concluait que le
produit était mauvais plutôt qu'il lui manquait une clé.

- **Ajouter une capacité optionnelle = une entrée au registre + ses clés i18n**,
  aucune modification d'écran. Le `CapabilitySpec` s'enregistre depuis
  l'`apps.py::ready()` de **l'app qui possède le réglage** — même modèle que
  `agent.searchables` et `banking.compliance.REGISTRY`. `app_settings` ne
  connaît pas la liste. Six capacités aujourd'hui : `assistant` et
  `semantic_search` (agent), `recap_ai` (recap), `email` (accounts), `push`
  (webpush), `telegram` (telegram).
- **`available` est un callable, jamais une valeur figée à l'import.** Un
  booléen calculé au chargement gèlerait l'état du premier démarrage : ajouter
  une clé et redémarrer ne changerait rien tant que le process vit, et aucun
  test ne pourrait le simuler par `override_settings`.
- **Le prédicat renvoie `False` sur l'inconnu** (fournisseur non implémenté,
  clé absente d'une paire) — même défaut sûr que `banking.rules.guess_internal`.
  Une devinette optimiste fait promettre à l'écran ce que le premier clic
  dément.
- **Chaque capacité porte l'ancre d'une section existante** de
  `ai-providers.md`, vérifiée par test. Sans ce contrôle le lien meurt le jour
  où il est écrit, et « nécessite une clé Anthropic » redevient le mur qu'on
  voulait supprimer — même raison que la parité des catalogues i18n.
- **Le libellé vit côté front** (namespace i18n `capabilities`), pas en
  `gettext` : ajouter une capacité ne doit pas imposer un passage dans quatre
  `.po` puis un `compilemessages`. La couverture des quatre catalogues est
  vérifiée **depuis Python**, seul côté qui connaît la liste des capacités.
- **Les clés se posent par instance, jamais par foyer.** Le `.env` *est* le BYOK
  de l'auto-hébergeur. Une saisie de clé dans l'interface ferait de
  `get_llm_client()` une décision d'appelant — ce que `apps/agent/llm.py`
  interdit — et n'aurait de sens que le jour où quelqu'un héberge des foyers
  tiers. D'où un endpoint **global**, hors du scoping foyer.
- **Le payload ne transporte jamais une valeur de clé**, seulement son nom et le
  fait qu'elle soit posée.

### Refuser se dit en 503 nommé

`capabilities.require(key)` lève `CapabilityUnavailable` (503, `detail` string
pour l'intercepteur axios, plus `capability` / `env_vars` / `docs_url` à côté).
Posé **avant tout effet de bord** : persister un tour de conversation ou un
abonnement push que rien ne pourra honorer coûte plus cher que de refuser tout
de suite.

- **La garde est dans la vue, pas dans le service.** `agent.service.ask` doit
  continuer à renvoyer « je ne sais pas » pour ses appelants non-HTTP (digest,
  pings) ; servi à travers l'API, ce même « je ne sais pas » est un mensonge.
- **`telegram` avait déjà son 503, écrit à la main** : il passe par le registre
  pour que « le canal est-il configuré ? » n'ait qu'une seule définition — celle
  que l'écran lit aussi. Idem pour le front du push, qui déduisait la
  configuration d'une clé publique vide.
- La suite de tests tourne sur une instance **configurée**
  (`config/settings/test.py` pose `ANTHROPIC_API_KEY`) ; l'absence de clé est
  testée là où c'est le sujet.

Régressions : `apps/app_settings/tests/test_capabilities.py`,
`agent/tests/test_views.py::TestAnUnconfiguredInstanceSaysSo`,
`webpush/tests/test_webpush.py::test_subscribe_refuses_when_the_instance_has_no_vapid_pair`.

## Notes

- **Pas de modèle propre** : `app_settings` est purement un namespace UI agrégeant des sections de plusieurs apps backend (`accounts`, `households`) — *source : absence de `models.py` dans `apps/app_settings/`*
- Le dossier React canonique est `ui/src/features/settings/` (pas `app_settings/`) — le nom diffère entre Django et la SPA
- Composants legacy dans `apps/app_settings/react/` peuvent rester (relique pré-migration SPA) — décision projet documentée dans le brief
- Le test `test_switch_household.py` couvre l'endpoint `/api/households/switch/` consommé par `HouseholdManagement` — *source : `apps/app_settings/tests/test_switch_household.py`*
