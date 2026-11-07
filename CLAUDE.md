# Lexio

Full-cycle communication learning platform (speaking, writing, vocabulary, presentation,
grammar, reading, listening, group discussion). Source of truth for architecture:
`Lexio_LLD_Architecture_updated.docx`. Source of truth for visual design:
`design_extracted/lexio/*.jsx` (do not restyle without checking there first). Full build
plan (phases, rationale, open assumptions): see the plan this repo was built from —
ask the user for its path if you need the original context, or rely on this file plus
the "Build phases & status" section below, which is kept current.

## Stack & why

- **Frontend**: React 18 + Vite, Tailwind v4 (CSS-first `@theme`, no `tailwind.config.js`)
  + CSS variables. SPA, no SSR (LLD §16.1) — this is a logged-in product behind auth,
  SSR buys nothing. Pinned to React 18 (not the Vite default of 19) to match the LLD's
  stack table exactly.
- **State**: Zustand (global: auth/session/path/gamification/practice) + TanStack Query
  (server state/caching, no axios — plain `fetch` via `frontend/src/lib/api.js`). Split
  deliberately — Zustand never holds server data.
- **Backend**: Django + DRF. One app per LLD module (see Module map below).
- **Async analysis**: a small `ThreadPoolExecutor` in `apps/analysis/runner.py`, not
  Celery. The LLD's submit→poll contract (§5.2) needs the AI work off the request thread;
  a thread pool does that without a third process to run in dev. Celery+Redis stays in
  requirements as the production upgrade — swapping is a one-line change in that file.
  Tests set `ANALYSIS_SYNC=True` to run inline and stay deterministic.
- **Real-time**: Django Channels over Daphne (ASGI), for live practice coaching (LLD §18).
  `daphne` is first in INSTALLED_APPS so `manage.py runserver` serves WebSockets too — no
  second process in dev. WS auth is JWT-in-query-param (`apps/practice/middleware.py`),
  since browsers can't set headers on a WS handshake.
- **DB**: PostgreSQL (relational) + Redis (cache/sessions/channels/Celery broker).
- **AI**: Claude primary, Gemini fallback, behind `core.ai.AIProvider` (built in Phase 1,
  first actual call site).
- **STT**: Deepgram primary, AssemblyAI fallback, behind `core.stt.STTProvider` (Phase 1).
- **TTS**: Sarvam (`bulbul:v3`, native Indian-English voices) primary, OpenAI
  (`gpt-4o-mini-tts`) fallback, behind `core.tts.TTSProvider`; ElevenLabs stays named but has
  no adapter. Every spoken voice (GD peers, Presentation avatar, Listening clip) goes through
  `lib/tts.js` → `/api/assessment/tts/speak`. See the deviation log entry below.
- **Storage**: `apps.core.storage.get_storage()` — `LocalFileStorage` (writes under
  `backend/media/`) in dev, `S3Storage` in prod, selected by `STORAGE_BACKEND` env var.
  Both implementations exist in code always; built in Phase 0 for avatar upload.
- **Notifications**: SendGrid email only for v1 — push (FCM/OneSignal) deliberately
  deferred.

## Local dev infra — deliberately simple

No Docker, no docker-compose, no separate settings modules. One `config/settings.py`,
driven entirely by `backend/.env` (`python-decouple`). Same file runs dev and prod; only
the `.env` values differ.

- **Postgres**: whatever is already running natively on the machine. On this dev machine
  that's port **5433** (not the 5432 default — check `postgresql.conf` if unsure), db
  `lexio`, role `lexio`/`lexio`. A different machine may run 5432 — just update `.env`.
- **Redis**: whatever is already running (Docker or native) on port 6379. Lexio uses
  **DB index 1** (`redis://localhost:6379/1`), not DB 0, specifically so it never
  collides with another project's data if the same Redis instance is shared. Don't spin
  up a new Redis container — reuse what's there.
- No new containers get created for local dev. If Postgres/Redis aren't running, start
  what's already installed — don't containerize a fresh copy alongside it.

## Repo structure

