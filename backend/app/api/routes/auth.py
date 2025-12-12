import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.config import settings
from ...core.security import TokenPayload, get_current_user
from ...schemas.auth import LoginRequest, SupabaseUser, TokenResponse

router = APIRouter(tags=["auth"])


async def _login_with_supabase(email: str, password: str) -> TokenResponse:
    url = f"{settings.supabase_auth_url}/token?grant_type=password"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url, headers=headers, json={"email": email, "password": password}
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to reach Supabase auth service",
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from Supabase auth service",
        ) from exc

    if response.is_error:
        detail = (
            payload.get("error_description")
            or payload.get("msg")
            or payload.get("message")
            or "Invalid credentials"
        )
        status_code = (
            status.HTTP_401_UNAUTHORIZED
            if response.status_code < status.HTTP_500_INTERNAL_SERVER_ERROR
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=status_code, detail=detail)

    user_data = payload.get("user") or {}

    try:
        user = SupabaseUser(
            id=user_data["id"],
            email=user_data.get("email"),
            role=user_data.get("role"),
            aud=user_data.get("aud"),
            phone=user_data.get("phone"),
            app_metadata=user_data.get("app_metadata") or {},
            user_metadata=user_data.get("user_metadata") or {},
            created_at=user_data.get("created_at"),
            last_sign_in_at=user_data.get("last_sign_in_at"),
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase response missing user information",
        ) from exc

    try:
        return TokenResponse(
            access_token=payload["access_token"],
            refresh_token=payload["refresh_token"],
            token_type=payload.get("token_type", "bearer"),
            expires_in=payload.get("expires_in", 3600),
            user=user,
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase response missing token information",
        ) from exc


@router.post("/login", response_model=TokenResponse, summary="Login via Supabase")
async def login(payload: LoginRequest) -> TokenResponse:
    """
    Authenticate with Supabase using email and password.
    Returns the Supabase-issued access and refresh tokens.
    """
    return await _login_with_supabase(payload.email, payload.password)


@router.get(
    "/me",
    response_model=TokenPayload,
    summary="Inspect the current Supabase access token",
)
async def me(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """
    Decode the Supabase JWT using the configured JWT secret.
    Useful to verify the Authorization header is wired correctly.
    """
    return current_user
