"""
Database connection dependency for FastAPI.
"""

from typing import AsyncGenerator

import aiosqlite
from fastapi import Request

from koifit.settings import get_db_path


async def get_db(request: Request) -> AsyncGenerator[aiosqlite.Connection, None]:
    """
    Provide an aiosqlite connection tied to the current request.

    The DB path is taken from app.state.db_path when available, falling back
    to the configured default.
    """
    db_path = getattr(request.app.state, "db_path", get_db_path())
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        yield db
