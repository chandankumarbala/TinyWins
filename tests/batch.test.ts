import { describe, expect, it } from "vitest";
import { initialState, transition, type State } from "../src/domain";
const batch = (
  state: State,
  tasks = [{ title: "Write outline", estimatedMinutes: 5 }],
) =>
  transition(
    state,
    { type: "task-add-batch", tabId: state.tabs[0].id, tasks },
    1000,
  );
describe("atomic generated task insertion", () => {
  it("creates paused ordered tasks with estimates and fresh IDs", () => {
    const state = initialState();
    const result = batch(state, [
      { title: "  Write outline  ", estimatedMinutes: 5 },
      { title: "Draft opening", estimatedMinutes: 15 },
    ]);
    expect(state.tabs[0].tasks).toHaveLength(0);
    expect(result.tabs[0].tasks.map((t) => t.title)).toEqual([
      "Write outline",
      "Draft opening",
    ]);
    expect(result.tabs[0].tasks.map((t) => t.plannedMs)).toEqual([
      300000, 900000,
    ]);
    expect(new Set(result.tabs[0].tasks.map((t) => t.id)).size).toBe(2);
    expect(result.tabs[0].lastOperatedAt).toBe(1000);
    for (const task of result.tabs[0].tasks)
      expect(task).toMatchObject({
        status: "paused",
        createdAt: 1000,
        elapsedMs: 0,
        runningSince: null,
        completedAt: null,
        yellowShown: false,
      });
  });
  it("suffixes conflicts against completed tasks and incoming peers", () => {
    let state = initialState();
    const tabId = state.tabs[0].id;
    state = transition(
      state,
      { type: "task-add", tabId, title: "Write outline" },
      10,
    );
    state = transition(
      state,
      { type: "task-finish", tabId, id: state.tabs[0].tasks[0].id },
      20,
    );
    state = transition(
      state,
      { type: "task-add", tabId, title: "Write outline (2)" },
      30,
    );
    const result = batch(state, [
      { title: "WRITE OUTLINE", estimatedMinutes: 5 },
      { title: "write outline", estimatedMinutes: 5 },
    ]);
    expect(result.tabs[0].tasks.map((t) => t.title)).toEqual([
      "Write outline",
      "Write outline (2)",
      "WRITE OUTLINE (3)",
      "write outline (4)",
    ]);
  });
  it("preserves the running task and other tab data", () => {
    let state = initialState();
    const tabId = state.tabs[0].id;
    state = transition(
      state,
      { type: "task-add", tabId, title: "Current" },
      10,
    );
    state = transition(
      state,
      { type: "task-toggle", tabId, id: state.tabs[0].tasks[0].id },
      20,
    );
    const active = structuredClone(state.tabs[0].tasks[0]);
    const result = batch(state);
    expect(result.tabs[0].tasks[0]).toEqual(active);
    expect(result.version).toBe(1);
  });
  it.each(
    [
      [],
      Array.from({ length: 13 }, () => ({
        title: "Task",
        estimatedMinutes: 5,
      })),
      [{ title: "", estimatedMinutes: 5 }],
      [{ title: "x".repeat(161), estimatedMinutes: 5 }],
      [{ title: "Task", estimatedMinutes: 0 }],
      [{ title: "Task", estimatedMinutes: 31 }],
      [{ title: "Task", estimatedMinutes: 1.5 }],
    ].map((tasks) => [tasks]),
  )("rejects invalid batches without changing state", (tasks) => {
    const state = initialState(),
      before = structuredClone(state);
    expect(() => batch(state, tasks)).toThrow();
    expect(state).toEqual(before);
  });
  it("rejects a batch if the target tab was removed", () => {
    const state = initialState();
    expect(() =>
      transition(state, {
        type: "task-add-batch",
        tabId: "missing",
        tasks: [{ title: "Task", estimatedMinutes: 5 }],
      }),
    ).toThrow("Tab no longer exists");
  });
  it("retains the two-hour manual creation default", () => {
    const state = initialState();
    expect(
      transition(state, {
        type: "task-add",
        tabId: state.tabs[0].id,
        title: "Manual",
      }).tabs[0].tasks[0].plannedMs,
    ).toBe(7200000);
  });
});
