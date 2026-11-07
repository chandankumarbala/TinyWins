# Tiny Wins — Small steps. Real progress.

A local-only desktop task app. Organize sectors into tabs, focus on one task per tab, and track active effort.

## Development

Use Node.js 24 LTS and npm. Run `npm install` once. Open the localhost URL printed by Vite. Keep the same origin and port to retain access to the same browser data.

For AI breakdown, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Never use a `VITE_` prefix for secrets. Optional `OPENAI_MODEL` defaults to `gpt-5-mini`.

Local run commands:

- `npm run dev`: start frontend and backend together. Use this for the normal app with AI breakdown.
- `npm run dev:web`: start the Vite frontend only on `127.0.0.1:5173`. AI generation will stay unavailable unless the backend is running separately.
- `npm run dev:api`: start the local AI backend/helper only on `127.0.0.1:8788`. Use this with `npm run dev:web` when you want separate terminals.
- `npm run build`: type-check and produce static frontend files in `dist/`.
- `npm start`: run the production local server/API on `127.0.0.1:5173` after `npm run build`.

Common setups:

- **Frontend + backend together:** `npm run dev`
- **Frontend only:** `npm run dev:web`
- **Backend only:** `npm run dev:api`
- **Production local:** `npm run build`, then `npm start`

Commands:

- `npm run build`: type-check and produce static files in `dist/`.
- `npm run preview`: serve the production build.
- `npm run typecheck`: check TypeScript.
- `npm run lint`: check source conventions.
- `npm run format:check`: check formatting.
- `npm test`: run deterministic domain tests.
- `npm run test:e2e`: run browser acceptance tests (install browsers with `npx playwright install`).

### macOS Native App

- `npm run tauri:dev`: start the Tauri macOS app during development with the frontend and local AI helper.
- `npm run tauri:build:debug`: build an unsigned local debug `.app`.
- `npm run tauri:build:mac:apple-silicon`: build an unsigned DMG for Apple Silicon Macs, including M1, M2, M3, M4, and later, then copy it to the repository root as `TinyWins_1.0.0_aarch64.dmg`.
- `npm run tauri:build`: build a local unsigned DMG target for Apple Silicon testing.

The first native release is local/unsigned. Public sharing requires Apple signing and notarization.

### Build macOS DMG

Run:

```bash
npm run tauri:build:mac:apple-silicon
```

The local Apple Silicon DMG targets `aarch64-apple-darwin` and is intended for personal testing on M-series Macs. The Tauri bundle keeps its generated name under `src-tauri/target`, and the build command copies the distributable installer to the repository root as `TinyWins_1.0.0_aarch64.dmg`. Public sharing requires Apple Developer signing and notarization before release.

## Using Tiny Wins

Enter creates tasks and saves edits. Escape cancels edits. Click a task title or duration to edit; pause running tasks first. Task row actions are hidden while a task is being edited so the edit field has the row's available space. Double-click a tab name to rename it. Finish permanently freezes a timer. Delete tasks with two clicks within 20 seconds. Tab deletion requires confirmation.

The footer remains fully visible at the bottom of the app while tasks scroll independently behind the reserved footer space. Sector tabs use the original single-row pill design: each tab shows its full label, task count, and close control inside the pill, with the add button beside the row. The native window and task panel share one continuous aqua surface instead of showing a separate outer window strip.

Timers count all time while running, including browser closure and system sleep; explicitly pause to stop counting. Each sector supports one running task. Progress turns yellow at 50%, red at 80%, and overtime above 100%. In-app reminders appear while the app is open. Device clock changes may affect elapsed time.

Use the download/upload controls for JSON backups. Import replaces current data after confirmation and restores running tasks as paused at the exported elapsed time. Browser cleanup can erase local data; export regularly. Storage errors are shown explicitly and block changes until resolved.

Only one browser window can edit at a time. Use a modern desktop Chromium, Firefox, or Safari browser supporting Web Locks on localhost or HTTPS. No account or network data storage is needed. AI breakdown is optional and requires the local helper plus `OPENAI_API_KEY`.

## Verification

Tests use synthetic fixtures and controlled timestamps. Browser tests cover primary workflows. No numeric coverage threshold is configured. Native packaging is verified through Tauri debug/app and DMG builds; native tray, notification, and installer behavior still need manual macOS acceptance checks.

## Phase 2: AI breakdown

`npm run dev` starts Vite on 127.0.0.1:5173 and the helper on 127.0.0.1:8788. `npm run dev:web` runs manual-only mode unless `npm run dev:api` is also running. After `npm run build`, `npm start` serves the app and API locally on port 5173. Use the same browser origin to retain access to stored tasks.

Use the AI sparkle button to generate an inline task breakdown. The AI button is enabled only when the local helper reports `OPENAI_API_KEY`; otherwise it remains visible but disabled with setup guidance. Manual task entry remains available. Enter generates; Shift+Enter inserts a newline; Escape cancels. Up to 12 ordered tasks are automatically added with editable 1–30-minute estimates. Conflicting titles gain numeric suffixes. New tasks start paused. A broad goal produces a first slice rather than pretending the whole project fits one session.

Only the goal is sent to OpenAI. Existing tabs/tasks stay local. Cancellation discards late results but may not avoid provider charges. Limits: one active request, five attempts/minute, 45-second timeout. No automatic paid retries. Missing helper/key leaves manual tasks available. Tests mock provider responses; live generation is optional and incurs API charges.
