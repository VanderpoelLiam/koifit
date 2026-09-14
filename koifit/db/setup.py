"""
Utilities for creating and seeding the SQLite database.
"""

from pathlib import Path

import aiosqlite

SQL_DIR = Path(__file__).resolve().parent / "sql"

# Which exercises can substitute for each other. The swap picker on the session
# page only offers exercises sharing a group, so this is the single source of
# truth for both fresh databases and existing ones.
EXERCISE_GROUPS = {
    "Chest": [
        "Flat DB Press",
        "Cable Chest Press",
        "Barbell Bench Press",
        "Chest Press Machine",
    ],
    "Back": [
        "2-Grip Lat Pulldown",
        "Seated Cable Row",
        "Pendlay Row",
        "Weighted Pullup",
        "Barbell Row",
        "Lat Pulldown Machine",
        "Seated Row Machine",
    ],
    "Shoulders": [
        "Seated DB Shoulder Press",
        "Machine Shoulder Press",
        "DB Lateral Raise",
    ],
    "Triceps": [
        "Overhead Cable Triceps Extension",
        "Triceps Pressdown",
        "Triceps Pressure Machine",
    ],
    "Biceps": [
        "EZ Bar Curl",
        "DB Incline Curl",
    ],
    "Quads": [
        "Barbell Squat",
        "Hack Squat",
        "Leg Press",
        "Leg Extension",
        "Lunges",
    ],
    # Roman Chair sits here rather than in a group of its own so it stays
    # reachable from the posterior-chain slots.
    "Hamstrings": [
        "Lying Hamstring Curl",
        "Romanian Deadlift",
        "Seated Hamstring Curl",
        "Roman Chair",
    ],
}

# Exercises added after the original seed. seed.sql only runs for a database
# that does not exist yet, so these are inserted by a migration instead and
# reach existing databases too. Keyed by name, which is how they are matched.
ADDED_EXERCISES = [
    ("Barbell Bench Press", 2.5, "Shoulder blades retracted, bar to lower chest"),
    ("Barbell Row", 2.5, "Torso stable, pull to lower chest, only the bar moves"),
    ("Seated Hamstring Curl", 2.5, "Pad just above the knee, control the negative"),
    (
        "Roman Chair",
        1.25,
        "Hinge at the hips, neutral spine, no hyperextension at the top",
    ),
    ("Lunges", 2.5, "Long stride, torso upright, drive through the front heel"),
    (
        "Lat Pulldown Machine",
        2.5,
        "Plate machine version. Runs heavier than the cable pulldown",
    ),
    ("Seated Row Machine", 2.5, "Machine version. Squeeze shoulder blades"),
    ("Chest Press Machine", 2.5, "Machine version. Note the arm/seat position"),
    (
        "Triceps Pressure Machine",
        1.0,
        "Measured in pressure, not kg. Note which machine and the height setting",
    ),
]


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


async def apply_migrations(db):
    """
    Bring an existing database up to date with the current schema.

    schema.sql only uses CREATE TABLE IF NOT EXISTS, so columns added to it
    later never reach a database that already exists. Every step here must be
    idempotent and safe to run on each startup.
    """
    cursor = await db.execute("PRAGMA table_info(exercise)")
    columns = {row[1] for row in await cursor.fetchall()}
    if "muscle_group" not in columns:
        await db.execute("ALTER TABLE exercise ADD COLUMN muscle_group TEXT")

    cursor = await db.execute("PRAGMA table_info(session_exercise)")
    columns = {row[1] for row in await cursor.fetchall()}
    if "working_sets_count" not in columns:
        await db.execute(
            "ALTER TABLE session_exercise ADD COLUMN working_sets_count INTEGER"
        )

    # Insert by name if absent. Retiring one of these is done by setting
    # active = 0 rather than deleting it, so the row survives and is not
    # recreated here on the next startup.
    for name, min_increment, notes in ADDED_EXERCISES:
        await db.execute(
            """INSERT INTO exercise (name, min_increment, notes)
               SELECT ?, ?, ?
               WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE name = ?)""",
            (name, min_increment, notes, name),
        )

    # Backfill by name. Only touches rows with no group yet, so a group edited
    # by hand in the database is left alone.
    for group, names in EXERCISE_GROUPS.items():
        placeholders = ",".join("?" for _ in names)
        await db.execute(
            f"""UPDATE exercise SET muscle_group = ?
                WHERE muscle_group IS NULL AND name IN ({placeholders})""",
            (group, *names),
        )
    await db.commit()


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
