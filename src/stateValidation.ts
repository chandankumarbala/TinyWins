import type { State } from "./domain";

function invalid(message: string): never {
  throw new Error(`Invalid saved data: ${message}`);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("expected an object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim())
    invalid(`${label} must be nonempty text without outer spaces.`);
}

function number(
  value: unknown,
  label: string,
  positive = false,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (positive ? value <= 0 : value < 0)
  )
    invalid(
      `${label} must be a ${positive ? "positive" : "nonnegative"} finite number.`,
    );
}

const normalized = (value: string) => value.toLowerCase();

export function validateState(value: unknown): State {
  const state = record(value);
  if (state.version !== 1) invalid("unsupported schema version.");
  if (state.theme !== "light" && state.theme !== "dark")
    invalid("unknown theme.");
  if (!Array.isArray(state.tabs)) invalid("tabs must be an array.");
  const ids = new Set<string>();
  const tabNames = new Set<string>();
  const tabIds = new Set<string>();
  const checkId = (id: unknown) => {
    text(id, "ID");
    if (ids.has(id)) invalid("duplicate ID.");
    ids.add(id);
  };
  for (const item of state.tabs) {
    const tab = record(item);
    checkId(tab.id);
    tabIds.add(tab.id as string);
    text(tab.name, "Tab name");
    const tabName = normalized(tab.name);
    if (tabNames.has(tabName)) invalid("duplicate tab name.");
    tabNames.add(tabName);
    number(tab.lastOperatedAt, "Tab operation time");
    if (!Array.isArray(tab.tasks)) invalid("tasks must be an array.");
    const names = new Set<string>();
    let running = 0;
    for (const [index, itemTask] of tab.tasks.entries()) {
      const task = record(itemTask);
      checkId(task.id);
      text(task.title, "Task title");
      const taskName = normalized(task.title);
      if (names.has(taskName)) invalid("duplicate task name in a tab.");
      names.add(taskName);
      number(task.createdAt, "Created time");
      number(task.plannedMs, "Planned duration", true);
      number(task.elapsedMs, "Elapsed duration");
      if (typeof task.yellowShown !== "boolean")
        invalid("yellow alert history must be boolean.");
      if (!["paused", "running", "completed"].includes(task.status as string))
        invalid("unknown task status.");
      if (task.status === "running") {
        running += 1;
        number(task.runningSince, "Running anchor");
        if (index !== 0) invalid("running task must be first.");
      } else if (task.runningSince !== null)
        invalid("inactive task has a running anchor.");
      if (task.status === "completed") {
        number(task.completedAt, "Completion time");
        if (task.completedAt < (task.createdAt as number))
          invalid("completion precedes creation.");
      } else if (task.completedAt !== null)
        invalid("unfinished task has a completion time.");
      if (
        task.lastAlertPhase !== undefined &&
        !["green", "yellow", "red", "overtime"].includes(
          task.lastAlertPhase as string,
        )
      )
        invalid("unknown alert phase.");
      if (task.lastAlertElapsed !== undefined)
        number(task.lastAlertElapsed, "Alert elapsed time");
    }
    if (running > 1) invalid("multiple running tasks in one tab.");
  }
  if (
    state.tabs.length === 0
      ? state.selectedTabId !== null
      : typeof state.selectedTabId !== "string" ||
        !tabIds.has(state.selectedTabId)
  )
    invalid("selected tab does not exist.");
  return structuredClone(value) as State;
}
