# The Learning Tree

The Learning Tree is a local-first educational application built around a full-screen 3D tree. Learners progress by selecting leaves that represent topics, receiving AI-generated lessons, and growing mastery over time. Everything runs locally: profiles are stored in SQLite, lessons are generated through a local Ollama model, and speech playback uses the browser Web Speech API.

This repository currently delivers a working MVP for profile-based learning, streamed lesson generation, local persistence, and a child-first immersive interface. It is not yet a finished infinite-canopy curriculum platform.

## Current capabilities

- Full-screen React Three Fiber tree interface with touch-friendly leaf targets
- Local learner profiles with selectable learner levels before entering the tree
- Profile-specific tree mastery colors and recent lesson history
- Streaming lesson generation over Server-Sent Events from a single local Ollama model
- Immediate lesson rendering as text arrives in the frontend
- Local lesson persistence and challenge-based mastery progression per leaf
- Warmup mini-games while waiting for the first lesson token
- Web Speech API support for leaf titles, lesson reading, and game prompts
- Dynamic branch growth with locally generated new leaves
- Local AI health check against the configured Ollama server

## Product status

Implemented:

- Local profiles
- Seeded tree data in SQLite
- 3D tree renderer
- Streamed lesson generation
- Saved lesson history
- Warmup mini-games
- AI health checks
- Dynamic branch growth
- Lesson modal and read-aloud support

Still open:

- True infinite canopy with streamed world chunks
- Full Alembic-style migration tooling
- Broader frontend and backend test coverage
- End-user packaging beyond the local setup/run scripts
- Advanced citation-grounded academic workflows
- Curriculum modes beyond the current child-first MVP

## Architecture

### Frontend

- React 18
- TypeScript
- Vite
- React Three Fiber
- Drei
- React Spring
- Three.js

Responsibilities:

- Render the immersive 3D tree
- Manage profile selection, learner level selection, and local lesson UI state
- Fetch tree and lesson history data
- Start lesson streams and render tokens in real time
- Run warmup games while waiting for the first token
- Speak leaf titles and lesson text with the browser speech engine

### Backend

- FastAPI
- SQLAlchemy
- SQLite
- Local Ollama HTTP API

Responsibilities:

- Bootstrap the local database
- Serve profile, tree, lesson-history, and health endpoints
- Resolve learner context for lesson generation
- Stream lesson text from a single Ollama model over SSE
- Persist generated lessons and update mastery progress after lesson challenges
- Generate additional leaves for branches

### Lesson generation model

The MVP no longer uses a multi-agent orchestration layer.

Lesson generation now works as a single-model streaming pipeline:

1. The frontend sends `profile_id` and `leaf_id`.
2. The backend resolves the learner profile, grade, subject, topic, and recent related progress from SQLite.
3. The backend builds one tutoring prompt for Ollama.
4. Ollama streams lesson markdown back through `text/event-stream`.
5. The frontend appends lesson text live as it arrives.
6. When the stream completes, the backend saves the lesson.
7. When the learner passes the lesson challenge, the backend marks completion and increments mastery for that leaf.

This architecture is designed to reduce latency and remove the timeout problems caused by the old multi-agent path.

## Repository layout

```text
learning_tree/
|-- apps/
|   |-- api/
|   |   |-- app/
|   |   |   |-- core/
|   |   |   |   `-- config.py
|   |   |   |-- db/
|   |   |   |   |-- base.py
|   |   |   |   |-- bootstrap.py
|   |   |   |   |-- models.py
|   |   |   |   `-- session.py
|   |   |   |-- routes/
|   |   |   |   `-- tree.py
|   |   |   |-- schemas/
|   |   |   |   `-- tree.py
|   |   |   |-- services/
|   |   |   |   |-- ai_health.py
|   |   |   |   |-- lesson_engine.py
|   |   |   |   `-- tree_layout.py
|   |   |   `-- main.py
|   |   |-- requirements.txt
|   |   `-- sql/
|   |       `-- schema.sql
|   `-- web/
|       |-- public/
|       |-- src/
|       |   |-- features/
|       |   |   |-- layout/
|       |   |   |-- lessons/
|       |   |   |-- profiles/
|       |   |   |-- rewards/
|       |   |   |-- tree/
|       |   |   `-- warmup/
|       |   |-- lib/
|       |   |-- styles/
|       |   |-- App.tsx
|       |   `-- main.tsx
|       |-- package.json
|       |-- tsconfig.json
|       `-- vite.config.ts
|-- data/
|   `-- learning_tree.db
|-- PHASE3_CHECKLIST.md
`-- README.md
```

