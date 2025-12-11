"""
Koifit Workout Tracker - FastAPI Application
"""
import aiosqlite
from contextlib import asynccontextmanager
from datetime import date
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader
from models import SaveExerciseRequest, SaveExerciseResponse, FinishSessionResponse
from pathlib import Path
from typing import AsyncGenerator

# Database path
DB_PATH = Path("db/db.sqlite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure database exists on startup."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        print("Database not found. Please run: uv run python init_db.py")
    yield


# Initialize FastAPI app
app = FastAPI(
    title="Koifit Workout Tracker",
    description="Self-hosted workout tracking application",
    lifespan=lifespan,
)

# Mount static files
app.mount("/assets", StaticFiles(directory="app/assets"), name="assets")

# Setup Jinja2 templates
jinja_env = Environment(loader=FileSystemLoader("views"), autoescape=True)


# Database dependency
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Get database connection."""
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        yield db


# Health check endpoint
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# Root endpoint - will be implemented in API phase
@app.get("/", response_class=HTMLResponse)
async def home(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """Home page - shows resume option or day selection."""
    # Check for unfinished session
    cursor = await db.execute(
        "SELECT id, day_id FROM session WHERE is_finished = 0 LIMIT 1"
    )
    unfinished = await cursor.fetchone()
    
    if unfinished:
        # Get day label for resume
        cursor = await db.execute(
            "SELECT label FROM day WHERE id = ?", (unfinished["day_id"],)
        )
        day = await cursor.fetchone()
        template = jinja_env.get_template("pages/index.html")
        return HTMLResponse(
            template.render(
                has_unfinished_session=True,
                session_id=unfinished["id"],
                day_label=day["label"] if day else "Workout",
            )
        )
    else:
        # Get all days
        cursor = await db.execute("SELECT id, label, ordinal FROM day ORDER BY ordinal")
        days = await cursor.fetchall()
        template = jinja_env.get_template("pages/index.html")
        return HTMLResponse(
            template.render(
                has_unfinished_session=False,
                days=[dict(day) for day in days],
            )
        )


@app.get("/days", response_class=HTMLResponse)
async def days_page(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """Day selection page."""
    cursor = await db.execute("SELECT id, label, ordinal FROM day ORDER BY ordinal")
    days = await cursor.fetchall()
    template = jinja_env.get_template("pages/days.html")
    return HTMLResponse(
        template.render(days=[dict(day) for day in days])
    )


@app.post("/sessions/start/{day_id}")
async def start_session(day_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Create a new session or return existing unfinished session."""
    # Check for existing unfinished session
    cursor = await db.execute(
        "SELECT id FROM session WHERE is_finished = 0 LIMIT 1"
    )
    unfinished = await cursor.fetchone()
    
    if unfinished:
        # Resume existing session
        return RedirectResponse(url=f"/sessions/{unfinished['id']}", status_code=303)
    
    # Verify day exists
    cursor = await db.execute("SELECT id FROM day WHERE id = ?", (day_id,))
    day = await cursor.fetchone()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    
    # Create new session
    today = date.today().isoformat()
    cursor = await db.execute(
        "INSERT INTO session (day_id, date, is_finished) VALUES (?, ?, 0)",
        (day_id, today)
    )
    session_id = cursor.lastrowid
    await db.commit()
    
    return RedirectResponse(url=f"/sessions/{session_id}", status_code=303)


@app.get("/sessions/{session_id}", response_class=HTMLResponse)
async def session_page(session_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Workout session page."""
    # Get session
    cursor = await db.execute(
        "SELECT id, day_id, date, is_finished FROM session WHERE id = ?",
        (session_id,)
    )
    session = await cursor.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get day and slots
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
        (session["day_id"],)
    )
    slots = await cursor.fetchall()
    
    # Get or create session exercises
    session_exercises = []
    for slot in slots:
        # Check if session_exercise exists
        cursor = await db.execute(
            "SELECT id FROM session_exercise WHERE session_id = ? AND slot_id = ?",
            (session_id, slot["id"])
        )
        se = await cursor.fetchone()
        
        if not se:
            # Create session_exercise lazily
            cursor = await db.execute(
                """INSERT INTO session_exercise (session_id, slot_id, exercise_id, dropset_done)
                   VALUES (?, ?, ?, 0)""",
                (session_id, slot["id"], slot["preferred_exercise_id"])
            )
            se_id = cursor.lastrowid
            await db.commit()
        else:
            se_id = se["id"]
        
        # Get session exercise data
        cursor = await db.execute(
            """SELECT id, effort_tag, next_time_note, dropset_done
               FROM session_exercise WHERE id = ?""",
            (se_id,)
        )
        se_data = await cursor.fetchone()
        
        # Get set entries
        cursor = await db.execute(
            """SELECT set_number, weight_kg, reps, is_done, is_drop
               FROM set_entry WHERE session_exercise_id = ?
               ORDER BY set_number""",
            (se_id,)
        )
        sets = await cursor.fetchall()
        
        # Get previous session data (most recent completed session for same slot/exercise)
        cursor = await db.execute(
            """SELECT se.next_time_note, se.effort_tag, se.id as prev_se_id
               FROM session_exercise se
               JOIN session s ON se.session_id = s.id
               WHERE se.slot_id = ? AND se.exercise_id = ? AND s.is_finished = 1
               ORDER BY s.date DESC, s.id DESC
               LIMIT 1""",
            (slot["id"], slot["preferred_exercise_id"])
        )
        prev_session = await cursor.fetchone()
        
        prev_sets = []
        if prev_session:
            # Get previous session's sets (non-dropset only)
            cursor = await db.execute(
                """SELECT set_number, weight_kg, reps
                   FROM set_entry
                   WHERE session_exercise_id = ? AND is_drop = 0
                   ORDER BY set_number""",
                (prev_session["prev_se_id"],)
            )
            prev_sets = await cursor.fetchall()
        
        session_exercises.append({
            "id": se_id,
            "slot": dict(slot),
            "effort_tag": se_data["effort_tag"] if se_data else None,
            "next_time_note": se_data["next_time_note"] if se_data else None,
            "dropset_done": se_data["dropset_done"] if se_data else 0,
            "sets": [dict(s) for s in sets],
            "previous": {
                "next_time_note": prev_session["next_time_note"] if prev_session else None,
                "effort_tag": prev_session["effort_tag"] if prev_session else None,
                "sets": [dict(s) for s in prev_sets],
            } if prev_session else None,
        })
    
    template = jinja_env.get_template("pages/session.html")
    return HTMLResponse(
        template.render(
            session={"id": session["id"], "date": session["date"]},
            day=dict(day),
            session_exercises=session_exercises,
        )
    )


@app.post("/sessions/{session_id}/exercises/{session_exercise_id}/save", response_model=SaveExerciseResponse)
async def save_exercise(
    session_id: int,
    session_exercise_id: int,
    data: SaveExerciseRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Auto-save endpoint for exercise data."""
    # Verify session_exercise belongs to session
    cursor = await db.execute(
        "SELECT id FROM session_exercise WHERE id = ? AND session_id = ?",
        (session_exercise_id, session_id)
    )
    se = await cursor.fetchone()
    if not se:
        raise HTTPException(status_code=404, detail="Session exercise not found")
    
    # Update session_exercise
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
    
    # Update or create set entries
    if data.sets:
        for set_data in data.sets:
            # Check if set exists
            cursor = await db.execute(
                """SELECT id FROM set_entry
                   WHERE session_exercise_id = ? AND set_number = ?""",
                (session_exercise_id, set_data.set_number)
            )
            existing = await cursor.fetchone()
            
            if existing:
                # Update existing set
                await db.execute(
                    """UPDATE set_entry
                       SET weight_kg = ?, reps = ?, is_done = ?
                       WHERE id = ?""",
                    (set_data.weight_kg, set_data.reps, set_data.is_done, existing["id"])
                )
            else:
                # Create new set
                await db.execute(
                    """INSERT INTO set_entry
                       (session_exercise_id, set_number, weight_kg, reps, is_done, is_drop)
                       VALUES (?, ?, ?, ?, ?, 0)""",
                    (session_exercise_id, set_data.set_number, set_data.weight_kg, set_data.reps, set_data.is_done)
                )
        await db.commit()
    
    return SaveExerciseResponse(status="ok")


@app.post("/sessions/{session_id}/finish", response_model=FinishSessionResponse)
async def finish_session(session_id: int, db: aiosqlite.Connection = Depends(get_db)):
    """Mark session as finished."""
    # Verify session exists and is not finished
    cursor = await db.execute(
        "SELECT id, is_finished FROM session WHERE id = ?", (session_id,)
    )
    session = await cursor.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["is_finished"]:
        raise HTTPException(status_code=400, detail="Session already finished")
    
    # Mark as finished
    await db.execute(
        "UPDATE session SET is_finished = 1 WHERE id = ?", (session_id,)
    )
    await db.commit()
    
    return FinishSessionResponse(status="ok", redirect="/")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