```
/backend
  config/                  # settings.py (single file), asgi.py, urls.py
  apps/
    core/                    # ai/, stt/, storage/ providers; testing.py base test cases
    accounts/                # M1 ✅
    assessments/             # M2 ✅  (models, prompt bank, submit/status/history)
    analysis/                # M3 ✅  (rubrics, prompts, services, aggregates, runner)
    dashboard/               # M4 ✅  (read-only aggregation, no models)
    feedback/                # M6 ✅
    learning_path/           # M7 + M12.2 ✅ (path engine, skill graph, mastery gate)
    content/                 # M8 ✅ (library, recommendations); M12.1/5/6 pending
    gamification/            # M9 partial (XP + levels; badges/streaks pending)
    practice/                # M5 ✅ (consumers, live coaching, session scoring)
    reassessment/            # M10 ✅ (triggers, delta engine, comparison report)
    retention/               # M11 partial (Echo companion, daily drill)
    notifications/            # email adapter — not yet built (Phase 8)
  requirements.txt
  .env                       # local secrets/config, gitignored
  .env.example                # template — copy to .env and fill in
/frontend
  src/
    routes/                   # one folder per LLD §16.2 route (landing/, auth/, dashboard/, …)
    components/
      primitives/               # design system, ported from design_extracted/lexio/primitives.jsx
      AppShell.jsx               # authenticated page shell (ported from lexio/desktop.jsx DShell)
      PublicHeader.jsx            # pre-auth header (landing/register/login)
      AuthGuard.jsx                # redirects unauthenticated users to /login
    stores/                      # zustand — one file per §16.3 store
    lib/                          # api.js (fetch client) + one *Api.js of TanStack Query hooks per area
    styles/tokens.css              # design tokens, see below
  e2e/                             # Playwright specs
design_extracted/                    # the original design prototype — reference only, not shipped
CLAUDE.md
```

Design source files stay referenced from `design_extracted/` when porting a new page;
each ported component's comment says which prototype file it came from.

## Design system rules

- Tokens live in `frontend/src/styles/tokens.css` as a Tailwind v4 `@theme` block, ported
  from `design_extracted/lexio/primitives.jsx` (`L_COLORS`) and
  `design_extracted/lexio.html` (`:root`). **These are the real values** — ignore the
  LLD's own Appendix color table, which doesn't match the actual prototype and is treated
  as stale.
- Fonts: Instrument Serif (`font-ser`, display/headings), Inter (`font-sans`, UI/body),
  JetBrains Mono (`font-mono`, labels, metrics, pills, timestamps). Loaded via Google
  Fonts link in `index.html`.
- Palette: navy ink (`text-ink` `#0B1B3B`) on white/paper (`bg-paper` `#FFFFFF` /
  `bg-paper-2` `#F2F5FA`), accent `bg-accent`/`text-accent` `#133A7A`. Semantic:
  `text-good` `#1F7A4A`, `text-warn` `#B8861F`, `text-bad` `#A84242`. Annotation colors
  (LLD §9.3) are `bg-annotation-{filler,grammar,hedge,strong,structure}`.
  All available as Tailwind utilities directly (`bg-`, `text-`, `border-` + token name) —
  no need to reach for inline styles for color.
- Component conventions: `AppShell` wraps every authenticated route (ported from `DShell`
  in `lexio/desktop.jsx`), `PublicHeader` wraps pre-auth routes. Primitives
  (`ScoreRing`, `Pill`, `Button`, `XPBar`, `StreakChip`, `MetricBar`, `Avatar`,
  `EchoMascot`, `Wordmark`, `Rule`, `Placeholder`, `Icon`) live in
  `components/primitives/` — import from there, don't rebuild one-offs.
