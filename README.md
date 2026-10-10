# StoryScout Webapp

React and TypeScript frontend for StoryScout's browser-based audio recording and transcription work.

The currently routed user experience is the GUID-gated recording flow: a participant enters a backend-issued access code, records audio with the browser microphone, previews it, and uploads it through the StoryScout backend. Transcription UI modules are present in the source tree but are not currently routed from the application entry point.

## Participant flow

1. Enter a backend-issued access GUID.
2. Record with the browser microphone, preview, and upload.

There is no account management or recording library in this application.

## Requirements

- Node.js `22.13` or later (Node.js 24 is also supported)
- npm
- A compatible StoryScout backend API

## Local development

Install dependencies:

```bash
npm ci
```

Start the StoryScout backend at `http://localhost:3001`, then run:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

Copy `.env.example` to `.env.local` if the API is hosted somewhere other than the default. `VITE_STORYSCOUT_API_URL` must include the API version path, for example:

```dotenv
VITE_STORYSCOUT_API_URL=http://localhost:3001/api/v1
```

Do not commit local environment files. Values prefixed with `VITE_` are embedded in browser builds and must not contain secrets.

## Scripts

- `npm run dev` — start the local Vite development server
- `npm test` — run the Vitest interaction tests once
- `npm run typecheck` — validate TypeScript
- `npm run lint` — run ESLint
- `npm run format:check` — check Prettier formatting
- `npm run build` — create a production build in `dist/`
- `npm run check` — run all repository validation

## Production build

Run `npm run build` with the production API URL supplied at build time. The static output is written to `dist/`.

The backend and its recording-upload destination must allow requests from the webapp's deployed origin.

## Validation

`npm run check` runs TypeScript, ESLint, formatting, the focused interaction tests, and the production build.

## Repository notes

- Generated dependencies and build output are intentionally excluded from Git.
- No license has been granted for this source code unless a license file is added later.

## Local book reader

Start the backend using the command in its README, then start this frontend in a
second terminal:

```sh
cd /Users/vikrantsingh/storyscout/storyscout-webapp
VITE_STORYSCOUT_API_URL=http://localhost:3001/api/v1 npm run dev -- --host localhost --strictPort
```

Open [Daddy’s Story](http://localhost:5173/books/9146a916-a99e-4917-89a3-207f20c1b47e).
The landing page lists 16 chapters in manifest order, with English summaries,
original audio and Hindi/English reading links. Only one audio player is active at
a time; signed URLs are requested on demand and refreshed on expiry or media error.
Use native audio controls to play/pause and seek. If the browser blocks automatic
playback after loading, press the native play control.

Reading pages support direct links, refresh, language switching, and a Back to book
link that returns to the selected chapter. The original recording flow remains at
`/` and requires its existing backend participant configuration. Anyone with a book
link can read it: the reader does not require a recording access code.

Both local processes must stay running while reading. No deployment is required.
The frontend contains no AWS credentials or per-book S3 configuration. Its API
returns text and signed media URLs. Production hosting (not deployed by this work)
must serve `index.html` for `/books/*` paths and allow its API origin.

Each chapter has independent original-language and English summary disclosures,
with the original-language summary initially expanded and English collapsed. Missing summaries, audio, refined text, and translations
remain visible as grey, disabled “Unavailable” labels. Temporary API/storage errors
show the retry screen instead of incorrectly marking content missing.
