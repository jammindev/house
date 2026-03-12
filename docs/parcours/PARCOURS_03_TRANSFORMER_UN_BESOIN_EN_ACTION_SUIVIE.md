# Parcours 03 — Transformer un besoin en action suivie

Ce document détaille le troisième parcours métier à travailler dans House.

Il s'appuie sur l'état actuel du projet Django + React hybride, sur le socle posé par le parcours 01 (capturer un événement) et sur le parcours 02 (traiter un document entrant).

## Résumé

Le troisième usage fondamental du produit est le suivant :

"Il y a quelque chose à faire. Je veux le noter, lui donner un contexte, le suivre jusqu'à ce que ce soit réglé, et retrouver ensuite ce qui l'avait déclenché."

Ce parcours est clé car il donne de la valeur opérationnelle à tout ce qui a été capturé avant.

- Un événement capturé génère souvent une action à prévoir.
- Un document reçu génère souvent quelque chose à faire.
- Une zone ou un équipement appelle parfois une intervention à planifier.

Sans ce parcours, le foyer accumule une mémoire mais ne convertit pas cette mémoire en suivi d'actions réelles.

## Positionnement produit

## Concept interne

Le modèle technique central reste `Interaction` avec `type='todo'`.

Ce choix est délibéré :

- la tâche reste dans la même timeline que les événements
- les liens vers zones, documents, contacts, structures et projets sont natifs
- l'API et le schéma de données restent cohérents
- le suivi de statut est déjà implémenté

## Concept visible côté utilisateur

Dans l'interface, le vocabulaire à utiliser est :

- vue dédiée : `Tâches`
- action principale : `Ajouter une tâche`
- statuts visibles : `Backlog`, `À faire`, `En cours`, `Fait`
- formulation secondaire : `action`, `suivi`, `ce qui est à faire`

Le mot `todo` reste dans le code. Le mot `interaction` reste invisible sur cette surface.

## Objectif produit

Permettre à un membre du foyer de :

1. créer une tâche rapidement, avec ou sans point de départ explicite
2. la lier à ce qui l'a déclenchée (événement, document, zone)
3. suivre son avancement sans friction dans une liste claire
4. la fermer proprement sans perdre son contexte
5. retrouver l'origine d'une tâche si besoin

## Ce que le projet a déjà aujourd'hui

Le repo contient déjà une base solide pour ce parcours.

## Mini-app tâches existante

Une mini-app dédiée existe déjà dans [apps/tasks/](/Users/benjaminvandamme/Developer/house/apps/tasks/).

Elle expose aujourd'hui une vue kanban accessible via `/app/tasks/`, avec 4 colonnes par statut et un dialog de création rapide.

Cette vue kanban sera remplacée par une liste mobile-first dans la V1 du parcours 03.

Les composants existants [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx) et [apps/tasks/react/NewTaskDialog.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/NewTaskDialog.tsx) sont réutilisables avec adaptation. [apps/tasks/react/TaskColumn.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskColumn.tsx) devient obsolète et peut être retiré.

## API existante

- liste des todos groupés par statut : `/api/interactions/interactions/tasks/`
- changement rapide de statut : `/api/interactions/interactions/{id}/update_status/`
- CRUD complet : `/api/interactions/interactions/`
- client frontend : [ui/src/lib/api/tasks.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/tasks.ts)

## Capacité métier déjà présente

- création d'une tâche avec sujet, note, date, zone obligatoire
- 5 statuts disponibles : `backlog`, `pending`, `in_progress`, `done`, `archived`
- changement de statut via l'API
- household scoping cohérent
- liens vers zones, documents, contacts, structures et projets disponibles côté modèle

## Diagnostic actuel

La mini-app tâches existe et fonctionne, mais deux problèmes se posent.

Le premier est structurel : le kanban horizontal est un pattern pensé pour des équipes avec un flux de travail pipeline. Dans un foyer avec 10 à 20 tâches actives, les colonnes sont sous-peuplées, la navigation horizontale est contre-naturelle sur mobile et la vue "qu'est-ce que je dois faire maintenant ?" est enfouie dans le découpage par statut.

