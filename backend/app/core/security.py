from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ValidationError

from .config import settings


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


class TokenPayload(BaseModel):
    sub: str
    email: str | None = None
    aud: str | None = None
    exp: int
    role: str | None = None


def decode_supabase_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
        )
        return TokenPayload(**payload)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase token",
        ) from exc


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> TokenPayload:
    return decode_supabase_token(token)
