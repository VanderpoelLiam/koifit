# AGENTS.md

This guide equips AI coding agents (and humans) to work effectively in this
repository. It summarizes architecture, key entry points, run targets, code
conventions, and an actionable playbook for common changes. Prefer surgical
edits, clear reasoning, and validation via the existing scripts.

## Overview

- React + Vite frontend with React Router for navigation.
- Desktop app via Tauri (Rust) with local SQLite storage; web mode served by an
  Axum HTTP server.
- Core business logic shared in `src-core` (Rust) for workout tracking, session
  management, and exercise history.
- Local-first architecture: all user workout data stored in SQLite, no cloud
  dependencies.

References:

- `README.md`:1 — Project intro and IDE setup.
- `MVP.md`:1 — Complete MVP specification, data model, and API endpoints.
- `src/App.tsx`:1 — App routing and page configuration.
- `src/api.ts`:1 — Frontend API client and TypeScript type definitions.
- `src-server/src/main.rs`:1 — Axum server entrypoint and API routes.
- `src-tauri/src/main.rs`:1 — Tauri desktop entrypoint.
- `src-core/src/db.rs`:1 — Database operations and business logic.
- `src-core/src/models.rs`:1 — Core data models and request/response types.

## Run Targets

- Desktop dev: `pnpm tauri dev`
- Desktop build: `pnpm tauri build`
- Web dev (Vite only): `pnpm dev`
- Web production build: `pnpm build`
- Server only (HTTP API + static): `cargo run --manifest-path src-server/Cargo.toml`
- Preview production build: `pnpm preview`

## Code Layout

- Frontend app: `src/`
  - Pages: `src/pages/...` (Home, Session, ExerciseHistory)
  - API client: `src/api.ts` (TypeScript types and fetch wrappers)
  - Styles: `src/App.css`
- Desktop (Tauri): `src-tauri/` (Rust commands, currently minimal)
- Core business logic (Rust): `src-core/` (models, database, services)
- HTTP Server (web mode): `src-server/` (Axum routes, handlers)

## Architecture Notes

- **Dual Runtime Support**: App can run as desktop (Tauri) or web (Axum server).
  - Desktop mode: Frontend talks to Tauri commands (work in progress).
  - Web mode: Frontend makes HTTP requests to Axum server via `src/api.ts`.
  - Current MVP focuses on web mode; desktop integration is scaffolded but
    minimal.
- **Shared Core Logic**: `src-core` contains all database operations, models,
  and business rules. Both Tauri and Axum backends delegate to this crate.
- **Local-First Data**: All workout sessions, exercises, and history stored in
  SQLite database (`koifit.db`). No external services or cloud storage.
- **Single Active Session**: Business rule enforces only one unfinished workout
  session at a time. Starting a new session resumes the existing one if
  unfinished.

## Data Model

See `MVP.md` for complete data model documentation. Key entities:

- **Exercise**: Physical exercises (e.g., "Flat DB Press") with weight
  increments and notes.
- **Day**: Workout days in rotation (e.g., "Upper 1", "Lower 1").
- **Slot**: Exercise slots within a day, defining sets, reps, rest time, RPE.
- **Session**: Workout instance tied to a specific day and date.
- **SessionExercise**: Links session to slot with chosen exercise, tracks effort
  tags and notes.
- **SetEntry**: Individual set performed (weight, reps, completion status).

Key relationships:

- Day → Slot (one-to-many, ordered)
- Day → Session (one-to-many, by date)
- Session → SessionExercise (one-to-many, one per slot)
- SessionExercise → SetEntry (one-to-many, per working set)

## Development Conventions

- TypeScript: strict mode, functional style, descriptive names
  (`isFinished`, `hasDropset`).
- Keep changes minimal, focused, and consistent with surrounding style.
- Don't introduce unrelated refactors; avoid renames unless required by the
  task.
- Error handling: log concisely, surface actionable messages to UI when needed.
- Rust: idiomatic, clear error handling with `Result`, prefer modularity.

## Validation Checklist

- Build the target you're modifying:
  - Frontend only: `pnpm build`
  - Desktop: `pnpm tauri dev`
  - Web mode: `pnpm dev` (or `cargo run --manifest-path src-server/Cargo.toml`)
- Keep changes consistent; don't add new toolchains or formatters.
- For server changes, verify endpoints with HTTP client or browser.
- For Tauri commands, verify desktop flows compile and run.

## Agent Playbook

When adding a new user-visible feature that needs backend data:

1. **Frontend route and UI**

   - Add page under `src/pages/...` and route in `src/App.tsx`.
   - Build UI with React components and existing styles.

2. **Frontend API client**

   - Add TypeScript types in `src/api.ts` matching Rust models.
   - Add API function to `api` object following fetch pattern.

3. **Core logic (shared)**

   - Implement database operations in `src-core/src/db.rs`.
   - Add models/request types in `src-core/src/models.rs` as needed.
   - Keep business rules and calculations in core, not UI or server layers.

4. **Web server endpoint**

   - Add handler function in `src-server/src/main.rs`.
   - Add route to `Router` in `main()`.
   - Handler should lock database, call `src-core` method, return JSON.
   - Follow error handling pattern: match on Result, return 500 on error.

5. **Desktop backend (if needed)**
   - Add Tauri command in `src-tauri/src/lib.rs`.
   - Register command in `invoke_handler` in `run()`.
   - Call into `src-core` service methods.

