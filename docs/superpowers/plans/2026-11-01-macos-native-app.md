# macOS Native App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first self-contained macOS Apple Silicon Tiny Wins app with Tauri while keeping the existing web app supported.

**Architecture:** Keep `src/domain.ts` as the shared behavior core, split browser-only persistence/UI boundaries behind platform adapters, and add a Tauri native shell that owns local JSON file storage, window/tray behavior, settings, import/export, and native notifications. The React app should run unchanged in user-facing task behavior, with native-only capabilities injected through a `PlatformBridge`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Tauri v2, Rust, Tauri official APIs/plugins for dialog, notification, filesystem/path/window/tray behavior.

**Spec:** `docs/superpowers/specs/2026-11-01-macos-native-app-requirements-design.md`

## Global Constraints

- Platform: macOS.
- Architecture: Apple Silicon only for the first native release.
- Distribution: `.dmg`.
- Native shell preference: Tauri.
- Web app: remains supported.
- Windows: deferred to a separate requirements pass.
- The app is self-contained and does not require the user to manually run frontend or backend commands.
- The app opens as a right-side panel by default.
- Default panel width is approximately 25% of screen width.
- The panel uses available screen height.
- The panel is minimizable and expandable but not maximizeable.
- The first release uses a single panel only.
- Settings live inside the same panel.
- No first-run onboarding is required.
- The app includes a menu bar icon with show/hide and quit.
- Closing the window hides Tiny Wins to the menu bar.
- Quitting is explicit through the menu bar.
- Always-on-top is user-toggleable and defaults off.
- Launch-at-login is deferred.
- Auto-updates are deferred.
- Local testing builds may be unsigned.
- Public distribution requires signing and notarization.
- Store Tiny Wins data in a local app data file, not embedded browser storage.
- Use plain readable JSON for the first native release.
- Treat encryption as a future privacy enhancement.
- Support import and export from the UI.
- Support migration from exported web data.
- Imports merge into existing native data.
- Duplicate imported tab or task names are renamed with predictable numeric suffixes.
- Timers keep running while the app is hidden to the menu bar.
- On quit, elapsed active time is persisted up to quit.
- On relaunch, tasks that were running before quit resume automatically.
- Native macOS notifications supplement existing in-app toasts.
- Native notifications fire for yellow, red, overtime, and repeated red/overtime states.
- Clicking a notification shows Tiny Wins and focuses the relevant task.
- The macOS app defaults to the system theme.
- The user can override theme inside the app.
- Minimal Settings includes theme override, always-on-top, and import/export.
- Keyboard shortcuts remain limited to Enter and Escape for the first native release.
- Task management works offline.
- AI breakdown requires internet access and `OPENAI_API_KEY`.
- The first native release reads the API key from the environment only.
- Missing API key does not block launch.
- If the key is missing, AI shows a helpful unavailable message when used.
- Native Keychain storage is a future enhancement.
- Do not read or expose `.env`, `docs/.secrets`, API keys, or other secrets while executing this plan.
- If npm dependency installation fails, retry once with `npm install --force` as the last resort.
- Do not commit unless the user explicitly approves the commit.

---

## File Structure

- Create `src/stateValidation.ts`: pure saved-state validation shared by browser storage, backup helpers, and native data loading.
- Create `src/backup.ts`: pure backup creation, backup validation, import normalization, and merge-with-renames logic shared by browser and native.
- Modify `src/storage.ts`: keep browser localStorage load/save, import state validation from `src/stateValidation.ts`, and delegate import/export JSON shaping to `src/backup.ts`.
- Create `src/platform/types.ts`: shared `PlatformBridge`, `NativeSettings`, notification, import/export, and focus interfaces.
- Create `src/platform/browser.ts`: browser implementation backed by localStorage, DOM download/upload, web theme defaults, and no-op native capabilities.
- Create `src/platform/tauri.ts`: Tauri implementation backed by `invoke`, Tauri notification plugin, and native settings commands.
- Create `src/App.tsx`: move the current React app out of `src/main.tsx`, receive a `PlatformBridge`, and remove direct browser-only storage assumptions.
- Modify `src/main.tsx`: choose browser or Tauri platform, mount `<App platform={platform} />`.
- Create `src/SettingsPanel.tsx`: minimal in-panel settings for theme preference, always-on-top, import, and export.
- Modify `src/style.css`: compact native panel responsive styling and settings panel styles while preserving existing web appearance.
- Create `src-tauri/`: Tauri Rust app, config, commands, tray, close-to-tray behavior, right-side panel positioning, app data file commands, and bundle configuration.
- Modify `package.json`: add Tauri scripts and dependencies.
- Modify `README.md`: document macOS dev/build commands, DMG target, unsigned local build, and signing/notarization note.
- Add tests in `tests/backup.test.ts`, `tests/platform-browser.test.ts`, and extend `tests/browser/app.spec.ts`.

---

### Task 1: Extract Pure Backup And Merge Logic

**Files:**
- Create: `src/stateValidation.ts`
- Create: `src/backup.ts`
- Modify: `src/storage.ts`
- Create: `tests/backup.test.ts`
- Modify: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `State`, `Task`, `Tab`, `elapsedAt`, and `initialState` from existing domain modules.
- Produces:
  - `export function validateState(value: unknown): State` from `src/stateValidation.ts`
  - `export interface BackupEnvelope { version: 1; exportedAt: number; state: State }`
  - `export function createBackupEnvelope(state: State, exportedAt?: number): BackupEnvelope`
  - `export function parseBackupEnvelope(content: string): BackupEnvelope`
  - `export function normalizeImportedState(envelope: BackupEnvelope): State`
  - `export function mergeImportedState(current: State, imported: State, now?: number): State`
  - `export function uniqueImportedName(base: string, existing: Iterable<string>): string`

- [ ] **Step 1: Write failing backup merge tests**

