# Prompt: multi-study Soundings — studies as data, a registry, and an admin route

Use this prompt to make Soundings run any study, not only the vehicle-ownership one. Follow `CLAUDE.md` (STE comments, complexity gate, vault sync, tests next to code). Work in four commits, one per layer, each green on `npm run typecheck && npm run lint && npm test`.

## Why

The app is built around one `study` constant. The survey engine, the interview rail, the transcript, the backstop, and the agent all read from it, which is good. But the constant is the only study, the segment ids are a TypeScript union that leaks into the database enum and into labels, and there is no `study_id` on a respondent. A reviewer cannot see that the BMW study is one instance of a general tool.

The goal: a study is a JSON document. Drop a new one in, and the survey, the agent, the rail, the transcript, and the backstop all change. The agent does **not** change: one hardened prompt, and the guide arrives as dynamic variables. Keep that property. Do not add per-study prompts.

Reference for the file-per-study idea (do not copy the shape): `https://github.com/itsfaraaz/DiligenceSquaredTakeHome`, folders `surveys/` and `voice-surveys/`. Our design keeps one document per study, not two, so screening and interview can never drift apart.

## Layer 1 — the study is data

### Types and validation

- Add `zod`. `src/lib/study/schema.ts` defines `StudySchema` and `export type StudyConfig = z.infer<typeof StudySchema>`. Move the types out of `src/config/study.ts`; that file becomes a thin re-export during Layer 1 and is deleted in Layer 2.
- Segments become data:
  ```ts
  segments: [{ id: "bmw_customer", label: "Current BMW owner", transcriptLabel: "BMW Customer" }, ...]
  ```
  `Outcome` becomes `string` everywhere. Delete `SEGMENT_LABEL` in `session.ts` and the label map in `TranscriptView.tsx`; read from the study.
- Keep `screening`, `interview`, `theme`, `outcomePrecedence`, `name`, `title` as they are. Add `id` (slug, `^[a-z0-9-]+$`), `version` (integer, starts at 1), and optional `intro` (the q1 text) so the readiness check is per study but still `required: false`.
- `StudySchema.superRefine` rejects: duplicate screening ids; duplicate `(interview id, audience)` pairs; an `audience` or `qualify.outcome` that names an unknown segment; a first interview question that is `required: true`; a segment with zero required questions; an `outcomePrecedence` that misses a segment; a screening question with no `qualify` option and no `terminate` option anywhere in the screening set (the survey would never end). Every error carries a `path` so the admin UI can show it.
- `src/lib/study/index.ts` exports pure helpers that take a study: `guideFor(study, segment)`, `requiredIds(study, segment)`, `isComplete(study, segment, answered)`, `segmentLabel(study, segment)`. Move them from `session.ts`; `session.ts` keeps only the dynamic-variable builder and takes a `study` argument. `backstop.ts`, `engine.ts`, both `persist.ts` files, and `agent-config.ts` take the study as a parameter. No module reads a global study.

### Database

- `respondents.study_id text NOT NULL` and `respondents.study_version integer NOT NULL`. A respondent keeps the version they started with; a published change never re-shapes an interview in progress.
- `segment` changes from `pgEnum` to `text`. Drop the enum. `npm run db:push`. Existing rows need `study_id = 'vehicle-ownership', study_version = 1`: add `scripts/backfill-study.ts`, run it once, keep it, and note it in the README.
- `studies` table: `id text, version integer, config jsonb, published_at timestamptz, created_at timestamptz`, primary key `(id, version)`. The newest `published_at` per id is the live one.

### Routes and client

- Pages move under a study segment: `/s/[studyId]` (survey), `/s/[studyId]/interview`, `/s/[studyId]/transcript`. `/` redirects to `/s/<DEFAULT_STUDY_ID>` (env, default `vehicle-ownership`). Old paths `/interview` and `/transcript` redirect too, so the Vercel link in the brief keeps working.
- `POST /api/respondents` takes `{ studyId }`. The server loads the live study and stamps `study_id` and `study_version` on the row. Every other route loads the study **from the respondent's row**, never from the URL, so a URL cannot move a respondent to a different study.
- `RespondentState` gains `studyId` and `studyVersion`. The client stores `soundings:rid:<studyId>` so two studies in one browser do not share a respondent. `?new=1` and `?rid=` keep working.
- `StudyShell` and `layout.tsx` metadata read the study that the page loaded. The theme accent is per study.
- Agent tool `mark_question_answered`: `question_id` becomes a plain string (no `enum`). `POST /interview/progress` rejects an id that is not in `requiredIds(study, segment)` with 400 and logs it. Run `npm run agent:setup` once to push the tool change; this is the only agent change in the whole prompt.
- `buildDynamicVariables(study, respondentId, segment, progress, attemptNo)` — the guide text and segment label come from the study. `opening_line` reads `study.intro` for the first session.

### Sample studies

- `studies/vehicle-ownership.json` — the current config, same content. `studies/coffee-subscription.json` — a second study with different screening (age, buys coffee, brand multi-select that qualifies into `subscriber` / `non_subscriber`), a different accent, seven interview questions, and one segment-specific pair. Keep it sponsor-blind like the first.
- `scripts/studies-seed.ts` (`npm run studies:seed`): validates every file in `studies/`, upserts `(id, version)`, prints one line per study. Refuses a file whose `version` already exists in the table with different content (bump the version instead).

## Layer 2 — the registry

