use crate::error::Result;
use crate::models::*;
use rusqlite::{Connection, params};
use chrono::NaiveDate;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_schema()?;
        db.seed_data()?;
        Ok(db)
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS exercise (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                min_increment REAL NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                notes TEXT
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS day (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                ordinal INTEGER NOT NULL UNIQUE
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS slot (
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
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS session (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                is_finished INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (day_id) REFERENCES day(id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS session_exercise (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                slot_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                effort_tag TEXT,
                next_time_note TEXT,
                dropset_done INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (session_id) REFERENCES session(id),
                FOREIGN KEY (slot_id) REFERENCES slot(id),
                FOREIGN KEY (exercise_id) REFERENCES exercise(id),
                UNIQUE(session_id, slot_id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS set_entry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_exercise_id INTEGER NOT NULL,
                set_number INTEGER NOT NULL,
                weight_kg REAL NOT NULL,
                reps INTEGER NOT NULL,
                is_done INTEGER NOT NULL DEFAULT 0,
                is_drop INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (session_exercise_id) REFERENCES session_exercise(id),
                UNIQUE(session_exercise_id, set_number)
            )",
            [],
        )?;

        // Index for performance
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_session_exercise_session_id ON session_exercise(session_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_set_entry_session_exercise_id ON set_entry(session_exercise_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_session_date ON session(date)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_session_exercise_exercise_id ON session_exercise(exercise_id)",
            [],
        )?;

        Ok(())
    }

    pub fn get_active_session(&self) -> Result<Option<i64>> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM session WHERE is_finished = 0 LIMIT 1"
        )?;
        
        let mut rows = stmt.query_map([], |row| {
            Ok(row.get::<_, i64>(0)?)
        })?;

        if let Some(id) = rows.next() {
            Ok(Some(id?))
        } else {
            Ok(None)
        }
    }

    pub fn start_or_resume_session(&self, day_id: i64) -> Result<i64> {
        // Check for existing unfinished session
        if let Some(id) = self.get_active_session()? {
            // Check if it's for the same day
            let session_day: i64 = self.conn.query_row(
                "SELECT day_id FROM session WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )?;
            if session_day == day_id {
                return Ok(id); // Resume existing session
            }
        }

        // Create new session
        let today = chrono::Local::now().date_naive();
        self.conn.execute(
            "INSERT INTO session (day_id, date, is_finished) VALUES (?1, ?2, 0)",
            params![day_id, today.to_string()],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_session(&self, session_id: i64) -> Result<SessionWithExercises> {
        // Get session and day
        let (session, day) = self.conn.query_row(
            "SELECT s.id, s.day_id, s.date, s.is_finished, d.id, d.label, d.ordinal 
             FROM session s 
             JOIN day d ON s.day_id = d.id 
             WHERE s.id = ?1",
            params![session_id],
            |row| {
                Ok((
                    Session {
                        id: row.get(0)?,
                        day_id: row.get(1)?,
                        date: NaiveDate::parse_from_str(&row.get::<_, String>(2)?, "%Y-%m-%d")
                            .map_err(|e| rusqlite::Error::InvalidColumnType(2, "date".to_string(), rusqlite::types::Type::Text))?,
                        is_finished: row.get::<_, i64>(3)? != 0,
                    },
                    Day {
                        id: row.get(4)?,
                        label: row.get(5)?,
                        ordinal: row.get(6)?,
                    },
                ))
            },
        )?;

        // Get all slots for this day
        let mut slot_stmt = self.conn.prepare(
            "SELECT id, day_id, ordinal, title, preferred_exercise_id, warmup_sets, 
                    working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset
             FROM slot WHERE day_id = ?1 ORDER BY ordinal"
        )?;
        
        let slots: Vec<Slot> = slot_stmt.query_map(params![session.day_id], |row| {
            Ok(Slot {
                id: row.get(0)?,
                day_id: row.get(1)?,
                ordinal: row.get(2)?,
                title: row.get(3)?,
                preferred_exercise_id: row.get(4)?,
                warmup_sets: row.get(5)?,
                working_sets_count: row.get(6)?,
                rep_target: row.get(7)?,
                rpe_range: row.get(8)?,
                rest_minutes: row.get(9)?,
                has_dropset: row.get::<_, i64>(10)? != 0,
            })
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        // Get or create session exercises for each slot
        let mut exercises = Vec::new();
        for slot in slots {
            // Check if session_exercise exists
            let session_exercise = match self.conn.query_row(
                "SELECT id, session_id, slot_id, exercise_id, effort_tag, next_time_note, dropset_done
                 FROM session_exercise WHERE session_id = ?1 AND slot_id = ?2",
                params![session_id, slot.id],
                |row| {
                    Ok(Some(SessionExercise {
                        id: row.get(0)?,
                        session_id: row.get(1)?,
                        slot_id: row.get(2)?,
                        exercise_id: row.get(3)?,
                        effort_tag: row.get(4)?,
                        next_time_note: row.get(5)?,
                        dropset_done: row.get::<_, i64>(6)? != 0,
                    }))
                },
            ) {
                Ok(se) => se,
                Err(rusqlite::Error::QueryReturnedNoRows) => {
                    // Create session exercise
                    self.conn.execute(
                        "INSERT INTO session_exercise (session_id, slot_id, exercise_id, dropset_done) 
                         VALUES (?1, ?2, ?3, 0)",
                        params![session_id, slot.id, slot.preferred_exercise_id],
                    )?;
                    Some(SessionExercise {
                        id: self.conn.last_insert_rowid(),
                        session_id,
                        slot_id: slot.id,
                        exercise_id: slot.preferred_exercise_id,
                        effort_tag: None,
                        next_time_note: None,
                        dropset_done: false,
                    })
                },
                Err(e) => return Err(e.into()),
            };

            let session_exercise = session_exercise.unwrap();

            // Get exercise
            let exercise = self.conn.query_row(
                "SELECT id, name, min_increment, active, notes FROM exercise WHERE id = ?1",
                params![session_exercise.exercise_id],
                |row| {
                    Ok(Exercise {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        min_increment: row.get(2)?,
                        active: row.get::<_, i64>(3)? != 0,
                        notes: row.get(4)?,
                    })
                },
            )?;

            // Get sets for this session exercise
            let mut set_stmt = self.conn.prepare(
                "SELECT id, session_exercise_id, set_number, weight_kg, reps, is_done, is_drop
                 FROM set_entry WHERE session_exercise_id = ?1 ORDER BY set_number"
            )?;
            
            let sets: Vec<SetEntry> = set_stmt.query_map(params![session_exercise.id], |row| {
                Ok(SetEntry {
                    id: row.get(0)?,
                    session_exercise_id: row.get(1)?,
                    set_number: row.get(2)?,
                    weight_kg: row.get(3)?,
                    reps: row.get(4)?,
                    is_done: row.get::<_, i64>(5)? != 0,
                    is_drop: row.get::<_, i64>(6)? != 0,
                })
            })?.collect::<std::result::Result<Vec<_>, _>>()?;

            // Get previous session exercise data (most recent finished session)
            let previous = self.get_previous_session_exercise(session_exercise.slot_id, session_exercise.exercise_id)?;

            exercises.push(SessionExerciseWithSlot {
                session_exercise,
                slot,
                exercise,
                previous_session_exercise: previous,
                sets,
            });
        }

        Ok(SessionWithExercises {
            session,
            day,
            exercises,
        })
    }

    fn get_previous_session_exercise(&self, slot_id: i64, exercise_id: i64) -> Result<Option<PreviousSessionExercise>> {
        // Get most recent finished session exercise for this slot/exercise combo
        let mut stmt = self.conn.prepare(
            "SELECT se.id, se.effort_tag, se.next_time_note
             FROM session_exercise se
             JOIN session s ON se.session_id = s.id
             WHERE se.slot_id = ?1 AND se.exercise_id = ?2 AND s.is_finished = 1
             ORDER BY s.date DESC
             LIMIT 1"
        )?;

        let previous_se = match stmt.query_row(params![slot_id, exercise_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get(1)?, row.get(2)?))
        }) {
            Ok((id, effort_tag, next_time_note)) => (id, effort_tag, next_time_note),
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.into()),
        };

        // Get sets (non-dropset only)
        let mut set_stmt = self.conn.prepare(
            "SELECT id, session_exercise_id, set_number, weight_kg, reps, is_done, is_drop
             FROM set_entry WHERE session_exercise_id = ?1 AND is_drop = 0 ORDER BY set_number"
        )?;
        
        let sets: Vec<SetEntry> = set_stmt.query_map(params![previous_se.0], |row| {
            Ok(SetEntry {
                id: row.get(0)?,
                session_exercise_id: row.get(1)?,
                set_number: row.get(2)?,
                weight_kg: row.get(3)?,
                reps: row.get(4)?,
                is_done: row.get::<_, i64>(5)? != 0,
                is_drop: row.get::<_, i64>(6)? != 0,
            })
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(Some(PreviousSessionExercise {
            sets,
            effort_tag: previous_se.1,
            next_time_note: previous_se.2,
        }))
    }

    pub fn finish_session(&self, session_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE session SET is_finished = 1 WHERE id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    pub fn save_exercise(&self, session_exercise_id: i64, request: &SaveExerciseRequest) -> Result<()> {
        // Update session_exercise fields
        if let Some(ref notes) = request.notes {
            self.conn.execute(
                "UPDATE session_exercise SET next_time_note = ?1 WHERE id = ?2",
                params![notes, session_exercise_id],
            )?;
        }
        if let Some(ref effort_tag) = request.effort_tag {
            self.conn.execute(
                "UPDATE session_exercise SET effort_tag = ?1 WHERE id = ?2",
                params![effort_tag, session_exercise_id],
            )?;
        }
        if let Some(dropset_done) = request.dropset_done {
            self.conn.execute(
                "UPDATE session_exercise SET dropset_done = ?1 WHERE id = ?2",
                params![if dropset_done { 1 } else { 0 }, session_exercise_id],
            )?;
        }

        // Update or insert sets
        if let Some(ref sets) = request.sets {
            for set in sets {
                // Check if set exists
                let exists: i64 = self.conn.query_row(
                    "SELECT COUNT(*) FROM set_entry WHERE session_exercise_id = ?1 AND set_number = ?2",
                    params![session_exercise_id, set.set_number],
                    |row| row.get(0),
                )?;

                if exists > 0 {
                    // Update existing set
                    self.conn.execute(
                        "UPDATE set_entry SET weight_kg = ?1, reps = ?2, is_done = ?3 
                         WHERE session_exercise_id = ?4 AND set_number = ?5",
                        params![set.weight_kg, set.reps, if set.is_done { 1 } else { 0 }, 
                                session_exercise_id, set.set_number],
                    )?;
                } else {
                    // Insert new set
                    self.conn.execute(
                        "INSERT INTO set_entry (session_exercise_id, set_number, weight_kg, reps, is_done, is_drop) 
                         VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                        params![session_exercise_id, set.set_number, set.weight_kg, set.reps, 
                                if set.is_done { 1 } else { 0 }],
                    )?;
                }
            }
        }

        Ok(())
    }

    fn seed_data(&self) -> Result<()> {
        // Check if data already exists
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM exercise",
            [],
            |row| row.get(0),
        )?;
        
        if count > 0 {
            return Ok(()); // Already seeded
        }

        // Seed exercises
        let exercises = vec![
            ("Flat DB Press", 2.5, Some("Tuck chin a little")),
            ("Seated DB Shoulder Press", 2.5, Some("75-85° bench angle. Bring dumbbells all the way down")),
            ("2-Grip Lat Pulldown", 2.5, Some("Use lat bar then easy grip bar. Pull to chest")),
            ("Seated Cable Row", 2.5, Some("Squeeze shoulder blades")),
            ("Hack Squat", 2.5, Some("Foot rest mid position, top all way flat, safety 6. Control weight on way down")),
            ("Overhead Cable Triceps Extension", 2.5, Some("Both arms at once, resist the negative")),
            ("EZ Bar Curl", 1.25, Some("Arc bar 'out' not 'up', squeeze biceps")),
            ("Lying Hamstring Curl", 2.5, Some("Legs at 3, circle at 2")),
            ("Pendlay Row", 2.5, Some("Squeeze shoulder blades, pull to lower chest")),
            ("Machine Shoulder Press", 2.5, Some("Smooth controlled tension, no stopping")),
            ("Weighted Pullup", 1.25, Some("Pull elbows down and in, minimize swinging")),
            ("Cable Chest Press", 2.5, Some("Squeeze chest")),
            ("DB Lateral Raise", 1.25, Some("Raise 'out' not 'up'")),
            ("Romanian Deadlift", 2.5, Some("Neutral lower back, hips back, no rounding")),
            ("Leg Press", 5.0, Some("Foot above middle so heel doesn't raise in bottom. Safety 3, back mid hole")),
            ("DB Incline Curl", 1.25, Some("38° bench angle. Keep shoulders back as you curl")),
            ("Triceps Pressdown", 2.5, Some("Squeeze triceps to move weight")),
            ("Leg Extension", 2.5, Some("Squeeze quads")),
        ];

        let mut exercise_ids = std::collections::HashMap::new();
        for (name, min_increment, notes) in exercises {
            self.conn.execute(
                "INSERT INTO exercise (name, min_increment, notes) VALUES (?1, ?2, ?3)",
                params![name, min_increment, notes],
            )?;
            let id = self.conn.last_insert_rowid();
            exercise_ids.insert(name, id);
        }

        // Seed days
        let days = vec![
            ("Upper 1", 1),
            ("Lower 1", 2),
            ("Upper 2", 3),
            ("Lower 2", 4),
        ];

        let mut day_ids = std::collections::HashMap::new();
        for (label, ordinal) in days {
            self.conn.execute(
                "INSERT INTO day (label, ordinal) VALUES (?1, ?2)",
                params![label, ordinal],
            )?;
            let id = self.conn.last_insert_rowid();
            day_ids.insert(ordinal, id);
        }

        // Seed slots
        // Day 1: Upper 1
        let day1_id = day_ids[&1];
        let slots_day1 = vec![
            (1, "Flat DB Press (Heavy)", "Flat DB Press", "2-3", 1, "4-6", Some("8-9"), 3.0, false),
            (2, "Flat DB Press (Back off)", "Flat DB Press", "0", 1, "8-10", Some("9-10"), 3.0, false),
            (3, "Seated DB Shoulder Press", "Seated DB Shoulder Press", "1", 2, "10-12", Some("9-10"), 2.0, false),
            (4, "2-Grip Lat Pulldown", "2-Grip Lat Pulldown", "2", 2, "10-12", Some("9-10"), 2.0, false),
            (5, "Seated Cable Row", "Seated Cable Row", "1", 2, "10-12", Some("9-10"), 2.0, true),
        ];

        for (ordinal, title, exercise_name, warmup_sets, working_sets, rep_target, rpe_range, rest_min, has_dropset) in slots_day1 {
            let exercise_id = exercise_ids[exercise_name];
            self.conn.execute(
                "INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![day1_id, ordinal, title, exercise_id, warmup_sets, working_sets, rep_target, rpe_range, rest_min, if has_dropset { 1 } else { 0 }],
            )?;
        }

        // Day 2: Lower 1
        let day2_id = day_ids[&2];
        let slots_day2 = vec![
            (1, "Hack Squat (Heavy)", "Hack Squat", "2-3", 1, "4-6", Some("8-9"), 3.0, false),
            (2, "Hack Squat (Back off)", "Hack Squat", "0", 1, "8-10", Some("8-9"), 3.0, false),
            (3, "Overhead Cable Triceps Extension", "Overhead Cable Triceps Extension", "1", 2, "12-15", Some("10"), 1.5, false),
            (4, "EZ Bar Curl", "EZ Bar Curl", "1", 2, "12-15", Some("10"), 1.5, false),
            (5, "Lying Hamstring Curl", "Lying Hamstring Curl", "1", 1, "10-12", Some("10"), 1.5, true),
        ];

        for (ordinal, title, exercise_name, warmup_sets, working_sets, rep_target, rpe_range, rest_min, has_dropset) in slots_day2 {
            let exercise_id = exercise_ids[exercise_name];
            self.conn.execute(
                "INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![day2_id, ordinal, title, exercise_id, warmup_sets, working_sets, rep_target, rpe_range, rest_min, if has_dropset { 1 } else { 0 }],
            )?;
        }

        // Day 3: Upper 2
        let day3_id = day_ids[&3];
        let slots_day3 = vec![
            (1, "Pendlay Row", "Pendlay Row", "2", 2, "8-10", Some("9-10"), 2.0, false),
            (2, "Machine Shoulder Press", "Machine Shoulder Press", "2", 2, "10-12", Some("9-10"), 2.0, false),
            (3, "Weighted Pullup", "Weighted Pullup", "1", 2, "8-10", Some("9-10"), 2.0, false),
            (4, "Cable Chest Press", "Cable Chest Press", "2", 2, "10-12", Some("9-10"), 2.0, true),
            (5, "DB Lateral Raise", "DB Lateral Raise", "1", 1, "12-15", Some("10"), 1.5, true),
        ];

        for (ordinal, title, exercise_name, warmup_sets, working_sets, rep_target, rpe_range, rest_min, has_dropset) in slots_day3 {
            let exercise_id = exercise_ids[exercise_name];
            self.conn.execute(
                "INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![day3_id, ordinal, title, exercise_id, warmup_sets, working_sets, rep_target, rpe_range, rest_min, if has_dropset { 1 } else { 0 }],
            )?;
        }

        // Day 4: Lower 2
        let day4_id = day_ids[&4];
        let slots_day4 = vec![
            (1, "Romanian Deadlift", "Romanian Deadlift", "2", 2, "10-12", Some("8-9"), 2.0, false),
            (2, "Leg Press", "Leg Press", "2", 3, "10-12", Some("8-9"), 2.0, false),
            (3, "DB Incline Curl", "DB Incline Curl", "1", 2, "12-15", Some("10"), 1.5, false),
            (4, "Triceps Pressdown", "Triceps Pressdown", "1", 2, "12-15", Some("10"), 1.5, false),
            (5, "Leg Extension", "Leg Extension", "1", 1, "10-12", Some("9-10"), 1.5, true),
        ];

        for (ordinal, title, exercise_name, warmup_sets, working_sets, rep_target, rpe_range, rest_min, has_dropset) in slots_day4 {
            let exercise_id = exercise_ids[exercise_name];
            self.conn.execute(
                "INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![day4_id, ordinal, title, exercise_id, warmup_sets, working_sets, rep_target, rpe_range, rest_min, if has_dropset { 1 } else { 0 }],
            )?;
        }

        Ok(())
    }

    pub fn get_exercise_history(&self, exercise_id: i64) -> Result<Vec<ExerciseHistoryEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT s.id, s.day_id, s.date, s.is_finished, d.id, d.label, d.ordinal,
                    se.id, se.session_id, se.slot_id, se.exercise_id, se.effort_tag, 
                    se.next_time_note, se.dropset_done
             FROM session_exercise se
             JOIN session s ON se.session_id = s.id
             JOIN day d ON s.day_id = d.id
             WHERE se.exercise_id = ?1 AND s.is_finished = 1
             ORDER BY s.date DESC
             LIMIT 50"
        )?;

        let mut entries = Vec::new();
        let rows: Vec<_> = stmt.query_map(params![exercise_id], |row| {
            Ok((
                Session {
                    id: row.get(0)?,
                    day_id: row.get(1)?,
                    date: NaiveDate::parse_from_str(&row.get::<_, String>(2)?, "%Y-%m-%d")
                        .map_err(|_| rusqlite::Error::InvalidColumnType(2, "date".to_string(), rusqlite::types::Type::Text))?,
                    is_finished: row.get::<_, i64>(3)? != 0,
                },
                Day {
                    id: row.get(4)?,
                    label: row.get(5)?,
                    ordinal: row.get(6)?,
                },
                SessionExercise {
                    id: row.get(7)?,
                    session_id: row.get(8)?,
                    slot_id: row.get(9)?,
                    exercise_id: row.get(10)?,
                    effort_tag: row.get(11)?,
                    next_time_note: row.get(12)?,
                    dropset_done: row.get::<_, i64>(13)? != 0,
                },
            ))
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        for (session, day, session_exercise) in rows {
            // Get all sets for this session exercise (including dropsets)
            let mut set_stmt = self.conn.prepare(
                "SELECT id, session_exercise_id, set_number, weight_kg, reps, is_done, is_drop
                 FROM set_entry WHERE session_exercise_id = ?1 ORDER BY set_number"
            )?;
            
            let sets: Vec<SetEntry> = set_stmt.query_map(params![session_exercise.id], |row| {
                Ok(SetEntry {
                    id: row.get(0)?,
                    session_exercise_id: row.get(1)?,
                    set_number: row.get(2)?,
                    weight_kg: row.get(3)?,
                    reps: row.get(4)?,
                    is_done: row.get::<_, i64>(5)? != 0,
                    is_drop: row.get::<_, i64>(6)? != 0,
                })
            })?.collect::<std::result::Result<Vec<_>, _>>()?;

            entries.push(ExerciseHistoryEntry {
                session,
                day,
                session_exercise,
                sets,
            });
        }

        Ok(entries)
    }
}

