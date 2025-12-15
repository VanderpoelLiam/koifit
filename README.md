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

## Docker Quick Start

**Prerequisites:** [Docker](https://www.docker.com/) and [just](https://github.com/casey/just).

```shell
# Build and start the application
just build
just up

# View logs
just logs

# Stop the application
just down
```

The application will be available at `http://localhost:8000`. A persistent volume is mounted at `/app/db.sqlite` and uses the default database path.

## Docker Compose Setup

To run Koifit on your own server using Docker Compose:

1. **Clone the repository** to your server:

   ```shell
   git clone https://github.com/VanderpoelLiam/koifit
   cd koifit
   ```

2. **Add the service to your Docker Compose file**. You can either:

   **Option A: Build from source** (recommended if you want to customize or track changes):

   ```yaml
   koifit:
     container_name: koifit
     build: /path/to/koifit  # Path to the cloned repository
     ports:
       - "8000:8000"
     volumes:
       - /path/to/data:/app  # Persistent app and database storage
   ```

   **Option B: Build the image first**, then use it:

   ```shell
   cd /path/to/koifit
   docker build -t koifit:latest .
   ```

   Then in your compose file:

   ```yaml
   koifit:
     container_name: koifit
     image: koifit:latest
     ports:
       - "8000:8000"
     volumes:
       - /path/to/data:/app
   ```

3. **Start the service**:

   ```shell
   docker compose up -d koifit
   ```


## PWA & iOS Timer Notifications

Koifit works as a Progressive Web App (PWA) with background timer notifications on iOS.

### Installation (iOS)

1. Open Koifit in your browser
2. Tap the **Share** button
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**
5. Open Koifit from your home screen
6. **Allow notifications** when prompted

Once installed, rest timer notifications will work even when you switch to other apps.
