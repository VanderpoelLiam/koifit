"""
Koifit Workout Tracker - FastAPI Application
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from koifit.db import ensure_database
from koifit.routes import home_router, sessions_router
from koifit.settings import get_db_path


def create_app(db_path: Path | None = None) -> FastAPI:
    """
    Build the FastAPI application with a configurable database path.
    """
    resolved_db_path = db_path or get_db_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await ensure_database(resolved_db_path)
        app.state.db_path = resolved_db_path
        yield

    app = FastAPI(
        title="Koifit Workout Tracker",
        description="Self-hosted workout tracking application",
        lifespan=lifespan,
    )

    app.mount("/assets", StaticFiles(directory="app/assets"), name="assets")
    app.include_router(home_router)
    app.include_router(sessions_router)

    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