- `src/lib/study/registry.ts`: `loadLiveStudy(id)`, `loadStudy(id, version)`, `listStudies()`, `publishStudy(config)`. All read the `studies` table through Drizzle. `loadStudy` is memoised per `(id, version)` in a module map; a version is immutable, so the cache never goes stale. `loadLiveStudy` uses `unstable_cache` with tag `study:<id>`, and `publishStudy` calls `revalidateTag`.
- Parse every row through `StudySchema` on read. A row that fails validation is a 500 with the zod path in the log, never a half-rendered survey.
- Delete `src/config/study.ts`. Every import of `study` is gone. `grep -rn "config/study" src scripts` returns nothing.
- Agent tests: `scripts/agent-tests` loads the study through the registry (`--study <id>`, default `vehicle-ownership`). `segment-routing` reads segment ids from the study instead of literals. Add one scenario `second-study-happy-path` that runs the coffee study end to end and asserts `markedIds()` equals its required ids — the proof that the agent is study-agnostic.

## Layer 3 — the admin route

- `/admin` gated by `ADMIN_TOKEN` (env). `GET /admin?token=…` sets an httpOnly cookie and redirects to `/admin`; without a valid cookie every `/admin*` page and `/api/admin/*` route returns 404 (not 401, so the route does not advertise itself). `middleware.ts` does the check with `timingSafeEqual`. Never log the token. If `ADMIN_TOKEN` is unset, the route is off.
- `/admin` lists studies: id, title, live version, respondent counts by status (one grouped query), a "Copy link" button for `/s/<id>`, and "New study" / "Edit".
- `/admin/studies/new` and `/admin/studies/[id]`: a JSON editor (a `<textarea>` in monospace with the same typographic system as the survey; no CodeMirror), with three actions:
  - **Validate** — `POST /api/admin/studies/validate`. Returns zod issues as `{ path, message }[]`; the UI lists them and highlights the first line that contains the last path segment.
  - **Preview** — renders the screening flow (read-only, keyboard works) and, per segment, the interview guide the agent would receive, using the same components as the live survey. No database writes.
  - **Publish** — `POST /api/admin/studies`. Bumps `version`, inserts, revalidates. Refuses if `id` exists and the body equals the live version (nothing to publish).
- **Try the agent** (per study, per segment): `POST /api/admin/studies/[id]/simulate` runs one `simulateConversation` happy path through the existing harness (move the pure parts of `scripts/agent-tests/harness.ts` into `src/lib/agent-tests/` so the route can import them without `tsx`). Returns the transcript and `markedIds()` versus `requiredIds`. The UI shows PASS/FAIL, the turn count, and the transcript. Show the credit note before the button runs (`Uses ElevenLabs credit; about N turns.`). Rate-limit to one simulation per study per minute in a module map.
- Admin pages use `StudyShell` with a neutral accent so they are visibly the same product. STE for comments only; the UI copy follows the existing tone.

## Layer 4 — test polish

Do this after the three layers so it covers the new shape.

- `src/lib/study/schema.test.ts`: one test per `superRefine` rule, one for the happy path with both sample files (`readFileSync` from `studies/`), and one that the vehicle-ownership sample equals the old constant (keep a copy of the old `study` object in this test file for that one assertion; it is then the only place it exists).
- `src/lib/study/registry.test.ts`: mocked `db`; live-version selection, cache hit on the second `loadStudy`, `publishStudy` refuses an identical body.
- Existing tests: every test that imported `study` from `config/study` now builds a study with a `makeStudy(overrides)` factory in `src/test/fixtures.ts`. No test reads the JSON files except `schema.test.ts`.
- `engine.test.ts`: add a coffee-study case so the engine is proven on two shapes. Add a table-driven precedence test.
- `backstop.test.ts`: anchors come from the study fixture; add a case where two studies share an id (`q2`) with different text and the matcher uses the right one.
- `routes.test.ts`: `POST /api/respondents` without `studyId` → 400; with an unknown id → 404; progress route rejects a foreign id → 400.
- `src/app/api/admin/*.test.ts`: no cookie → 404; validate returns issues with paths; publish refuses an identical body.
- `middleware.test.ts`: cookie check; a wrong token of the same length and of a different length both fail.
- Client: `respondent.test.ts` covers the per-study localStorage key.
- Coverage: add `@vitest/coverage-v8`, `npm run test:coverage`, and set `thresholds` in `vitest.config.mts` to the numbers the suite reaches after this work minus 2 points, so the gate is real but not brittle. Print the table in the commit message.
- Delete any test that only re-asserts a fixture value. Every remaining test name says what behaviour it protects.

## Guardrails

- The agent prompt does not change. If a scenario fails because of the prompt, stop and report; do not patch it inside this work.
- No study content in TypeScript after Layer 2. Studies are JSON in `studies/` and rows in `studies`.
- `INTERVIEW_SHORT_MODE` still works and still applies to whichever study is loaded (take the first two required questions per segment).
- Never print `.env.local`, the API key, or `ADMIN_TOKEN`.
- Complexity gate stays at 10. The admin editor page is the likely offender; split validate/preview/publish into hooks.
- Do not edit the agent in the dashboard. Do not test the UI with the Chrome extension.

## Definition of done

- Both sample studies run end to end on localhost: survey → interview → transcript, with the correct accent, guide, rail, and segment labels. Resume works on both.
- `npm run agent:test -- --only second-study-happy-path --yes` passes.
- `/admin`: paste the coffee study with an invalid `audience`, see the path; fix it, preview, publish, open the link, take the survey.
- README: a "Studies" section (STE) — the JSON shape in one table, how to add one (`studies/` file → `npm run studies:seed`, or `/admin`), the version rule, and the admin token.
- `project log.md`: the trade-offs — one document per study not two; segments as data; version pinned on the respondent; DB-backed registry over files only; token gate over full auth; no per-study prompt; deterministic validation before the agent sees a study. `system architecture.md`: the study schema, the registry, the new routes, the admin flow, the middleware, and the updated failure map.
