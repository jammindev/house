---
name: feedback_factory_vs_api_for_side_effects
description: When testing side-effects that require service layer execution, use API calls not factory_boy to create test data.
metadata:
  type: feedback
---

Factory-boy creates DB rows directly without running the service/view layer. When a test asserts on side-effects that are triggered by a viewset's `perform_create`/`perform_update`/`perform_destroy` (e.g., `rebuild_reading_records` regenerating `ConsumptionRecord` rows), the test must create the prerequisite data through the API (POST to the viewset) rather than through `Factory()`.

**Why:** `MeterReadingFactory()` inserts a row but never calls `rebuild_reading_records`. A test that checks "records exist after two readings" will fail if both readings were created via factory — the records never exist.

**How to apply:** Write a `_post_reading(client, ...)` helper inside the test class that POSTs to the list URL and asserts 201. Use that helper in tests that need side-effects. Only use factories when side-effects do not matter (e.g., testing list isolation, cross-household 404, member read permissions).
