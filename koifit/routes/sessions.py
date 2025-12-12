"""
Routes for sessions: start, view, autosave, and finish.
"""

from datetime import date

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from koifit.templates import templates
from koifit.models import (
    FinishSessionResponse,
    SaveExerciseRequest,
    SaveExerciseResponse,
)

router = APIRouter()


@router.post("/sessions/start/{day_id}")
async def start_session(day_id, request: Request):
    """Create a new session, discarding any unfinished session."""
    db = request.app.state.db

    # Delete any unfinished sessions and their related data
    cursor = await db.execute("SELECT id FROM session WHERE is_finished = 0")
    unfinished_sessions = await cursor.fetchall()

    for unfinished in unfinished_sessions:
        session_id = unfinished["id"]
        # Get session_exercise IDs for this session
        cursor = await db.execute(
            "SELECT id FROM session_exercise WHERE session_id = ?", (session_id,)
        )
        session_exercises = await cursor.fetchall()

        # Delete set_entries for each session_exercise
        for se in session_exercises:
            await db.execute(
                "DELETE FROM set_entry WHERE session_exercise_id = ?", (se["id"],)
            )

        # Delete session_exercises
        await db.execute(
            "DELETE FROM session_exercise WHERE session_id = ?", (session_id,)
        )

        # Delete the session
        await db.execute("DELETE FROM session WHERE id = ?", (session_id,))

    await db.commit()

    cursor = await db.execute("SELECT id FROM day WHERE id = ?", (day_id,))
    day = await cursor.fetchone()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    today = date.today().isoformat()
    cursor = await db.execute(
        "INSERT INTO session (day_id, date, is_finished) VALUES (?, ?, 0)",
        (day_id, today),
    )
    session_id = cursor.lastrowid
    await db.commit()

    return RedirectResponse(url=f"/sessions/{session_id}", status_code=303)


@router.get("/sessions/{session_id}", response_class=HTMLResponse)
async def session_page(session_id, request: Request):
    """Workout session page."""
    db = request.app.state.db
    cursor = await db.execute(
        "SELECT id, day_id, date, is_finished FROM session WHERE id = ?",
        (session_id,),
    )
    session = await cursor.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    cursor = await db.execute(
        "SELECT id, label FROM day WHERE id = ?", (session["day_id"],)
    )
    day = await cursor.fetchone()

    cursor = await db.execute(
        """SELECT s.id, s.ordinal, s.title, s.preferred_exercise_id, s.warmup_sets,
                  s.working_sets_count, s.rep_target, s.rpe_range, s.rest_minutes, s.has_dropset,
                  e.name as exercise_name, e.notes as exercise_notes
           FROM slot s
           JOIN exercise e ON s.preferred_exercise_id = e.id
           WHERE s.day_id = ?
           ORDER BY s.ordinal""",
        (session["day_id"],),
    )
    slots = await cursor.fetchall()

    session_exercises = []
    for slot in slots:
        cursor = await db.execute(
            "SELECT id FROM session_exercise WHERE session_id = ? AND slot_id = ?",
            (session_id, slot["id"]),
        )
        se = await cursor.fetchone()

        if not se:
            cursor = await db.execute(
                """INSERT INTO session_exercise (session_id, slot_id, exercise_id, dropset_done)
                   VALUES (?, ?, ?, 0)""",
                (session_id, slot["id"], slot["preferred_exercise_id"]),
            )
            se_id = cursor.lastrowid
            await db.commit()
        else:
            se_id = se["id"]

        cursor = await db.execute(
            """SELECT id, effort_tag, next_time_note, dropset_done
               FROM session_exercise WHERE id = ?""",
            (se_id,),
        )
        se_data = await cursor.fetchone()

        cursor = await db.execute(
            """SELECT set_number, weight_kg, reps, is_done, is_drop
               FROM set_entry WHERE session_exercise_id = ?
               ORDER BY set_number""",
            (se_id,),
        )
        sets = await cursor.fetchall()

        cursor = await db.execute(
            """SELECT se.next_time_note, se.effort_tag, se.id as prev_se_id
               FROM session_exercise se
               JOIN session s ON se.session_id = s.id
               WHERE se.slot_id = ? AND se.exercise_id = ? AND s.is_finished = 1
               ORDER BY s.date DESC, s.id DESC
               LIMIT 1""",
            (slot["id"], slot["preferred_exercise_id"]),
        )
        prev_session = await cursor.fetchone()

        prev_sets = []
        if prev_session:
            cursor = await db.execute(
                """SELECT set_number, weight_kg, reps
                   FROM set_entry
                   WHERE session_exercise_id = ? AND is_drop = 0
                   ORDER BY set_number""",
                (prev_session["prev_se_id"],),
            )
            prev_sets = await cursor.fetchall()

        session_exercises.append(
            {
                "id": se_id,
                "slot": dict(slot),
                "effort_tag": se_data["effort_tag"] if se_data else None,
                "next_time_note": se_data["next_time_note"] if se_data else None,
                "dropset_done": se_data["dropset_done"] if se_data else 0,
                "sets": [dict(s) for s in sets],
                "previous": {
                    "next_time_note": prev_session["next_time_note"]
                    if prev_session
                    else None,
                    "effort_tag": prev_session["effort_tag"] if prev_session else None,
                    "sets": [dict(s) for s in prev_sets],
                }
                if prev_session
                else None,
            }
        )

    template = templates.get_template("pages/session.html")
    return HTMLResponse(
        template.render(
            session={"id": session["id"], "date": session["date"]},
            day=dict(day),
            session_exercises=session_exercises,
        )
    )


