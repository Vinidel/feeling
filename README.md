# Steady

[![Heroku](https://img.shields.io/badge/Heroku-stormy--cliffs--52671-7056bf?logo=heroku&logoColor=white)](https://stormy-cliffs-52671.herokuapp.com)

A personal mood and activity tracker. Log how you feel day to day, note related activities, review your history on a timeline, and keep a weekly check-in.

**Live app:** [https://stormy-cliffs-52671.herokuapp.com](https://stormy-cliffs-52671.herokuapp.com)

## What it does

Steady lets you:

- **Log daily feelings** on a 0–4 mood scale (Rough → Low → Steady → Good → Great), with optional notes and activity tags (bow, run, lift, swim, cycle).
- **Review mood history** as a 30-day step timeline with summary stats.
- **Track weekly goals** — cardio, strength, mobility, build, archery, hunt — plus short notes on wins, challenges, and plans for next week.

Authentication is handled by [Auth0](https://auth0.com/). Each user only sees their own data.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | React 16, Tailwind CSS, Auth0 React SDK |
| Backend | Go 1.23, Gin |
| Database | MongoDB Atlas |
| Auth | Auth0 (`dev-vin.au.auth0.com`) |
| Deployment | Heroku (Docker container) |

In production, the Go server serves both the built React app and the REST API from a single container.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React SPA  │────▶│  Go API (Gin)    │────▶│  MongoDB Atlas  │
│  (client/)  │     │  (server/)       │     │  database: feeling │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    Auth0 (JWT)
```

## Project structure

```
├── client/          React frontend (Create React App)
├── server/          Go API and static file serving
│   ├── main.go      Server setup, auth middleware, routes
│   ├── handlers.go  API handlers
│   └── web/         Built frontend (generated, gitignored)
├── Dockerfile       Multi-stage build for Heroku
├── heroku.yml       Heroku container deploy config
└── app.json         Heroku app metadata
```

## Database

Data is stored in **MongoDB Atlas** (`cluster0.8pqgj.mongodb.net`).

| Setting | Value |
|---------|-------|
| Database | `feeling` |
| Collections | `feelings`, `weekly_trackers` |
| Credentials | Set via `DB_USER` and `DB_PASS` environment variables |

The connection string is built in `server/main.go` from those two env vars. You need a MongoDB Atlas account with access to the cluster, or your own cluster with the same database/collection names.

## Running locally

You need Go 1.23+, Node 20+, and MongoDB credentials (`DB_USER`, `DB_PASS`).

### Option A — Development mode (recommended)

Run the React dev server and Go API separately. The frontend talks to the API on port 8080.

**Terminal 1 — API:**

```bash
cd server
export DB_USER=your_mongodb_user
export DB_PASS=your_mongodb_password
export PORT=8080
go run main.go handlers.go
```

**Terminal 2 — Frontend:**

```bash
cd client
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The React app proxies API calls to `http://localhost:8080` automatically (see `client/src/config.js`).

### Option B — Production-like single server

Build the frontend into `server/web/` and serve everything from Go:

```bash
cd client
npm install
npm run build-serve   # builds and copies to ../server/web

cd ../server
export DB_USER=your_mongodb_user
export DB_PASS=your_mongodb_password
export PORT=8080
go run main.go handlers.go
```

Open [http://localhost:8080](http://localhost:8080).

### Option C — Docker

Build and run the same container image used on Heroku:

```bash
docker build -t steady .
docker run -p 8080:8080 \
  -e DB_USER=your_mongodb_user \
  -e DB_PASS=your_mongodb_password \
  -e PORT=8080 \
  steady
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_USER` | Yes | MongoDB Atlas username |
| `DB_PASS` | Yes | MongoDB Atlas password |
| `PORT` | No | HTTP port (default `8080`) |
| `CORS_ORIGINS` | No | Allowed origins, comma-separated (defaults to `http://localhost:3000` and the Heroku URL) |
| `CHAT_INGEST_TOKEN` | No | Shared secret for the chat ingest API (`x-ingest-token` header) |
| `AGENT_API_TOKEN` | No | Shared secret for the agent API (`x-agent-token` header) |
| `AGENT_ALLOWED_USER_IDS` | No | Comma-separated Auth0 user IDs allowed to use the agent API |

## API

All user-facing endpoints require a valid Auth0 JWT in the `Authorization` header.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/feelings` | JWT | List the authenticated user's feelings |
| `POST` | `/api/feelings` | JWT | Create a new feeling entry |
| `GET` | `/api/weekly-tracker?weekOf=YYYY-MM-DD` | JWT | Get weekly tracker for a given week |
| `POST` | `/api/weekly-tracker` | JWT | Create or update a weekly tracker |
| `GET` | `/api/chat/capabilities` | Ingest token | Describe chat ingest schema |
| `POST` | `/api/chat/feeling` | Ingest token | Log a feeling from an external chat integration |
| `GET` | `/api/agent/feelings` | Agent token | Fetch feelings for a user (requires `x-user-id` header) |

## Deployment

The app is deployed on **Heroku** as a Docker container:

- **URL:** [https://stormy-cliffs-52671.herokuapp.com](https://stormy-cliffs-52671.herokuapp.com)
- **Config:** `heroku.yml` + root `Dockerfile`
- **Stack:** Container

Heroku config vars must include at least `DB_USER` and `DB_PASS`. Set them in the Heroku dashboard or via the CLI:

```bash
heroku config:set DB_USER=... DB_PASS=... -a stormy-cliffs-52671
```

Deploys are triggered by pushing to the connected GitHub branch or manually via `git push heroku master`.
