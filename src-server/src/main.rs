use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Html, Json, IntoResponse},
    routing::{get, post},
    Router,
};
use src_core::{Database, models::*, error::Result};
use std::sync::{Arc, Mutex};
use tower_http::{cors::CorsLayer, services::ServeDir};

#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Database>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize database
    let db = Arc::new(Mutex::new(Database::new("koifit.db")?));
    
    let app_state = AppState { db };

    // Static file service with SPA fallback
    let serve_dir = ServeDir::new("dist")
        .append_index_html_on_directories(true)
        .fallback(get(spa_fallback));

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/days", get(get_days))
        .route("/api/session/active", get(get_active_session))
        .route("/api/sessions/start/:day_id", post(start_session))
        .route("/api/sessions/:id/finish", post(finish_session))
        .route("/api/sessions/:session_id/exercises/:exercise_id/save", post(save_exercise))
        .route("/api/sessions/:id", get(get_session))
        .route("/api/exercises/:id/history", get(get_exercise_history))
        .nest_service("/", serve_dir)
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await
        .map_err(|e| src_core::error::Error::InvalidData(format!("Failed to bind: {}", e)))?;
    
    println!("Server running on http://0.0.0.0:3000");
    axum::serve(listener, app).await
        .map_err(|e| src_core::error::Error::InvalidData(format!("Server error: {}", e)))?;

    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn spa_fallback() -> impl IntoResponse {
    match std::fs::read_to_string("dist/index.html") {
        Ok(html) => Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "index.html not found").into_response(),
    }
}

async fn get_days(State(state): State<AppState>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    let conn = db.conn();
    let mut stmt = match conn.prepare("SELECT id, label, ordinal FROM day ORDER BY ordinal") {
        Ok(stmt) => stmt,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database query error").into_response(),
    };
    
    let days: Vec<Day> = match stmt.query_map([], |row| {
        Ok(Day {
            id: row.get(0)?,
            label: row.get(1)?,
            ordinal: row.get(2)?,
        })
    }) {
        Ok(iter) => match iter.collect::<std::result::Result<Vec<_>, _>>() {
            Ok(days) => days,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database row error").into_response(),
        },
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database query error").into_response(),
    };

    Json(days).into_response()
}

async fn get_active_session(State(state): State<AppState>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.get_active_session() {
        Ok(Some(id)) => Json(Some(id)).into_response(),
        Ok(None) => Json(None::<i64>).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

async fn start_session(State(state): State<AppState>, Path(day_id): Path<i64>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.start_or_resume_session(day_id) {
        Ok(session_id) => Json(serde_json::json!({ "session_id": session_id })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

async fn get_session(State(state): State<AppState>, Path(session_id): Path<i64>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.get_session(session_id) {
        Ok(session) => Json(session).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

async fn finish_session(State(state): State<AppState>, Path(session_id): Path<i64>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.finish_session(session_id) {
        Ok(_) => Json(serde_json::json!({ "status": "ok" })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

async fn save_exercise(
    State(state): State<AppState>,
    Path((_session_id, exercise_id)): Path<(i64, i64)>,
    Json(request): Json<SaveExerciseRequest>,
) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.save_exercise(exercise_id, &request) {
        Ok(_) => Json(serde_json::json!({ "status": "ok" })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

async fn get_exercise_history(State(state): State<AppState>, Path(exercise_id): Path<i64>) -> impl IntoResponse {
    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database lock error").into_response(),
    };
    match db.get_exercise_history(exercise_id) {
        Ok(history) => Json(history).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}