Create `tests/backup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialState, transition, type State } from "../src/domain";
import {
  createBackupEnvelope,
  mergeImportedState,
  normalizeImportedState,
  parseBackupEnvelope,
  uniqueImportedName,
} from "../src/backup";

const withTab = (name: string, task: string): State => {
  let state = initialState();
  state = transition(state, { type: "tab-rename", id: state.tabs[0].id, name }, 100);
  return transition(state, { type: "task-add", tabId: state.tabs[0].id, title: task }, 200);
};

describe("backup helpers", () => {
  it("creates a backup envelope while freezing running elapsed time at export", () => {
    let state = withTab("Home", "Sweep");
    const tabId = state.tabs[0].id;
    const taskId = state.tabs[0].tasks[0].id;
    state = transition(state, { type: "task-toggle", tabId, id: taskId }, 1_000);

    const envelope = createBackupEnvelope(state, 4_000);

    expect(envelope).toMatchObject({ version: 1, exportedAt: 4_000 });
    expect(envelope.state.tabs[0].tasks[0]).toMatchObject({
      status: "running",
      elapsedMs: 3_000,
      runningSince: 4_000,
    });
  });

  it("parses and normalizes imported running tasks to paused snapshot time", () => {
    let state = withTab("Office", "Draft memo");
    const tabId = state.tabs[0].id;
    const taskId = state.tabs[0].tasks[0].id;
    state = transition(state, { type: "task-toggle", tabId, id: taskId }, 500);

    const imported = normalizeImportedState(
      parseBackupEnvelope(JSON.stringify({ version: 1, exportedAt: 2_500, state })),
    );

    expect(imported.tabs[0].tasks[0]).toMatchObject({
      status: "paused",
      elapsedMs: 2_000,
      runningSince: null,
    });
  });

  it("merges imported data and renames duplicate tab and task names", () => {
    const current = withTab("Home", "Sweep");
    const imported = withTab("Home", "Sweep");

    const merged = mergeImportedState(current, imported, 10_000);

    expect(merged.tabs.map((tab) => tab.name)).toEqual(["Home", "Home (2)"]);
    expect(merged.tabs[1].tasks[0].title).toBe("Sweep");
    expect(new Set(merged.tabs.flatMap((tab) => [tab.id, ...tab.tasks.map((task) => task.id)])).size).toBe(4);
  });

  it("renames duplicate names predictably", () => {
    expect(uniqueImportedName("Home", ["Home", "Home (2)"])).toBe("Home (3)");
  });
});
```

- [ ] **Step 2: Run backup tests to verify they fail**

Run: `npx vitest run tests/backup.test.ts`

Expected: FAIL because `src/backup.ts` does not exist.

- [ ] **Step 3: Move saved-state validation into a shared module**

Create `src/stateValidation.ts` by moving the current `validateState` implementation and its private helper functions from `src/storage.ts`.

The file should start with:

```ts
import type { State } from "./domain";
```

The file should export:

```ts
export function validateState(value: unknown): State {
  // existing validation body moved from src/storage.ts
}
```

Update `src/storage.ts` to import it:

```ts
import { validateState } from "./stateValidation";
export { validateState } from "./stateValidation";
```

Keep the re-export so existing tests and call sites that import `validateState` from `src/storage.ts` continue to work during the migration.

- [ ] **Step 4: Implement pure backup helpers**

Create `src/backup.ts`:

```ts
import { elapsedAt, type State, type Tab, type Task } from "./domain";
import { validateState } from "./stateValidation";

export interface BackupEnvelope {
  version: 1;
  exportedAt: number;
  state: State;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The backup must be a JSON object.");
  return value as Record<string, unknown>;
}

function withFreshIds(tab: Tab): Tab {
  return {
    ...tab,
    id: crypto.randomUUID(),
    tasks: tab.tasks.map((task) => ({ ...task, id: crypto.randomUUID() })),
  };
}

export function uniqueImportedName(base: string, existing: Iterable<string>): string {
  const taken = new Set([...existing].map((name) => name.trim().toLowerCase()));
  const trimmed = base.trim();
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  let suffix = 2;
  let next = `${trimmed} (${suffix})`;
  while (taken.has(next.toLowerCase())) next = `${trimmed} (${++suffix})`;
  return next;
}

export function createBackupEnvelope(state: State, exportedAt = Date.now()): BackupEnvelope {
  const snapshot = validateState(state);
  snapshot.tabs.forEach((tab) =>
    tab.tasks.forEach((task) => {
      if (task.status === "running") {
        task.elapsedMs = elapsedAt(task, exportedAt);
        task.runningSince = exportedAt;
      }
    }),
  );
  return { version: 1, exportedAt, state: snapshot };
}

export function parseBackupEnvelope(content: string): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The backup is not valid JSON.");
  }
  const backup = parseObject(parsed);
  if (backup.version !== 1) throw new Error("Invalid saved data: unsupported backup version.");
  if (typeof backup.exportedAt !== "number" || !Number.isFinite(backup.exportedAt))
    throw new Error("Invalid saved data: Backup snapshot time must be a finite number.");
  return {
    version: 1,
    exportedAt: backup.exportedAt,
    state: validateState(backup.state),
  };
}

export function normalizeImportedState(envelope: BackupEnvelope): State {
  const state = validateState(envelope.state);
  state.tabs.forEach((tab) =>
    tab.tasks.forEach((task) => {
      if (task.status === "running") {
        task.elapsedMs = elapsedAt(task, envelope.exportedAt);
        task.runningSince = null;
        task.status = "paused";
      }
    }),
  );
  return state;
}

export function mergeImportedState(current: State, imported: State, now = Date.now()): State {
  const next = validateState(current);
  const tabNames = new Set(next.tabs.map((tab) => tab.name));
  for (const source of validateState(imported).tabs) {
    const tab = withFreshIds(source);
    tab.name = uniqueImportedName(tab.name, tabNames);
    tab.lastOperatedAt = now;
    tabNames.add(tab.name);
    const taskNames = new Set<string>();
    tab.tasks = tab.tasks.map((task: Task) => {
      const title = uniqueImportedName(task.title, taskNames);
      taskNames.add(title);
      return { ...task, title };
    });
    next.tabs.push(tab);
  }
  if (!next.selectedTabId && next.tabs[0]) next.selectedTabId = next.tabs[0].id;
  return validateState(next);
}
```

- [ ] **Step 5: Update browser storage to use backup helpers**

Modify `src/storage.ts`:

```ts
import { createBackupEnvelope, normalizeImportedState, parseBackupEnvelope } from "./backup";
import { validateState } from "./stateValidation";
export { validateState } from "./stateValidation";
```

Replace the `exportBackup` JSON construction with:

```ts
const envelope = createBackupEnvelope(state);
const exportedAt = envelope.exportedAt;
const url = URL.createObjectURL(
  new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }),
);
```

Replace `validateImport` body with:

```ts
export function validateImport(content: string): State {
  return normalizeImportedState(parseBackupEnvelope(content));
}
```

- [ ] **Step 6: Run storage and backup tests**

Run: `npx vitest run tests/storage.test.ts tests/backup.test.ts`

Expected: PASS.

- [ ] **Step 7: Run full unit tests**

Run: `npm run test`

