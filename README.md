# TODO — Small steps, real progress

A local-only desktop task app. Organize sectors into tabs, focus on one task per tab, and track active effort.

## Development

Use Node.js 24 LTS and npm. Run `npm install`, then `npm run dev`. Open the localhost URL printed by Vite. Keep the same origin and port to retain access to the same browser data.

Commands:

- `npm run build`: type-check and produce static files in `dist/`.
- `npm run preview`: serve the production build.
- `npm run typecheck`: check TypeScript.
- `npm run lint`: check source conventions.
- `npm run format:check`: check formatting.
- `npm test`: run deterministic domain tests.
- `npm run test:e2e`: run browser acceptance tests (install browsers with `npx playwright install`).

## Using TODO

Enter creates tasks and saves edits. Escape cancels edits. Click a task title or duration to edit; pause running tasks first. Double-click a tab name to rename it. Finish permanently freezes a timer. Delete tasks with two clicks within 20 seconds. Tab deletion requires confirmation.

Timers count all time while running, including browser closure and system sleep; explicitly pause to stop counting. Each sector supports one running task. Progress turns yellow at 50%, red at 80%, and overtime above 100%. In-app reminders appear while the app is open. Device clock changes may affect elapsed time.

Use the download/upload controls for JSON backups. Import replaces current data after confirmation and restores running tasks as paused at the exported elapsed time. Browser cleanup can erase local data; export regularly. Storage errors are shown explicitly and block changes until resolved.

Only one browser window can edit at a time. Use a modern desktop Chromium, Firefox, or Safari browser supporting Web Locks on localhost or HTTPS. No server, account, network data storage, API key, or AI integration is needed. The AI control is a placeholder.

## Verification

Tests use synthetic fixtures and controlled timestamps. Browser tests cover primary workflows. No numeric coverage threshold is configured. Native packaging, synchronization, undo, and AI breakdown are deferred.
