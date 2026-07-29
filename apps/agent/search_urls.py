"""Global search URL — mounted at `/api/search/` (see config/urls.py).

It lives in the agent app because the retrieval layer does, but it is *not* under
`/api/agent/`: the app-wide search box is a navigation affordance, not a
conversation with the assistant. The URL says so.
"""
from django.urls import path

from .search_api import GlobalSearchView

urlpatterns = [
    path("", GlobalSearchView.as_view(), name="global-search"),
]
