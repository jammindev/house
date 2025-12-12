from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from .core.config import settings


engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_models() -> None:
    """
    Optional helper to create tables mapped with SQLModel.
    Call explicitly when you want to sync models to the database.
    """
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