- Original prototype used inline style objects; production code translates these to
  Tailwind classes + the CSS custom properties above — same visual output, not a redesign.
  Where a value is genuinely dynamic (e.g. `ScoreRing`'s stroke-dasharray), inline styles
  stay — that's not a token, it's computed geometry.
- Pages/components not in the design zip (auth forms, profile, leaderboard, comparison
  report shell) are built by extending these same conventions, never inventing new colors,
  fonts, or component shapes.

## Module → code map

| LLD Module | Backend app | Frontend routes | Status |
|---|---|---|---|
| M1 Auth | `apps/accounts` | `/register`, `/login`, `/profile` | ✅ built (Phase 0) — + topic preferences |
| M2 Assessment | `apps/assessments` | `/onboarding`, `/assess/:mode`, `/report` | ✅ built (Phase 1, reworked Phase 9) |
| M3 AI Analysis | `apps/analysis` (service layer, no UI) | — | ✅ built (Phase 1) |
| M4 Dashboard | `apps/dashboard` | `/dashboard` | ✅ built (Phase 2) |
| M5 Practice | `apps/practice` | `/practice`, `/practice/:id`, `/practice/:id/summary` | ✅ built (Phase 4) |
| M6 Feedback | `apps/feedback` | `/feedback/:session_id` | ✅ built (Phase 1) |
| M7 Learning Path | `apps/learning_path` | `/path`, `/path/module/:id` | ✅ built (Phase 2) |
| M8 Content | `apps/content` | embedded in `/path`, `/feedback` | ✅ built (Phase 2) — library + recommendations |
| M9 Gamification | `apps/gamification` | `/profile`, `/leaderboard`, embedded in `/dashboard` | ✅ built (Phase 3) |
| M10 Reassessment | `apps/reassessment` | `/reassessment`, `/reassessment/:id/report` | ✅ built (Phase 5) |
| M11 Retention | `apps/retention` | Echo widget, Daily Drill (dashboard) | not started |
| M12 Content sourcing/attribution | `apps/content` (extends M8) | `/progress/:dimension`, admin review queue | ✅ built (Phases 2 + 6) |

## Repo hygiene

- No unnecessary files. Every file added must have a clear, present-tense reason to
  exist — not "might be useful later."
- No duplicate files with a prefix/suffix tacked on (`file_v2.py`, `new_component.jsx`,
  `temp_settings.py`) — edit the original in place, or delete the old one when replacing
  it. If a rename is needed, rename; don't leave both versions around.
- Anything created purely to verify something during a session (a one-off build, a
  manual test script, a scratch file) gets deleted again once it's served its purpose —
  it does not linger in the repo. `frontend/dist/`, `frontend/test-results/`,
  `__pycache__/`, `.pytest_cache/` are gitignored (see `.gitignore`) but should also just
  not be left sitting in the working tree after a verification pass.
- `design_extracted/` is a reference-only copy of the original design prototype, not
  shipped code — don't add new files into it; port what's needed into `frontend/src/`
  instead.

## Testing convention

- Backend: Django's built-in test runner (`python manage.py test`) + `factory_boy` for
  fixtures. Tests as `TestCase`/`APITestCase` subclasses in `apps/<app>/tests/`. Every
  test class inherits from `apps.core.testing.LexioTestCase` or `LexioAPITestCase`
  instead of plain Django/DRF `TestCase` — that mixin clears the Redis-backed cache in
  `setUp`/`tearDown`, needed because DRF throttling and Django's cache aren't reset by
  the normal per-test DB transaction rollback (a real bug hit while testing M1: repeated
  runs started failing on "Too Many Requests" from a leaked throttle counter). No pytest,
  no `conftest.py`, no `pytest.ini` — deliberately, to match this codebase's existing
  Django testing conventions.
- Frontend unit/component: Vitest + React Testing Library, colocated `*.test.jsx` (e.g.
  `components/primitives/primitives.test.jsx`).
- E2E: Playwright, `frontend/e2e/`. Requires both dev servers running (see Commands).
- **Done = unit + integration + one e2e golden path, per feature, before moving to the
  next feature.**

## Commands

See `README.md` at the repo root — setup and run instructions live there only, not
duplicated here.

## Build phases & status

- [x] **Phase 0 — Foundation.** Django+DRF+Postgres+Redis+Celery(deps only)/React+Vite+
      Tailwind scaffolded. Design tokens + primitive component library ported. Storage
      abstraction (local/S3) built. Auth module (M1) complete: register/login/me/profile/
      logout/Google-OAuth-stub/avatar-upload-url, 16 backend tests passing. Landing,
      Register, Login, Dashboard-empty-state pages live, wired to the real API (no mock
      data). 5 frontend component tests + 2 Playwright e2e tests passing against the real
      stack. **Not yet built in Phase 0** (deferred to when first actually needed, per
      "don't build ahead of what's needed"): `core.ai`/`core.stt`/`core.tts` provider
      interfaces, Celery wiring, Channels wiring — these land at the start of Phase 1/4.
- [x] **Phase 1 — Core Assessment Loop (M2 + M3 + M6 + minimal M9).** All 8 assessment
      modes working end to end: prompt bank seeded (`manage.py seed_prompts`), session
      start/submit/status/history, AssemblyAI transcription for voice modes, one combined
      Gemini call for scores + annotations + Echo's narrative, deterministic scoring for
      MCQ modes, annotated feedback page, XP awarded on completion. Provider abstractions
      (`core.ai`, `core.stt`) with Claude/Gemini and Deepgram/AssemblyAI ordering plus
      `fake` providers for tests. 58 backend tests, 6 Playwright e2e. Verified against the
      live Gemini + AssemblyAI APIs, not just fakes.
- [x] **Phase 2 — Dashboard & Learning Path (M4 + M7 + M8 + M12.2 skill graph).** Real
      dashboard aggregation (composite score, per-dimension bars, 30-day chart, today's
      tasks, cohort leaderboard with Redis cache). Path engine: gap ranking, pre-authored
      module catalog, prerequisite locking, content assignment, path-stability rule,
      mastery gate. Content library seeded (16 resources: curated talks + Lexio-authored
      micro-lessons) with sub-skill-aware recommendations on the feedback page.
      119 backend tests, 10 Playwright e2e.
- [x] **Phase 3 — Gamification (M9 full).** Badges (10, declarative catalog + award
      engine), streaks from a `DailyActivity` log with the 48-hour grace and freeze
      tokens, XP/level curve, cohort leaderboard page, profile page with badge wall and
      profile editing. 148 backend tests, 13 Playwright e2e.
- [x] **Phase 4 — Practice Engine & Real-Time (M5).** Django Channels over ASGI with
      JWT-authenticated WebSockets, five practice session types, live captions, coaching
      nudges every ~30s, client-side metrics, multi-turn interview questions that react to
      the student's last answer, end-of-session scoring that feeds the same eight
      dimensions (and therefore the path). 170 backend tests, 17 Playwright e2e.
      Verified against live Gemini.
- [x] **Phase 5 — Reassessment & Comparison (M10).** All four §13.1 triggers (path
      complete, manual with a 14-day cooldown, auto-nudge after 10 practice sessions,
      admin), cycle tracking per mode, delta computation, AI comparison narrative,
      before/after radar report with highlights and a rebuilt-path preview.
- [x] **Phase 6 — Content Sourcing & Attribution (M12).** Content-ops review queue
      (admin-only; nothing goes live unreviewed), consumption tracking, the attribution
      engine (14-day window, correlational caveat surfaced in the API and UI), nightly
      effectiveness job (`manage.py compute_attribution`), full §22.6 four-signal ranking,
      and the per-dimension progress timeline at `/progress/:dimension`.
- [~] **Phase 7 — Module 11 Retention Layer (partial).** Built: Echo companion (5
      evolution stages tied to level, memory of recurring weak points derived from the
      student's own annotations, daily message) and the Daily Drill Card (weakest-dimension
      targeting, midnight expiry, auto-completion, XP). **Not built:** the per-mode
      signature UX redesign (§21.2 Topic Roulette / Word Duel / Bug Hunt etc.), AI peer
      personas with distinct voices (§21.3), and the social layer (§21.6 friend challenges,
      replay cards, cohort battles, mentor nudge).
- [x] **Phase 9 — Assessment rework.** Five changes to how assessment actually works,
      driven by watching it used:
      - **Topic preferences** (`apps/accounts/topics.py`): up to 3 domains, chosen at first
        login and editable from the profile. Every prompt is now AI-generated against them
        (`apps/assessments/generation.py`), validated hard, and shared across students with
        the same topic set; the seeded bank is the fallback when generation is unavailable.
      - **Integrity without proctoring**: a pledge modal at login, and an authenticity read
        on every report (`apps/analysis/authenticity.py`) that combines the model's view of
        the prose with client-observed paste/tab behaviour. It never changes a score, and
        says so in its own payload.
      - **Nothing is thrown away**: an unfinished assessment resumes with its prompt and a
        saved draft (`AssessmentSession.draft`, autosaved from the interfaces). A partial
        unique index enforces one open session per mode.
      - **Time adherence** (`apps/analysis/rubrics.time_adherence`): using the time you were
        given is scored. Speaking/GD/Presentation show the target live and cap the
        coverage-sensitive dimensions when a response falls well short.
      - **Reports are batched**: per-assessment feedback is locked until all eight baseline
        modes are done, then `/report` gives an overview (`apps/analysis/overview.py`) with
        each assessment underneath it. A completed baseline mode cannot be retaken.
      - **Presentation redesigned**: an AI-generated deck presented cold, slide by slide, on
        camera, with per-slide pacing and five browser-computed delivery signals
        (`frontend/src/lib/useCameraPresence.js`, `apps/analysis/presentation.py`). Once every
        slide is covered, a couple of AI-generated follow-up questions — built live from what
        the student actually said on each slide (`generate_doubt_questions`,
        `apps/assessments/generation.py`) — are put to them cold by an on-screen AI persona
        (`AvatarPlayer`, four portraits in `frontend/public/avatars/`, spoken aloud via
        `lib/tts.js`'s real, gender-matched voice) while recording keeps running; a failure or
        empty result here just skips straight to review, it can never block finishing. A
        leave-guard (`frontend/src/lib/useLeaveGuard.js`) blocks the browser back button, tab
        close, the in-app "All modes" link, and AppShell's own header nav (Dashboard, Practice,
        Learning path, the logo, the profile avatar) — for every assessment mode, the instant a
        session is on screen, not just Presentation. AppShell sits alongside the assessment on
        the same page, so it reads a small shared store (`stores/useAssessmentGuardStore.js`)
        rather than owning a second copy of the abandon flow — a header click while guarded
        routes into the exact same confirmation modal and `AbandonSessionView` call as browser
        back does. Confirming "leave anyway" fails the session server-side rather than leaving
        it open to quietly resume — the next `start` gets a fresh prompt. Selecting or copying
        page content is off everywhere (`index.css` `user-select: none` + a document-level
        `copy`/`cut` block in `App.jsx`, exempting actual form controls), and the Writing
        assessment additionally blocks paste on its own textarea — friction against routing a
        prompt out to a chatbot and the answer back in, not real DRM (a determined student can
        still get around CSS/JS; see the authenticity read below for the layer that actually
        catches it).
- [ ] Phase 8 — Polish, Security, Deploy

## Deviations from the LLD (running log)

- Design tokens: using the design zip's actual navy palette, not the LLD Appendix's cream
  palette (see Design system rules above) — per explicit instruction to treat the zip as
  the design source of truth.
- React pinned to 18.x — `npm create vite` defaults to 19; downgraded to match the LLD's
  stack table.
- Auth response `token` field is `{ access, refresh }`, not a single string — the LLD's
  §4.3 contract just says `token` without specifying shape; an access/refresh pair matches
  §19.1's "refresh token rotation" requirement.
- `User.goals` (JSONField) added — referenced by the §4.3 profile-update payload but
  missing from the §4.2 data model table; needed somewhere to persist it.
- Async task queue: Celery + Redis, not named in the LLD (see Stack & why above).
- `skill_graph` (LLD §22.2, nominally Module 12) will be built in Phase 2, not deferred,
  because Module 7's path generation depends on it to function.
- Local dev infra deliberately has **no** settings-module split (base/dev/prod) and **no**
  Docker — single `settings.py` + `.env`, reusing whatever Postgres/Redis is already
  running on the machine. This was a correction mid-Phase-0: the first pass over-engineered
  this (separate settings package, a new Redis container on a nonstandard port, a `_dev`
  suffixed database) before being simplified back down.
- Same simplification applied to `requirements/{base,dev,prod}.txt` — collapsed into one
  `requirements.txt` (test deps included), since we aren't actually running different
  Python dependency sets per environment yet.
- Test runner switched from pytest+pytest-django to Django's own `manage.py test` —
  pytest wasn't wrong, but it's not what this project's owner has used before, and the
  built-in runner needs no extra config files.
- **Analysis runs in a thread pool, not Celery** (`apps/analysis/runner.py`). The LLD's
  submit→poll contract (§5.2) is preserved exactly; this just avoids a third process in
  local dev. Swapping to Celery = make `analyse_session` a task and change one line.
- **The client doesn't actually poll after a normal submit any more** — `/submit` always
  returned 202 immediately (analysis was already backgrounded), but `AssessPage` used to sit
  on a spinner and poll `/status` itself before navigating, which meant a slow scoring call
  visibly held the student on the page for no reason. It now navigates back to the hub the
  instant `/submit` returns; the hub's own "Scoring…" state (`ModeListView`) reflects
  completion whenever the student next looks. The status-polling code (`useSessionStatus`,
  the `Analysing` screen) still exists and still matters — for re-entering a mode whose last
  submission hasn't finished scoring yet, which is the one case left with nothing to render
  but a wait.
- **A scoring failure retries against the same submission — it never asks the student to
  redo the assessment.** Two related fixes, both real incidents: (1) `apps.core.ai`'s
  provider router now retries a malformed/truncated JSON reply from the same provider (up to
  `RETRIES_PER_PROVIDER = 2`) before falling through — most bad replies are a one-off, not a
  provider that's actually down, and this is what "same key as local, fails in prod" usually
  turns out to be. (2) Even when a provider genuinely stays down and the session lands in
  `FAILED`, that never meant starting over: `StartSessionView` now recognises a FAILED
  session that actually reached `/submit` (`submitted_at` set — distinct from one abandoned
  or retired-prompt-swapped before ever submitting, which still starts fresh) and retries
  `analyse_session` against its already-stored response, handing the same session back rather
  than generating a new prompt. A session still mid-flight (`submitted`/`processing`) is
  handed back untouched for the same reason — the frontend just keeps polling it.
- **Annotations ask the model for verbatim text, not character offsets** (§6.3 implies
  offsets). Models can't count characters reliably; offsets are computed server-side with
  `str.find()` in `analysis/services.py`. Verified correct against live Gemini output.
- **`Prompt.payload` (JSONB) added** — the LLD's §5.3 Prompt table has nowhere to store
  MCQ questions, passages, answer keys or GD peer statements. Answer keys are stripped by
  `PromptSerializer` so they never reach the client.
- **Rubric weights for `present` and `read` are filled in** — LLD §6.5's table omits both;
  derived from each mode's stated dimensions in §5.1. See `analysis/rubrics.py`.
- **Listening mode uses the browser's speech synthesis** for its audio clip rather than a
  TTS vendor or shipped audio asset — no key needed, works offline. Swaps to real TTS
  audio later without changing the questions or scoring.
- **`core.tts.TTSProvider` was built ahead of Phase 7, OpenAI-backed, once a key was
  supplied**: every AI persona that talks out loud (GD peers, the Presentation follow-up
  avatar) now speaks through `POST /api/assessment/tts/speak` — real synthesized voices,
  spoken with an Indian English accent via `gpt-4o-mini-tts`'s `instructions` parameter,
  not the browser's flat default. Voice *gender* is never left to chance: each avatar has a
  fixed gender (`AvatarPlayer.avatarGender`) and the endpoint picks from a matching voice
  pool, seeded by persona so the same character keeps the same voice all session
  (`core/tts/openai_tts.py`). The browser's own `speechSynthesis` remains only as the
  fallback when that call fails outright — offline, no key, a network hiccup
  (`lib/tts.js`, gender-matched there too via `lib/speechVoices.js`'s voice-name
  heuristics) — a persona must always be able to "speak" even with nothing configured.
- **Group Discussion is a live room, reinstated ahead of Phase 7**: a table with three AI peers
  on three of its sides and the student on the fourth (`GdInterface.jsx`), each peer with a
  real, gender-matched voice (`lib/tts.js`) tied to the same avatar shown at their seat. A
  lobby ("Enter room") comes first; once in, peers speak
  their openings, then the floor is simply open — no fixed "speak for N minutes." The student
  raises a hand for the floor, talks for as long as they want, lowers it when done, and can do
  this as many times as they like. After each of the student's turns a peer responds — building
  on it, pushing back, or asking them something directly — chosen live by
  `generate_gd_turn` (`apps/assessments/generation.py`); if the student never takes the floor,
  a peer eventually calls on them by name (`event="idle_nudge"`). One continuous recording spans
  the whole room (peer speech is synthesised client-side and never reaches the student's mic, so
  it naturally captures only the student, turn by turn), and the full turn log travels with the
  submission (`discussion_log`) so scoring has the room's side of the conversation too — see
  `apps/analysis/gd.py`. Time-adherence scores the student's *cumulative floor time* from that
  log, not the recording's length, which now spans the whole session. Still genuinely one
  assessment: every turn the student took across the room feeds the same single score, not a
  sequence of separate submissions. A truly real-time room (concurrent audio, not a turn-by-turn
  REST loop — à la `practice`'s Channels-driven reactive interview) remains Module 11
  (§21.2–21.3) future work; it wasn't needed here since it's one student and simulated peers,
  not multiple live humans.
- **Three real GD bugs, since fixed**: (1) the caption box was showing a peer's line the
  moment it was *queued*, not when the avatar actually started saying it — `log` (needed
  immediately, for scoring) and what the caption displays are now separate; a new
  `activeCaption` state is set only from a `speakLine` `onStart` callback, so nothing is
  visible before it's actually being spoken. (2) `generate_gd_turn` read as mechanically
  round-robin because nothing told it not to — `GD_TURN_SYSTEM` now explicitly says not to
  cycle through participants in order, and the prompt names the most recent speaker(s) so the
  model has something concrete to react against instead of just continuing list order. (3) the
  student's own turn almost never actually got a reaction: `lowerHand()` called
  `requestNextTurn('after_student', …)` synchronously, in the same tick as `setHandRaised
  (false)` — but the guard it checks reads a ref that only refreshes on the *next* render, so it
  saw the stale "still raised" value and silently no-opped nearly every time. `lowerHand` now
  updates that ref directly before calling through.
- **Two more GD bugs, since fixed**: (4) a peer's `stance` sentence — their one-line position on
  the motion — sat under their avatar for the entire discussion, in the lobby too, effectively
  spoiling their argument before they'd said a word; it's no longer rendered at all, since the
  live caption box is already the one place a line is allowed to appear, and only once spoken.
  (5) peer *names* are AI-generated per motion and were never told to agree with the fixed
  seat-position avatars — a peer named "Priya" could land on a male portrait purely because of
  which of the three seats she got, with her voice (gender-matched to that avatar) wrong to
  match. `generate_gd_turn`'s peer schema now requires a `gender` field per peer (validated,
  defaulted by alternating if the model drops it) and the seeded fallback bank has it hardcoded;
  the frontend assigns each peer's avatar from the matching-gender pool
  (`GdInterface.assignAvatars`) instead of by seat index, so the name, portrait and voice are
  always the same person. (6) the 4-5s gap while the next turn is being generated
  (`gdTurn.mutateAsync`) had no visible feedback beyond a status line most students wouldn't
  read mid-conversation — a small animated indicator now appears next to it, and "Raise your
  hand" is disabled for exactly that window (re-enabled the instant the floor is genuinely open
  or a peer is mid-turn, since interrupting a speaking peer is still allowed).