Le second reste fonctionnel : les liens vers l'origine d'une tâche, l'édition après création, les tâches en retard et les points d'entrée depuis les parcours 01 et 02 ne sont pas encore implémentés.

Ce qui fonctionne :

- créer une tâche standalone depuis la page tâches
- voir les tâches par statut
- avancer ou reculer une tâche manuellement

Ce qui manque pour rendre le parcours vraiment fort :

- une interface mobile-first adaptée au contexte foyer
- créer une tâche depuis un événement existant (lien parcours 01 → 03)
- créer une tâche depuis un document (lien parcours 02 → 03)
- voir dans la carte l'origine de la tâche (quel événement, quel document)
- éditer une tâche après création
- détecter et afficher les tâches en retard
- retourner depuis une tâche vers l'événement ou le document qui l'a générée

## Problème utilisateur précis

Quand quelque chose est à faire, l'utilisateur ne doit pas choisir entre noter une action et l'inscrire dans l'historique du foyer.

Il ne doit pas se demander :

- est-ce que je crée une note, une tâche, ou autre chose ?
- où est-ce que je retrouve la tâche que j'ai créée depuis un document ?
- qu'est-ce qui avait déclenché cette tâche il y a trois semaines ?

Le système doit répondre à ces questions naturellement, sans que l'utilisateur ait à reconstituer lui-même les liens.

## Utilisateur cible

Pour ce parcours, la cible principale est un membre du foyer qui veut convertir un besoin réel en action suivie.

Exemples :

- un problème a été constaté (parcours 01), il génère quelque chose à réparer
- une facture a été reçue (parcours 02), elle déclenche un rappel de suivi
- un entretien est à prévoir, même sans événement déclencheur explicite
- une tâche est assignée à un prestataire et doit rester visible jusqu'à confirmation

## Scénarios prioritaires

## Scénario A — Tâche née d'un événement

"J'ai noté une fuite dans la cuisine. Je veux créer une tâche 'Appeler le plombier' directement depuis cet événement."

## Scénario B — Tâche née d'un document

"J'ai reçu une facture de contrat d'entretien. Je veux créer un rappel lié à ce document pour vérifier la date de résiliation."

## Scénario C — Tâche standalone

"Je veux juste noter quelque chose à faire dans la maison, sans qu'il y ait un événement ou un document à la source."

## Scénario D — Clôture avec contexte

"J'ai fini. Je marque la tâche comme faite. Je veux pouvoir revenir dessus plus tard si besoin et voir ce qui l'avait déclenchée."

## Scénario E — Tâches en retard

"Je veux voir d'un coup d'œil les tâches dont la date est dépassée et qui ne sont pas encore faites."

## Parcours cible

Le parcours de référence pour la V1 est le suivant.

### Depuis un événement (parcours 01 → 03)

1. L'utilisateur consulte un événement dans l'historique.
2. Il voit une action `Créer une tâche depuis cet événement`.
3. Le formulaire de création de tâche s'ouvre prérempli avec le lien vers l'événement.
4. L'utilisateur ajuste sujet, date et zone si nécessaire.
5. La tâche est créée et visible dans la liste des tâches.
6. Depuis la tâche, le lien vers l'événement d'origine reste accessible.

### Depuis un document (parcours 02 → 03)

1. L'utilisateur consulte un document dans son détail.
2. Il voit une action `Créer une tâche depuis ce document`.
3. Le formulaire s'ouvre avec le lien vers le document.
4. La tâche est créée et visible dans la liste avec le document source accessible.
5. Depuis la tâche, le lien vers le document d'origine reste accessible.

### Standalone

1. L'utilisateur ouvre le dashboard ou la page tâches.
2. Il clique sur `Ajouter une tâche`.
3. Il remplit sujet, zone et date.
4. La tâche apparaît dans la liste dans la section `À faire`.

### Suivi et clôture

1. L'utilisateur fait avancer sa tâche au fil de l'avancement.
2. Il la marque `Fait` quand c'est terminé.
3. La tâche reste accessible dans la section `Fait` et dans l'historique général.

## Règles produit

## Règle 1 — La tâche reste une interaction

