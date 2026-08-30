# Soundings

Soundings is a research pipeline in one session. A screening survey routes qualified respondents into a voice interview. An AI moderator (ElevenLabs) runs the interview. The respondent can stop and resume at each step.

**Live:** https://soundings-xi.vercel.app

## Stack

- Next.js (App Router) with TypeScript, deployed on Vercel
- Tailwind v4 with a small set of hand-made components (`src/components/ui`)
- Motion for screen transitions
- Neon Postgres through Drizzle (respondents, answers, interview progress, transcripts)
- ElevenLabs Agents Platform (`@elevenlabs/react`) for the voice interview

## Run the app locally

1. Install the dependencies: `npm install`
2. Make `.env.local` with `DATABASE_URL`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_AGENT_ID`.
3. Push the schema to the database: `npm run db:push`
4. Store the sample studies in the database: `npm run studies:seed`
5. Create the ElevenLabs agent: `npm run agent:setup`. Put the printed agent id in `.env.local`.
6. Start the development server: `npm run dev`

To start as a new respondent, open the app with `?new=1` in the URL.

## Studies

A study is one JSON document in `studies/`. The survey, the interview guide, the checklist, the transcript labels, and the theme all come from it. The agent does not change between studies: one generic prompt receives the guide as dynamic variables. `/` redirects to the default study (`DEFAULT_STUDY_ID`, or `vehicle-ownership`). Each study runs at `/s/<id>`.

| Field | Function |
|---|---|
| `id`, `version` | The URL slug and the document version. A published change gets the next version. |
| `name`, `title`, `theme`, `copy` | Header text, accent colors, and the respondent-facing sentences. |
| `segments` | The qualified groups: id, agent label, transcript label. |
| `screening` | Single and multi select questions. An option can `terminate` or `qualify` into a segment. |
| `outcomePrecedence` | Which segment wins when one answer qualifies for more than one. |
| `interview` | The spoken guide. `audience` is `all` or one segment id. The first question is the readiness check. |

To add a study: put `<id>.json` in `studies/`, run `npm run studies:seed`, and open `/s/<id>`. The seed script validates the document first and refuses a version that exists with different content. A respondent keeps the version they started with, so a published change never re-shapes an interview in progress.

The database rows that existed before studies were data belong to `vehicle-ownership@1` through column defaults.

## Scripts

| Command | Function |
|---|---|
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the app for production. |
| `npm run lint` | Runs ESLint. Fails when a function has a cyclomatic complexity above 10. |
| `npm run lint:complexity` | Reports each function with a complexity above 5. |
| `npm run typecheck` | Runs the TypeScript compiler without output. |
| `npm test` | Runs the unit tests once (Vitest). |
| `npm run test:watch` | Runs the unit tests in watch mode. |
| `npm run db:push` | Pushes the Drizzle schema to the database. |
| `npm run studies:seed` | Validates and stores every study in `studies/`. |
| `npm run db:studio` | Opens Drizzle Studio. |
| `npm run agent:setup` | Creates or updates the ElevenLabs agent from code. |
| `npm run agent:test` | Runs the agent simulation scenarios against the live agent. Costs platform credit. Not part of `npm test`. |

## Layout

```
studies/*.json               One document per study: title, accent, questions, branch rules, interview guide
src/lib/study/               Study schema (zod), pure guide helpers, file loader, database registry
src/lib/survey/engine.ts     Pure function: study + stored answers -> current screen or outcome
src/lib/survey/persist.ts    Respondent rows and answer upserts
src/lib/interview/           Agent configuration, dynamic variables, sessions, transcripts
src/lib/interview/backstop.ts Pure function: transcript turns -> missing questions that were answered
src/lib/client/              Browser-side API calls and respondent identity
src/lib/motion.ts            Transition variants and durations
src/db/schema.ts             Drizzle schema
src/app/api/                 Route handlers
src/components/ui            Primitives (Button, OptionRow, KeyHint, SoundingLine, ...)
src/components/layout        StudyShell: the frame that the survey and the interview share
src/components/survey        Question screens, single and multi select, outcome screens
src/components/interview     Interview state machine and call screen
src/components/transcript    Transcript view and download
scripts/setup-agent.ts       Sends the agent configuration to ElevenLabs
scripts/agent-tests/         Simulated-conversation scenarios: harness, criteria, runner
```

## Conventions

- Comments and this README follow ASD-STE100 (Simplified Technical English).
- Cyclomatic complexity: 1 to 5 is fine. 6 to 10 is the watch band. 11 and above fails lint.
- Unit tests sit next to the code as `*.test.ts`. They run without a database, ElevenLabs, or a browser session.
- Agent behaviour tests are in `scripts/agent-tests/`. They run the real agent against a simulated respondent with `simulateConversation`. Run one scenario with `npm run agent:test -- --only happy-path`. More than three runs need `--yes` or `CI=1`. `--repeat N` reports a pass rate. `--json` writes `last-run.json` with the transcripts.
- When a scenario fails, change `src/lib/interview/agent-config.ts`, run `npm run agent:setup`, and run the scenario again. Do not change the agent from the test harness.
- See `CLAUDE.md` for the full rules.

## Documents

Design notes, the resumption approach, and the trade-offs are in `docs/` (added with the write-up).
