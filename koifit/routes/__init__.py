from .exercises import router as exercises_router
from .home import router as home_router
from .sessions import router as sessions_router

__all__ = ["exercises_router", "home_router", "sessions_router"]
