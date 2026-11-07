import { describe, expect, it } from "vitest";
import { initialState, transition, type State } from "../src/domain";
import {
  createBackupEnvelope,
  mergeImportedState,
  normalizeImportedState,
  prepareNativeStateForLoad,
  parseBackupEnvelope,
  uniqueImportedName,
} from "../src/backup";

const withTab = (name: string, task: string): State => {
  let state = initialState();
  state = transition(
    state,
    { type: "tab-rename", id: state.tabs[0].id, name },
    100,
  );
  return transition(
    state,
    { type: "task-add", tabId: state.tabs[0].id, title: task },
    200,
  );
};

describe("backup helpers", () => {
  it("creates a backup envelope while freezing running elapsed time at export", () => {
    let state = withTab("Home", "Sweep");
    const tabId = state.tabs[0].id;
    const taskId = state.tabs[0].tasks[0].id;
    state = transition(
      state,
      { type: "task-toggle", tabId, id: taskId },
      1_000,
    );

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
      parseBackupEnvelope(
        JSON.stringify({ version: 1, exportedAt: 2_500, state }),
      ),
    );

    expect(imported.tabs[0].tasks[0]).toMatchObject({
      status: "paused",
      elapsedMs: 2_000,
      runningSince: null,
    });
  });

  it("resumes native running tasks from relaunch time", () => {
    let state = withTab("Home", "Focus");
    const tabId = state.tabs[0].id;
    const taskId = state.tabs[0].tasks[0].id;
    state = transition(
      state,
      { type: "task-toggle", tabId, id: taskId },
      1_000,
    );
    const envelope = createBackupEnvelope(state, 5_000);

    const loaded = prepareNativeStateForLoad(envelope, 9_000);

    expect(loaded.tabs[0].tasks[0]).toMatchObject({
      status: "running",
      elapsedMs: 4_000,
      runningSince: 9_000,
    });
  });

  it("merges imported data and renames duplicate tab and task names", () => {
    const current = withTab("Home", "Sweep");
    const imported = withTab("Home", "Sweep");

    const merged = mergeImportedState(current, imported, 10_000);

    expect(merged.tabs.map((tab) => tab.name)).toEqual(["Home", "Home (2)"]);
    expect(merged.tabs[1].tasks[0].title).toBe("Sweep");
    expect(
      new Set(
        merged.tabs.flatMap((tab) => [
          tab.id,
          ...tab.tasks.map((task) => task.id),
        ]),
      ).size,
    ).toBe(4);
  });

  it("renames duplicate names predictably", () => {
    expect(uniqueImportedName("Home", ["Home", "Home (2)"])).toBe("Home (3)");
  });
});
