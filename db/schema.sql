-- Koifit Workout Tracker Database Schema

-- Exercise table
CREATE TABLE IF NOT EXISTS exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    min_increment REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT
);

-- Day table
CREATE TABLE IF NOT EXISTS day (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    ordinal INTEGER NOT NULL UNIQUE
);

-- Slot table
CREATE TABLE IF NOT EXISTS slot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    ordinal INTEGER NOT NULL,
    title TEXT NOT NULL,
    preferred_exercise_id INTEGER NOT NULL,
    warmup_sets TEXT NOT NULL,
    working_sets_count INTEGER NOT NULL,
    rep_target TEXT NOT NULL,
    rpe_range TEXT,
    rest_minutes REAL NOT NULL,
    has_dropset INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (day_id) REFERENCES day(id),
    FOREIGN KEY (preferred_exercise_id) REFERENCES exercise(id),
    UNIQUE(day_id, ordinal)
);

-- Session table
CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    is_finished INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (day_id) REFERENCES day(id)
);

-- Session Exercise table
CREATE TABLE IF NOT EXISTS session_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    effort_tag TEXT,
    next_time_note TEXT,
    dropset_done INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES session(id),
    FOREIGN KEY (slot_id) REFERENCES slot(id),
    FOREIGN KEY (exercise_id) REFERENCES exercise(id)
);

-- Set Entry table
CREATE TABLE IF NOT EXISTS set_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    is_done INTEGER NOT NULL DEFAULT 0,
    is_drop INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_exercise_id) REFERENCES session_exercise(id),
    UNIQUE(session_exercise_id, set_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_day_date ON session(day_id, date);
CREATE INDEX IF NOT EXISTS idx_session_finished ON session(is_finished);
CREATE INDEX IF NOT EXISTS idx_session_exercise_session ON session_exercise(session_id);
CREATE INDEX IF NOT EXISTS idx_set_entry_session_exercise ON set_entry(session_exercise_id);
CREATE INDEX IF NOT EXISTS idx_slot_day_ordinal ON slot(day_id, ordinal);
