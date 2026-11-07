# Lexio

Full-cycle communication learning platform. Architecture/design context lives in
`CLAUDE.md`. This file is just how to get it running.

## Prerequisites

- Python 3.10+, Node 20+
- PostgreSQL running locally (any port — you'll point `.env` at it)
- Redis running locally (Docker or native — any existing instance is fine, Lexio uses
  DB index 1 so it won't collide with another project's data on the same instance)

## First-time setup

**Database** (once):
```sh
psql -U postgres -c "CREATE ROLE lexio WITH LOGIN PASSWORD 'lexio' CREATEDB;"
psql -U postgres -c "CREATE DATABASE lexio OWNER lexio;"
```

**Backend**:
```sh
cd backend
python -m venv venv
venv\Scripts\activate        # Windows — use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # then fill in SECRET_KEY, DB_PORT, REDIS_URL for your machine
python manage.py migrate
```

**Frontend**:
```sh
cd frontend
npm install
```

## Running it

Two terminals, both need to stay open:

```sh
# Terminal 1 — backend, :8000
cd backend
venv\Scripts\activate
python manage.py runserver 8000

# Terminal 2 — frontend, :5173 (proxies /api to :8000)
cd frontend
npm run dev
```

Open http://localhost:5173.

**Browser notes.** Live captions (assessments and practice) use the browser's own speech
recognition, so they need Chrome or Edge — elsewhere the recording is still transcribed and
scored server-side, it just isn't shown as you speak. Presentation mode asks for the camera;
declining it is a supported path (the run is scored on what you said). No video is ever
uploaded — frames are measured in the browser and discarded.

**A student's first run**: pick up to 3 topics (every assessment question is written around
them), read the pledge, then work through the eight modes in any order. Nothing is scored
back until all eight are done, at which point `/report` opens.

## Running tests

```sh
# Backend — from /backend, venv active
python manage.py test

# Frontend unit/component — from /frontend
npm test

# Frontend e2e — from /frontend, needs BOTH dev servers already running.
npm run test:e2e
```

Start the backend with stub providers for e2e, so the suite spends no API
credits and doesn't throttle itself on the auth rate limit:

```sh
AI_PROVIDER_PRIMARY=fake AI_PROVIDER_FALLBACK=fake \
STT_PROVIDER_PRIMARY=fake STT_PROVIDER_FALLBACK=fake \
AUTH_THROTTLE_RATE=200/min python manage.py runserver 8000
```

## Common tasks

```sh
# New migration after changing a model — from /backend
python manage.py makemigrations <app_name>
python manage.py migrate

# Re-seed content/prompts/badges (idempotent — safe to re-run any time).
# seed_prompts is the *fallback* bank: normally prompts are generated per
# student from their chosen topics, and this is what gets used when no AI
# provider is configured or a generation fails validation.
python manage.py seed_prompts
python manage.py seed_content
python manage.py seed_badges

# Attribution engine — run nightly in production (cron / Task Scheduler)
python manage.py compute_attribution

# Django admin (create a superuser first)
python manage.py createsuperuser
# then visit http://localhost:8000/admin
```
