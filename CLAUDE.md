@AGENTS.md

# Soundings — project rules

These rules apply to all work in this repository. Apply them in the same change as the code, not afterwards.

## 1. Comments and README: ASD-STE100

All code comments, JSDoc, CSS comments, and `README.md` follow ASD-STE100 (Simplified Technical English).

- Short sentences. At most 20 words for an instruction, at most 25 for a description.
- One topic per sentence. One instruction per sentence.
- Active voice, present tense. "The server decides completion." Not "Completion is decided by the server."
- Imperative for procedures: "Run `npm run db:push`." Not "You should run".
- No contractions, slang, idioms, or humour. No "e.g." or "i.e." — write "for example" or "that is".
- No dashes or semicolons as sentence connectors. Split into two sentences.
- Use one word for one meaning. Prefer: make (not create/spawn/produce), start (not kick off/launch), correct (not right), do not (not don't), before/after (not prior to/subsequent to).
- Write nouns and verbs plainly. Avoid noun clusters longer than three words.
- Comments explain a decision or a constraint. Do not restate the code.

Out of scope for STE: respondent-facing UI copy, the agent prompt in `src/lib/interview/agent-config.ts`, commit messages, and the Obsidian vault docs. Those keep their own voice.

## 2. Cyclomatic complexity

ESLint's `complexity` rule is on. `npm run lint` fails above 10. `npm run lint:complexity` lists every function above 5.

| Complexity | Action |
|---|---|
| 1–5 | Fine. Leave it alone. |
| 6–10 | Watch. Refactor if you are changing that function anyway. |
| 11–15 | Refactor now, in this change. |
| 16+ | Must split. No debate. |

Run `npm run lint:complexity` before you finish a change. When a function you edited is 6–10, split it in the same change. Prefer extracting small named helpers (a predicate, a mapper, a sub-component) over adding early returns. JSX ternaries and `?.`/`??` count toward the score — a component with many branches wants child components.

## 3. Obsidian vault — keep in sync

The vault is at `../../vault/` (that is, `C:\Users\Armaa\Documents\Projects\vault`). The folder `vault/diligence squared/` holds two living docs for this project. Update them in the same change as the code, then bump `updated:` in the frontmatter.

- **`project log.md`** — every trade-off and decision, at any level: architecture, design, UI/UX, implementation, tooling, process. Each entry says what was chosen, what it was chosen over, and why. Examples of the expected grain: why Neon over Supabase; why the app is called Soundings; why the palette is not BMW-coded; each ElevenLabs agent/API decision; why a lint threshold is what it is. Add a dated line to the `## Log` section as well.
- **`system architecture.md`** — the current design: stack, module layout, important types and class/function definitions, schema, API routes, state machines, failure handling, environment. When the code diverges from the doc, fix the doc.

Do not put secrets in the vault.

## 4. Other standing rules

- Do not test the UI with the Chrome extension. The user tests manually and reports bugs.
- Never print secrets. Mask values when you check `.env.local`.
- `xi-api-key` stays server-only. Never add a `NEXT_PUBLIC_` ElevenLabs variable.
- `INTERVIEW_SHORT_MODE` is for local development only. Never set it on Vercel.
- The ElevenLabs agent is code: change `src/lib/interview/agent-config.ts`, then run `npm run agent:setup`. Do not edit the agent in the dashboard.
- Files use LF line endings (`.gitattributes`). If a file shows CRLF, normalise it.
- Before a commit: `npm run typecheck && npm run lint`.
