"""
Koifit Workout Tracker - FastAPI Application
"""

from contextlib import asynccontextmanager

import aiosqlite
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from koifit.db import ensure_database
from koifit.routes import home_router, sessions_router
from koifit.settings import get_db_path


def create_app(db_path=None):
    """
    Build the FastAPI application with a configurable database path.
    """
    resolved_db_path = db_path or get_db_path()

    @asynccontextmanager
    async def lifespan(app):
        await ensure_database(resolved_db_path)
        # Create a single shared database connection for single-user app
        app.state.db = await aiosqlite.connect(str(resolved_db_path))
        app.state.db.row_factory = aiosqlite.Row
        yield
        await app.state.db.close()

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

    @app.get("/favicon.ico")
    async def favicon():
        """Serve favicon."""
        return RedirectResponse(url="/assets/images/favicon.png", status_code=301)

    @app.get("/apple-touch-icon.png")
    async def apple_touch_icon():
        """Serve Apple touch icon."""
        return RedirectResponse(
            url="/assets/images/apple-touch-icon.png", status_code=301
        )

    @app.get("/apple-touch-icon-precomposed.png")
    async def apple_touch_icon_precomposed():
        """Serve Apple touch icon (precomposed)."""
        return RedirectResponse(
            url="/assets/images/apple-touch-icon.png", status_code=301
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
