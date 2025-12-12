# Workout Tracker MVP Design Document

This document describes the core functionality and data model of the workout tracker MVP. The app is a self-hosted web application accessible from any browser via Docker.

## MVP Scope

**In Scope:**
- Pre-seeded exercises, days, and slots
- Workout session tracking with auto-save
- Manual day selection

**Out of Scope for MVP:**
- Exercise history viewing
- Rest timer (user times manually; `rest_minutes` shown for reference)
- Slot substitution UI and table
- Template table (single implicit template)
- Session cleanup logic on finish
- Desktop application
- iOS application
- Template/exercise/day/slot CRUD (data is seeded)
- Multiple templates
- Weight unit conversion (kg only)
- Editing or deleting past sessions
- Session rotation logic (user manually selects workout day each time)

## Data Model

### Core Entities

#### Exercise
Represents a physical exercise that can be performed.

- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT, NOT NULL) - Exercise name (e.g., "Flat DB Press")
- `min_increment` (REAL, NOT NULL) - Minimum weight increment in kg (e.g., 1.25, 2.5, 5.0)
- `active` (INTEGER, NOT NULL, DEFAULT 1) - Whether exercise is active (1) or inactive (0)
- `notes` (TEXT) - Optional exercise-specific notes/instructions. May include alternative exercise suggestions.

#### Day
A workout day in the program. Represents one day in a rotation (e.g., "Upper 1", "Lower 1", "Upper 2", "Lower 2").

- `id` (INTEGER, PRIMARY KEY)
- `label` (TEXT, NOT NULL) - Day label (e.g., "Upper 1")
- `ordinal` (INTEGER, NOT NULL) - Position in rotation (1, 2, 3, ...)

#### Slot
An exercise slot within a day. Defines what exercise should be done, how many sets, rep targets, rest time, etc.

- `id` (INTEGER, PRIMARY KEY)
- `day_id` (INTEGER, NOT NULL, FOREIGN KEY) - References day
- `ordinal` (INTEGER, NOT NULL) - Position within the day (1, 2, 3, ...)
- `title` (TEXT, NOT NULL) - Slot title (e.g., "Flat DB Press (Heavy)")
- `preferred_exercise_id` (INTEGER, NOT NULL, FOREIGN KEY) - References exercise
- `warmup_sets` (TEXT, NOT NULL) - Warmup sets specification (e.g., "2-3", "1", "0")
- `working_sets_count` (INTEGER, NOT NULL) - Number of working sets (e.g., 1, 2, 3)
- `rep_target` (TEXT, NOT NULL) - Rep target range (e.g., "4-6", "8-10", "12-15")
- `rpe_range` (TEXT) - Optional RPE (Rate of Perceived Exertion) range (e.g., "8-9", "9-10")
- `rest_minutes` (REAL, NOT NULL) - Rest time between sets in minutes (e.g., 1.5, 2.0, 3.0)
- `has_dropset` (INTEGER, NOT NULL, DEFAULT 0) - Whether slot includes a dropset (1) or not (0)

#### Session
A workout instance tied to a specific day and date. Represents one actual workout session.

- `id` (INTEGER, PRIMARY KEY)
- `day_id` (INTEGER, NOT NULL, FOREIGN KEY) - References day
- `date` (TEXT, NOT NULL) - Date in YYYY-MM-DD format
- `is_finished` (INTEGER, NOT NULL, DEFAULT 0) - Whether session is completed (1) or in progress (0)

**Constraint:** Only one unfinished session may exist at a time. Starting a new session when one is in progress should resume the existing session instead.

#### Session Exercise
Links a session to a slot with the chosen exercise. Stores per-exercise metadata for the session.

