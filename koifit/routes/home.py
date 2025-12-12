"""
Routes for the home and day selection pages.
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from koifit.templates import templates

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page - shows resume option or day selection."""
    db = request.app.state.db
    cursor = await db.execute(
        "SELECT id, day_id FROM session WHERE is_finished = 0 LIMIT 1"
    )
    unfinished = await cursor.fetchone()

    template = templates.get_template("pages/index.html")

    if unfinished:
        cursor = await db.execute(
            "SELECT label FROM day WHERE id = ?", (unfinished["day_id"],)
        )
        day = await cursor.fetchone()
        return HTMLResponse(
            template.render(
                has_unfinished_session=True,
                session_id=unfinished["id"],
                day_label=day["label"] if day else "Workout",
            )
        )

    cursor = await db.execute("SELECT id, label, ordinal FROM day ORDER BY ordinal")
    days = await cursor.fetchall()
    return HTMLResponse(
        template.render(
            has_unfinished_session=False,
            days=[dict(day) for day in days],
        )
    )


@router.get("/days", response_class=HTMLResponse)
async def days_page(request: Request):
    """Day selection page."""
    db = request.app.state.db
    cursor = await db.execute("SELECT id, label, ordinal FROM day ORDER BY ordinal")
    days = await cursor.fetchall()
    template = templates.get_template("pages/days.html")
    return HTMLResponse(template.render(days=[dict(day) for day in days]))
