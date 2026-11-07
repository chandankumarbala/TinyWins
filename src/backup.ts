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

export function uniqueImportedName(
  base: string,
  existing: Iterable<string>,
): string {
  const taken = new Set([...existing].map((name) => name.trim().toLowerCase()));
  const trimmed = base.trim();
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  let suffix = 2;
  let next = `${trimmed} (${suffix})`;
  while (taken.has(next.toLowerCase())) next = `${trimmed} (${++suffix})`;
  return next;
}

export function createBackupEnvelope(
  state: State,
  exportedAt = Date.now(),
): BackupEnvelope {
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
  if (backup.version !== 1)
    throw new Error("Invalid saved data: unsupported backup version.");
  if (
    typeof backup.exportedAt !== "number" ||
    !Number.isFinite(backup.exportedAt)
  )
    throw new Error(
      "Invalid saved data: Backup snapshot time must be a finite number.",
    );
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

export function prepareNativeStateForLoad(
  envelope: BackupEnvelope,
  now = Date.now(),
): State {
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

export function mergeImportedState(
  current: State,
  imported: State,
  now = Date.now(),
): State {
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
