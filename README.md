# Koifit - Workout Tracker MVP

Self-hosted workout tracking application built with FastAPI and SQLite.

## Quick Start

**Prerequisites:** [uv](https://docs.astral.sh/uv/) and [just](https://github.com/casey/just) (optional but recommended)

```bash
# Install dependencies
just install

# Run the development server
just serve
```

Open `http://localhost:8000` in your browser. The database is auto-created and seeded on first start.

## Development

### Using just (recommended)

```bash
just install   # Install all dependencies (including dev extras)
just serve     # Run the development server with reload
just check     # Run code quality checks (ruff format + lint)
just test      # Run tests
```

Run `just` to see all available commands.

### Manual commands

```bash
# Install dependencies
uv sync --extra dev

# Run server
uv run uvicorn main:app --reload

# Run tests
uv run pytest

# Format and lint
uv run ruff format .
uv run ruff check .
```

### Pre-commit hooks

Install pre-commit hooks to automatically check code quality on commit:

```bash
uv run pre-commit install
```

Or run checks manually:

```bash
uv run pre-commit run --all-files
```

## Configuration

- `KOIFIT_DB_PATH` (optional): Path to the SQLite database. Defaults to `./db/db.sqlite`.

> **Tip:** Set `KOIFIT_DB_PATH` outside the repo (e.g. `~/.local/share/koifit/db.sqlite`) to avoid local db changes appearing in `git status`. If the db file is already tracked and noisy, you can locally mark it ignored with `git update-index --skip-worktree db/db.sqlite`.

## Docker

### Docker Compose (recommended)

```bash
docker compose up --build
```

This mounts a persistent volume at `/app/db` and sets `KOIFIT_DB_PATH` automatically.

### Docker CLI

```bash
docker build -t koifit .
docker run -p 8000:8000 -e KOIFIT_DB_PATH=/app/db/db.sqlite -v koifit_db:/app/db koifit
```
