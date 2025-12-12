#!/usr/bin/env python3
"""
Initialize the Koifit database with schema and seed data.
"""
import asyncio
from pathlib import Path

from koifit.db import init_database
from koifit.settings import get_db_path


async def main():
    """
    Rebuild the database from schema + seed.
    """
    db_path = get_db_path()
    print(f"Rebuilding database at {db_path}")
    await init_database(db_path, overwrite=True)
    print("Database initialized successfully.")


if __name__ == "__main__":
    asyncio.run(main())
