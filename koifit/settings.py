"""
Application configuration helpers.
"""

import os
from pathlib import Path


def get_project_root():
    """Return repository root (one level above the koifit package)."""
    return Path(__file__).resolve().parent.parent


def get_db_path():
    """
    Resolve the SQLite database path.

    Prefers KOIFIT_DB_PATH env var, otherwise defaults to ./db/db.sqlite
    relative to the project root.
    """
    env_path = os.environ.get("KOIFIT_DB_PATH")
    if env_path:
        return Path(env_path)
    return get_project_root() / "db" / "db.sqlite"
