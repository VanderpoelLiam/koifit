# Workout Tracker Design Document

This document defines the technical architecture and design patterns for the workout tracker application. It follows a minimal, opinionated "omakase" web stack: HTML + HTTP server + SQLite + flat CSS architecture.

## Stack overview

- **Runtime / platform**
  - Single server process running in a Docker container, accessible from any browser on the local network.
  - Minimal HTTP server capable of:
    - Serving static files (`.html`, `.css`, `.js`, assets).
    - Exposing JSON endpoints for data access (session management, auto-save, history).
  - SQLite as the only database (single `db.sqlite` file on disk).

  - **Client**
  - Hand-written HTML for pages (home, day selection, workout session, exercise history).
  - Unbundled, framework-free JavaScript modules for workout tracking interactivity (auto-save, form management, state persistence).
  - Vanilla CSS organized into multiple small files under `app/assets/stylesheets`, following the 37signals "no build" architecture (reset, base, colors, utilities, per-component files). [1]
  - **Mobile-only design**: Layout and interactions are strictly optimized for mobile touchscreens (iPhone/Android). Desktop support is secondary or non-existent.

- **Build / tooling**
  - No CSS preprocessor.
  - No CSS build pipeline (no PostCSS, no Tailwind, no bundlers).
  - Optional: a tiny JS bundler or none at all; scripts can be loaded directly via `<script type="module">`.
  - Rely on the server / framework to:
    - Concatenate and fingerprint CSS in production if desired (optional).
    - Serve raw files in development.

***

## Directory and file structure

Project-level structure:

```text
app/
  assets/
    stylesheets/
      _reset.css
      base.css
      colors.css
      utilities.css
      buttons.css
      inputs.css
      layout.css
      cards.css
      header.css
      footer.css
    session-panel.css
    exercise-card.css
    set-table.css
    day-selector.css
    animations.css
    spinners.css
  javascripts/
    app.js
    session.js
    auto-save.js
views/
  layouts/
    application.html
  pages/
    index.html
    days.html
    session.html

db/
  db.sqlite
  schema.sql
  seed.sql

config/
  server.config.(js|rb|py|go|...)
```

Key idea: **flat CSS directory, one file per concept**, no nested folders, no partials. [1]

***

## CSS architecture

### Goals

- Professional, minimalist aesthetic suitable for a fitness tracking app.
- **Mobile-only optimization**: Designed exclusively for phone browsers during workouts.
- No third-party CSS frameworks.
- Rely on **modern CSS**:
  - Custom properties for theming.
  - Nesting for component organization.
  - `@layer` for specificity control.
  - `:has()` for stateful UI (e.g., completed sets, filled inputs).
  - Container queries for responsive components. [1]

### File responsibilities

- `_reset.css`
  - Global reset / normalization.
  - Loads first (underscore ensures sort order).
  - Only concerns:
    - Box sizing.
    - Margin / padding resets.
    - Basic typography defaults.

- `base.css`
  - Root-level tokens and global patterns:
    - `:root` custom properties for spacing, typography, radii, transitions.
    - Base typography rules (`body`, `h1`–`h6`, `p`, lists).
    - Layout primitives (`main`, `section`, `article`, `aside`).
  - Uses `@layer base` to group all base rules.

- `colors.css`
  - Color system using OKLCH (or similar) primitives. [1]
  - Defines:
    - Raw color variables: `--lch-blue`, `--lch-gray`, `--lch-green`, `--lch-red`, etc.
    - Semantic tokens: `--color-bg`, `--color-ink`, `--color-border`, `--color-accent`, `--color-success`, `--color-danger`, etc.
    - Effort tag colors: `--color-effort-increase`, `--color-effort-decrease` , `--color-effort-good`.
  - Handles dark mode via `@media (prefers-color-scheme: dark)`.
  - Optionally uses `color-mix()` to derive contextual colors. [1]

- `utilities.css`
  - Small set of **additive** utility classes:
    - `.flex`, `.grid`, `.gap-*`, `.pad-*`, `.stack`, `.align-center`.
    - `.hide`, `.sr-only`.
    - Simple text utilities: `.text-small`, `.text-quiet`, `.text-center`, `.text-bold`.
  - Used sparingly for one-off adjustments; **components carry the main styles**. [1]

