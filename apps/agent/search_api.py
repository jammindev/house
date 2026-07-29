"""
Global household search — the app-wide search box, served by the agent's retrieval.

``GET /api/search/?q=…`` is the *only* endpoint of the app-wide search. It runs the
exact same ``retrieval.search`` the ``search_household`` tool runs, so what the user
finds in the top-bar palette and what the agent can cite are one and the same index:
one query, one ranking, one set of module-disabled exclusions. Nothing here knows
about any particular entity — adding a ``SearchableSpec`` makes the new entity
searchable from the palette with zero change to this file.

Two deliberate choices, both about search-as-you-type rather than about search:

- **``hybrid=False``.** The semantic leg costs one embedding call per query. Fine for
  a question asked to the agent, absurd for a debounced keystroke — see
  ``retrieval.search``.
- **Its own throttle scope.** Full-text is cheap, so the agent's 10/min burst cap
  would be absurdly tight here; but a type-ahead endpoint is the easiest loop to
  leave running, hence a bound of its own rather than none at all.
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
    """Run the palette's search and serialize it. One entry point, two URLs.

    Strips and gates the query here rather than trusting callers to: this is the
    shared door, and a caller that forgot would send whitespace to the retrieval.
    """
    query = (query or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        return []
    hits = retrieval.search(household_id, query, limit=limit, hybrid=False)
    return serialize_hits(hits)


class GlobalSearchView(APIView):
    """``GET /api/search/?q=&limit=`` — search everything the household owns."""

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
        return Response(
            {"results": search_household_entities(household.id, query, limit)},
            status=status.HTTP_200_OK,
        )