Ne pas créer un modèle de données séparé pour les tâches.

Pourquoi :

- la timeline reste unifiée
- les liens zones/documents/contacts/projets sont natifs et cohérents
- les vues historiques couvrent aussi les tâches
- la complexité de maintenance est réduite

## Règle 2 — La tâche peut naître de plusieurs contextes

Tout point d'entrée doit être valide :

- création directe depuis la page tâches ou le dashboard
- création depuis un événement existant
- création depuis un document existant

Les trois flux doivent converger vers le même modèle, avec des liens contextuels différents selon l'origine.

## Règle 3 — Le contexte d'origine doit rester lisible

Une tâche créée depuis un événement ou un document ne doit pas perdre cette information.

Le lien doit être :

- visible dans la liste sans avoir à ouvrir le détail
- cliquable pour revenir à la source
- persistant même si la tâche est clôturée

## Règle 4 — La liste ne doit pas afficher les tâches archivées

La section `Fait` reste accessible et utile.

Les tâches archivées sortent de la vue principale sans être perdues. Elles restent consultables depuis l'historique du parcours 01.

## Règle 5 — Les tâches en retard doivent être signalées

Une tâche dont la date est dépassée et dont le statut n'est pas `done` ou `archived` est considérée en retard.

Ce signal doit être visible sans nécessiter un filtre explicite de l'utilisateur.

## Règle 6 — La clôture ne doit pas effacer le contexte

Marquer une tâche comme faite ne doit pas en faire une entrée illisible.

La tâche fermée doit rester accessible dans la section `Fait` et dans l'historique général avec son contexte intact.

## Backlog produit recommandé pour la V1

## Story 0 — Refonte de la page tâches en liste mobile-first

En tant que membre du foyer,
je veux une page tâches lisible sur mobile, organisée par priorité réelle,
afin de savoir immédiatement ce que j'ai à faire sans friction.

### Critères d'acceptation

- la page est utilisable sans scroll horizontal
- les tâches sont regroupées par sections dans un ordre de priorité décroissant : En retard, En cours, À faire, Backlog, Fait
- des filtres rapides en haut de page permettent de réduire la vue par statut
- le bouton `Ajouter une tâche` est accessible sans scroll
- les sections vides sont masquées ou réduites sauf si un filtre actif les force
- la section `Fait` est repliée par défaut

## Story 1 — Créer une tâche depuis un événement

En tant que membre du foyer,
je veux créer une tâche directement depuis un événement de l'historique,
afin de ne pas perdre le lien entre le problème constaté et l'action à mener.

### Critères d'acceptation

- le détail ou la carte d'un événement expose une action `Créer une tâche`
- le formulaire s'ouvre prérempli avec le lien vers l'événement source
- la tâche créée apparaît dans la liste
- depuis la tâche, un lien vers l'événement d'origine est visible et accessible

## Story 2 — Créer une tâche depuis un document

En tant que membre du foyer,
je veux créer une tâche directement depuis un document,
afin de transformer un document entrant en action concrète à suivre.

### Critères d'acceptation

- le détail d'un document expose une action `Créer une tâche`
- le formulaire s'ouvre prérempli avec le lien vers le document source
- la tâche créée apparaît dans la liste
- depuis la tâche, un lien vers le document d'origine est visible et accessible

## Story 3 — Voir le contexte d'origine dans la carte

En tant que membre du foyer,
je veux voir dans la liste si une tâche vient d'un événement ou d'un document,
afin de comprendre sans effort d'où vient cette action.

### Critères d'acceptation

- la carte affiche un indicateur si un événement est lié
- la carte affiche un indicateur si un document est lié
- l'indicateur permet de naviguer vers la source
- la carte reste lisible et non surchargée

## Story 4 — Éditer une tâche après création

En tant que membre du foyer,
je veux modifier le sujet, la date ou les notes d'une tâche déjà créée,
afin de l'affiner sans avoir à la supprimer et la recréer.

### Critères d'acceptation

- une action d'édition est accessible depuis la carte
- les champs modifiables incluent au minimum : sujet, date, notes, zone
- la modification est persistée sans perdre les liens existants
- la liste reflète les changements immédiatement