- Presentation mode is **audio-only** — slide upload (§5.1) is not built; camera-based
  eye-contact tracking stays out of scope per §21.8.
- **Live captions come from the browser's SpeechRecognition**, not from relaying audio to
  a streaming STT provider (§18.2). No streaming-STT subscription needed, no relay latency,
  and §18.3 already puts live metrics client-side. Only text crosses the socket; recorded
  sessions still go through AssemblyAI. Chrome/Edge only — other browsers fall back to
  typing, which is a covered path. The socket contract is unchanged, so server-side
  streaming can be swapped in without touching the client.
- **`useSpeechRecognition` self-heals from Chrome's silent-stall bug**
  (`frontend/src/lib/useSpeechRecognition.js`). Chrome ends a continuous recognition
  session on its own every so often and needs restarting, but restarting can leave two
  instances briefly alive at once — a stray callback from the one being replaced would
  otherwise fight the new one, which is what produced "captions worked for the first
  slide/turn, then never again" (reported against Presentation, Speaking and GD alike).
  Every (re)start is now tagged with a generation counter that stale callbacks check
  before acting, and a watchdog forces a fresh instance if nothing at all — no result, no
  restart — has happened for 7s, since the actual failure mode is the engine going quiet
  with no `onend`/`onerror` ever firing to trigger the normal recovery path.
