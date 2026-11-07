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
    current = transition(
      current,
      {
        type: "task-add",
        tabId: current.tabs[0].id,
        title: "Sweep",
      },
      10,
    );
    await platform.saveState(current);

    const backup = JSON.stringify({
      version: 1,
      exportedAt: 20,
      state: current,
    });

    const merged = await platform.mergeImportedBackup(backup, current, 30);

    expect(merged.tabs.map((tab) => tab.name)).toEqual([
      "My Tasks",
      "My Tasks (2)",
    ]);
  });
});
