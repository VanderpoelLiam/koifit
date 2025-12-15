FROM ghcr.io/astral-sh/uv:python3.13-alpine

# Copy the project into the image
COPY . .

# Disable development dependencies
ENV UV_NO_DEV=1
ENV UV_LINK_MODE=copy

# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
RUN uv sync --locked

# Expose port
EXPOSE 8000

# Run the application
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
