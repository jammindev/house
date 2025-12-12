"""
API package grouping versioned routers.
"""

from fastapi import APIRouter

from .auth import router as auth_router
from .health import router as health_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth")
api_router.include_router(health_router, prefix="/health")

__all__ = ["api_router"]