## Data model

The app persists everything locally in `data/learning_tree.db`.

Primary tables:

- `profiles`: learner profiles stored on the local machine
- `grade_levels`: trunk segments and grade ordering
- `subject_branches`: branches for each grade/subject combination
- `leaves`: persisted topic nodes, coordinates, and lesson seed prompts
- `lessons`: saved generated lessons per profile and leaf
- `profile_leaf_progress`: mastery state, completed count, and last-open metadata per profile and leaf

Key relationships:

- One `GradeLevel` has many `SubjectBranch` rows
- One `SubjectBranch` has many `Leaf` rows
- One `Profile` has many `Lesson` rows
- One `Profile` has many `ProfileLeafProgress` rows

On first backend startup, the database is created and seeded automatically.

## Runtime requirements

- Python 3.11+
- Node.js 20.19+ or 22.12+
- npm 10+
- Ollama installed locally
- At least one Ollama model pulled locally

Default model settings:

- Fast model: `llama3.2:3b`
- Advanced model: `qwen3:30b`

The current lesson path prefers fast first-token response for the MVP.

## Quick start

### One-command local setup

From the repository root:

```powershell
.\scripts\setup.ps1
```

Start Ollama separately, then run both local app servers:

```powershell
.\scripts\run-dev.ps1
```

The script opens separate PowerShell windows for the API and web app.

### 1. Start Ollama

Pull the default fast model once:

```powershell
ollama pull llama3.2:3b
```

Optional larger model for advanced content:

```powershell
ollama pull qwen3:30b
```

Start Ollama:

```powershell
ollama serve
```

### 2. Start the API

From the repository root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r apps/api/requirements.txt
uvicorn app.main:app --reload --app-dir apps/api
```

The API runs at `http://127.0.0.1:8000`.

### 3. Start the web app

In a separate terminal:

```powershell
cd apps/web
npm install
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`.

### 4. Use the app

Typical learner flow:

1. Choose or create a child profile.
2. Enter the 3D tree.
3. Select a leaf.
4. Start the lesson.
5. Wait briefly for the first streamed token.
6. Read or listen to the lesson as it appears live.
7. Complete the lesson challenge to build mastery.
8. Revisit the leaf later for more practice.

## Configuration

The backend reads `.env` values with the `LEARNING_TREE_` prefix.

Example:

```env
LEARNING_TREE_APP_NAME=The Learning Tree API
LEARNING_TREE_DATABASE_URL=sqlite:///data/learning_tree.db
LEARNING_TREE_OLLAMA_BASE_URL=http://127.0.0.1:11434
LEARNING_TREE_OLLAMA_FAST_MODEL=llama3.2:3b
LEARNING_TREE_OLLAMA_ADVANCED_MODEL=qwen3:30b
LEARNING_TREE_LESSON_TEMPERATURE=0.2
LEARNING_TREE_OLLAMA_TIMEOUT_SECONDS=180
```

Supported settings:

