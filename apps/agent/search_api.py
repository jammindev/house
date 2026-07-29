"""
Global household search — the app-wide search box, served by the agent's retrieval.

``GET /api/search/?q=…`` is the *only* endpoint of the app-wide search. It runs the
exact same ``retrieval.search`` the ``search_household`` tool runs, so what the user
finds in the top-bar palette and what the agent can cite are one and the same index:
one query, one ranking, one set of module-disabled exclusions. Nothing here knows
about any particular entity — adding a ``SearchableSpec`` makes the new entity
searchable from the palette with zero change to this file.

**The search box answers in two stages, and the query string says which one.**
``?q=…`` is the lexical stage: a few indexed SQL queries, back in milliseconds, shown
the instant they land. ``?q=…&semantic=1`` is the second stage — what only the meaning
finds (« chauffage » → « pompe à chaleur »), *minus* what the first stage already
returned, so the client appends a group instead of re-ordering the list under the
user's cursor.

Why two calls rather than one hybrid call: measured on production usage, embedding a
query takes **211 ms on average and up to 1.6 s**. Waiting for it would make every
keystroke feel that slow, and would put the search box behind the embedding
provider's availability. Two stages keep the box instant, degrade to lexical-only on
their own (an empty second response is a normal answer, not an error), and cost
nothing extra when a deployment has no semantic index — ``retrieval.semantic_only``
returns ``[]`` when the hybrid flag is off, without calling the provider.

Its own throttle scope: full-text is cheap, so the agent's 10/min burst cap would be
absurdly tight here; but a type-ahead endpoint is the easiest loop to leave running,
hence a bound of its own rather than none at all.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsHouseholdMember, resolve_request_household

from . import retrieval
from .throttles import SearchRateThrottle

# Cap on `limit`. The palette shows a couple of results per entity type; a client
# asking for hundreds would turn a type-ahead into a full table scan per keystroke.
MAX_LIMIT = 50
DEFAULT_LIMIT = 20

# Below this, a query matches nearly everything and ranks nothing. The client
# debounces and waits for the same threshold; the server enforces it so a direct
# caller cannot trigger the expensive-and-useless case.
MIN_QUERY_LENGTH = 2


def serialize_hits(hits: list[retrieval.Hit]) -> list[dict]:
    """Render retrieval hits as the search payload.

    Shared with the agent's context picker (``conversations/search_context``) so the
    two consumers of household search cannot drift into two shapes.

    ``snippet`` keeps the ``<<…>>`` markers emitted by ``SearchHeadline``: they carry
    *where* the match landed, which is the whole point of showing a snippet. The
    client turns them into ``<mark>`` — see ``ui/src/features/search/highlight.ts``.
    """
    return [
        {
            "entity_type": hit.entity_type,
            "object_id": str(hit.id),
            "label": hit.label,
            "url": hit.url_path,
            "snippet": hit.snippet,
        }
        for hit in hits
    ]


def _clamp_limit(raw: str | None) -> int:
    try:
        limit = int(raw) if raw else DEFAULT_LIMIT
    except (TypeError, ValueError):
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))


def search_household_entities(household_id, query: str, limit: int) -> list[dict]:
    """Stage one — the lexical search, serialized. One entry point, two URLs.

    Strips and gates the query here rather than trusting callers to: this is the
    shared door, and a caller that forgot would send whitespace to the retrieval.
    """
    query = (query or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return []
    hits = retrieval.search(household_id, query, limit=limit, hybrid=False)
    return serialize_hits(hits)


def semantic_household_entities(household_id, query: str, limit: int) -> list[dict]:
    """Stage two — what only the meaning finds, minus stage one's results."""
    query = (query or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return []
    return serialize_hits(retrieval.semantic_only(household_id, query, limit=limit))


def _wants_semantic(request) -> bool:
    """``?semantic=1`` (or ``true``/``yes``) asks for the second stage."""
    raw = (request.query_params.get("semantic") or "").strip().lower()
    return raw in {"1", "true", "yes"}


class GlobalSearchView(APIView):
    """``GET /api/search/?q=&limit=&semantic=`` — search everything the household owns.

    Same URL for both stages so the client has one contract and one payload shape;
    ``semantic=1`` is what changes which leg runs. Both answer ``{"results": [...]}``,
    and an empty list is always a valid answer — never an error.
    """

    permission_classes = [IsAuthenticated, IsHouseholdMember]
    throttle_classes = [SearchRateThrottle]

    def get(self, request):
        household = getattr(request, "household", None) or resolve_request_household(request)
        if household is None:
            return Response(
                {"detail": "No active household for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        query = (request.query_params.get("q") or "").strip()
        limit = _clamp_limit(request.query_params.get("limit"))
        run = semantic_household_entities if _wants_semantic(request) else search_household_entities
        return Response(
            {"results": run(household.id, query, limit)},
            status=status.HTTP_200_OK,
        )
