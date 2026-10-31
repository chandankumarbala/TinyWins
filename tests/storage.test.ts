import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, transition } from "../src/domain";
import {
  load,
  save,
  STORAGE_KEY,
  validateImport,
  validateState,
} from "../src/storage";

describe("local persistence and backup validation", () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("distinguishes first launch from saved empty tabs", () => {
    expect(load()).toBeNull();
    const original = initialState();
    const empty = transition(original, {
      type: "tab-delete",
      id: original.tabs[0].id,
    });
    save(empty);
    expect(load()).toEqual(empty);
  });
  it("round trips stored state without losing running anchors", () => {
    let state = initialState();
    const tabId = state.tabs[0].id;
    state = transition(state, { type: "task-add", tabId, title: "Focus" }, 100);
    state = transition(
      state,
      { type: "task-toggle", tabId, id: state.tabs[0].tasks[0].id },
      200,
    );
    save(state);
    expect(load()).toEqual(state);
  });
  it("rejects corrupt JSON without replacing it", () => {
    values.set(STORAGE_KEY, "broken");
    expect(() => load()).toThrow("not valid JSON");
    expect(values.get(STORAGE_KEY)).toBe("broken");
  });
  it("reports blocked storage and failed writes", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    });
    expect(() => load()).toThrow("unavailable");
    expect(() => save(initialState())).toThrow("could not be saved");
  });
  it("rejects unknown versions, duplicates and invalid selections", () => {
    const state = initialState();
    expect(() => validateState({ ...state, version: 2 })).toThrow("version");
    expect(() => validateState({ ...state, selectedTabId: "missing" })).toThrow(
      "selected tab",
    );
    expect(() =>
      validateState({
        ...state,
        tabs: [...state.tabs, { ...state.tabs[0], id: "other" }],
      }),
    ).toThrow("duplicate tab");
  });
  it("imports running tasks paused at the snapshot time", () => {
    let state = initialState();
    const tabId = state.tabs[0].id;
    state = transition(state, { type: "task-add", tabId, title: "Focus" }, 100);
    state = transition(
      state,
      { type: "task-toggle", tabId, id: state.tabs[0].tasks[0].id },
      200,
    );
    const restored = validateImport(
      JSON.stringify({ version: 1, exportedAt: 1200, state }),
    );
    expect(restored.tabs[0].tasks[0]).toMatchObject({
      status: "paused",
      elapsedMs: 1000,
      runningSince: null,
    });
  });
  it("rejects malformed and unsupported backups", () => {
    expect(() => validateImport("bad")).toThrow("JSON");
    expect(() => validateImport(JSON.stringify({ version: 2 }))).toThrow(
      "version",
    );
  });
});