Expected: PASS. If sandbox blocks loopback server tests with `listen EPERM 127.0.0.1`, rerun the same command with approved escalation.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src/stateValidation.ts src/backup.ts src/storage.ts tests/backup.test.ts tests/storage.test.ts`

Expected: diff only contains backup extraction and tests.

Commit only if the user approves:

```bash
git add src/stateValidation.ts src/backup.ts src/storage.ts tests/backup.test.ts tests/storage.test.ts
git commit -m "Extract Tiny Wins backup helpers"
```

---

### Task 2: Add Platform Bridge And Browser Adapter

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/browser.ts`
- Create: `tests/platform-browser.test.ts`
- Modify: `src/storage.ts`

**Interfaces:**
- Consumes: `State`, `BackupEnvelope`, backup helper functions, browser storage functions.
- Produces:
  - `export type ThemePreference = "system" | "light" | "dark"`
  - `export interface NativeSettings`
  - `export interface PlatformBridge`
  - `export function createBrowserPlatform(): PlatformBridge`

- [ ] **Step 1: Write failing browser platform tests**

Create `tests/platform-browser.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, transition } from "../src/domain";
import { createBrowserPlatform } from "../src/platform/browser";
import { STORAGE_KEY } from "../src/storage";

describe("browser platform bridge", () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads and saves through browser localStorage", async () => {
    const platform = createBrowserPlatform();
    const state = initialState();

    expect(await platform.loadState()).toBeNull();
    await platform.saveState(state);

    expect(JSON.parse(values.get(STORAGE_KEY)!)).toEqual(state);
    expect(await platform.loadState()).toEqual(state);
  });

  it("uses web-safe native capability defaults", async () => {
    const platform = createBrowserPlatform();

    expect(platform.kind).toBe("browser");
    expect(await platform.loadSettings()).toEqual({
      themePreference: "light",
      alwaysOnTop: false,
    });
    await expect(platform.setAlwaysOnTop(true)).resolves.toBeUndefined();
  });

  it("merges imported backup data", async () => {
    const platform = createBrowserPlatform();
    let current = initialState();
    current = transition(current, { type: "task-add", tabId: current.tabs[0].id, title: "Sweep" }, 10);
    await platform.saveState(current);

    const backup = JSON.stringify({
      version: 1,
      exportedAt: 20,
      state: current,
    });

    const merged = await platform.mergeImportedBackup(backup, current, 30);

    expect(merged.tabs.map((tab) => tab.name)).toEqual(["My Tasks", "My Tasks (2)"]);
  });
});
```

- [ ] **Step 2: Run platform tests to verify they fail**

Run: `npx vitest run tests/platform-browser.test.ts`

Expected: FAIL because `src/platform/browser.ts` does not exist.

- [ ] **Step 3: Add platform interface**

Create `src/platform/types.ts`:

```ts
import type { State } from "../domain";

export type ThemePreference = "system" | "light" | "dark";

export interface NativeSettings {
  themePreference: ThemePreference;
  alwaysOnTop: boolean;
}

export interface AlertNotification {
  id: string;
  tabId: string;
  taskId: string;
  title: string;
  body: string;
}

export interface PlatformBridge {
  kind: "browser" | "tauri";
  loadState(): Promise<State | null>;
  saveState(state: State): Promise<void>;
  exportState(state: State): Promise<void>;
  importBackup(): Promise<string | null>;
  mergeImportedBackup(content: string, current: State, now?: number): Promise<State>;
  loadSettings(): Promise<NativeSettings>;
  saveSettings(settings: NativeSettings): Promise<void>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  notify(alert: AlertNotification): Promise<void>;
  onNotificationFocus(callback: (target: { tabId: string; taskId: string }) => void): () => void;
}
```

- [ ] **Step 4: Add browser adapter**

Create `src/platform/browser.ts`:

```ts
import type { State } from "../domain";
import { createBackupEnvelope, mergeImportedState, normalizeImportedState, parseBackupEnvelope } from "../backup";
import { exportBackup, load, save } from "../storage";
import type { NativeSettings, PlatformBridge } from "./types";

const browserSettings: NativeSettings = {
  themePreference: "light",
  alwaysOnTop: false,
};

export function createBrowserPlatform(): PlatformBridge {
  return {
    kind: "browser",
    async loadState() {
      return load();
    },
    async saveState(state: State) {
      save(state);
    },
    async exportState(state: State) {
      exportBackup(state);
    },
    async importBackup() {
      return null;
    },
    async mergeImportedBackup(content: string, current: State, now = Date.now()) {
      const imported = normalizeImportedState(parseBackupEnvelope(content));
      return mergeImportedState(current, imported, now);
    },
    async loadSettings() {
      return { ...browserSettings };
    },
    async saveSettings(settings: NativeSettings) {
      browserSettings.themePreference = settings.themePreference;
      browserSettings.alwaysOnTop = settings.alwaysOnTop;
    },
    async setAlwaysOnTop() {
      return undefined;
    },
    async notify() {
      return undefined;
    },
    onNotificationFocus() {
      return () => undefined;
    },
  };
}
```

If `createBackupEnvelope` is unused in the final file, remove that import before running lint.

- [ ] **Step 5: Keep browser import file path for current UI**

Leave `src/storage.ts` exports intact so existing UI continues to work until `App` is refactored in Task 3.

- [ ] **Step 6: Run platform browser tests**

Run: `npx vitest run tests/platform-browser.test.ts`

Expected: PASS.

- [ ] **Step 7: Run lint and unit tests**

Run:

```bash
npm run lint
npm run test
```

