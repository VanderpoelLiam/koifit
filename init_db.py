#!/usr/bin/env python3
"""
Initialize the Koifit database with schema and seed data.
"""
import asyncio
import aiosqlite
from pathlib import Path


async def init_database():
    """Create database, apply schema, and seed data."""
    db_path = Path("db/db.sqlite")
    
    # Create db directory if it doesn't exist
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Remove existing database if it exists (for development)
    if db_path.exists():
        print(f"Removing existing database at {db_path}")
        db_path.unlink()
    
    async with aiosqlite.connect(str(db_path)) as db:
        print(f"Creating database at {db_path}")
        
        # Read and execute schema
        schema_path = Path("db/schema.sql")
        if schema_path.exists():
            print("Applying schema...")
            schema_sql = schema_path.read_text()
            await db.executescript(schema_sql)
            await db.commit()
        
        # Read and execute seed data
        seed_path = Path("db/seed.sql")
        if seed_path.exists():
            print("Seeding database...")
            seed_sql = seed_path.read_text()
            await db.executescript(seed_sql)
            await db.commit()
        
        # Verify data
        async with db.execute("SELECT COUNT(*) FROM exercise") as cursor:
            exercise_count = (await cursor.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM day") as cursor:
            day_count = (await cursor.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM slot") as cursor:
            slot_count = (await cursor.fetchone())[0]
        
        print(f"Database initialized successfully!")
        print(f"  - {exercise_count} exercises")
        print(f"  - {day_count} days")
        print(f"  - {slot_count} slots")


if __name__ == "__main__":
    asyncio.run(init_database())
