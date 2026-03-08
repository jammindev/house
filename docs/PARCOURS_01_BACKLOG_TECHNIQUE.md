# Parcours 01 — Backlog technique V1

Ce document traduit la décision produit V1 en backlog technique concret pour le repo actuel.

Flow cible :

1. dashboard
2. CTA unique `Ajouter`
3. `SheetDialog` de choix du type
4. redirection vers `/app/interactions/new/?type=...`
5. formulaire unique avec tronc commun + variantes conditionnelles
6. retour vers l'historique

## Objectif d'implémentation

Livrer une première version utilisable sans refactor large, en réutilisant au maximum l'architecture déjà en place :

- dashboard React déjà hydraté côté Django
- page de création interactions déjà existante
- API `interactions` déjà en production locale dans le repo
- design system déjà équipé avec `SheetDialog`

## Principe d'exécution

Le backlog est organisé en lots techniques verticaux.

Chaque lot doit produire un incrément testable.

## Lot 1 — CTA dashboard unique et ouverture du sélecteur

### But

Remplacer l'action `New interaction` du dashboard par un CTA unique qui ouvre un sélecteur de type, sans charger le dashboard en boutons multiples.

### Fichiers principaux

- [apps/accounts/views/template_views.py](/Users/benjaminvandamme/Developer/house/apps/accounts/views/template_views.py)
- [apps/accounts/react/DashboardPage.tsx](/Users/benjaminvandamme/Developer/house/apps/accounts/react/DashboardPage.tsx)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/fr/translation.json)

### Tâches

1. Faire évoluer la `quickAction` principale du dashboard.
2. Remplacer le libellé `New interaction` par un libellé produit de type `Add` ou `Add item` ou `Add event` selon la direction retenue.
3. Ajouter dans les props dashboard les données nécessaires au sélecteur de type si besoin.
4. Prévoir dans `DashboardPage` un mode spécial pour le CTA principal : ouverture d'overlay au lieu de lien simple.

### Notes techniques

- Aujourd'hui, `quickActions` est rendu comme une liste de liens simples.
- Il faudra probablement introduire une variante d'action, par exemple `kind: 'link' | 'dialog'` ou un booléen du type `opensTypePicker`.
- L'évolution doit rester compatible avec les autres quick actions existantes.

### Critères de validation

- le dashboard n'affiche qu'un seul CTA principal pour la création
- ce CTA n'envoie plus directement sur un formulaire vide
- les autres quick actions continuent de fonctionner normalement

## Lot 2 — SheetDialog de sélection du type

### But

Ajouter une `SheetDialog` qui propose un choix de type clair, hiérarchisé et extensible.

### Fichiers principaux

- [apps/accounts/react/DashboardPage.tsx](/Users/benjaminvandamme/Developer/house/apps/accounts/react/DashboardPage.tsx)
- [ui/src/design-system/sheet-dialog.tsx](/Users/benjaminvandamme/Developer/house/ui/src/design-system/sheet-dialog.tsx)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/fr/translation.json)

### Tâches

1. Intégrer `SheetDialog` dans le dashboard.
2. Créer une structure de données pour les types affichés dans le picker.
3. Séparer les types principaux et secondaires.
4. Ajouter titre, description et microcopy courte par type.
5. Au clic sur un type, rediriger vers `/app/interactions/new/?type=...`.

### Recommandation de structure de données

Prévoir un tableau local ou hydraté contenant au minimum :

- `value`
- `label`
- `description`
- `group`
- `icon` éventuelle

### Critères de validation

- le picker s'ouvre depuis le dashboard
- les 4 types principaux sont immédiatement visibles
- les types secondaires existent sans surcharger le premier niveau
- le clic sur un type redirige correctement

## Lot 3 — Vocabulaire produit et labels cohérents

### But

Réduire le poids du mot `interaction` dans l'UI tout en gardant le modèle technique intact.

### Fichiers principaux

- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/fr/translation.json)

### Tâches

1. Renommer les titres de page et titres de composants quand ils sont trop techniques.
2. Remplacer `Create interaction` par une formulation plus naturelle.
3. Remplacer `Latest interactions` par une formulation produit plus claire.
4. Prévoir les labels des types visibles dans la langue utilisateur.

### Critères de validation

- le mot `interaction` reste acceptable dans la navigation ou le code, mais n'est plus le CTA principal dominant
- la création et la liste parlent un langage plus concret

## Lot 4 — Formulaire unique avec tronc commun et variantes conditionnelles

### But

Faire évoluer le formulaire de création pour qu'il s'adapte au type choisi, sans exploser en formulaires séparés.

### Fichiers principaux

- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionCreateForm.tsx)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [ui/src/locales/en/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/en/translation.json)
- [ui/src/locales/fr/translation.json](/Users/benjaminvandamme/Developer/house/ui/src/locales/fr/translation.json)

### Tâches

1. Afficher clairement le type sélectionné en tête de formulaire.
2. Conserver un tronc commun : titre, date/heure, zone, description.
3. Faire apparaître les champs spécifiques selon le type.
4. Masquer ou désactiver proprement le statut quand il n'est pas pertinent.
5. Garder la possibilité de changer le type sans casser le formulaire.

### Variantes V1 recommandées

- `note` : tronc commun uniquement
- `todo` : statut visible
- `expense` : montant en plus
- `maintenance` : tronc commun uniquement en V1

### Point d'attention API

Le type `expense` aura besoin d'un champ supplémentaire côté payload. Le plus simple pour la V1 est probablement de l'écrire dans `metadata`, déjà présent côté modèle et serializer.