Expected: PASS. If unit tests hit the loopback sandbox restriction, rerun `npm run test` with approved escalation.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src/platform/types.ts src/platform/browser.ts tests/platform-browser.test.ts`

Commit only if the user approves:

```bash
git add src/platform/types.ts src/platform/browser.ts tests/platform-browser.test.ts
git commit -m "Add Tiny Wins platform bridge"
```

---

### Task 3: Refactor React App To Use Platform Bridge

**Files:**
- Create: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `PlatformBridge` from Task 2.
- Produces:
  - `export function App({ platform }: { platform: PlatformBridge }): JSX.Element`
  - `src/main.tsx` mounts `createBrowserPlatform()` for web.

- [ ] **Step 1: Write failing browser regression for current behavior after adapter refactor**

Extend `tests/browser/app.spec.ts` with:

```ts
test("web target still exports and imports backups through the browser controls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("Keep browser working");
  await page.getByLabel("New task", { exact: true }).press("Enter");

  const raw = await page.evaluate(() => localStorage.getItem("todo.state.v1"));
  expect(raw).toContain("Keep browser working");

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("todo.state.v1")!);
    state.tabs[0].tasks = [];
    localStorage.setItem("todo.state.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByText("Keep browser working")).toHaveCount(0);
});
```

This regression verifies web storage still works. Browser file chooser import is already covered by lower-level tests and does not need brittle file chooser automation here.

- [ ] **Step 2: Run focused browser tests before refactor**

Run: `npm run test:e2e -- --project=chromium -g "web target still exports"`

Expected: PASS before refactor, proving the regression represents existing web persistence.

- [ ] **Step 3: Move React app into `src/App.tsx`**

Move all current `function App()` content from `src/main.tsx` into `src/App.tsx`.

At the top of `src/App.tsx`, import platform types:

```ts
import type { PlatformBridge } from "./platform/types";
```

Change the component signature:

```ts
export function App({ platform }: { platform: PlatformBridge }) {
```

Replace direct persistence calls:

```ts
const next = (await platform.loadState()) ?? initialState();
await platform.saveState(next);
```

Change `commit` to async-safe by creating a `commitState` function:

```ts
async function commitState(next: State) {
  try {
    await platform.saveState(next);
    current.current = next;
    setState(next);
    setError("");
    return true;
  } catch (e) {
    setError(`Changes could not be saved. ${String(e)}`);
    return false;
  }
}
```

Use `void commitState(next)` inside event handlers where React cannot await directly, and update tests after behavior is stable.

- [ ] **Step 4: Replace direct export/import calls**

In header tools, replace:

```ts
onClick={() => state && exportBackup(state)}
```

with:

```ts
onClick={() => {
  if (state) void platform.exportState(state);
}}
```

Keep the hidden browser file input for `platform.kind === "browser"`.

For the import input handler, replace `validateImport` with:

```ts
setImported(await platform.mergeImportedBackup(await f.text(), current.current ?? state));
```

For the native path, Task 7 will wire `platform.importBackup()` into the Settings panel.

- [ ] **Step 5: Simplify `src/main.tsx`**

Replace `src/main.tsx` contents with:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createBrowserPlatform } from "./platform/browser";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App platform={createBrowserPlatform()} />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Run TypeScript and focused e2e**

Run:

```bash
npm run typecheck
npm run test:e2e -- --project=chromium
```

Expected: PASS. Fix any async state sequencing regressions before continuing.

- [ ] **Step 7: Run full checks**

Run:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Expected: PASS. If unit tests hit loopback sandbox restrictions, rerun `npm run test` with approved escalation.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src/App.tsx src/main.tsx tests/browser/app.spec.ts`

Commit only if the user approves:

```bash
git add src/App.tsx src/main.tsx tests/browser/app.spec.ts
git commit -m "Refactor app onto platform bridge"
```

---

### Task 4: Add Tauri Project Skeleton And Build Scripts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/capabilities/default.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: Vite build output in `dist`.
- Produces: Tauri dev/build scripts and a minimal native app window.

- [ ] **Step 1: Add Tauri dependencies**

Run:

```bash
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-notification @tauri-apps/plugin-fs
```

If npm installation fails because of dependency resolution, retry once:

```bash
npm install --force --save-dev @tauri-apps/cli
npm install --force @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-notification @tauri-apps/plugin-fs
```

- [ ] **Step 2: Add package scripts**

Modify `package.json` scripts:

```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build --bundles dmg",
"tauri:build:debug": "tauri build --debug --bundles app"
```

- [ ] **Step 3: Create Rust manifest**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "tiny-wins"
version = "1.0.0"
description = "Tiny Wins desktop app"
authors = ["Tiny Wins"]
edition = "2021"
rust-version = "1.77"

[lib]
name = "tiny_wins_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-dialog = "2"
tauri-plugin-notification = "2"
tauri-plugin-fs = "2"
```

- [ ] **Step 4: Create Tauri config**

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Tiny Wins",
  "version": "1.0.0",
  "identifier": "app.tinywins.local",
  "build": {
    "beforeDevCommand": "npm run dev:web",
    "devUrl": "http://127.0.0.1:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Tiny Wins",
        "width": 420,
        "height": 900,
        "resizable": true,
        "maximizable": false,
        "fullscreen": false,
        "visible": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "macOS": {
      "minimumSystemVersion": "12.0"
    },
    "icon": [
      "icons/icon.icns",
      "icons/icon.png"
    ]
  }
}
```

- [ ] **Step 5: Create Rust entry points**

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build();
}
```

Create `src-tauri/src/main.rs`:

```rust
fn main() {
    tiny_wins_lib::run();
}
```

Create `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Tiny Wins");
}
```

- [ ] **Step 6: Add default capabilities**

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Tiny Wins desktop permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "notification:default",
    "fs:default",
    "path:default"
  ]
}
```

- [ ] **Step 7: Add temporary app icon assets**

Create `src-tauri/icons/icon.png` and `src-tauri/icons/icon.icns` from `public/tiny-wins.svg` using the Tauri icon generator:

```bash
npx tauri icon public/tiny-wins.svg
```

Expected: Tauri writes icon assets under `src-tauri/icons/`.

- [ ] **Step 8: Verify web build still works**

Run:

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 9: Verify Tauri config compiles**

Run:

```bash
npm run tauri:build:debug
```

Expected: PASS and creates a debug app bundle. If Rust toolchain or macOS Tauri prerequisites are missing, record the exact prerequisite error in the completion report and do not work around it by deleting native requirements.

- [ ] **Step 10: Update README commands**

Add a macOS native section:

```md
### macOS Native App

- `npm run tauri:dev` starts the Tauri macOS app during development.
- `npm run tauri:build:debug` builds an unsigned local debug `.app`.
- `npm run tauri:build` builds a local unsigned DMG target for Apple Silicon testing.

The first native release is local/unsigned. Public sharing requires Apple signing and notarization.
```

- [ ] **Step 11: Checkpoint**

Run: `git diff -- package.json src-tauri README.md`

Commit only if the user approves:

```bash
git add package.json package-lock.json src-tauri README.md
git commit -m "Add Tauri macOS shell"
```

---

### Task 5: Implement Native JSON Data File Commands And Tauri Platform Adapter

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src/platform/tauri.ts`
- Modify: `src/main.tsx`
- Create: `tests/native-data-shape.test.ts`

**Interfaces:**
- Consumes: `PlatformBridge`, `BackupEnvelope`, `State`.
- Produces:
  - Rust commands: `load_state_file`, `save_state_file`, `load_settings_file`, `save_settings_file`
  - `export function createTauriPlatform(): PlatformBridge`
  - runtime platform selection in `src/main.tsx`

- [ ] **Step 1: Add TypeScript tests for native file shape**

Create `tests/native-data-shape.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialState } from "../src/domain";
import { createBackupEnvelope, parseBackupEnvelope } from "../src/backup";

