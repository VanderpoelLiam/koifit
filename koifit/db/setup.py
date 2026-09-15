"""
Utilities for creating and seeding the SQLite database.
"""

from pathlib import Path

import aiosqlite

SQL_DIR = Path(__file__).resolve().parent / "sql"


async def apply_schema(db):
    """Apply the SQL schema from db/schema.sql."""
    schema_path = SQL_DIR / "schema.sql"
    schema_sql = schema_path.read_text()
    await db.executescript(schema_sql)


async def apply_seed(db):
    """Seed the database from db/seed.sql."""
    seed_path = SQL_DIR / "seed.sql"
    seed_sql = seed_path.read_text()
    await db.executescript(seed_sql)


async def init_database(db_path, overwrite=False):
    """
    Create and seed a SQLite database at db_path.

    If overwrite is True and the file exists, it will be removed first.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if overwrite and db_path.exists():
        db_path.unlink()

    async with aiosqlite.connect(str(db_path)) as db:
        await apply_schema(db)
        await apply_seed(db)
        await db.commit()


async def ensure_database(db_path):
    """
    Ensure the database file exists; if missing, create and seed it.
    """
    if db_path.exists():
        return
    await init_database(db_path, overwrite=False)