### Critères de validation

- le formulaire change réellement selon le type
- l'expérience reste lisible et rapide
- aucun besoin de créer une page distincte par type

## Lot 5 — Support minimal des champs spécifiques côté API

### But

Permettre aux variantes de formulaire d'envoyer leurs données sans casser le contrat existant.

### Fichiers principaux

- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)
- [apps/interactions/serializers.py](/Users/benjaminvandamme/Developer/house/apps/interactions/serializers.py)
- [apps/interactions/tests/test_api_interactions.py](/Users/benjaminvandamme/Developer/house/apps/interactions/tests/test_api_interactions.py)

### Tâches

1. Étendre `CreateInteractionInput` si nécessaire.
2. Décider du mapping des champs spécifiques vers `metadata`.
3. Ajouter ou ajuster les tests API pour couvrir au moins un cas de type spécifique.

### Recommandation V1

- ne pas changer le modèle Django pour cette itération
- utiliser `metadata` pour les champs temporaires ou spécifiques
- ne faire évoluer le schéma que lorsqu'un type devient assez structurant pour le justifier

### Critères de validation

- un `expense` peut être créé avec ses infos minimales
- l'API continue d'accepter les types simples existants
- les tests de création restent verts

## Lot 6 — Retour cohérent vers l'historique après création

### But

Faire du retour post-submit une vraie fin de flux, pas une simple redirection brute.

### Fichiers principaux

- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)
- [apps/interactions/react/InteractionCreateForm.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)

### Tâches

1. Garder la redirection vers la liste comme comportement standard.
2. S'assurer que la liste se recharge bien après création.
3. Étudier si un paramètre de query peut aider à mettre en évidence l'élément créé.
4. Conserver un message de succès visible avant redirection ou à l'arrivée.

### Critères de validation

- retour cohérent après création depuis le dashboard
- l'utilisateur voit rapidement le résultat de son action
- la confiance dans le flux augmente

## Lot 7 — Ajustement de la liste et de la retrouvabilité

### But

Renforcer la lisibilité de la vue historique, sans attendre une refonte complète.

### Fichiers principaux

- [apps/interactions/react/InteractionList.tsx](/Users/benjaminvandamme/Developer/house/apps/interactions/react/InteractionList.tsx)
- [ui/src/lib/api/interactions.ts](/Users/benjaminvandamme/Developer/house/ui/src/lib/api/interactions.ts)
- [apps/interactions/views_web.py](/Users/benjaminvandamme/Developer/house/apps/interactions/views_web.py)

### Tâches

1. Vérifier la lisibilité des badges type/statut.
2. Améliorer les labels affichés pour les types si besoin.
3. Vérifier que les filtres type/statut restent cohérents avec le nouveau vocabulaire.
4. Décider si la recherche textuelle visible entre dans cette V1 ou non.

### Recommandation

Pour cette V1, les filtres type/statut suffisent probablement. La recherche textuelle visible peut rester dans le backlog suivant si le timing est serré.

### Critères de validation

- un utilisateur retrouve rapidement un élément récent
- la liste reste simple et non surchargée

## Lot 8 — Tests et validation manuelle

### But

Sécuriser le flux sans multiplier les tests inutiles.

### Fichiers principaux

- [apps/accounts/tests/test_views.py](/Users/benjaminvandamme/Developer/house/apps/accounts/tests/test_views.py)
- [apps/interactions/tests/test_api_interactions.py](/Users/benjaminvandamme/Developer/house/apps/interactions/tests/test_api_interactions.py)

### Tâches

1. Ajouter un test dashboard si le payload change.
2. Ajouter ou ajuster les tests API pour les champs spécifiques.
3. Vérifier les labels exposés si des assertions de contenu existent déjà.

### Validation manuelle minimale

1. ouvrir le dashboard
2. cliquer sur `Ajouter`
3. choisir `Note`
4. arriver sur le formulaire prérempli
5. créer l'élément
6. revenir sur l'historique
7. filtrer si besoin
8. répéter avec `Tâche` et `Dépense`

## Ordre recommandé d'implémentation

1. Lot 1 — CTA dashboard
2. Lot 2 — Sheet type picker
3. Lot 3 — Vocabulaire UI
4. Lot 4 — Variantes du formulaire
5. Lot 5 — Support minimal API
6. Lot 6 — Retour vers l'historique
7. Lot 7 — Lisibilité de la liste
8. Lot 8 — Tests et validation

## Découpage en PRs ou sessions de travail

Si tu veux garder de petites itérations propres, je découperais en 3 sessions :

### Session 1

- Lot 1
- Lot 2
- début Lot 3

### Session 2

- fin Lot 3
- Lot 4
- Lot 5

### Session 3

- Lot 6
- Lot 7
- Lot 8

## Points de vigilance

- ne pas casser le pattern générique des `quickActions`
- ne pas transformer le dashboard en écran de formulaire complet
- ne pas sur-spécialiser les types trop tôt
- ne pas introduire de schéma backend complexe tant que `metadata` suffit
- garder un vocabulaire produit cohérent entre dashboard, création et historique

## Définition de done technique

La V1 peut être considérée terminée si :

1. le dashboard ouvre un sélecteur de type via un CTA unique
2. le type sélectionné amène vers la création préremplie
3. le formulaire change légèrement selon le type
4. la création fonctionne toujours via l'API existante
5. le retour vers l'historique est clair
6. les tests essentiels sont à jour