| Variable | Default | Purpose |
|---|---|---|
| `LEARNING_TREE_APP_NAME` | `The Learning Tree API` | FastAPI application title |
| `LEARNING_TREE_DATABASE_URL` | `sqlite:///data/learning_tree.db` | SQLite connection string |
| `LEARNING_TREE_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama server URL |
| `LEARNING_TREE_OLLAMA_FAST_MODEL` | `llama3.2:3b` | Default low-latency lesson model |
| `LEARNING_TREE_OLLAMA_ADVANCED_MODEL` | `qwen3:30b` | Optional larger model for advanced content |
| `LEARNING_TREE_LESSON_TEMPERATURE` | `0.2` | Lesson-generation temperature |
| `LEARNING_TREE_OLLAMA_TIMEOUT_SECONDS` | `180` | Ollama request timeout in seconds |

## API reference

All API routes are mounted under `/api`.

### Health

- `GET /api/health`
- `GET /api/health/ai`

### Profiles

- `GET /api/profiles`
- `POST /api/profiles`

Example profile creation payload:

```json
{
  "display_name": "Explorer",
  "avatar_seed": "fox",
  "age_band": "early-reader"
}
```

### Tree

- `GET /api/tree?profile_id=1`

Returns seeded grade, branch, and leaf data with profile-specific mastery merged into each leaf.

### Lesson history

- `GET /api/profiles/{profile_id}/lessons`

Returns recent saved lessons for that profile, including completion state and fallback-recovery metadata when a local fallback lesson was saved.

### Streamed lesson generation

- `POST /api/generate-lesson/stream`

Request payload:

```json
{
  "profile_id": 1,
  "leaf_id": 42
}
```

Response type:

- `text/event-stream`

Current SSE events:

- `start`
- `token`
- `replace`
- `complete`
- `error`

If the live Ollama stream fails, the backend emits a `replace` event with a local fallback lesson and stores `recovered`, `recovery_detail`, and `stream_model` metadata with the saved lesson.

The backend streams lesson text as it is generated, then sends a final completion payload after the lesson is saved locally.

### Branch expansion

- `POST /api/branches/generate-leaves`

Example payload:

```json
{
  "grade": "Grade 3",
  "subject": "Science",
  "count": 3
}
```

## Frontend behavior

### Immersive 3D tree

The tree is rendered in React Three Fiber using placeholder geometry:

- Cylinders for the trunk and branches
- Planes for leaves
- Large invisible hit targets for child-friendly tapping
- Overlay UI rendered above the canvas

### Streamed lesson reader

When a lesson starts:

- the lesson modal opens immediately
- a subtle waiting state shows until the first token arrives
- the warmup game appears only while the app is waiting for the first streamed token
- streamed lesson text is appended live into the reader
- the warmup game closes as soon as the first token is received
- recovered fallback lessons show a persistent notice in the lesson reader

### Speech

The browser Web Speech API is used for:

- leaf title announcement
- read-aloud support for lesson text
- mini-game prompts

Speech support depends on the browser and may require a user interaction before playback is allowed.

## Safety and privacy

- No cloud login is required
- Profiles and lessons stay local in SQLite
- The app is designed for a local Ollama server
- The current MVP does not rely on hosted AI APIs

Limits:

- AI-generated lessons still require adult judgment
- Advanced academic content is not yet citation-grounded
- The app is not yet appropriate for high-stakes or regulated learning environments

## Verification

Recent verification completed in this repository:

- backend Python syntax compilation
- backend normalization, API, migration, and SQLite foreign-key regression tests
- frontend TypeScript checks
- frontend SSE, profile, warmup, and lesson reader component tests
- frontend production build with Vite

The frontend currently builds successfully. The 3D tree and reward games are code-split, but the Three/R3F chunks remain the largest frontend assets.

## Known limitations

- The canopy is still finite rather than truly infinite
- Seeded curriculum is broad but still shallow at each grade/subject branch
- Migration tooling is a small in-app runner, not a full Alembic workflow
- Test coverage is improved but still not exhaustive
- Advanced higher-ed and research workflows are not implemented
- Lesson quality still depends heavily on the locally installed Ollama model and machine performance

## Troubleshooting

### Lesson generation is slow or fails

Check:

- Ollama is running
- the configured model is installed locally
- `GET /api/health/ai` reports a healthy response
- the machine has enough memory for the configured model

For better first-token latency, prefer the fast model in `.env`.

### Speech does not play

Check:

- the browser supports `speechSynthesis`
- the page has received a user interaction
- the device is not muted

### I want a clean reset

Stop the API and delete:

```text
data/learning_tree.db
```

Restart the API to recreate and reseed the local database.

## Key files

Backend:

- `apps/api/app/main.py`
- `apps/api/app/routes/tree.py`
- `apps/api/app/services/lesson_engine.py`
- `apps/api/app/services/ai_health.py`
- `apps/api/app/db/models.py`
- `apps/api/app/db/bootstrap.py`

Frontend:

- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/features/tree/components/LearningTreeCanvas.tsx`
- `apps/web/src/features/tree/hooks/useTreeData.ts`
- `apps/web/src/features/tree/hooks/useLeafSpeech.ts`
- `apps/web/src/features/profiles/hooks/useProfiles.ts`
- `apps/web/src/features/lessons/hooks/useLessonHistory.ts`
- `apps/web/src/features/lessons/components/LessonReader.tsx`
- `apps/web/src/features/rewards/components/RewardGameModal.tsx`
- `apps/web/src/features/warmup/components/WarmupGameModal.tsx`

## Summary

The Learning Tree now uses a simpler and faster lesson architecture: one local model, one streaming request, one persisted lesson result. The remaining work is product hardening and curriculum expansion, not basic wiring.
