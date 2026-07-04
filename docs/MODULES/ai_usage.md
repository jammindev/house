# Module `ai_usage` — observabilité IA

## État synthétique

Livré (lot 6 du parcours 07, #109). Table d'audit + agrégations + page admin.

## Ce que fait le module

- **`AIUsageLog`** : une ligne par appel provider IA (agent, expansion de requête,
  OCR upload/backfill), écrite par `log_ai_usage(...)` depuis la couche
  `agent.llm` (`complete`, `run`, `run_stream`, `vision_extract`). Fail-soft :
  l'échec du log ne remonte jamais. `metadata` porte notamment les compteurs de
  prompt cache (`cache_read/creation_input_tokens`) sur les appels `run*`.
- **`aggregations.py`** : lecture pure, scopée foyer —
  - `summary` : par fenêtre (24h/7j/30j) — appels, taux d'erreur, latence p95
    (nearest-rank), taux « je ne sais pas » (calculé sur `AgentMessage.metadata.
    answer_kind`, pas sur les lignes par round-trip) + flags d'alerte
    (`idk_rate > 30 %`, `p95 > 10 s`).
  - `histogram` : appels par jour × feature, jours zéro-remplis (30 j par défaut,
    cap 90).
  - `recent` : 50 derniers appels (cap 200), filtre `feature`.
- **API** : `GET /api/ai-usage/{summary,histogram,recent}/` —
  `IsAuthenticated` + ownership vérifié explicitement (membre simple → 403).
- **UI** : `/app/admin/ai-usage/` (`ui/src/features/ai-usage/`) — KpiCards,
  histogramme empilé en pur CSS (pas de lib de charts), table des appels récents
  avec filtre par feature. Entrée sidebar « Usage IA » dans la section Admin,
  visible pour les owners (`useIsHouseholdOwner`, basé sur
  `current_user_role` de `/api/households/`).

## Décisions

- Pas de coût $ (décision produit) : on raisonne qualité d'usage.
- Le taux IDK vient d'`AgentMessage` (une question = plusieurs lignes
  `AIUsageLog`) — import paresseux pour garder les apps découplées.
- L'OCR passe par `LLMClient.vision_extract()` (`documents/extraction.py` ne
  parle plus jamais au SDK directement) — feature `ocr_upload` (upload +
  re-extraire) ou `ocr_backfill` (management command), modèle
  `LLM_VISION_MODEL`, timeout dédié `LLM_VISION_TIMEOUT_SECONDS` (60 s).

## Hors scope (V1)

Email/push sur seuil, export CSV, comparaison de providers, vue par utilisateur.