## Frontend Rules

- **Tech stack**: React, Vite, React Router, TypeScript.
- **Principles**: Write concise, technical TypeScript; avoid duplication; prefer
  functional/declarative patterns; use descriptive names.
- **File structure order**: exported component → subcomponents → helpers →
  static content → types.
- **Naming**: lowercase-with-dashes for directories; favor named exports.
- **TypeScript**: Use TS everywhere; prefer interfaces over types; avoid enums
  (use union types); functional components with interface props.
- **Syntax**: Use `function` for pure functions; always use curly braces for
  conditionals; favor simple, declarative JSX.
- **Performance**: Immutable data; minimize re-renders; efficient data
  structures.

## Backend Rules (Rust)

- **Scope**: Rust code in `src-tauri/**`, `src-core/**`, and `src-server/**`
  (Axum).
- **Principles**: Write clear, idiomatic Rust; do only the requested task;
  prefer modularity and small, focused functions; expressive names.
- **Async**: Embrace `async`/`.await` in `src-server`; use tokio runtime.
  `src-core` database operations are synchronous (using rusqlite).
- **Error handling**: Use `Result`/`Option`; propagate with `?`; define domain
  errors in `src-core/src/error.rs`; return errors rather than panicking.
- **Organization**: Separate concerns:
  - `src-server`: HTTP API routes and handlers (Axum).
  - `src-tauri`: Desktop IPC commands (Tauri).
  - `src-core`: Business logic, database operations, models (shared).
- **Database**: rusqlite + SQLite; keep schema and seed data logic in
  `src-core/src/db.rs`.
- **Tauri**: Add commands in `src-tauri/src/lib.rs`, register via
  `generate_handler!` macro.
- **Axum server**: Add handlers in `src-server/src/main.rs`, use `State` for
  database access, return `Json` or `IntoResponse`.
- **Concurrency**: `src-server` uses `Arc<Mutex<Database>>` for thread-safe
  access. Lock, perform operation, drop lock.

## API Endpoints

All endpoints are prefixed with `/api` when accessed via web server.

- `GET /health` — Health check.
- `GET /days` — List all workout days.
- `GET /session/active` — Get active (unfinished) session ID or null.
- `POST /sessions/start/:day_id` — Start or resume session for day.
- `GET /sessions/:id` — Get session with exercises, slots, and previous data.
- `POST /sessions/:session_id/exercises/:exercise_id/save` — Auto-save exercise
  data (sets, notes, effort tags).
- `POST /sessions/:id/finish` — Mark session as finished.
- `GET /exercises/:id/history` — Get exercise history (past 50 sessions).

See `MVP.md` for complete API documentation and request/response schemas.

## Business Logic Details

### Single Active Session

- Only one unfinished session (`is_finished = 0`) can exist at a time.
- Starting a new session when one is in progress resumes the existing session.
- This prevents orphaned sessions and data loss.

### Weight Units

- All weights stored and displayed in kilograms (kg).
- No unit conversion in MVP.

### Weight Increments

- Exercises have `min_increment` (e.g., 1.25, 2.5, 5.0 kg).
- UI input fields should respect this increment for validation/stepping.

### Effort Tags

- **"easy"**: User should increase weight next time.
- **"good"**: User should keep same weight next time (default).
- **"hard"**: User should decrease weight next time.
- Tags displayed in exercise history for reference.

### Auto-Save

- All inputs auto-save on change:
  - Weight/reps: debounced ~1 second.
  - Notes: debounced ~2 seconds.
  - Checkboxes (set completion, dropset, effort tags): immediate save.

## Useful Commands (Agent Discovery)

- List files quickly: `ls -R` or use file tree tools.
- Search text: `grep -r "keyword" src/` or `rg "keyword"`.
- Inspect scripts: `cat package.json`.
- Frontend dev: `pnpm dev`.
- Server dev: `cargo run --manifest-path src-server/Cargo.toml`.
- Desktop dev: `pnpm tauri dev`.
- Build: `pnpm build`.

## Seed Data

See `MVP.md` for complete seed data specification.

- **Exercises**: 19 pre-defined exercises (Flat DB Press, Hack Squat, etc.).
- **Days**: 4 workout days (Upper 1, Lower 1, Upper 2, Lower 2).
- **Slots**: Exercise slots per day with sets, reps, rest times, RPE.

All seed data is initialized in `src-core/src/db.rs` during database creation.

## Troubleshooting

- Vite dev server runs at `http://localhost:1420` (Tauri) or default port (web
  mode).
- Axum server runs at `http://0.0.0.0:3000` by default.
- Database file is `koifit.db` in working directory. Check write permissions if
  database operations fail.
- For web mode, ensure CORS is enabled (already configured in `src-server`).
- If API calls fail, verify endpoint URLs match the server routes and
  `API_BASE` in `src/api.ts`.

## Future Enhancements (Out of MVP Scope)

- Rest timer UI.
- Exercise substitution system.
- Multiple workout templates.
- Session editing/deletion.
- Weight unit conversion (lb/kg).
- Advanced analytics and charts.
- Cloud sync (optional).

---

This document is intended to make AI agents productive, consistent, and safe in
this codebase. When in doubt, follow the nearest existing pattern and validate
via the provided scripts.

## Acknowledgements

This AGENTS.md document was heavily inspired by and adapted from the
[Wealthfolio project](https://github.com/afadil/wealthfolio).