describe("native data file shape", () => {
  it("uses the same envelope format for native app data and exported backups", () => {
    const envelope = createBackupEnvelope(initialState(), 123);
    const parsed = parseBackupEnvelope(JSON.stringify(envelope));

    expect(parsed).toEqual(envelope);
    expect(parsed.state.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run native data shape test**

Run: `npx vitest run tests/native-data-shape.test.ts`

Expected: PASS once Task 1 exists.

- [ ] **Step 3: Add Rust app data commands**

Modify `src-tauri/src/lib.rs`:

```rust
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("tiny-wins-state.json"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("tiny-wins-settings.json"))
}

fn atomic_write(path: PathBuf, content: String) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|error| error.to_string())?;
    fs::rename(tmp, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_state_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_state_file(app: AppHandle, content: String) -> Result<(), String> {
    atomic_write(state_path(&app)?, content)
}

#[tauri::command]
fn load_settings_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_settings_file(app: AppHandle, content: String) -> Result<(), String> {
    atomic_write(settings_path(&app)?, content)
}
```

Add the commands to the builder:

```rust
.invoke_handler(tauri::generate_handler![
    load_state_file,
    save_state_file,
    load_settings_file,
    save_settings_file
])
```

- [ ] **Step 4: Add Tauri platform adapter**

Create `src/platform/tauri.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { State } from "../domain";
import {
  createBackupEnvelope,
  mergeImportedState,
  normalizeImportedState,
  parseBackupEnvelope,
} from "../backup";
import type { NativeSettings, PlatformBridge } from "./types";

const defaultSettings: NativeSettings = {
  themePreference: "system",
  alwaysOnTop: false,
};

function parseSettings(raw: string | null): NativeSettings {
  if (!raw) return { ...defaultSettings };
  const parsed = JSON.parse(raw) as Partial<NativeSettings>;
  return {
    themePreference:
      parsed.themePreference === "light" || parsed.themePreference === "dark" || parsed.themePreference === "system"
        ? parsed.themePreference
        : "system",
    alwaysOnTop: parsed.alwaysOnTop === true,
  };
}

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function createTauriPlatform(): PlatformBridge {
  return {
    kind: "tauri",
    async loadState() {
      const raw = await invoke<string | null>("load_state_file");
      return raw ? normalizeImportedState(parseBackupEnvelope(raw)) : null;
    },
    async saveState(state: State) {
      await invoke("save_state_file", {
        content: JSON.stringify(createBackupEnvelope(state), null, 2),
      });
    },
    async exportState() {
      throw new Error("Native export is added in the import/export task.");
    },
    async importBackup() {
      throw new Error("Native import is added in the import/export task.");
    },
    async mergeImportedBackup(content: string, current: State, now = Date.now()) {
      return mergeImportedState(current, normalizeImportedState(parseBackupEnvelope(content)), now);
    },
    async loadSettings() {
      return parseSettings(await invoke<string | null>("load_settings_file"));
    },
    async saveSettings(settings: NativeSettings) {
      await invoke("save_settings_file", { content: JSON.stringify(settings, null, 2) });
    },
    async setAlwaysOnTop() {
      return undefined;
    },
    async notify() {
      return undefined;
    },
    onNotificationFocus() {
      return () => undefined;
    },
  };
}
```

- [ ] **Step 5: Select platform in `src/main.tsx`**

Modify `src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createBrowserPlatform } from "./platform/browser";
import { createTauriPlatform, isTauriRuntime } from "./platform/tauri";
import "./style.css";

const platform = isTauriRuntime() ? createTauriPlatform() : createBrowserPlatform();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App platform={platform} />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Run TypeScript and unit tests**

Run:

```bash
npm run typecheck
npm run test
```

Expected: PASS. If unit tests hit loopback sandbox restrictions, rerun `npm run test` with approved escalation.

- [ ] **Step 7: Run Tauri debug build**

Run: `npm run tauri:build:debug`

Expected: PASS and native app can read/write `tiny-wins-state.json`.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src-tauri/src/lib.rs src/platform/tauri.ts src/main.tsx tests/native-data-shape.test.ts`

Commit only if the user approves:

```bash
git add src-tauri/src/lib.rs src/platform/tauri.ts src/main.tsx tests/native-data-shape.test.ts
git commit -m "Store native Tiny Wins data in JSON"
```

---

### Task 6: Add Native Window, Tray, Close-To-Tray, And Always-On-Top

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/platform/tauri.ts`
- Modify: `src/App.tsx`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `NativeSettings.alwaysOnTop`.
- Produces:
  - Rust command `set_always_on_top(enabled: bool)`
  - Rust command `show_main_window()`
  - tray menu entries `show-hide` and `quit`
  - close button hides app instead of quitting.

- [ ] **Step 1: Add Rust window commands and setup helpers**

Modify `src-tauri/src/lib.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewWindow, WindowEvent,
};

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    main_window(&app)?.set_always_on_top(enabled).map_err(|error| error.to_string())
}

fn position_right_panel(window: &WebviewWindow) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
        let size = monitor.size();
        let position = monitor.position();
        let width = (size.width as f64 * 0.25).max(360.0);
        let height = size.height as f64;
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
            .map_err(|error| error.to_string())?;
        window
            .set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: position.x as f64 + size.width as f64 - width,
                y: position.y as f64,
            }))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
