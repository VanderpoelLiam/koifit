import aiosqlite
import pytest


async def _start_session(client, day_id: int) -> int:
    resp = await client.post(f"/sessions/start/{day_id}", follow_redirects=False)
    assert resp.status_code == 303
    location = resp.headers["location"]
    return int(location.rsplit("/", 1)[-1])


async def _get_first_session_exercise_id(db_conn: aiosqlite.Connection, session_id: int) -> int:
    cursor = await db_conn.execute(
        "SELECT id FROM session_exercise WHERE session_id = ? ORDER BY id LIMIT 1",
        (session_id,),
    )
    row = await cursor.fetchone()
    assert row is not None
    return row["id"]


@pytest.mark.anyio
async def test_home_shows_days_when_no_session(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    assert "Start Workout" in resp.text
    assert "Upper 1" in resp.text


@pytest.mark.anyio
async def test_start_and_resume_session(client, db_conn):
    first_session_id = await _start_session(client, day_id=1)

    # Starting another day while unfinished should resume the same session
    resp = await client.post("/sessions/start/2", follow_redirects=False)
    assert resp.status_code == 303
    assert resp.headers["location"].endswith(f"/{first_session_id}")

    cursor = await db_conn.execute("SELECT COUNT(*) FROM session")
    session_count = (await cursor.fetchone())[0]
    assert session_count == 1


@pytest.mark.anyio
async def test_session_page_creates_session_exercises(client, db_conn):
    session_id = await _start_session(client, day_id=1)

    # Hitting the session page lazily creates session_exercise rows
    resp = await client.get(f"/sessions/{session_id}")
    assert resp.status_code == 200

    cursor = await db_conn.execute(
        "SELECT COUNT(*) FROM slot WHERE day_id = ?", (1,)
    )
    expected_slots = (await cursor.fetchone())[0]

    cursor = await db_conn.execute(
        "SELECT COUNT(*) FROM session_exercise WHERE session_id = ?",
        (session_id,),
    )
    created = (await cursor.fetchone())[0]
    assert created == expected_slots


@pytest.mark.anyio
async def test_autosave_upserts_sets_and_metadata(client, db_conn):
    session_id = await _start_session(client, day_id=1)
    await client.get(f"/sessions/{session_id}")  # ensure session_exercise rows exist

    se_id = await _get_first_session_exercise_id(db_conn, session_id)
    payload = {
        "notes": "Felt strong",
        "effort_tag": "increase",
        "dropset_done": 1,
        "sets": [
            {"set_number": 1, "weight_kg": 100.0, "reps": 5, "is_done": 1},
            {"set_number": 2, "weight_kg": 95.0, "reps": 8, "is_done": 0},
        ],
    }

    resp = await client.post(
        f"/sessions/{session_id}/exercises/{se_id}/save", json=payload
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    cursor = await db_conn.execute(
        "SELECT next_time_note, effort_tag, dropset_done FROM session_exercise WHERE id = ?",
        (se_id,),
    )
    se_row = await cursor.fetchone()
    assert se_row["next_time_note"] == "Felt strong"
    assert se_row["effort_tag"] == "increase"
    assert se_row["dropset_done"] == 1

    cursor = await db_conn.execute(
        "SELECT set_number, weight_kg, reps, is_done FROM set_entry WHERE session_exercise_id = ? ORDER BY set_number",
        (se_id,),
    )
    sets = await cursor.fetchall()
    assert len(sets) == 2
    assert sets[0]["weight_kg"] == 100.0
    assert sets[0]["reps"] == 5
    assert sets[0]["is_done"] == 1


@pytest.mark.anyio
async def test_finish_session_marks_complete(client, db_conn):
    session_id = await _start_session(client, day_id=1)
    await client.get(f"/sessions/{session_id}")  # ensure lazy creations

    resp = await client.post(f"/sessions/{session_id}/finish")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    cursor = await db_conn.execute(
        "SELECT is_finished FROM session WHERE id = ?", (session_id,)
    )
    is_finished = (await cursor.fetchone())[0]
    assert is_finished == 1


@pytest.mark.anyio
async def test_previous_session_data_is_preloaded(client, db_conn):
    # First session with data
    first_session_id = await _start_session(client, day_id=1)
    await client.get(f"/sessions/{first_session_id}")
    se_id = await _get_first_session_exercise_id(db_conn, first_session_id)
    payload = {
        "notes": "Stay tight",
        "effort_tag": "good",
        "dropset_done": 0,
        "sets": [
            {"set_number": 1, "weight_kg": 100.0, "reps": 5, "is_done": 1},
            {"set_number": 2, "weight_kg": 95.0, "reps": 8, "is_done": 1},
        ],
    }
    await client.post(
        f"/sessions/{first_session_id}/exercises/{se_id}/save", json=payload
    )
    await client.post(f"/sessions/{first_session_id}/finish")

    # New session should show previous data
    second_session_id = await _start_session(client, day_id=1)
    resp = await client.get(f"/sessions/{second_session_id}")
    assert resp.status_code == 200
    assert "Last time" in resp.text
    assert "100.0kg × 5 reps" in resp.text

