# Soundings — design write-up

**Live:** https://soundings-xi.vercel.app · **Repo:** https://github.com/Valkyrie1547/soundings

Soundings is a research pipeline in one session: a screening survey with terminate/qualify branching routes respondents into an ElevenLabs voice interview, and the transcript is stored and viewable. The BMW study is one JSON document loaded into it — not the product. This write-up covers the decisions and what they were traded against.

## Stack choices

**Next.js on Vercel.** The voice stream runs browser ↔ ElevenLabs directly over a websocket; our server only does short request/response work — mint identity, persist state, sign URLs, gate completion, fetch transcripts. That profile is exactly what serverless route handlers are for, so a separate backend (Express/Fastify on a VM, or a Railway worker) would have added an idle process and a second deploy for no benefit. Vercel's git-push deploys also meant the reviewer link existed from day one.

**Postgres over the alternatives.** The state here is relational and constraint-shaped: a respondent has many answers, sessions, and progress rows, and correctness depends on uniqueness. Two composite primary keys *are* the resumption logic — `(respondent_id, question_id)` makes a re-answer an upsert and a duplicate agent tool-call a no-op, with no application code. A document store (Mongo/Firestore) would push that de-duplication into the app; a KV store (Redis/Upstash) has no good answer for "all progress rows for this respondent, in answer order"; SQLite (Turso) would have worked but gives up `jsonb` querying over transcripts and study configs. Transcripts are KB-scale, so they live as `jsonb` rows rather than object storage — one database, one backup story.

**Neon over Supabase/RDS/PlanetScale.** We needed Postgres over HTTP for serverless (no connection-pool exhaustion from parallel lambdas), instant provisioning, and nothing else. Supabase bundles auth, storage, and realtime we would not use — and its auth would have tempted us into accounts, which the design deliberately avoids (a respondent is a resumable UUID, not a login). RDS means VPC and pooler management for a take-home. PlanetScale is MySQL — no `jsonb`, weaker fit. Neon's `@neondatabase/serverless` driver + Drizzle gave typed SQL with one env var.

**Drizzle over Prisma.** Schema-as-TypeScript in one file, no codegen step, and the SQL stays visible — `onConflictDoUpdate` / `onConflictDoNothing` are the heart of the persistence layer and read as SQL. `drizzle-kit push` accepted the trade of no migration history for a single-developer sprint; migrations are the first thing to add for a real deployment.

## Resumption (the hard requirement)

ElevenLabs has no native conversation resumption, so a resumed interview is a **new session that only looks continuous**. The server is the memory:

- Every meaningful transition is persisted at the moment it happens: session open, each `mark_question_answered` client-tool call, session close. The client holds no state the flow depends on, so refresh, tab-close (a `pagehide` keepalive beacon records the drop), and network loss all collapse into one resume path.
- On the next start, the server builds **dynamic variables** from the database — answered ids, remaining count, a per-answer summary digest, and a scripted opening line ("Welcome back. Last time we were just discussing your satisfaction rating…"). The agent prompt itself never changes; `is_resume` comes from the attempt number, so pausing before the first answer doesn't replay the introduction.
- **Completion is decided server-side only**: the required-id set for the respondent's segment against the progress table, re-checked at every segment close. The client's checklist is a view of it, not the authority.
- The one unrecoverable failure — the LLM asks a question, hears an answer, and forgets the tool call — has a deterministic **transcript backstop**: at segment close, if the gate says incomplete, the stored transcript is scanned for the question's wording (anchor phrase or ≥60 % content-word overlap) followed by a substantive answer, and the progress row is inserted with `source='transcript'` (shown as a hollow diamond, never overwriting a tool row). An LLM-judged variant was deliberately deferred: the deterministic matcher is testable and cannot hallucinate a completion.

## The agent is code, and it is study-agnostic

The agent, its tools, and its settings live in one TypeScript file pushed by `npm run agent:setup`; nothing exists only in the dashboard. The prompt is generic — the question guide arrives as a dynamic variable — so **one agent serves every study**. This is the alternative to per-study prompts, which is where most of our by-ear prompt bugs (narrating instructions, "are you still there?" during a requested pause) would have multiplied. Those fixes — scripted silence lines plus the platform's 30 s turn timeout — harden a single prompt once.

## Extensibility: studies as data

A study is a zod-validated JSON document: screening (with terminate/qualify effects and outcome precedence), segments, the interview guide with per-segment audiences, theme, and copy. One document per study — screening and interview can never drift apart. Documents in `studies/` are seeded into a versioned `studies` table; each respondent is pinned to `(study_id, study_version)` so a published change never re-shapes an interview in progress. Studies run at `/s/<id>`; a second sample study (coffee subscriptions, different segments and guide) proves the point — the unchanged agent passed a live simulated interview of it on the first run.

A token-gated `/admin` closes the loop without a deploy: paste JSON → validate (schema errors with paths) → preview the flow per segment → publish (the registry assigns the next version) → run one simulated interview against the live agent before any real respondent hears the new guide.

## Testing

166 unit tests (Vitest, colocated, no network) cover the pure core: survey engine, guide/session builders, the backstop matcher on fixture transcripts, the study schema's referential rules, the registry, route handlers with persistence mocked, and client identity — with a coverage gate. Separately, `npm run agent:test` runs the real agent against AI-simulated respondents (`simulateConversation`) across eight scenarios — happy path, skip requests, silence handling, mid-interview and pre-first-answer resumes, early stop, segment routing, and the second study — asserting on tool calls and evaluation criteria. Prompt bugs found by ear became repeatable scenarios.

## What I'd do next

Post-call webhook ingestion instead of polled transcript fetches; Drizzle migrations; the LLM-judged backstop behind a flag; audio recording playback; magic-link resume across devices; rate limiting on the public API.
