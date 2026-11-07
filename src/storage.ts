import type { State } from "./domain";
import {
  createBackupEnvelope,
  normalizeImportedState,
  parseBackupEnvelope,
} from "./backup";
import { validateState } from "./stateValidation";
export { validateState } from "./stateValidation";

export const STORAGE_KEY = "todo.state.v1";

export function load(): State | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error(
      "Browser storage is unavailable. Allow local storage and retry.",
    );
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Saved data is not valid JSON. Export the raw data before resetting or import a valid backup.",
    );
  }
  return validateState(parsed);
}

export function save(state: State): void {
  const checked = validateState(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  } catch {
    throw new Error(
      "Your changes could not be saved. Browser storage may be full or blocked. Free space or allow storage, then retry.",
    );
  }
}

export function exportBackup(state: State): void {
  const envelope = createBackupEnvelope(state);
  const exportedAt = envelope.exportedAt;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(envelope, null, 2)], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `todo-backup-${new Date(exportedAt).toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function validateImport(content: string): State {
  return normalizeImportedState(parseBackupEnvelope(content));
}