- `id` (INTEGER, PRIMARY KEY)
- `session_id` (INTEGER, NOT NULL, FOREIGN KEY) - References session
- `slot_id` (INTEGER, NOT NULL, FOREIGN KEY) - References slot
- `exercise_id` (INTEGER, NOT NULL, FOREIGN KEY) - References exercise (in MVP, always matches slot's preferred_exercise_id)
- `effort_tag` (TEXT) - Effort indicator: "increase", "good" (keep weight), "decrease"
- `next_time_note` (TEXT) - Optional notes for next time performing this exercise
- `dropset_done` (INTEGER, NOT NULL, DEFAULT 0) - Whether dropset was completed (1) or not (0)

#### Set Entry
An individual set performed during a session exercise.

- `id` (INTEGER, PRIMARY KEY)
- `session_exercise_id` (INTEGER, NOT NULL, FOREIGN KEY) - References session_exercise
- `set_number` (INTEGER, NOT NULL) - Set number (1, 2, 3, ...)
- `weight_kg` (REAL, NOT NULL) - Weight in kilograms
- `reps` (INTEGER, NOT NULL) - Number of repetitions
- `is_done` (INTEGER, NOT NULL, DEFAULT 0) - Whether set is completed (1) or not (0)
- `is_drop` (INTEGER, NOT NULL, DEFAULT 0) - Whether set is a dropset (1) or not (0)

### Entity Relationship Diagram

```
Day (ordered by ordinal)
  ├─ has many ──> Slot (ordered by ordinal)
  │                └─ references ──> Exercise (preferred_exercise_id)
  └─ has many ──> Session
                     ├─ has many ──> Session Exercise
                     │                ├─ references ──> Slot
                     │                ├─ references ──> Exercise
                     │                └─ has many ──> Set Entry
                     └─ (is_finished flag determines completion)

Exercise ── referenced by ──> Slot (preferred)
Exercise ── referenced by ──> Session Exercise
```

### Key Relationships

- **Day → Slot**: One-to-many. A day contains multiple exercise slots in order.
- **Slot → Exercise**: Many-to-one. Each slot has a preferred exercise, but exercises can be used in multiple slots.
- **Day → Session**: One-to-many. Multiple sessions can be created for the same day (different dates).
- **Session → Session Exercise**: One-to-many. A session contains multiple session exercises (one per slot).
- **Session Exercise → Set Entry**: One-to-many. Each session exercise has multiple set entries.

### Historical Data Independence

Session and set entry data is independent of day/slot structure. If the program is modified (outside MVP scope), historical records remain intact as a log of "which exercises were done on which dates with what weights/reps."

## Core Features

### 1. Home Screen

**Purpose**: Entry point for starting workouts.

**Functionality**:
- **If an unfinished session exists**: Shows "Resume Workout" button with the day label
- **If no unfinished session**: Shows list of workout days to choose from
- Provides navigation to day selection

**Data Flow**:
1. Check for any unfinished session (`is_finished = 0`)
2. If found, display resume option for that session
3. Otherwise, display day selection list

### 2. Day Selection

**Purpose**: Allow users to select which workout day to perform.

**Functionality**:
- Lists all workout days, ordered by ordinal
- Displays day labels (e.g., "Upper 1", "Lower 1")
- Clicking a day starts a new session for that day (or resumes if unfinished session exists)

**Data Flow**:
1. Query all days, ordered by ordinal
2. Display as a list
3. On selection:
   - Check if unfinished session exists → resume it
   - Otherwise, create a new session for that day with today's date

### 3. Workout Session

**Purpose**: Core workout tracking interface where users log their sets, weights, and reps.

**Functionality**:

#### Session Initialization
- When a session is started, create a `session_exercise` record for each slot in the day
- Each session exercise uses the slot's `preferred_exercise_id`
- Session exercises are created lazily when the session page is first loaded

#### Session Resumption
- If the user navigates away (closes browser, switches apps, etc.) and returns, the session resumes exactly where they left off
- All previously entered data is loaded from the database

#### Exercise Display
- Each exercise slot is displayed as a card/section
- Shows slot title
- Displays rep target and RPE range if specified
- Shows rest time recommendation (e.g., "Rest: 2 min") from slot's `rest_minutes` for reference
- Shows exercise notes if available (may include alternative exercise suggestions as text)
- Displays "Last time notes" in a collapsible section if previous session exists

#### Previous Session Data
- For each exercise, look up the most recent completed session exercise for the same (slot_id, exercise_id) combination
- Pre-populate weight and reps inputs with previous session's values
- Only show non-dropset sets from previous session (filter `is_drop = 0`)
- Display previous session's notes and effort tag

#### Warmup Sets
- If slot has warmup sets (warmup_sets != "0"), display a checkbox labeled with the warmup spec (e.g., "2-3 warmup sets")
- Warmup completion is not tracked in database, only UI state
- No specific warmup weights are suggested; user determines warmup weights themselves

#### Working Sets Table
- Displays a table with columns: Set Number, Weight (kg), Reps, Completion Checkbox
- Number of rows = `working_sets_count` from slot
- Weight input allows manual entry (allows negative values)
- Reps input accepts numeric values
- Each set row has a completion checkbox

#### Set Completion Logic
- When a set checkbox is checked:
  - Auto-save the exercise data

#### Dropset
- If slot has `has_dropset = 1`, display a dropset checkbox
- Dropset is typically done after last working set
- Checking dropset checkbox saves `dropset_done = 1` to session_exercise
- Dropset sets are not individually tracked (only completion flag)

#### Notes Field
- Text area for exercise-specific notes
- Auto-saves on input (debounced, ~2 second delay)
- Saved to `session_exercise.next_time_note`

#### Effort Tags (Weight Change Indicators)
- Two checkboxes: "-" (decrease weight) and "+" (increase weight)
- Mutually exclusive: checking one unchecks the other
- Default state: neither checked = "good" (keep weight)
- Values: "decrease", "good" (keep), "increase"
- Saved to `session_exercise.effort_tag`
- Used to guide weight adjustments for next session

#### Auto-Save
- All inputs auto-save on change:
  - Weight/reps inputs: debounced ~1 second
  - Notes: debounced ~2 seconds
  - Checkboxes (set completion, dropset, effort tags): immediate save
- Saves to `/sessions/{session_id}/exercises/{session_exercise_id}/save` endpoint
- Payload includes: notes, effort_tag, dropset_done, sets array
- Sets array contains: set_number, weight_kg, reps, is_done
- Creates set_entry records if they don't exist, updates if they do
- **Constraint**: Exercises with zero completed sets should not be permanently saved/counted in history. The backend or cleanup logic should handle removing/ignoring empty exercises on session finish.

#### Finish Workout
- Button fixed at bottom of screen
- On click, shows confirmation dialog
- Saves all exercise data one final time
- Calls `/sessions/{session_id}/finish` endpoint
- Marks session as finished (`is_finished = 1`)
- Redirects to home page

### 4. Exercise History
(Moved to Out of Scope for MVP)

## API Endpoints

### GET `/`
Home page. Shows resume option if unfinished session exists, otherwise shows day selection.

### GET `/days`
Day selection page. Lists all days.

### POST `/sessions/start/<day_id>`
Creates a new session for the given day with today's date, or returns existing unfinished session. Redirects to session page.

### GET `/sessions/<session_id>`
Session page. Displays all slots for the session's day, with previous session data pre-populated.

### POST `/sessions/<session_id>/exercises/<session_exercise_id>/save`
Auto-save endpoint. Updates session exercise and set entries.
- Body: `{ notes?, effort_tag?, dropset_done?, sets?: [{ set_number, weight_kg, reps, is_done }] }`
- Returns: `{ status: "ok" }`

### POST `/sessions/<session_id>/finish`
Marks session as finished.
- Returns: `{ status: "ok", redirect: "/" }`

### GET `/health`
Health check endpoint.

## Business Logic Details

### Weight Units
- All weights are stored and displayed in kilograms (kg)
- No unit conversion in MVP

### Weight Increments
- Exercises have a `min_increment` value (e.g., 1.25, 2.5, 5.0 kg)
- Input fields allow free text entry (can be negative)
- Common values: 1.25 kg (small plates), 2.5 kg (standard), 5.0 kg (large plates)

### Set Numbering
- Sets are numbered starting from 1
- Set numbers correspond to working sets only (warmup sets are not tracked)
- Dropsets are tracked via flag, not as separate numbered sets

### Single Active Session
- Only one unfinished session can exist at a time
- Attempting to start a new session while one is in progress should resume the existing session
- This prevents orphaned sessions and data loss

### Effort Tag Usage
- "increase": Indicates user should increase weight next time
- "good": Indicates user should keep same weight next time (default)
- "decrease": Indicates user should decrease weight next time
- These tags are stored for reference in next session

## Data Validation

### Required Fields
- Exercise: name, min_increment
- Day: label, ordinal
- Slot: day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rest_minutes
- Session: day_id, date
- Session Exercise: session_id, slot_id, exercise_id
- Set Entry: session_exercise_id, set_number, weight_kg, reps

### Constraints
- Day ordinal must be unique
- Slot ordinal must be unique within a day
- Set number must be unique within a session exercise
- Date format: YYYY-MM-DD (ISO format)
- Only one session with `is_finished = 0` may exist at a time

## Deployment

### Self-Hosted Web App (Docker)
- Docker container with web server and SQLite database
- Data persisted via Docker volume
- Access from any device on local network or via reverse proxy
- Optimized for mobile browser access

## Seed Data

### Exercises

| Name | min_increment | notes |
|------|---------------|-------|
| Flat DB Press | 2.5 | Tuck chin a little |
| Seated DB Shoulder Press | 2.5 | 75-85° bench angle. Bring dumbbells all the way down |
| 2-Grip Lat Pulldown | 2.5 | Use lat bar then easy grip bar. Pull to chest |
| Seated Cable Row | 2.5 | Squeeze shoulder blades |
| Hack Squat | 2.5 | Foot rest mid position, top all way flat, safety 6. Control weight on way down |
| Overhead Cable Triceps Extension | 2.5 | Both arms at once, resist the negative |
| EZ Bar Curl | 1.25 | Arc bar 'out' not 'up', squeeze biceps |
| Lying Hamstring Curl | 2.5 | Legs at 3, circle at 2 |
| Pendlay Row | 2.5 | Squeeze shoulder blades, pull to lower chest |
| Machine Shoulder Press | 2.5 | Smooth controlled tension, no stopping |
| Weighted Pullup | 1.25 | Pull elbows down and in, minimize swinging |
| Cable Chest Press | 2.5 | Squeeze chest |
| DB Lateral Raise | 1.25 | Raise 'out' not 'up' |
| Romanian Deadlift | 2.5 | Neutral lower back, hips back, no rounding |
| Leg Press | 5.0 | Foot above middle so heel doesn't raise in bottom. Safety 3, back mid hole |
| DB Incline Curl | 1.25 | 38° bench angle. Keep shoulders back as you curl |
| Triceps Pressdown | 2.5 | Squeeze triceps to move weight |
| Leg Extension | 2.5 | Squeeze quads |

### Days & Slots

#### Day 1: Upper 1

| ordinal | title | exercise | warmup_sets | working_sets | rep_target | rest_min | rpe | dropset |
|---------|-------|----------|-------------|--------------|------------|----------|-----|---------|
| 1 | Flat DB Press (Heavy) | Flat DB Press | 2-3 | 1 | 4-6 | 3.0 | 8-9 | 0 |
| 2 | Flat DB Press (Back off) | Flat DB Press | 0 | 1 | 8-10 | 3.0 | 9-10 | 0 |
| 3 | Seated DB Shoulder Press | Seated DB Shoulder Press | 1 | 2 | 10-12 | 2.0 | 9-10 | 0 |
| 4 | 2-Grip Lat Pulldown | 2-Grip Lat Pulldown | 2 | 2 | 10-12 | 2.0 | 9-10 | 0 |
| 5 | Seated Cable Row | Seated Cable Row | 1 | 2 | 10-12 | 2.0 | 9-10 | 1 |

#### Day 2: Lower 1

| ordinal | title | exercise | warmup_sets | working_sets | rep_target | rest_min | rpe | dropset |
|---------|-------|----------|-------------|--------------|------------|----------|-----|---------|
| 1 | Hack Squat (Heavy) | Hack Squat | 2-3 | 1 | 4-6 | 3.0 | 8-9 | 0 |
| 2 | Hack Squat (Back off) | Hack Squat | 0 | 1 | 8-10 | 3.0 | 8-9 | 0 |
| 3 | Overhead Cable Triceps Extension | Overhead Cable Triceps Extension | 1 | 2 | 12-15 | 1.5 | 10 | 0 |
| 4 | EZ Bar Curl | EZ Bar Curl | 1 | 2 | 12-15 | 1.5 | 10 | 0 |
| 5 | Lying Hamstring Curl | Lying Hamstring Curl | 1 | 1 | 10-12 | 1.5 | 10 | 1 |

#### Day 3: Upper 2

| ordinal | title | exercise | warmup_sets | working_sets | rep_target | rest_min | rpe | dropset |
|---------|-------|----------|-------------|--------------|------------|----------|-----|---------|
| 1 | Pendlay Row | Pendlay Row | 2 | 2 | 8-10 | 2.0 | 9-10 | 0 |
| 2 | Machine Shoulder Press | Machine Shoulder Press | 2 | 2 | 10-12 | 2.0 | 9-10 | 0 |
| 3 | Weighted Pullup | Weighted Pullup | 1 | 2 | 8-10 | 2.0 | 9-10 | 0 |
| 4 | Cable Chest Press | Cable Chest Press | 2 | 2 | 10-12 | 2.0 | 9-10 | 1 |
| 5 | DB Lateral Raise | DB Lateral Raise | 1 | 1 | 12-15 | 1.5 | 10 | 1 |

#### Day 4: Lower 2

| ordinal | title | exercise | warmup_sets | working_sets | rep_target | rest_min | rpe | dropset |
|---------|-------|----------|-------------|--------------|------------|----------|-----|---------|
| 1 | Romanian Deadlift | Romanian Deadlift | 2 | 2 | 10-12 | 2.0 | 8-9 | 0 |
| 2 | Leg Press | Leg Press | 2 | 3 | 10-12 | 2.0 | 8-9 | 0 |
| 3 | DB Incline Curl | DB Incline Curl | 1 | 2 | 12-15 | 1.5 | 10 | 0 |
| 4 | Triceps Pressdown | Triceps Pressdown | 1 | 2 | 12-15 | 1.5 | 10 | 0 |
| 5 | Leg Extension | Leg Extension | 1 | 1 | 10-12 | 1.5 | 9-10 | 1 |