- `buttons.css`
  - Semantic button system:
    - `.btn` base.
    - Variants: `.btn--primary`, `.btn--secondary`, `.btn--danger`, `.btn--ghost`.
    - Special: `.btn--finish` for prominent "Finish Workout" action, fixed at bottom.
  - Uses custom properties for:
    - Padding, radius, colors, shadows.
  - Pseudo-classes and states colocated:
    - `:hover`, `:active`, `:disabled`, `[aria-busy]`.
  - Example pattern: a single `.btn` class for 90% of buttons with modifiers for exceptional behavior. [1]

- `inputs.css`
  - Text inputs, number inputs, textareas, checkboxes.
  - Weight and rep inputs styled for simple numeric entry (no up/down spinners).
  - Unified visual language:
    - Shared border radius, focus ring, padding.
  - Use `:has()` where appropriate to style wrappers based on internal input state (e.g. completed sets, filled fields). [1]
  - Checkbox styling for:
    - Set completion toggles.
    - Warmup completion.
    - Dropset completion.
    - Effort tags (mutually exclusive pair: "increase" and "decrease").

- `layout.css`
  - Page-level layout patterns:
    - App shell (header, main, footer).
    - **Single column layout**: Full-width containers, no sidebars or multi-column grids.
    - Content width constraints: relaxed for mobile to maximize screen real estate (e.g., `100vw` or minimal padding).
    - Fixed bottom action bar for "Finish Workout" button (sticky footer).
  - Use container queries for component-level responsiveness.

- `cards.css`
  - Reusable UI chunks:
    - Generic card component (`.card`).
    - Variants: `.card--highlight`, `.card--muted`, `.card--interactive`.
  - Follow pattern:
    - One main component class (`.card`).
    - Small set of variants.
    - Internal structure using BEM-like naming or simple descendant selectors.

- `session-panel.css`
  - Overall session page layout and structure.
  - Session header showing day label and date.
  - Container for exercise cards.
  - Progress indicators (optional: visual completion status).

- `exercise-card.css`
  - Individual exercise slot card within a workout session.
  - Components:
    - Exercise title.
    - Rep target and RPE display.
    - Rest time indicator.
    - Exercise notes section.
    - Previous session data display (collapsible).
    - Warmup checkbox.
    - Working sets table container.
    - Dropset checkbox.
    - Notes textarea.
    - Effort tag checkboxes.
  - Uses `:has()` to show visual states:
    - All sets completed.
    - Any sets in progress.
    - Exercise expanded/collapsed.

- `set-table.css`
  - Working sets table styles.
  - Columns: Set Number, Weight (kg), Reps, Completion.
  - Styles for:
    - Simple inputs (allowing negative values for weight).
    - Completed row visual state.
    - Focus states for rapid data entry.
  - Mobile-optimized table layout (horizontal scroll or stacked).

- `day-selector.css`
  - Day selection page styles.
  - Button grid or list for workout days (Upper 1, Lower 1, etc.).
  - Large, touch-friendly targets.
  - Visual hierarchy for day labels.

***

## CSS layering and load order

Use CSS Layers to explicitly control precedence:

```css
@layer reset, base, components, utilities;
```

- `_reset.css`
  - Defines `@layer reset { ... }`.
- `base.css`, `colors.css`
  - Define `@layer base { ... }`.
- `buttons.css`, `inputs.css`, `layout.css`, `cards.css`, `session-panel.css`, `exercise-card.css`, `set-table.css`, `day-selector.css`
  - Define `@layer components { ... }`.
- `utilities.css`
  - Defines `@layer utilities { ... }`.

This guarantees:

- Reset < Base < Components < Utilities.
- Utilities can always override components when necessary, regardless of file order. [1]

***

## Design tokens and units

