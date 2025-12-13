#!/usr/bin/env -S just --justfile
# ^ A shebang isn't required, but allows this justfile to be executed
#   like a script, with `./justfile check`, for example.

default:
    @just --list

# Install all dependencies (including dev extras)
install:
    uv sync --extra dev
    uv run pre-commit install

# Run code quality checks
check:
    uv run ruff format .
    uv run ruff check .
    uv run pre-commit run --all-files

# Run tests
test:
    uv run pytest

# Serve the app locally with reload
serve:
    uv run uvicorn main:app --reload

# Serve the app over tailscale, available at https://<tailnet-device-name>.<tailnet-dns-name> e.g.  https://lovely-laptop.tigris-tigerfish.ts.net
serve-tailscale:
    #!/usr/bin/env bash
    set -e
    # Start tailscale serve in background
    tailscale serve --bg 8000
    # Trap to reset tailscale serve when script exits
    trap "tailscale serve reset" EXIT INT TERM
    # Start uvicorn (this will block until interrupted)
    uv run uvicorn main:app --reload

# Reset database (purge and reinitialize from schema + seed)
db-reset:
    uv run python init_db.py

# Build the Docker image
build:
    docker compose build

# Start the Docker containers
up:
    docker compose up -d

# Stop the Docker containers
down:
    docker compose down

# View Docker logs
logs:
    docker compose logs -f