```

- [ ] **Step 2: Add tray setup**

Add in `run()` setup:

```rust
.setup(|app| {
    let show = MenuItem::with_id(app, "show-hide", "Show/Hide Tiny Wins", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Tiny Wins", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let window = app.get_webview_window("main").expect("main window");
    position_right_panel(&window)?;
    window.show()?;

    TrayIconBuilder::with_id("tiny-wins")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show-hide" => {
                if let Ok(window) = main_window(app) {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = position_right_panel(&window);
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Ok(window) = main_window(app) {
                    let _ = position_right_panel(&window);
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
})
```

- [ ] **Step 3: Hide on close instead of quitting**

Add this window event handler:

```rust
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
})
```

- [ ] **Step 4: Register new commands**

Update `invoke_handler`:

```rust
tauri::generate_handler![
    load_state_file,
    save_state_file,
    load_settings_file,
    save_settings_file,
    show_main_window,
    set_always_on_top
]
```

- [ ] **Step 5: Wire always-on-top in Tauri adapter**

In `src/platform/tauri.ts`, replace `setAlwaysOnTop`:

```ts
async setAlwaysOnTop(enabled: boolean) {
  await invoke("set_always_on_top", { enabled });
}
```

- [ ] **Step 6: Add native CSS density hook**

In `src/App.tsx`, put platform kind on the workspace:

```tsx
<section className="workspace" data-platform={platform.kind}>
```

In `src/style.css`, add compact native adjustments:

```css
.workspace[data-platform="tauri"] {
  width: min(100vw, 440px);
  min-height: 100vh;
  border-radius: 0;
}

.workspace[data-platform="tauri"] header,
.workspace[data-platform="tauri"] nav,
.workspace[data-platform="tauri"] .add-task {
  gap: 8px;
}
```

- [ ] **Step 7: Run native build**

Run:

```bash
npm run typecheck
npm run tauri:build:debug
```

Expected: PASS. Manual check: launching the debug `.app` shows a right-side panel, close hides it, tray icon show/hide works, and quit exits.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src-tauri/src/lib.rs src/platform/tauri.ts src/App.tsx src/style.css`

Commit only if the user approves:

```bash
git add src-tauri/src/lib.rs src/platform/tauri.ts src/App.tsx src/style.css
git commit -m "Add macOS panel and tray behavior"
```

---

### Task 7: Add Minimal Settings Panel, System Theme Default, Import, And Export

**Files:**
- Create: `src/SettingsPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/platform/tauri.ts`
- Modify: `src/platform/browser.ts`
- Modify: `src/style.css`
- Extend: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `NativeSettings`, `PlatformBridge`.
- Produces:
  - Settings panel with theme preference, always-on-top toggle, export, import.
  - Tauri import/export using native dialog plugin.

- [ ] **Step 1: Add browser-visible Settings regression**

Extend `tests/browser/app.spec.ts`:

```ts
test("settings panel exposes theme and native options without changing web defaults", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Settings", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Theme preference")).toHaveValue("light");
  await expect(page.getByLabel("Always on top")).toBeDisabled();

  await page.getByLabel("Theme preference").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
```

- [ ] **Step 2: Run focused browser test to verify failure**

Run: `npm run test:e2e -- --project=chromium -g "settings panel exposes"`

Expected: FAIL because settings UI does not exist.

- [ ] **Step 3: Create SettingsPanel**

Create `src/SettingsPanel.tsx`:

```tsx
import type { NativeSettings, ThemePreference } from "./platform/types";

export function SettingsPanel({
  settings,
  nativeControls,
  onSettings,
  onImport,
  onExport,
  onClose,
}: {
  settings: NativeSettings;
  nativeControls: boolean;
  onSettings: (settings: NativeSettings) => void;
  onImport: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const updateTheme = (themePreference: ThemePreference) =>
    onSettings({ ...settings, themePreference });
  const updateAlwaysOnTop = (alwaysOnTop: boolean) =>
    onSettings({ ...settings, alwaysOnTop });

  return (
    <section className="settings-panel" aria-label="Settings panel">
      <header>
        <h2>Settings</h2>
        <button type="button" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </header>
      <label>
        <span>Theme</span>
        <select
          aria-label="Theme preference"
          value={settings.themePreference}
          onChange={(event) => updateTheme(event.currentTarget.value as ThemePreference)}
        >
          {nativeControls && <option value="system">System</option>}
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label>
        <span>Always on top</span>
        <input
          aria-label="Always on top"
          type="checkbox"
          checked={settings.alwaysOnTop}
          disabled={!nativeControls}
          onChange={(event) => updateAlwaysOnTop(event.currentTarget.checked)}
        />
      </label>
      <div className="settings-actions">
        <button type="button" onClick={onExport}>Export</button>
        <button type="button" onClick={onImport}>Import</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add settings state to App**

In `src/App.tsx`, import `SettingsPanel` and add:

```ts
const [settings, setSettings] = useState<NativeSettings>({
  themePreference: platform.kind === "tauri" ? "system" : "light",
  alwaysOnTop: false,
});
const [settingsOpen, setSettingsOpen] = useState(false);
```

Load settings during startup:

```ts
const loadedSettings = await platform.loadSettings();
setSettings(loadedSettings);
await platform.setAlwaysOnTop(loadedSettings.alwaysOnTop);
```

Add settings save helper:

```ts
async function updateSettings(next: NativeSettings) {
  setSettings(next);
  await platform.saveSettings(next);
  await platform.setAlwaysOnTop(next.alwaysOnTop);
}
```

- [ ] **Step 5: Resolve system theme**

Add:

```ts
function resolveTheme(preference: ThemePreference, fallback: State["theme"]): State["theme"] {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

Update document theme effect:

```ts
useEffect(() => {
  document.documentElement.dataset.theme = resolveTheme(settings.themePreference, state?.theme ?? "light");
}, [settings.themePreference, state?.theme]);
```

For browser theme toggle, keep existing `theme` action and set settings preference to the selected explicit theme.

- [ ] **Step 6: Add Settings icon**

Add `Settings` icon import from `lucide-react`.

In header tools:

```tsx
<Icon label="Settings" onClick={() => setSettingsOpen(true)}>
  <Settings size={18} />
</Icon>
```

Render panel:

```tsx
{settingsOpen && (
  <SettingsPanel
    settings={settings}
    nativeControls={platform.kind === "tauri"}
    onSettings={(next) => void updateSettings(next)}
    onImport={() => void importFromPlatform()}
    onExport={() => state && void platform.exportState(state)}
    onClose={() => setSettingsOpen(false)}
  />
)}
```

- [ ] **Step 7: Add native import/export in Tauri adapter**

In `src/platform/tauri.ts`, import:

```ts
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
```

Replace `exportState`:

```ts
async exportState(state: State) {
  const path = await saveDialog({
    defaultPath: `tiny-wins-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (path) await writeTextFile(path, JSON.stringify(createBackupEnvelope(state), null, 2));
}
```

Replace `importBackup`:

```ts
async importBackup() {
  const path = await open({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  return typeof path === "string" ? readTextFile(path) : null;
}
```

- [ ] **Step 8: Add `importFromPlatform` in App**

```ts
async function importFromPlatform() {
  if (!current.current) return;
  try {
    if (platform.kind === "browser") {
      file.current?.click();
      return;
    }
    const content = await platform.importBackup();
    if (!content) return;
    setImported(await platform.mergeImportedBackup(content, current.current));
  } catch (err) {
    setMessages((value) => [...value, String(err)].slice(-5));
  }
}
```

- [ ] **Step 9: Add styles**

Add to `src/style.css`:

```css
.settings-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.settings-panel header,
.settings-panel label,
.settings-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
```

- [ ] **Step 10: Run tests**

Run:

```bash
npm run typecheck
npm run test:e2e -- --project=chromium -g "settings panel exposes"
npm run test
```

Expected: PASS. If unit tests hit loopback sandbox restrictions, rerun `npm run test` with approved escalation.

- [ ] **Step 11: Checkpoint**

Run: `git diff -- src/SettingsPanel.tsx src/App.tsx src/platform/tauri.ts src/platform/browser.ts src/style.css tests/browser/app.spec.ts`

Commit only if the user approves:

```bash
git add src/SettingsPanel.tsx src/App.tsx src/platform/tauri.ts src/platform/browser.ts src/style.css tests/browser/app.spec.ts
git commit -m "Add native settings and data import export"
```

---

### Task 8: Add Native Notifications And Task Focus From Notification Clicks

**Files:**
- Modify: `src/platform/tauri.ts`
- Modify: `src/platform/browser.ts`
- Modify: `src/App.tsx`
- Modify: `src/domain.ts`
- Modify: `tests/domain.test.ts`

**Interfaces:**
- Consumes: `evaluateAlerts`.
- Produces:
  - alert objects with `tabId` and `taskId`
  - native notifications via Tauri notification plugin
  - notification click focus behavior.

- [ ] **Step 1: Update alert tests to require target metadata**

In `tests/domain.test.ts`, update alert expectations so `evaluateAlerts` returns objects:

```ts
expect(result.alerts[0]).toMatchObject({
  tabId,
  taskId,
  message: expect.stringContaining("Halfway there"),
});
```

- [ ] **Step 2: Run domain tests to verify failure**

Run: `npx vitest run tests/domain.test.ts`

Expected: FAIL because alerts are currently strings.

- [ ] **Step 3: Change alert shape**

In `src/domain.ts`, add:

```ts
export interface TaskAlert {
  tabId: string;
  taskId: string;
  tabName: string;
  taskTitle: string;
  phase: Phase;
  message: string;
}
```

Change `evaluateAlerts` return type:

```ts
): { state: State; alerts: TaskAlert[] } {
```

Replace the `alerts.push(...)` call with:

```ts
alerts.push({
  tabId: tab.id,
  taskId: task.id,
  tabName: tab.name,
  taskTitle: task.title,
  phase,
  message: `${tab.name} · ${task.title}: ${
    phase === "yellow"
      ? "Halfway there — keep going."
      : phase === "red"
        ? "Final stretch — time to wrap up."
        : "Overtime — finish or pause when ready."
  }`,
});
```

- [ ] **Step 4: Update App toast handling**

In `src/App.tsx`, change messages state:

```ts
const [messages, setMessages] = useState<string[]>([]);
```

Keep toast strings but call native notifications:

```ts
if (result.alerts.length && commit(result.state)) {
  setMessages((value) => [...value, ...result.alerts.map((alert) => alert.message)].slice(-5));
  result.alerts.forEach((alert) => {
    void platform.notify({
      id: `${alert.taskId}-${alert.phase}-${alert.message}`,
      tabId: alert.tabId,
      taskId: alert.taskId,
      title: alert.taskTitle,
      body: alert.message,
    });
  });
}
```

Add notification focus subscription:

```ts
useEffect(() => {
  return platform.onNotificationFocus(({ tabId, taskId }) => {
    setRename(null);
    setDraft("");
    setAiRequest(null);
    setInlineError("");
    void act({ type: "tab-select", id: tabId });
    requestAnimationFrame(() => {
      document.querySelector(`[data-task-id="${taskId}"]`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
  });
}, [platform]);
```

Add `data-task-id={task.id}` to task row root.

- [ ] **Step 5: Implement browser notification no-op**

Keep `src/platform/browser.ts` notification methods as no-ops.

- [ ] **Step 6: Implement Tauri notifications**

In `src/platform/tauri.ts`, import:

```ts
import { isPermissionGranted, onAction, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
```

Add module-level focus callback storage:

```ts
const notificationTargets = new Map<string, { tabId: string; taskId: string }>();
const notificationFocusCallbacks = new Set<(target: { tabId: string; taskId: string }) => void>();
let listening = false;

async function ensureNotificationListener() {
  if (listening) return;
  listening = true;
  await onAction((event) => {
    const target = notificationTargets.get(event.notification.identifier ?? "");
    if (target) notificationFocusCallbacks.forEach((callback) => callback(target));
  });
}
```

Replace `notify`:

```ts
async notify(alert) {
  await ensureNotificationListener();
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (!granted) return;
  notificationTargets.set(alert.id, { tabId: alert.tabId, taskId: alert.taskId });
  sendNotification({
    identifier: alert.id,
    title: alert.title,
    body: alert.body,
  });
}
```

Replace `onNotificationFocus`:

```ts
onNotificationFocus(callback) {
  notificationFocusCallbacks.add(callback);
  return () => notificationFocusCallbacks.delete(callback);
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm run typecheck
npx vitest run tests/domain.test.ts
npm run test:e2e -- --project=chromium
```

Expected: PASS.

- [ ] **Step 8: Run native manual check**

Run: `npm run tauri:dev`

Manual check:
- Start a short task.
- Wait for yellow/red/overtime.
- Confirm in-app toast still appears.
- Confirm macOS notification appears after permission grant.
- Click notification.
- Confirm Tiny Wins shows and scrolls to the relevant task.

- [ ] **Step 9: Checkpoint**

Run: `git diff -- src/domain.ts src/App.tsx src/platform/tauri.ts src/platform/browser.ts tests/domain.test.ts`

Commit only if the user approves:

```bash
git add src/domain.ts src/App.tsx src/platform/tauri.ts src/platform/browser.ts tests/domain.test.ts
git commit -m "Add native task notifications"
```

---

### Task 9: Preserve Running Timers Across Quit And Relaunch

**Files:**
- Modify: `src/backup.ts`
- Modify: `src/platform/tauri.ts`
- Modify: `src/App.tsx`
- Modify: `tests/backup.test.ts`

**Interfaces:**
- Consumes: backup envelope creation and native load/save.
- Produces:
  - Native saves freeze elapsed up to quit/write time.
  - Native load resumes previously running tasks from relaunch time.

- [ ] **Step 1: Add test for native resume behavior**

Extend `tests/backup.test.ts`:

```ts
import { prepareNativeStateForLoad } from "../src/backup";

it("resumes native running tasks from relaunch time", () => {
  let state = withTab("Home", "Focus");
  const tabId = state.tabs[0].id;
  const taskId = state.tabs[0].tasks[0].id;
  state = transition(state, { type: "task-toggle", tabId, id: taskId }, 1_000);
  const envelope = createBackupEnvelope(state, 5_000);

  const loaded = prepareNativeStateForLoad(envelope, 9_000);

  expect(loaded.tabs[0].tasks[0]).toMatchObject({
    status: "running",
    elapsedMs: 4_000,
    runningSince: 9_000,
  });
});
```

- [ ] **Step 2: Run backup test to verify failure**

Run: `npx vitest run tests/backup.test.ts -t "resumes native running"`

Expected: FAIL because `prepareNativeStateForLoad` does not exist.

- [ ] **Step 3: Implement native load preparation**

Add to `src/backup.ts`:

```ts
export function prepareNativeStateForLoad(envelope: BackupEnvelope, now = Date.now()): State {
  const state = validateState(envelope.state);
  state.tabs.forEach((tab) =>
    tab.tasks.forEach((task) => {
      if (task.status === "running") {
        task.elapsedMs = elapsedAt(task, envelope.exportedAt);
        task.runningSince = now;
      }
    }),
  );
  return state;
}
```

- [ ] **Step 4: Use native preparation in Tauri load**

In `src/platform/tauri.ts`, import `prepareNativeStateForLoad`.

Change `loadState`:

```ts
async loadState() {
  const raw = await invoke<string | null>("load_state_file");
  return raw ? prepareNativeStateForLoad(parseBackupEnvelope(raw)) : null;
}
```

- [ ] **Step 5: Persist on page hide and before unload**

In `src/App.tsx`, add:

```ts
useEffect(() => {
  const persist = () => {
    if (current.current) void platform.saveState(current.current);
  };
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
  return () => {
    window.removeEventListener("pagehide", persist);
    window.removeEventListener("beforeunload", persist);
  };
}, [platform]);
```

- [ ] **Step 6: Run tests**

Run:

```bash
npx vitest run tests/backup.test.ts
npm run typecheck
npm run test
```

Expected: PASS. If unit tests hit loopback sandbox restrictions, rerun `npm run test` with approved escalation.

- [ ] **Step 7: Manual native quit/relaunch check**

Run: `npm run tauri:dev`

Manual check:
- Create a task with a short duration.
- Start it.
- Quit from the menu bar.
- Relaunch.
- Confirm the task is running.
- Confirm elapsed active time did not lose the time accumulated before quit.

- [ ] **Step 8: Checkpoint**

Run: `git diff -- src/backup.ts src/platform/tauri.ts src/App.tsx tests/backup.test.ts`

Commit only if the user approves:

```bash
git add src/backup.ts src/platform/tauri.ts src/App.tsx tests/backup.test.ts
git commit -m "Resume native timers after relaunch"
```

---

### Task 10: Package Unsigned Apple Silicon DMG And Document Release Constraints

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `docs/requirements.md` if packaging discoveries require clarifying the approved requirements.

**Interfaces:**
- Consumes: Tauri build output.
- Produces: documented unsigned local DMG build process.

- [ ] **Step 1: Add generated native outputs to `.gitignore`**

Add:

```gitignore
src-tauri/target/
src-tauri/gen/
```

If `src-tauri/gen/schemas` is needed for capability schema validation in the repo, do not ignore that specific schema directory. Keep only generated build outputs ignored.

- [ ] **Step 2: Build production web assets**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Build unsigned local DMG**

Run: `npm run tauri:build`

Expected: PASS and a DMG appears under `src-tauri/target/release/bundle/dmg/`.

- [ ] **Step 4: Document DMG output and limitations**

In `README.md`, add:

````md
### Build macOS DMG

Run:

```bash
npm run tauri:build
```

The local DMG is unsigned and intended for personal testing on Apple Silicon Macs. Public sharing requires Apple Developer signing and notarization before release.
````

- [ ] **Step 5: Run final verification**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run tauri:build
```

Expected:
- Formatting passes.
- Lint passes.
- TypeScript passes.
- Unit tests pass.
- Web build passes.
- Browser e2e tests pass.
- Tauri DMG build passes on macOS Apple Silicon.

If unit or e2e tests hit loopback sandbox restrictions, rerun those same commands with approved escalation.

- [ ] **Step 6: Manual acceptance checklist**

Verify manually:
- DMG installs on Apple Silicon.
- App opens without manual frontend/backend commands.
- App opens as right-side panel around 25% screen width.
- Close hides to menu bar.
- Menu bar can show/hide and quit.
- Data persists in local JSON app data file.
- Import/export works from Settings.
- Web exported data merges and duplicate names auto-rename.
- System theme default works.
- Theme override works.
- Always-on-top toggle works and defaults off.
- Timer continues while hidden.
- Quit persists elapsed active time.
- Relaunch resumes previously running task.
- Native notification appears for threshold alerts.
- Clicking notification focuses the relevant task.
- Missing `OPENAI_API_KEY` does not block app launch.

- [ ] **Step 7: Checkpoint**

Run:

```bash
git status --short --untracked-files=all
git diff -- README.md .gitignore docs/requirements.md
```

Commit only if the user approves:

```bash
git add README.md .gitignore docs/requirements.md
git commit -m "Document macOS DMG release flow"
```

---

## Plan Self-Review

### Spec Coverage

- macOS Apple Silicon DMG: Task 4 and Task 10.
- Tauri preferred native shell: Task 4.
- Web remains supported: Tasks 2 and 3 preserve browser adapter and e2e tests.
- Self-contained app: Tasks 4 and 5 remove manual frontend/backend startup for packaged app.
- Right-side panel: Task 6.
- Single panel and in-panel settings: Task 7.
- Menu bar show/hide/quit and close-to-tray: Task 6.
- Always-on-top default off and toggleable: Task 6 and Task 7.
- Local JSON app data file: Task 5.
- Import/export and web-data migration: Task 1 and Task 7.
- Merge imports and auto-rename duplicates: Task 1.
- Timers hidden, quit, relaunch: Task 9.
- Native notifications and click-to-focus: Task 8.
- System theme default with override: Task 7.
- AI env-key behavior: preserved through existing AI code, verified in final manual checklist.
- No auto-updates, launch-at-login, onboarding, Windows: carried as global constraints and excluded from tasks.
- Signing/notarization for public distribution: Task 10 README documentation.

### Completeness Scan

This plan names exact files, commands, interfaces, and expected outcomes for each task.

### Type Consistency

- `PlatformBridge`, `NativeSettings`, and `ThemePreference` are introduced in Task 2 and reused consistently in Tasks 3, 5, 6, 7, and 8.
- Backup helpers are introduced in Task 1 and reused consistently in Tasks 2, 5, 7, and 9.
- Native Rust command names in Task 5 match the `invoke` calls in Task 5 and Task 6.