- **`SessionScore` points at either an assessment or a practice session** (nullable FKs +
  a check constraint). §14.1 implies one table; sessions live in two. This keeps practice
  results flowing into `latest_dimension_scores` — and therefore the learning path —
  with no special-casing.
- **Time-sensitive code takes an injectable `today`** (`gamification.record_activity`,
  `retention.get_or_create_daily_challenge`). Streak and daily-drill tests were flaky when
  the suite straddled local midnight. It's also the seam per-student local midnight will
  need — §21.5 says "local midnight" but the LLD puts no timezone on the profile.
- **`latest_dimension_scores` orders by `(-created_at, -id)`**, not `created_at` alone.
  Rows sharing a timestamp made "the last three sessions" ambiguous and the result
  unstable between identical queries.
- **`AUTH_THROTTLE_RATE` is configurable**, defaulting to the LLD's 10/min (§19.1). The
  e2e environment raises it because every test registers from 127.0.0.1. **Open question
  for the product owner:** 10 registrations/min per IP will also throttle a computer lab
  or any college behind one NAT — which is exactly Lexio's audience. Worth revisiting
  before launch (per-account limits, or a higher register-specific ceiling).
- **Assessment prompts are AI-generated per student, not drawn from a fixed bank** (§5.3
  describes a seeded `prompts` table). Generated against the student's 1–3 chosen topics,
  validated (`generation.validate`) before anyone sees them, and keyed on the topic set so
  the cost amortises across the cohort. The seeded bank remains as the fallback — a
  provider outage must never stop a student assessing themselves.
