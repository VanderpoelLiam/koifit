# Koifit - Workout Tracker MVP

Self-hosted workout tracking application built with FastAPI and SQLite.

## Quick Start

**Prerequisites:** [uv](https://docs.astral.sh/uv/) and [just](https://github.com/casey/just).

```shell
# Install dependencies
just install

# Run the development server
just serve
```

Open `http://localhost:8000` in your browser. The database is auto-created and seeded on first start.

## Development

```shell
just install   # Install all dependencies (including dev extras)
just serve     # Run the development server with reload
just check     # Run code quality checks (ruff format + lint)
just test      # Run tests
```

Run `just` to see all available commands.

## Docker

### Docker Compose

```shell
docker compose up --build
```

This mounts a persistent volume at `/app/db` and sets `KOIFIT_DB_PATH` automatically.

### Docker CLI

```shell
docker build -t koifit .
docker run -p 8000:8000 -e KOIFIT_DB_PATH=/app/db/db.sqlite -v koifit_db:/app/db koifit
```