@router.post(
    "/sessions/{session_id}/exercises/{session_exercise_id}/save",
    response_model=SaveExerciseResponse,
)
async def save_exercise(
    session_id,
    session_exercise_id,
    data: SaveExerciseRequest,
    request: Request,
):
    """Auto-save endpoint for exercise data."""
    db = request.app.state.db
    cursor = await db.execute(
        "SELECT id FROM session_exercise WHERE id = ? AND session_id = ?",
        (session_exercise_id, session_id),
    )
    se = await cursor.fetchone()
    if not se:
        raise HTTPException(status_code=404, detail="Session exercise not found")

    updates = []
    params = []
    if data.notes is not None:
        updates.append("next_time_note = ?")
        params.append(data.notes)
    if data.effort_tag is not None:
        updates.append("effort_tag = ?")
        params.append(data.effort_tag)
    if data.dropset_done is not None:
        updates.append("dropset_done = ?")
        params.append(data.dropset_done)

    if updates:
        params.append(session_exercise_id)
        query = f"UPDATE session_exercise SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, params)
        await db.commit()

    if data.sets:
        for set_data in data.sets:
            cursor = await db.execute(
                """SELECT id FROM set_entry
                   WHERE session_exercise_id = ? AND set_number = ?""",
                (session_exercise_id, set_data.set_number),
            )
            existing = await cursor.fetchone()

            if existing:
                await db.execute(
                    """UPDATE set_entry
                       SET weight_kg = ?, reps = ?, is_done = ?
                       WHERE id = ?""",
                    (
                        set_data.weight_kg,
                        set_data.reps,
                        set_data.is_done,
                        existing["id"],
                    ),
                )
            else:
                await db.execute(
                    """INSERT INTO set_entry
                       (session_exercise_id, set_number, weight_kg, reps, is_done, is_drop)
                       VALUES (?, ?, ?, ?, ?, 0)""",
                    (
                        session_exercise_id,
                        set_data.set_number,
                        set_data.weight_kg,
                        set_data.reps,
                        set_data.is_done,
                    ),
                )
        await db.commit()

    return SaveExerciseResponse(status="ok")


@router.post("/sessions/{session_id}/finish", response_model=FinishSessionResponse)
async def finish_session(session_id, request: Request):
    """Mark session as finished."""
    db = request.app.state.db
    cursor = await db.execute(
        "SELECT id, is_finished FROM session WHERE id = ?", (session_id,)
    )
    session = await cursor.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["is_finished"]:
        raise HTTPException(status_code=400, detail="Session already finished")

    await db.execute("UPDATE session SET is_finished = 1 WHERE id = ?", (session_id,))
    await db.commit()

    return FinishSessionResponse(status="ok", redirect="/")