- **Spacing**
  - Horizontal: `ch` units (`--space-inline: 1ch`) for content-related spacing. [1]
  - Vertical: `rem` units (`--space-block: 1rem`) for vertical rhythm. [1]
  - Touch targets: Minimum `44px` (iOS standard) or `48px` (Android standard) for mobile-friendly buttons and inputs.

- **Typography**
  - Base font size responsive via `clamp()` at `html`.
  - Use custom properties for scale:
    - `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, `--text-xl`.
  - Heading sizes defined via variables and applied in `base.css`.
  - Monospace font for numeric data (weight, reps) for better alignment and readability.

- **Colors**
  - OKLCH primitives in `colors.css` for perception-friendly colors. [1]
  - Semantic tokens for UI usage, not brand names:
    - `--color-ink`, `--color-ink-muted`, `--color-accent`, `--color-border-subtle`, etc.
    - `--color-success` (for completed sets, progress).
    - `--color-danger` (for "decrease" effort, delete actions).
    - `--color-info` (for "increase" effort, informational notes).

- **Radius, shadows, transitions**
  - Minimal set of tokens:
    - `--radius-sm`, `--radius-md`.
    - `--shadow-soft`, `--shadow-lifted`.
    - `--transition-fast`, `--transition-default`.

***

## HTML and JS conventions

- HTML
  - Semantic structure:
    - `header`, `nav`, `main`, `section`, `article`, `footer`.
  - Class naming:
    - Components: `.card`, `.btn`, `.input-group`, `.exercise-card`, `.set-table`.
    - Modifiers: `.card--highlight`, `.btn--primary`, `.exercise-card--completed`.
    - Utilities: `.stack`, `.flex`, `.hide`, `.text-quiet`.
  - Accessibility:
    - Proper label associations for all inputs.
    - `aria-busy` for save states.
    - `aria-expanded` for collapsible sections.
    - Focus management for form flows.

- JavaScript
  - Minimal scripts under `app/assets/javascripts`.
  - `app.js` entry that:
    - Wires up basic behaviors (navigation, modals).
    - Imports feature modules (if using ES modules).
  - `session.js`:
    - Manages workout session state.
    - Handles set completion toggles.
    - Coordinates auto-save calls.
  - `auto-save.js`:
    - Debounced save logic for inputs (~1s for weight/reps, ~2s for notes).
    - Immediate save for checkboxes.
    - Visual feedback (saving indicator, error states).
    - **Logic**: Ensures exercises are not saved/persisted if no sets are marked as complete.
  - Avoid JS for things CSS can do:
    - Show/hide states via `:has()` where practical.
    - Visual toggles based on inputs/checkboxes.
  - Use progressive enhancement:
    - Core functionality should work without JS (session creation, day selection).
    - JS enhances with auto-save, real-time updates, collapsible sections.

***

## Application-specific patterns

### Auto-save behavior

- **Weight and reps inputs**: Debounced save after 1 second of inactivity.
- **Notes textarea**: Debounced save after 2 seconds of inactivity.
- **Checkboxes** (set completion, dropset, effort tags): Immediate save on change.
- **Visual feedback**:
  - Subtle "saving..." indicator near input.
  - Success state (checkmark or brief green flash).
  - Error state (red outline, retry prompt).
- **API endpoint**: `POST /sessions/{session_id}/exercises/{session_exercise_id}/save`
  - Payload: `{ notes?, effort_tag?, dropset_done?, sets?: [{ set_number, weight_kg, reps, is_done }] }`

### Effort tags (weight change indicators)

- Two mutually exclusive checkboxes: "-" (decrease) and "+" (increase).
- Default state (neither checked): "good" (keep weight).
- Visual styling:
  - "+" checkbox: color (`--color-effort-increase`).
  - "-" checkbox: color (`--color-effort-decrease`).
  - Neither: Gray/muted color (`--color-effort-good`).
- Clicking one unchecks the other (JS logic).
- Saves to `session_exercise.effort_tag` field.

### Set completion state

- Use `:has()` to style parent row based on checkbox state:
  - Completed rows get muted background, strikethrough, or checkmark icon.
- Visual confirmation helps users track progress through workout.

### Previous session data

- Pre-populate weight and reps inputs with data from last session.
- Display in placeholder or as default value.
- Show previous notes in collapsible "Last time" section.
- Use muted colors to distinguish from current session data.

### Exercise notes

- Exercise title.
- Exercise notes (from `exercise.notes` field) displayed as info text below title.
- May include form cues or alternative exercise suggestions.

### Responsive behavior

- **Mobile-only**: Layout assumes a vertical, narrow viewport.
- **No Desktop adaptation**: No "ch" width constraints or centering for large screens; interface simply stretches or remains strictly mobile-width.
- **Touch-first**:
  - Touch targets >= 48px.
  - Input fields sized for easy thumb typing.
  - Buttons span full width where appropriate for easy reach.
  - Avoid hover states; rely on `:active` for feedback.
- **Set table**: Optimized for vertical stacking or horizontal scrolling if rows are wide, ensuring no zooming is required.

***

## Deployment expectations

- **Development**
  - CSS files served as-is, editable with instant refresh.
  - No bundling, compilation, or preprocessing required.
  - Hot reload for rapid iteration (if supported by server).

- **Production**
  - Docker container with:
    - HTTP server (e.g., Go, Node, Python, Ruby).
    - SQLite database file.
    - Static assets (HTML, CSS, JS).
  - Optionally:
    - Concatenate and minify CSS using the app framework's asset pipeline.
    - Fingerprint assets for cache busting.
  - Data persistence via Docker volume mounted to `/app/db/db.sqlite`.
  - Accessible on local network or via reverse proxy (for remote access).
  - No auth required (single-user, self-hosted).

***

## Non-goals and constraints

- No CSS frameworks (Tailwind, Bootstrap, etc.).
- No CSS preprocessors (Sass, Less).
- No CSS-in-JS.
- No build-step-specific constructs (e.g., `@apply` from Tailwind).
- Single-user application; no authentication, no multi-tenancy.
- No real-time collaboration (single active session per user).
- **No desktop UI**: The interface is not intended for mouse/keyboard usage.
- No iOS/Android specific features; PWA capabilities optional but highly recommended (manifest.json, touch icons).

***

## Database and data model

- **Schema**: See `db/schema.sql` and MVP.md for full data model.
- **Key tables**:
  - `exercise`: Pre-seeded exercises with names, increments, notes.
  - `day`: Workout days (Upper 1, Lower 1, etc.).
  - `slot`: Exercise slots within days (what exercises to do, sets, reps, rest time).
  - `session`: Workout instances tied to a day and date.
  - `session_exercise`: Links session to slots with chosen exercises, notes, effort tags.
  - `set_entry`: Individual sets performed (weight, reps, completion state).
- **Constraints**:
  - Only one unfinished session at a time (`is_finished = 0`).
  - Historical data remains intact even if program structure changes.
  - Exercises with 0 completed sets are not saved/persisted as history.

***

## API endpoint summary

- `GET /` — Home page (resume or start new).
- `GET /days` — Day selection page.
- `POST /sessions/start/<day_id>` — Create or resume session.
- `GET /sessions/<session_id>` — Workout session page.
- `POST /sessions/<session_id>/exercises/<session_exercise_id>/save` — Auto-save endpoint.
- `POST /sessions/<session_id>/finish` — Mark session as finished.
- `GET /health` — Health check.

See MVP.md for detailed endpoint specifications.

***

## Next steps

1. Implement base CSS files (`_reset.css`, `base.css`, `colors.css`, `utilities.css`).
2. Define design tokens (spacing, typography, colors) in `:root`.
3. Create component styles (`buttons.css`, `inputs.css`, `cards.css`).
4. Build page-specific styles (`session-panel.css`, `exercise-card.css`, `set-table.css`, etc.).
5. Implement JavaScript modules for auto-save and session management.
6. Wire up HTML templates with semantic classes and proper accessibility.
7. Test on mobile devices for touch interaction and responsiveness.

***

## References

[1] Vanilla CSS is all you need — https://www.zolkos.com/2025/12/03/vanilla-css-is-all-you-need

***

This design document should be read alongside `MVP.md` for a complete understanding of the application's functionality and data model.
