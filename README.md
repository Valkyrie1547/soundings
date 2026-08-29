# Soundings

A research pipeline in one session: a Typeform-style screening survey that routes qualified respondents straight into an AI-moderated voice interview (ElevenLabs), with resumption at every step.

**Live:** https://soundings-xi.vercel.app

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Tailwind v4 with a small hand-rolled component set (`src/components/ui`)
- Motion for screen transitions
- Neon Postgres via Drizzle (respondents, answers, interview progress, transcripts)
- ElevenLabs Agents Platform (`@elevenlabs/react`) for the voice interview

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Layout

```
src/config/study.ts        the study: title, accent, questions, branching, interview guide
src/lib/survey/engine.ts   pure function: stored answers → current screen / outcome
src/lib/motion.ts          transition variants and durations
src/components/ui          primitives (Button, OptionRow, KeyHint, SoundingLine, …)
src/components/layout      StudyShell — the frame shared by survey and interview
src/components/survey      question screens, single/multi select, outcome screens
```

Design notes, the resumption approach, and trade-offs are in `docs/` (added with the write-up).