- **Scoring accounts for time used** — nothing in §6.5's rubric does. A three-minute brief
  answered in thirty seconds caps structure/fluency/confidence; grammar and vocabulary are
  deliberately exempt, since those can be flawless in thirty seconds. See
  `analysis/rubrics.py`.
- **Every report carries an authenticity read** — not in the LLD at all. The LLD assumes an
  unproctored assessment is taken honestly; in practice a chatbot is one tab away. It is
  explicitly non-punitive: it never alters a score, the model's opinion alone can't push it
  past "unclear", and only behavioural evidence (a wholesale paste) can. Framed as a nudge
  back to doing it for themselves.
- **Baseline feedback is withheld until all eight modes are complete** (§9 implies feedback
  immediately after each session). Per-session reports arriving one at a time pushed
  students into retaking a single mode instead of finishing the picture; the overview at
  `/report` is the first artefact that actually describes them. Non-baseline sessions
  (reassessment, practice) are unaffected.
- **A completed baseline mode cannot be retaken**, and an incomplete one always resumes —
  same session, same prompt, with the draft the student left behind.
- **The learning path is gated on the same `is_baseline_complete` rule as the report**
  (§10.2 implies it builds off "the" dimension scores, singular, with no baseline-complete
  precondition). It used to regenerate after every scored session, including the very first
  — a path built from one mode only ever covers whichever dimensions that mode happens to
  touch, which is exactly the "result after one round" the baseline-report gate above exists
  to avoid, and this was the same bug wearing a different UI. `generate_path()` is no longer
  called from `analysis/services._run_post_analysis` until `is_baseline_complete(user)`, and
  `PathView`/`RegeneratePathView` hide/refuse a path the same way pre-baseline — including a
  path a pre-fix account already generated mid-baseline, which stays hidden rather than
  needing a data migration.
