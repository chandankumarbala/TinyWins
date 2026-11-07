# macOS Native App Requirements Design

## Purpose

Create a first native macOS release target for Tiny Wins while preserving the existing web app as a supported browser/development target.

The macOS app should make Tiny Wins feel like a lightweight desktop companion: quick to open, visible when needed, easy to hide, and calm enough for ADHD-minded use.

## Release Target

- Platform: macOS.
- Architecture: Apple Silicon only for the first native release.
- Distribution: `.dmg`.
- Native shell preference: Tauri.
- Web app: remains supported.
- Windows: deferred to a separate requirements pass.

## App Shape

- The app is self-contained and does not require the user to manually run frontend or backend commands.
- The app opens as a right-side panel by default.
- Default panel width is approximately 25% of screen width.
- The panel uses available screen height.
- The panel is minimizable and expandable but not maximizeable.
- The first release uses a single panel only.
- Settings live inside the same panel.
- No first-run onboarding is required.

## Native Behavior

- The app includes a menu bar icon with show/hide and quit.
- Closing the window hides Tiny Wins to the menu bar.
- Quitting is explicit through the menu bar.
- Always-on-top is user-toggleable and defaults off.
- Launch-at-login is deferred.
- Auto-updates are deferred.
- Local testing builds may be unsigned.
- Public distribution requires signing and notarization.

## Data

- Store Tiny Wins data in a local app data file, not embedded browser storage.
- Use plain readable JSON for the first native release.
- Treat encryption as a future privacy enhancement.
- Support import and export from the UI.
- Support migration from exported web data.
- Imports merge into existing native data.
- Duplicate imported tab or task names are renamed with predictable numeric suffixes.

## Timers And Notifications

- Timers keep running while the app is hidden to the menu bar.
- On quit, elapsed active time is persisted up to quit.
- On relaunch, tasks that were running before quit resume automatically.
- Native macOS notifications supplement existing in-app toasts.
- Native notifications fire for yellow, red, overtime, and repeated red/overtime states.
- Clicking a notification shows Tiny Wins and focuses the relevant task.

## Theme And Controls

- The macOS app defaults to the system theme.
- The user can override theme inside the app.
- Minimal Settings includes theme override, always-on-top, and import/export.
- Keyboard shortcuts remain limited to Enter and Escape for the first native release.

## AI

- Task management works offline.
- AI breakdown requires internet access and `OPENAI_API_KEY`.
- The first native release reads the API key from the environment only.
- Missing API key does not block launch.
- If the key is missing, AI shows a helpful unavailable message when used.
- Native Keychain storage is a future enhancement.

## Acceptance

The macOS release is ready when it installs from a DMG on Apple Silicon, opens as a self-contained right-side Tiny Wins panel, persists task data in a local JSON file, supports menu bar hide/show/quit, keeps timers accurate while hidden and across quit/relaunch, supports UI import/export and web-data migration, and sends native notifications that return the user to the relevant task.
