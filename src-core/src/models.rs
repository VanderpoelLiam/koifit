use serde::{Deserialize, Serialize};
use chrono::NaiveDate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exercise {
    pub id: i64,
    pub name: String,
    pub min_increment: f64,
    pub active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Day {
    pub id: i64,
    pub label: String,
    pub ordinal: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Slot {
    pub id: i64,
    pub day_id: i64,
    pub ordinal: i64,
    pub title: String,
    pub preferred_exercise_id: i64,
    pub warmup_sets: String,
    pub working_sets_count: i64,
    pub rep_target: String,
    pub rpe_range: Option<String>,
    pub rest_minutes: f64,
    pub has_dropset: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: i64,
    pub day_id: i64,
    pub date: NaiveDate,
    pub is_finished: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionExercise {
    pub id: i64,
    pub session_id: i64,
    pub slot_id: i64,
    pub exercise_id: i64,
    pub effort_tag: Option<String>,
    pub next_time_note: Option<String>,
    pub dropset_done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetEntry {
    pub id: i64,
    pub session_exercise_id: i64,
    pub set_number: i64,
    pub weight_kg: f64,
    pub reps: i64,
    pub is_done: bool,
    pub is_drop: bool,
}

// Request/Response types for API

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveExerciseRequest {
    pub notes: Option<String>,
    pub effort_tag: Option<String>,
    pub dropset_done: Option<bool>,
    pub sets: Option<Vec<SaveSetRequest>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveSetRequest {
    pub set_number: i64,
    pub weight_kg: f64,
    pub reps: i64,
    pub is_done: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionWithExercises {
    pub session: Session,
    pub day: Day,
    pub exercises: Vec<SessionExerciseWithSlot>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionExerciseWithSlot {
    pub session_exercise: SessionExercise,
    pub slot: Slot,
    pub exercise: Exercise,
    pub previous_session_exercise: Option<PreviousSessionExercise>,
    pub sets: Vec<SetEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreviousSessionExercise {
    pub sets: Vec<SetEntry>,
    pub effort_tag: Option<String>,
    pub next_time_note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExerciseHistoryEntry {
    pub session: Session,
    pub day: Day,
    pub session_exercise: SessionExercise,
    pub sets: Vec<SetEntry>,
}