## Story 5 — Tâches en retard visibles

En tant que membre du foyer,
je veux voir immédiatement les tâches dont la date est dépassée,
afin de ne pas laisser des actions urgentes sans suivi.

### Critères d'acceptation

- les tâches dont la date est passée et le statut non final sont visuellement distinguées
- elles apparaissent en tête de liste dans une section dédiée `En retard`
- le signal ne nécessite pas de filtre manuel

## Story 6 — Afficher la zone dans la carte

En tant que membre du foyer,
je veux voir à quelle zone répond une tâche depuis la liste,
afin de prioriser mes actions par espace physique sans ouvrir le détail.

### Critères d'acceptation

- la zone principale est visible sur la carte
- l'affichage reste compact
- si plusieurs zones, la première ou la plus pertinente est affichée

## Story 7 — Clôturer une tâche sans perdre son contexte

En tant que membre du foyer,
je veux fermer une tâche en la marquant comme faite,
afin qu'elle reste consultable avec tout son historique.

### Critères d'acceptation

- le passage en statut `done` ne supprime pas la tâche
- la tâche reste accessible dans la section `Fait`
- elle reste accessible via l'historique général avec ses liens intacts
- les tâches archivées sortent de la liste sans être supprimées

## Recommandation d'interface

## Pourquoi ne pas garder le kanban

Le kanban horizontal est un pattern efficace pour visualiser un pipeline de travail en équipe. Dans un foyer avec un volume limité de tâches actives simultanées, il introduit plus de friction qu'il n'en résout :

- les colonnes sont souvent sous-peuplées et le layout horizontal est sous-utilisé
- sur mobile, le scroll horizontal est contre-intuitif
- la question principale de l'utilisateur est "qu'est-ce que je fais maintenant ?" pas "dans quelle étape est cette tâche ?"

## Structure recommandée : liste groupée avec filtre rapide

```
┌─────────────────────────────────┐
│  Tâches              [+ Ajouter]│
│  ─────────────────────────────  │
│  [Tout] [À faire] [En cours]    │
│  [Backlog]  [Fait]              │
├─────────────────────────────────┤
│  ⚠ En retard (2)               │
│  ┌──────────────────────────┐   │
│  │ Appeler le plombier      │   │
│  │ Salon · il y a 3 jours   │   │
│  │ ↳ Fuite sous l'évier  ✓ │   │
│  └──────────────────────────┘   │
│                                 │
│  À faire (5)                    │
│  ┌──────────────────────────┐   │
│  │ Changer filtre VMC       │   │
│  │ Cave · dans 2 jours   ✓ │   │
│  └──────────────────────────┘   │
│  ...                            │
│                                 │
│  Backlog (3)  ▸ voir plus       │
└─────────────────────────────────┘
```

## Détail de la structure

**En-tête fixe :**

- titre de page `Tâches`
- bouton `+ Ajouter` accessible sans scroll
- chips de filtre : `Tout` / `À faire` / `En cours` / `Backlog` / `Fait`

**Corps — sections dans l'ordre de priorité :**

1. `En retard` — highlight orange, visible uniquement si des tâches sont en retard
2. `En cours`
3. `À faire`
4. `Backlog` — replié par défaut si non sélectionné
5. `Fait` — replié par défaut

Les sections vides ne s'affichent pas sauf si le filtre actif force leur affichage.

**Carte tâche :**

- sujet (ligne principale)
- zone (ligne secondaire courte)
- date relative (`dans 2 jours`, `il y a 3 jours`)
- bouton ✓ inline pour passer au statut suivant
- indicateur discret si un événement source est lié
- indicateur discret si un document est lié
- indicateur rouge/orange si en retard

**Geste principal :**

Le bouton ✓ sur la carte avance directement au statut suivant (`pending` → `in_progress` → `done`) sans menu intermédiaire. Un appui long ou un menu discret permet l'édition ou l'archivage.

## Création de tâche depuis un événement

Le modèle le plus simple est identique au pattern du parcours 02 :

