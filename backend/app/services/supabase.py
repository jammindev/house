from functools import lru_cache

from supabase import Client, create_client

from ..core.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """
    Returns a cached Supabase client.
    Uses the service role key when available for server-side operations.
    """
    api_key = settings.supabase_service_role_key or settings.supabase_anon_key
    return create_client(settings.supabase_url, api_key)
