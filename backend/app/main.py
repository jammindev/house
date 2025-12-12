from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import api_router
from .core.config import settings


def get_app() -> FastAPI:
    app = FastAPI(title=settings.project_name, debug=settings.debug)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = get_app()
