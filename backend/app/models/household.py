import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class Household(SQLModel, table=True):
    __tablename__ = "households"

    id: uuid.UUID | None = Field(default=None, primary_key=True)
    name: str
    created_at: datetime | None = Field(default=None, nullable=True)
