# Soundings — write-up

**Live:** https://soundings-xi.vercel.app · **Repo:** https://github.com/Valkyrie1547/soundings

Soundings is a research pipeline in one session: a screening survey with terminate/qualify branching routes respondents into an ElevenLabs voice interview, and the transcript is stored and viewable. Studies are JSON documents — the BMW study is one configuration of the pipeline, not the product — and a token-gated admin route can validate, preview, and publish new ones.

## Technology choices and why

**Next.js.** I've built with Next.js before, so setup was fast and familiar. Its serverless route handlers meant I never had to stand up a separate backend: the voice stream runs browser ↔ ElevenLabs directly, and everything the server actually does — issue respondent identity, persist state, sign URLs, gate completion, fetch transcripts — is short request/response work that fits API routes in the same repo as the UI.

**Postgres.** The data here is relational and constraint-shaped: a respondent has many answers, sessions, and progress rows, and correctness depends on uniqueness. Composite primary keys do real work — a re-answer becomes an upsert and a duplicate agent tool-call becomes a no-op, with no application code. A document store would have pushed that de-duplication and integrity logic into the app; a relational database gives it to me in the schema.

**Neon.** Primarily familiarity — I've worked with Neon before — plus it's a natural fit for serverless: Postgres over HTTP (no connection-pool problems from parallel functions), instant provisioning, one env var.

**Drizzle over Prisma.** Schema as plain TypeScript in one file, no codegen step, and the SQL stays visible — the `on conflict` clauses at the heart of the persistence layer read as SQL.

**Vercel.** Zero-config deploys from `main`, and it's the natural home for a Next.js app — the reviewer link existed from day one.

**Custom components over shadcn.** The UI needs about eight small primitives. A generated component library didn't earn its footprint, and every file being hand-written keeps the design opinionated (the sounding-line rail, the keyboard-first survey) and easy to walk through.

## Challenges faced and how I solved them

**Transcripts arrived before they existed.** The app fetches the transcript as soon as the call ends — but ElevenLabs takes a few seconds to assemble it, so the fetch came back empty and an empty transcript got stored permanently. The fix was a polling mechanism: the transcript page polls, and the server only stores a conversation once the platform reports it finished; until then the page shows a loading state and retries.

**Resumption, since the platform has none.** ElevenLabs has no native way to resume a conversation, so a resumed interview is a new session that has to *look* continuous. This took real iteration on the agent's system prompt and the setup script: handling a respondent who pauses, closes the tab, or navigates away and comes back; making the moderator greet a returning respondent correctly ("Welcome back — last time we were discussing your satisfaction rating") instead of re-introducing the study; and injecting context on every session start — which questions are answered, one-line summaries of prior answers, what remains — so the moderator picks up exactly where the conversation left off. All of that context is built server-side from the database and handed to the agent as dynamic variables; the prompt itself never changes.

**Finding these bugs repeatably.** Many of the issues above were first found by ear in manual runs. What made them solvable was building agent testing on ElevenLabs' conversation-simulation API — effectively integration tests: each test simulates a full call against the real agent with an AI respondent persona, produces a transcript, and asserts on the moderator's behavior and tool calls. Every bug I heard became a scenario (skip requests, silence handling, both resume shapes, early stops, segment routing), so fixes could be verified instead of re-listened for — and the suite caught a real one I never heard myself: the moderator occasionally ended the call without recording the final answer.

## What I'd improve with more time

- **UI polish** — more motion and finish across the survey and call screens.
- **A real admin data pipeline** — processing and storing more per-study data, not just raw responses.
- **Roles and a metrics dashboard** — log in as an admin and see response rates, completion rates, and drop-off per study.
- **Inference over results** — the data is stored but not yet interpreted; summarizing what respondents actually said per question and per segment is the obvious next layer.
- **More robust testing** — broader unit coverage and more simulation scenarios, run in CI before the agent can be updated.
- **Agentic study creation** — today a new study is pasted JSON (validated, previewed, published through the admin). The endgame: describe your study to a voice agent — the screening questions, how each answer routes, the respondent buckets, the interview guide — and have it build and publish the whole study for you.

## Time spent

Roughly 6–8 hours.
