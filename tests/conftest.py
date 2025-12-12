from pathlib import Path

import aiosqlite
import pytest
from httpx import ASGITransport, AsyncClient
from asgi_lifespan import LifespanManager

from koifit.db.setup import init_database
from main import create_app


@pytest.fixture
async def db_path(tmp_path: Path) -> Path:
    """Create and seed a fresh database for each test."""
    path = tmp_path / "test.sqlite"
    await init_database(path, overwrite=True)
    return path


@pytest.fixture
async def client(db_path: Path):
    """FastAPI test client backed by the fresh database."""
    app = create_app(db_path=db_path)
    async with LifespanManager(app):
        transport = ASGITransport(app=app, raise_app_exceptions=True)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


@pytest.fixture
async def db_conn(db_path: Path):
    """Direct database connection helper for assertions."""
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        yield db