- **Presentation mode uses the camera** (the build plan put camera-based eye-contact
  tracking out of scope, citing §21.8's privacy flag). Reinstated on request, with the
  scoping that flag asks for: frames are measured in the browser and discarded, no video is
  uploaded or stored, and only five aggregate numbers are submitted. The signals are
  geometric (framing, head position, movement, background) rather than a trained gaze
  model — the UI says so, and they only move `confidence`, only when there are enough
  samples to mean anything.
- **Presentation is presented, not pitched**: the student gets a deck they've never seen and
  five minutes to present it, rather than a topic to speak on. §5.1's slide *upload* is
  still not built; this replaces it.
- **Live captions die during the doubt round if recognition and TTS run at once** — the
  browser's SpeechRecognition and its own audio playback both want the same subsystem, and
  recognition can silently stall for the rest of the round when both are active together.
  `PresentInterface` now pauses recognition for exactly the window the avatar is asking a
  question and starts a fresh session the moment `doubtStatus` becomes `'answering'` — which
  is also just correct: the student isn't meant to be talking while the avatar is.
- One `README.md` at the repo root for setup/run instructions; `frontend/README.md`
  (generic create-vite boilerplate, not about Lexio) and `frontend/.oxlintrc.json`
  (unused linter config) were removed rather than kept alongside it.
