from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SupabaseUser(BaseModel):
    id: str
    email: EmailStr | None = None
    role: str | None = None
    aud: str | None = None
    phone: str | None = None
    app_metadata: dict = Field(default_factory=dict)
    user_metadata: dict = Field(default_factory=dict)
    created_at: datetime | None = None
    last_sign_in_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: SupabaseUser
