# Phase 0 Research — Migration Zones 1:1 Legacy vers Django

## Decision 1: Adapter DRF ↔ Legacy dans une couche dédiée
- **Decision**: Introduire une couche d'adaptation front dédiée (`zones-adapter`) qui mappe les payloads DRF vers le shape legacy et inversement.
- **Rationale**: Préserve les signatures des composants/hooks legacy (`useZones`, `ZoneItem`, `ZoneEditDialog`) et réduit le risque de régression UX.
- **Alternatives considered**:
  - Réécrire les composants legacy pour consommer directement DRF: rejeté (trop d'écarts UX possibles).
  - Adapter ad hoc dans chaque composant: rejeté (duplication et dette technique).

## Decision 2: Stratégie de suppression pour zone parent
- **Decision**: Refuser la suppression d'une zone ayant des enfants et afficher un message explicite.
- **Rationale**: Évite les suppressions destructrices inattendues et aligne les règles métier clarifiées.
- **Alternatives considered**:
  - Cascade parent + descendants: rejeté (risque de perte de données).
  - Re-parentage automatique des enfants: rejeté (comportement implicite non souhaité).

## Decision 3: Conflits d'édition concurrente
- **Decision**: Utiliser un contrôle optimiste; rejeter la mise à jour obsolète avec réponse de conflit et demande de rechargement.
- **Rationale**: Garantit l'intégrité de mise à jour sans verrouillage serveur lourd et reste compatible avec DRF.
- **Alternatives considered**:
  - Last-write-wins: rejeté (écrasement silencieux).
  - Verrouillage pessimiste: rejeté (complexité et UX dégradée).

## Decision 4: Boundary SSR / React / Runtime API
- **Decision**: Conserver SSR léger Django pour shell + payload initial (`zones_page_props`), puis basculer toutes mutations sur DRF ViewSet + actions custom.
- **Rationale**: Respecte le pattern d'architecture du repo et garantit une hydratation initiale fiable.
- **Alternatives considered**:
  - Full client-side fetch sans payload initial: rejeté (flash d'état vide et parité réduite).
  - Full SSR sans mini-SPA: rejeté (hors cible de migration).

## Decision 5: Contrats d'interface à maintenir
- **Decision**: Documenter explicitement les contrats API zones et les payloads web (liste/détail) dans `contracts/`.
- **Rationale**: Conformité constitutionnelle (Contract-First) et réduction des ambiguïtés d'intégration.
- **Alternatives considered**:
  - Déduire les contrats depuis le code uniquement: rejeté (pas de garantie de synchronisation spec/plan/tests).

## Decision 6: i18n dans la migration
- **Decision**: Réutiliser les clés de traduction existantes et interdire l'ajout de chaînes hardcodées dans les composants migrés.
- **Rationale**: Conformité constitution v1.3.0 et réduction de régression linguistique sur `en/fr/de/es`.
- **Alternatives considered**:
  - Reporter l'i18n après migration: rejeté (non conforme constitution).

## Decision 7: Stratégie de vérification
- **Decision**: Valider en deux paliers (liste/arbre puis détail/photos) avec tests ciblés Django + checks UX de parité.
- **Rationale**: Réduit le risque de migration et facilite l'isolation des régressions.
- **Alternatives considered**:
  - Big bang livraison unique: rejeté (risque de débogage élevé).

## Resolved Clarifications
- Suppression parent avec enfants: **bloquée** avec message explicite.
- Édition concurrente: **update obsolète rejetée** avec erreur de conflit et demande de rechargement.

Tous les points `NEEDS CLARIFICATION` sont considérés résolus pour passer en design.
