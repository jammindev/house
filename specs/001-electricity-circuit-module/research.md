# Research — Module Électricité Maison

## Decision 1: Créer une app Django dédiée `electricity`
- Decision: Implémenter une app Django autonome `electricity` (modèles, vues, serializers, urls, admin, tests).
- Rationale: Le module est métier, distinct des apps existantes, et doit rester lisible pendant la migration progressive Next.js -> Django.
- Alternatives considered:
  - Étendre `interactions`: rejeté car mélange timeline générale et structure électrique spécialisée.
  - Tout coder côté template sans app dédiée: rejeté car faible maintenabilité pour API/modèle/tests.

## Decision 2: Rendu principal en template Django, React ciblé pour zones complexes
- Decision: Rendre la page principale via `templates/app/electricity.html` avec contexte serveur complet; monter un nœud React uniquement pour visualisation/interaction complexe.
- Rationale: Aligné avec l’architecture du repo (Django-first + React islands) et la demande explicite utilisateur.
- Alternatives considered:
  - SPA React complète: rejeté car contraire à la stratégie migration.
  - 100% Django sans React: possible mais moins ergonomique pour visualisation interactive des correspondances.

## Decision 3: Contrat API DRF household-scoped
- Decision: Exposer des endpoints DRF sous `/api/electricity/` avec résolution household via `X-Household-Id` (et fallback pattern projet).
- Rationale: Cohérence avec les apps existantes (`interactions`, `zones`) et sécurité multi-tenant.
- Alternatives considered:
  - Endpoints HTML only: rejeté car le nœud React et les opérations async nécessitent une API claire.
  - API custom non-DRF: rejeté pour préserver les conventions du codebase.

## Decision 4: Permissions owner-write / member-read
- Decision: Lecture pour membres du foyer; création/modification/suppression réservées au owner.
- Rationale: Contrainte clarifiée dans la spec, cohérente avec la sensibilité des données électriques.
- Alternatives considered:
  - member write: rejeté (risque de dérive qualité/sécurité).
  - admin+owner write: rejeté car rôle admin non stabilisé dans le périmètre courant.

## Decision 5: Modéliser triphasé au niveau circuit (L1/L2/L3)
- Decision: Conserver `supply_type` au niveau tableau/foyer et `phase` au niveau circuit pour triphasé.
- Rationale: Répond à la contrainte utilisateur (“ma maison est en triphasé”) sans simuler la charge.
- Alternatives considered:
  - triphasé au niveau foyer seulement: rejeté car insuffisant fonctionnellement.
  - phase conditionnelle sur circuits “puissance”: rejeté car règle métier ambiguë au MVP.

## Decision 6: Soft delete des associations
- Decision: Désactiver les associations (statut actif/inactif + date/auteur de désactivation) au lieu de hard delete.
- Rationale: Traçabilité des modifications du plan électrique et cohérence avec besoin d’historique.
- Alternatives considered:
  - hard delete: rejeté car perte d’historique.
  - double mode soft/hard: rejeté pour limiter la complexité MVP.

## Decision 7: Unicité globale des repères par foyer
- Decision: Imposer l’unicité d’un repère visible sur l’ensemble des types d’éléments du plan d’un foyer.
- Rationale: Supprime les ambiguïtés de recherche bidirectionnelle.
- Alternatives considered:
  - unicité par type: rejeté car collisions inter-types possibles.
  - pas d’unicité: rejeté (qualité des données insuffisante).

## Decision 8: Intégration migration avec référence `legacy/`
- Decision: Utiliser `legacy/` comme documentation produit uniquement; implémenter exclusivement dans le code actif Django/DRF/templates/frontend.
- Rationale: Règle explicite du repo et réduction des risques de réintroduire des patterns obsolètes Next.js/Supabase.
- Alternatives considered:
  - porter des composants legacy directement: rejeté (écart d’architecture et dette technique).
