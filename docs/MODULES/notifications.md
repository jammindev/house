# Module — notifications

> Audit : 2026-04-28. Rôle : notifications in-app user-scoped (génériques via type + payload JSON).

## État synthétique

- **Backend** : Présent
- **Frontend** : Absent (pas de `ui/src/features/notifications/`, seul `ui/src/lib/notifications.ts` existe pour le bell HTMX legacy)
- **Locales (en/fr/de/es)** : namespace manquant : `notifications` absent dans les 4 locales
- **Tests** : oui — 2 fichiers (`test_notifications.py`, `test_notifications_extra.py`)
- **Migrations** : 2 (`0001_initial.py`, `0002_notification_soft_delete.py`)

## Modèles & API

- Modèles principaux : `Notification` (user-scoped, pas household-scoped) avec enum `Type` (`HOUSEHOLD_INVITATION`, `HOUSEHOLD_MEMBER_JOINED`, `STOCK_LOW`, `STOCK_OUT`), payload JSON, soft-delete — *source : `apps/notifications/models.py`*
- Endpoints exposés : `/api/notifications/` (ReadOnly liste + détail)
  - `GET /api/notifications/unread-count/`
  - `POST /api/notifications/{id}/mark-read/`
  - `POST /api/notifications/mark-all-read/`
- Permissions : `IsAuthenticated` (filtrage par `user=request.user` + `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:11-16`*
- Service : `apps/notifications/service.py` expose `send(user, type, title, body, payload)` comme point d'entrée unique pour créer une notification

## Notes

- **User-scoped, pas household-scoped** — chaque notification appartient à un utilisateur (FK `user`), pas à un foyer — *source : `apps/notifications/models.py:23-28`*
- Modèle générique : `type` + `payload` JSON permet d'ajouter de nouveaux types sans migration — *source : `apps/notifications/models.py` docstring*
- Soft-delete via `deleted_at` (le viewset filtre `deleted_at__isnull=True`) — *source : `apps/notifications/views.py:16`*
- Service `send()` est le **point d'entrée unique** : tous les callers (households, projects, tasks…) doivent passer par lui — *source : `apps/notifications/service.py:14`*

## Prévenir un foyer — `notify_household`, et rien d'autre

Toute notification de la famille « **un membre a fait quelque chose** » (une
tâche cochée, une dépense saisie, un arrivant dans le foyer) passe par
`notifications.service.notify_household`. Ajouter un émetteur, c'est écrire ce
qu'il dit — pas comment il le diffuse.

```python
from notifications.service import notify_household

notify_household(
    household,
    Notification.Type.STOCK_LOW,
    actor=request.user,               # exclu des destinataires, tracé dans payload
    text=lambda: (title, body),       # appelé SOUS la locale de chaque destinataire
    url=f"/app/stock/{item.id}",      # où mène la notification
    dedup_key=f"stock:{item.id}:low", # optionnel
    payload={...},
)
```

Les quatre garanties, et pourquoi chacune est du métier :

- **`text` est un callable, jamais deux strings.** Il est appelé une fois par
  destinataire dans `translation.override(sa locale)`. Le texte est stocké en
  clair (règle write-time du `CLAUDE.md`) : il n'y a **pas** de seconde chance à
  l'affichage, donc un appelant qui rend sa phrase une seule fois poste à tout le
  foyer la langue de celui qui a agi. Ce bug était en production dans
  `stock/notifications.py`, invisible parce que la phrase était parfaitement
  valide — simplement pas dans la bonne langue. Régression :
  `stock/tests/test_api_stock_extra.py::TestTheWarningIsWrittenInEachReadersLanguage`.
- **`actor` est exclu**, et c'est la règle partagée de toute la famille : on ne
  notifie personne de sa propre action. `actor=None` pour un fait sans auteur
  (un seuil de stock franchi, une alerte météo) — tout le monde est prévenu.
- **`url` est porté par la ligne, pas par le type.** `_DEEP_LINKS` reste un
  **fallback** pour les notifications qui mènent à un *endroit* ; une famille
  entité-scopée mène à une *chose*, et « Bob a terminé Tondre la pelouse » qui
  atterrit sur la liste des tâches fait refaire au lecteur la recherche que la
  notification venait de faire pour lui. Ordre de résolution :
  `notif.url` → `_DEEP_LINKS[type]` → `/app/dashboard` (`service.deep_link_for`).
- **`dedup_key` remplace trois anti-doublons maison** (weather avait le sien sur
  `payload__day`, stock n'en avait aucun). Portée : `(user, type, key)` **vivant**
  — soft-supprimer, c'est l'utilisateur qui dit qu'il en a fini, donc la
  prochaine occurrence est de nouveau une nouvelle.

### Ce que l'utilisateur peut faire taire — et ce qu'il ne peut pas

`User.muted_notification_types` est un opt-**out** (vide = tout arrive), et il ne
peut contenir que des types de `notifications.models.MUTABLE_TYPES`.

- **Certaines notifications ne se coupent pas.** Une invitation est le seul moyen
  d'apprendre quelque chose que personne ne peut faire à votre place ; laisser une
  case la masquer transforme une préférence en piège. Le serializer **refuse en
  400** au lieu d'ignorer : croire qu'on a coupé une invitation est pire que
  s'entendre dire qu'on ne peut pas.
- **Le filtre est dans `send()`, pas à l'écran.** Un type peut sortir de
  `MUTABLE_TYPES` (il s'est avéré important) ; une préférence enregistrée du temps
  où il était silenciable doit cesser de s'appliquer tout de suite, pas attendre
  que l'utilisateur rouvre un écran qu'il ne rouvrira peut-être jamais.
- **La liste est servie** (`GET /api/notifications/mutable-types/`), jamais
  redéclarée dans le front : une liste en dur finirait par proposer une case que
  l'API refuse. Et la couverture i18n (`notifications.type.*` dans les 4
  catalogues) est vérifiée **depuis Python**, seul côté qui connaît la liste —
  même pattern que la palette de recherche.

### Le catalogue des types est l'enum, sans exception

`choices` n'est pas contraint en base et `.create()` ne fait pas de `full_clean` :
une string littérale persiste sans broncher. `weather_alert` a vécu ainsi, absent
de l'affichage admin, absent de `MUTABLE_TYPES`, invisible pour qui lisait la
liste des types. Tout nouveau type se déclare dans `Notification.Type`, et son
appartenance à `MUTABLE_TYPES` est une décision explicite.
