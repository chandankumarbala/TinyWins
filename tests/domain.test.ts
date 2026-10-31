import { describe, expect, it } from "vitest";
import {
  initialState,
  transition,
  parseDuration,
  elapsedAt,
  phaseAt,
  evaluateAlerts,
} from "../src/domain";
import type { Action } from "../src/domain";

const tab = (s: ReturnType<typeof initialState>) => s.tabs[0];
const add = (s: ReturnType<typeof initialState>, title = "Task") =>
  transition(s, { type: "task-add", tabId: tab(s).id, title }, 0);
const act = (
  s: ReturnType<typeof initialState>,
  type: string,
  extra = {},
  now = 0,
) =>
  transition(
    s,
    { type, tabId: tab(s).id, id: tab(s).tasks[0]?.id, ...extra } as Action,
    now,
  );
describe("duration parsing", () => {
  it.each([
    ["30", 1800000],
    ["30m", 1800000],
    ["30 min", 1800000],
    ["1h", 3600000],
    ["1.5h", 5400000],
    ["2 hours", 7200000],
  ])("parses %s", (text, ms) => expect(parseDuration(text)).toBe(ms));
  it.each(["0", "-1", "abc", "Infinity", "1hourjunk", "1e99"])(
    "rejects %s",
    (text) => expect(() => parseDuration(text)).toThrow(),
  );
});
describe("domain", () => {
  it("initializes a light empty tab but preserves deletion of last tab", () => {
    const s = initialState();
    expect(s.theme).toBe("light");
    expect(tab(s).name).toBe("My Tasks");
    expect(transition(s, { type: "tab-delete", id: tab(s).id }).tabs).toEqual(
      [],
    );
  });
  it("ignores blank task input and enforces trimmed case-insensitive names", () => {
    const s = add(initialState(), " Work ");
    expect(tab(s).tasks[0].title).toBe("Work");
    expect(() => add(s, "work")).toThrow();
    expect(add(s, "  ")).toEqual(s);
  });
  it("prevents duplicate tabs and blank renames", () => {
    const s = initialState();
    expect(() =>
      transition(s, { type: "tab-add", name: " my tasks " }),
    ).toThrow();
    expect(() =>
      transition(s, { type: "tab-rename", id: tab(s).id, name: " " }),
    ).toThrow();
  });
  it("starts paused and retains active time through pause and restart", () => {
    let s = add(initialState());
    expect(tab(s).tasks[0].plannedMs).toBe(7200000);
    s = act(s, "task-toggle", {}, 100);
    expect(elapsedAt(tab(s).tasks[0], 1100)).toBe(1000);
    s = act(s, "task-toggle", {}, 1100);
    expect(elapsedAt(tab(s).tasks[0], 5000)).toBe(1000);
    s = act(s, "task-toggle", {}, 6000);
    expect(elapsedAt(tab(s).tasks[0], 7000)).toBe(2000);
  });
  it("allows one running task per tab, pins active and freezes completion", () => {
    let s = add(add(initialState(), "One"), "Two");
    const first = tab(s).tasks[0].id,
      second = tab(s).tasks[1].id;
    s = act(s, "task-toggle", { id: first }, 100);
    s = act(s, "task-toggle", { id: second }, 200);
    expect(tab(s).tasks[0].id).toBe(second);
    expect(tab(s).tasks[1].status).toBe("paused");
    s = act(s, "task-finish", {}, 300);
    expect(elapsedAt(tab(s).tasks[0], 10000)).toBe(100);
    expect(act(s, "task-toggle", {}, 500)).toEqual(s);
  });
  it("locks running edits and validates reordered lists", () => {
    const s = act(add(initialState()), "task-toggle");
    expect(() => act(s, "task-edit", { title: "Other" })).toThrow();
    expect(() => act(s, "task-reorder", { ids: [] })).toThrow();
  });
  it("partitions completed tasks only when starting another task", () => {
    let s = add(add(initialState(), "One"), "Two");
    const first = tab(s).tasks[0].id,
      second = tab(s).tasks[1].id;
    s = act(s, "task-finish", { id: first });
    expect(tab(s).tasks[0].id).toBe(first);
    s = act(s, "task-toggle", { id: second });
    expect(tab(s).tasks.map((t) => t.id)).toEqual([second, first]);
  });
  it("uses exact progress boundaries and deduplicates alerts", () => {
    let s = act(add(initialState()), "task-edit", { plannedMs: 1000 });
    s = act(s, "task-toggle");
    const t = tab(s).tasks[0];
    expect(phaseAt(t, 499)).toBe("green");
    expect(phaseAt(t, 500)).toBe("yellow");
    expect(phaseAt(t, 800)).toBe("red");
    expect(phaseAt(t, 1000)).toBe("red");
    expect(phaseAt(t, 1001)).toBe("overtime");
    let result = evaluateAlerts(s, 500);
    expect(result.alerts).toHaveLength(1);
    expect(evaluateAlerts(result.state, 501).alerts).toHaveLength(0);
    result = evaluateAlerts(result.state, 800);
    expect(result.alerts).toHaveLength(1);
    result = evaluateAlerts(result.state, 1001);
    expect(result.alerts).toHaveLength(1);
    expect(evaluateAlerts(result.state, 601001).alerts).toHaveLength(1);
  });
  it("keeps independent active tasks in different tabs", () => {
    let s = act(add(initialState()), "task-toggle");
    s = transition(s, { type: "tab-add", name: "Home" }, 0);
    const other = s.tabs[1].id;
    s = transition(s, { type: "task-add", tabId: other, title: "Other" }, 0);
    s = transition(
      s,
      { type: "task-toggle", tabId: other, id: s.tabs[1].tasks[0].id },
      0,
    );
    expect(
      s.tabs.flatMap((t) => t.tasks).filter((t) => t.status === "running"),
    ).toHaveLength(2);
  });
});
