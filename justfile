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
