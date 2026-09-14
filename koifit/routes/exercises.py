"""
Routes for exercise history.
"""

import json

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse

from koifit.templates import templates, title_qualifier

router = APIRouter()


@router.get("/slots/{slot_id}/history", response_class=HTMLResponse)
async def slot_history(slot_id: int, request: Request, exercise_id: int | None = None):
    """
    History page with 1RM chart for one exercise in one slot.

    Scoped to the exercise as well as the slot, so an exercise swapped in for a
    session keeps its own progression instead of joining the slot's line.
    """
    db = request.app.state.db

    cursor = await db.execute(
        "SELECT id, title, preferred_exercise_id FROM slot WHERE id = ?", (slot_id,)
    )
    slot = await cursor.fetchone()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if exercise_id is None:
        exercise_id = slot["preferred_exercise_id"]

    cursor = await db.execute("SELECT name FROM exercise WHERE id = ?", (exercise_id,))
    exercise = await cursor.fetchone()
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # Title the page after the exercise, keeping any "(Heavy)" / "(Back off)"
    # qualifier so the two slots sharing an exercise stay distinguishable.
    qualifier = title_qualifier(slot["title"])
    title = f"{exercise['name']} {qualifier}" if qualifier else exercise["name"]

    # Get all finished sessions for this exercise in this slot, with their sets
    cursor = await db.execute(
        """SELECT s.id as session_id, s.date,
                  se.id as se_id, se.effort_tag, se.next_time_note,
                  st.set_number, st.weight_kg, st.reps, st.is_drop
           FROM session_exercise se
           JOIN session s ON se.session_id = s.id
           JOIN set_entry st ON st.session_exercise_id = se.id
           WHERE se.slot_id = ? AND se.exercise_id = ?
                 AND s.is_finished = 1 AND st.is_done = 1
           ORDER BY s.date ASC, s.id ASC, st.set_number ASC""",
        (slot_id, exercise_id),
    )
    rows = await cursor.fetchall()

    # Group by session and compute best Epley 1RM
    sessions = {}
    for row in rows:
        sid = row["session_id"]
        if sid not in sessions:
            sessions[sid] = {
                "session_id": sid,
                "date": row["date"],
                "effort_tag": row["effort_tag"],
                "next_time_note": row["next_time_note"],
                "sets": [],
                "best_1rm": 0.0,
                "volume": 0.0,
            }
        weight = row["weight_kg"]
        reps = row["reps"]
        is_drop = row["is_drop"]
        sessions[sid]["sets"].append(
            {
                "set_number": row["set_number"],
                "weight_kg": weight,
                "reps": reps,
                "is_drop": bool(is_drop),
            }
        )
        # Epley 1RM from working sets only
        if not is_drop and weight > 0:
            estimated_1rm = weight * (1 + reps / 30.0)
            if estimated_1rm > sessions[sid]["best_1rm"]:
                sessions[sid]["best_1rm"] = round(estimated_1rm, 1)
        # Total volume (working sets only)
        if not is_drop and weight > 0:
            sessions[sid]["volume"] = round(sessions[sid]["volume"] + weight * reps, 1)

    history = list(sessions.values())

    template = templates.get_template("pages/exercise_history.html")
    return HTMLResponse(
        template.render(
            slot_title=title,
            history_json=json.dumps(history),
        )
    )