- depuis la liste interactions, une action contextuelle `Créer une tâche`
- redirection vers `/app/interactions/new/?type=todo&source_interaction_id=<id>`
- préremplissage du sujet à partir de l'événement source
- stockage du lien dans `metadata.source_interaction_id`

## Création de tâche depuis un document

Le flow est déjà partiellement préparé par le parcours 02 :

- ajouter une action `Créer une tâche` dans le détail document
- transmettre `source_document_id` avec `type=todo`
- créer le lien `InteractionDocument` à la création

## Écrans impactés

- [apps/tasks/react/TasksPage.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TasksPage.tsx) — refonte complète
- [apps/tasks/react/TaskCard.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskCard.tsx) — adaptation avec zone, origine, retard, bouton ✓
- [apps/tasks/react/TaskColumn.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/TaskColumn.tsx) — remplacé par des sections de liste, peut être retiré
- [apps/tasks/react/NewTaskDialog.tsx](/Users/benjaminvandamme/Developer/house/apps/tasks/react/NewTaskDialog.tsx) — conservé tel quel
- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- [apps/documents/react/DocumentDetailPage.tsx](/Users/benjaminvandamme/Developer/house/apps/documents/react/DocumentDetailPage.tsx)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)

## Hors scope pour la V1

Pour garder une livraison verticale propre :

- drag and drop pour réordonner les tâches
- tri personnalisable au sein d'une section
- filtres par zone ou par projet dans la liste
- récurrence et templates de tâches
- assignation à un membre du foyer
- vue calendrier des tâches
- notifications ou rappels automatiques
- détail tâche complet sur une page web dédiée si l'édition inline suffit

## Décisions produit recommandées

## 1. Ne pas créer de modèle tâche séparé

Le modèle `Interaction` avec `type='todo'` est suffisant pour la V1 et les prochaines itérations.

## 2. Le lien source d'une tâche passe par InteractionDocument et metadata

Pour relier une tâche à un document source, `InteractionDocument` est le bon contrat.

Pour relier une tâche à un événement source, deux options sont raisonnables en V1 :

- stocker l'id de l'interaction source dans `metadata`
- implémenter un lien `InteractionLink` si plusieurs parcours en ont besoin

La décision technique est traitée dans le backlog.

## 3. Remplacer le kanban par une liste mobile-first

La vue kanban existante est remplacée par une liste groupée par statut, accessible sur mobile sans friction.

La vue historique générale (parcours 01) reste la surface pour retrouver les tâches dans leur contexte temporel.

Ces deux vues se complètent sans se dupliquer.

## 4. Tâches en retard sans backend dédié en V1

Le calcul du retard peut rester côté frontend pour la V1.

Une exposition serveur explicite des tâches en retard peut être ajoutée ensuite si le besoin de filtrage API se confirme.

## Définition de done du parcours 3

Le parcours peut être considéré comme livré si, pour un utilisateur réel :

1. la page tâches s'utilise naturellement sur mobile
2. les tâches en retard sont visibles immédiatement en tête de liste
3. il peut créer une tâche depuis un événement existant et retrouver le lien
4. il peut créer une tâche depuis un document existant et retrouver le lien
5. il peut créer une tâche standalone sans friction
6. il voit dans la liste la zone et les liens d'origine de chaque tâche
7. il peut éditer une tâche après création
8. il peut la clôturer sans perdre son contexte
9. le parcours reste cohérent avec la timeline du parcours 01 et les documents du parcours 02

## Check de validation manuelle

Avant de considérer la V1 terminée, vérifier ce scénario complet :

1. ouvrir la page tâches sur mobile (ou en vue étroite)
2. constater que la liste est lisible sans scroll horizontal
3. créer un événement `problème de fuite` depuis le dashboard
4. depuis la liste interactions, créer une tâche depuis cet événement
5. vérifier que la tâche apparaît dans la liste avec le lien vers l'événement
6. ouvrir un document et créer une tâche depuis ce document
7. éditer le sujet de cette tâche
8. faire avancer les deux tâches jusqu'à `Fait`
9. confirmer que les liens d'origine sont encore lisibles après clôture

Backlog technique associé : `docs/PARCOURS_03_BACKLOG_TECHNIQUE.md`
