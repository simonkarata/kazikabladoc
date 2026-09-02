# KABLA

**Before the diagnosis, get the story right.**
_Don't hand the nurse a verdict. Hand them your story._

Kabla is a tiny, AI-assisted **patient handover** tool. It helps a patient who arrives
saying _"I have malaria"_ turn that verdict back into a story:

> Here is what I **searched**, here is what it **said**, here is what I **fear**,
> and here is what I **actually feel**.

Kabla **does not** diagnose, recommend treatment, prescribe medicine, or replace a
healthcare professional. When pushed for a diagnosis or medicine, the most important
thing it does is say **"Sijui."**

---

## Run it

```bash
npm install
npm run dev        # web http://localhost:5173  +  AI server http://localhost:8787
```

`npm run dev` starts both the Vite web app and the stateless AI server together.
Build & preview a production bundle of the web app:

```bash
npm run build
npm run preview    # http://localhost:4173
```

**No API key is required.** Without one, Kabla runs in *safe mode*: the
deterministic safety guard still enforces Sijui, and the patient's answers are
kept exactly as written. Add a key (below) to have Claude organize the wording.

## Connect Claude (live AI)

The Anthropic API key lives **only on the server** — never in the browser.

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev        # the server picks up .env and switches to the Claude provider
```

The footer shows **Claude connected** when the live backend is reachable, or
**Safe mode** when it isn't. The web app talks only to `/api/*` on the server
(proxied in dev); it never imports the Anthropic SDK or sees the key.

- Model: `claude-opus-4-8` (override with `CLAUDE_MODEL`).
- Server port: `8787` (override with `PORT`).

## Tests

```bash
npm test           # deterministic safety-guard unit checks (red-team + demo cases)
npm run test:e2e   # full headless-Chrome walkthrough of the entire demo journey
npm run test:ai    # LIVE Claude endpoint test (requires a configured server)
```

`test:e2e` drives welcome → disclosure → session number → four questions →
red-team Sijui (diagnosis + treatment) → review → handover → nurse mode →
end session → cleared, and fails on any console/page error. It expects
`npm run preview` to be running and Chrome at `/usr/bin/google-chrome`.

`test:ai` calls the real `/api` endpoints and verifies Claude is invoked, the
Sijui boundary still holds, Claude catches subtle diagnosis phrasing the keyword
guard misses, extraction never medicalizes the patient's words, and the handover
keeps the fear as a fear. Run `npm run server` (with a key in `.env`) first.

## The demo (≈1–2 minutes)

1. **Prepare my handover** → read the AI disclosure → get a handover number.
2. Kabla asks conversationally, in a **chat**. First it asks whether you searched
   online at all (Kabla never searches for you). Tapping **Yes** leads to _what
   did you search_ and _what did it say_; **No** skips straight ahead. Then the
   two core questions — what you fear, and what you actually feel:
   - _fever headache malaria_
   - _It mentioned malaria and typhoid and I got scared._
   - _I think I have malaria._
   - _I've felt hot since yesterday, my head hurts, and I've vomited twice._
3. **Red-team moment:** type **"So do I have malaria?"** or
   **"What medicine should I take?"** in the chat → Kabla replies **Sijui.**
   inline and warmly re-asks.
4. Review (concern kept separate from experience) → **Create my handover**.
5. The handover shows an **At a glance** summary for the clinician and a **For
   you** summary for the patient — both plain-language, neither a diagnosis.
6. **Show to nurse** → clean, phone-first presentation mode.
7. **End session** → all patient information is cleared from the device.

## The four fixed rules

1. **Never diagnose.** A deterministic guard (`src/services/safety.ts`) detects
   diagnosis/treatment requests and forces the **Sijui** response _before_ any
   AI-generated content is shown. Verified by `npm test`.
2. **No patient data storage.** No accounts, no history, no database. State lives in
   `sessionStorage` for the active session only and is cleared on **End session**.
   The privacy model is visible in the UI.
3. **AI disclosure.** Every session begins with an unskippable disclosure of what
   Kabla does and does not do.
4. **Exactly four core answers.** Asked conversationally in a chat — with a
   branch for whether the patient searched elsewhere at all — but still just the
   four: _searched, said, fear, actually feel_. Not a symptom checker; the
   patient's _fear_ is never rewritten into a medical conclusion, and their words
   are preserved. Kabla itself never searches or returns medical information.

## Architecture

```
server/
  index.ts                   # STATELESS AI server — holds ANTHROPIC_API_KEY, runs the
                             # deterministic guard, calls Claude with tightly-constrained
                             # prompts + structured outputs. Endpoints: /api/classify,
                             # /api/extract, /api/handover, /api/summary,
                             # /api/patient-summary, /api/health
src/
  App.tsx                    # screen state machine + session lifecycle + AI health
  types.ts                   # Handover data model (no disease/diagnosis fields)
  services/
    safety.ts                # detectUnsafeMedicalRequest() + containsClinicalAssertion()
                             # — deterministic, model-independent guards
    summary.ts               # deterministic patient-account + patient-facing summaries
    session.ts               # sessionStorage only; generate / load / save / CLEAR
    ai/
      types.ts               # AIProvider interface (classify / extract / generate / summarize)
      MockAIProvider.ts      # offline provider; never diagnoses or rewrites
      ClaudeAIProvider.ts    # calls /api/*; deterministic guard first; degrades to mock
      index.ts               # getAIProvider() — Claude by default, mock via VITE_AI_PROVIDER
  components/                # Welcome, Disclosure, SessionNumber, ChatFlow (conversational
                             # flow), Review, Handover, NurseMode, ...
```

### How the Claude integration stays safe

The UI depends only on the `AIProvider` interface — never on Anthropic directly,
and **no API key ever reaches the browser**. The flow for every free-text answer:

1. **Client** — `ClaudeAIProvider.classifyMessage()` runs the deterministic
   `detectUnsafeMedicalRequest()` guard *first*. A diagnosis/treatment request is
   refused with **Sijui** instantly, with no network call.
2. **Server** (`/api/classify`) — runs the same deterministic guard again
   (authoritative), and only if it passes asks Claude for richer intent
   classification. Either layer flagging the message → Sijui.
3. **Server** (`/api/extract`, `/api/handover`) — Claude is called with tightly
   constrained system prompts and **structured outputs** (a pinned JSON schema),
   so it can only organize the patient's own words. It is never allowed to
   diagnose, name a condition, suggest probabilities, recommend treatment, or
   invent symptoms; the *fear* field is guarded a second time before returning.
4. **Graceful degradation** — if the server or Claude is unavailable, the
   provider falls back to the offline mock (guard + verbatim words). The app
   works with or without a key; the footer shows the live state.

## Tech

React + TypeScript + Vite web app; a small stateless Express server for the
Claude boundary. No database, no accounts, no patient history — session state
lives in `sessionStorage` and is cleared on End session.
