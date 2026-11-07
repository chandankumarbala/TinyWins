export type Phase = "green" | "yellow" | "red" | "overtime";
export interface Task {
  id: string;
  title: string;
  status: "paused" | "running" | "completed";
  createdAt: number;
  plannedMs: number;
  elapsedMs: number;
  runningSince: number | null;
  completedAt: number | null;
  yellowShown: boolean;
  lastAlertPhase?: string;
  lastAlertElapsed?: number;
}
export interface TaskAlert {
  tabId: string;
  taskId: string;
  tabName: string;
  taskTitle: string;
  phase: Phase;
  message: string;
}
export interface Tab {
  id: string;
  name: string;
  lastOperatedAt: number;
  tasks: Task[];
}
export interface State {
  version: 1;
  theme: "light" | "dark";
  selectedTabId: string | null;
  tabs: Tab[];
}
export type Action =
  | { type: "tab-add"; name: string }
  | { type: "tab-select"; id: string }
  | { type: "tab-delete"; id: string }
  | { type: "tab-rename"; id: string; name: string }
  | { type: "task-add"; tabId: string; title: string }
  | {
      type: "task-add-batch";
      tabId: string;
      tasks: { title: string; estimatedMinutes: number }[];
    }
  | {
      type: "task-edit";
      tabId: string;
      id: string;
      title?: string;
      plannedMs?: number;
    }
  | {
      type: "task-toggle" | "task-finish" | "task-delete";
      tabId: string;
      id: string;
    }
  | { type: "task-reorder"; tabId: string; ids: string[] }
  | { type: "theme"; theme: "light" | "dark" };

export const normalizeName = (value: string) => value.trim().toLowerCase();
export function parseDuration(input: string): number {
  const match = input
    .trim()
    .toLowerCase()
    .match(
      /^(\d+(?:\.\d+)?|\.\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/,
    );
  const ms = match
    ? Number(match[1]) * (match[2]?.startsWith("h") ? 3600000 : 60000)
    : NaN;
  if (!Number.isFinite(ms) || ms <= 0)
    throw new Error("Enter a positive duration, such as 30m or 1.5h.");
  return ms;
}
export function initialState(): State {
  const id = crypto.randomUUID();
  return {
    version: 1,
    theme: "light",
    selectedTabId: id,
    tabs: [{ id, name: "My Tasks", lastOperatedAt: Date.now(), tasks: [] }],
  };
}
export function elapsedAt(task: Task, now: number): number {
  return (
    task.elapsedMs +
    (task.status === "running" && task.runningSince !== null
      ? Math.max(0, now - task.runningSince)
      : 0)
  );
}
export function phaseAt(task: Task, now: number): Phase {
  const ratio = elapsedAt(task, now) / task.plannedMs;
  return ratio > 1
    ? "overtime"
    : ratio >= 0.8
      ? "red"
      : ratio >= 0.5
        ? "yellow"
        : "green";
}
function uniqueName(value: string, peers: string[], kind: string): string {
  const name = value.trim();
  if (!name) throw new Error(`${kind} name cannot be empty.`);
  if (peers.some((peer) => normalizeName(peer) === normalizeName(name)))
    throw new Error(`A ${kind.toLowerCase()} with that name already exists.`);
  return name;
}
function pause(task: Task, now: number): void {
  task.elapsedMs = elapsedAt(task, now);
  task.runningSince = null;
  task.status = "paused";
}
export function transition(
  state: State,
  action: Action,
  now = Date.now(),
): State {
  if (action.type === "task-add" && !action.title.trim()) return state;
  const next = structuredClone(state);
  if (action.type === "theme") {
    next.theme = action.theme;
    return next;
  }
  if (action.type === "tab-add") {
    const name = uniqueName(
      action.name,
      next.tabs.map((t) => t.name),
      "Tab",
    );
    const id = crypto.randomUUID();
    next.tabs.push({ id, name, lastOperatedAt: now, tasks: [] });
    next.selectedTabId = id;
    return next;
  }
  if (action.type === "tab-delete") {
    const index = next.tabs.findIndex((t) => t.id === action.id);
    if (index < 0) return state;
    next.tabs.splice(index, 1);
    if (next.selectedTabId === action.id)
      next.selectedTabId =
        next.tabs[index]?.id ?? next.tabs[index - 1]?.id ?? null;
    return next;
  }
  if (action.type === "tab-select" || action.type === "tab-rename") {
    const tab = next.tabs.find((t) => t.id === action.id);
    if (!tab) throw new Error("Tab no longer exists.");
    if (action.type === "tab-select") next.selectedTabId = tab.id;
    else
      tab.name = uniqueName(
        action.name,
        next.tabs.filter((t) => t.id !== tab.id).map((t) => t.name),
        "Tab",
      );
    tab.lastOperatedAt = now;
    return next;
  }
  const tab = next.tabs.find((t) => t.id === action.tabId);
  if (!tab) throw new Error("Tab no longer exists.");
  if (action.type === "task-add") {
    const title = uniqueName(
      action.title,
      tab.tasks.map((t) => t.title),
      "Task",
    );
    tab.tasks.push({
      id: crypto.randomUUID(),
      title,
      status: "paused",
      createdAt: now,
      plannedMs: 7200000,
      elapsedMs: 0,
      runningSince: null,
      completedAt: null,
      yellowShown: false,
    });
  } else if (action.type === "task-add-batch") {
    if (
      !Array.isArray(action.tasks) ||
      action.tasks.length < 1 ||
      action.tasks.length > 12
    )
      throw new Error("A breakdown must contain between 1 and 12 tasks.");
    const names = new Set(tab.tasks.map((task) => normalizeName(task.title)));
    const tasks: Task[] = action.tasks.map((item) => {
      if (
        !item ||
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.trim().length > 160 ||
        !Number.isInteger(item.estimatedMinutes) ||
        item.estimatedMinutes < 1 ||
        item.estimatedMinutes > 30
      )
        throw new Error(
          "Generated tasks need a title and an estimate from 1 to 30 minutes.",
        );
      const base = item.title.trim();
      let title = base,
        suffix = 2;
      while (names.has(normalizeName(title))) title = `${base} (${suffix++})`;
      names.add(normalizeName(title));
      return {
        id: crypto.randomUUID(),
        title,
        status: "paused",
        createdAt: now,
        plannedMs: item.estimatedMinutes * 60000,
        elapsedMs: 0,
        runningSince: null,
        completedAt: null,
        yellowShown: false,
      };
    });
    tab.tasks.push(...tasks);
  } else if (action.type === "task-reorder") {
    if (
      action.ids.length !== tab.tasks.length ||
      new Set(action.ids).size !== action.ids.length ||
      action.ids.some((id) => !tab.tasks.some((t) => t.id === id))
    )
      throw new Error("Invalid task order.");
    const active = tab.tasks.find((t) => t.status === "running");
    if (active && action.ids[0] !== active.id)
      throw new Error("The running task stays at the top.");
    tab.tasks = action.ids.map((id) => tab.tasks.find((t) => t.id === id)!);
  } else {
    const task = tab.tasks.find((t) => t.id === action.id);
    if (!task) throw new Error("Task no longer exists.");
    if (action.type === "task-delete")
      tab.tasks = tab.tasks.filter((t) => t.id !== task.id);
    if (action.type === "task-edit") {
      if (task.status === "running")
        throw new Error("Pause the task before editing.");
      if (action.title !== undefined)
        task.title = uniqueName(
          action.title,
          tab.tasks.filter((t) => t.id !== task.id).map((t) => t.title),
          "Task",
        );
      if (action.plannedMs !== undefined) {
        if (!Number.isFinite(action.plannedMs) || action.plannedMs <= 0)
          throw new Error("Duration must be positive.");
        task.plannedMs = action.plannedMs;
        task.lastAlertPhase = phaseAt(task, now);
        task.lastAlertElapsed = task.elapsedMs;
      }
    }
    if (action.type === "task-toggle") {
      if (task.status === "completed") return state;
      if (task.status === "running") pause(task, now);
      else {
        tab.tasks
          .filter((t) => t.status === "running")
          .forEach((t) => pause(t, now));
        task.status = "running";
        task.runningSince = now;
        tab.tasks = [
          task,
          ...tab.tasks.filter(
            (t) => t.id !== task.id && t.status !== "completed",
          ),
          ...tab.tasks.filter(
            (t) => t.id !== task.id && t.status === "completed",
          ),
        ];
      }
    }
    if (action.type === "task-finish") {
      if (task.status === "completed") return state;
      task.elapsedMs = elapsedAt(task, now);
      task.runningSince = null;
      task.completedAt = now;
      task.status = "completed";
    }
  }
  tab.lastOperatedAt = now;
  return next;
}
export function evaluateAlerts(
  state: State,
  now: number,
): { state: State; alerts: TaskAlert[] } {
  const next = structuredClone(state),
    alerts: TaskAlert[] = [];
  for (const tab of next.tabs)
    for (const task of tab.tasks) {
      if (task.status !== "running") continue;
      const phase = phaseAt(task, now),
        elapsed = elapsedAt(task, now);
      let due = false;
      if (phase === "yellow" && !task.yellowShown) {
        task.yellowShown = true;
        due = true;
      }
      if (phase === "red" || phase === "overtime")
        due =
          task.lastAlertPhase !== phase ||
          elapsed - (task.lastAlertElapsed ?? 0) >= 600000;
      if (due) {
        task.lastAlertPhase = phase;
        task.lastAlertElapsed = elapsed;
        if (phase === "red" || phase === "overtime") task.yellowShown = true;
        const prompt =
          phase === "yellow"
            ? "Halfway there — keep going."
            : phase === "red"
              ? "Final stretch — time to wrap up."
              : "Overtime — finish or pause when ready.";
        alerts.push({
          tabId: tab.id,
          taskId: task.id,
          tabName: tab.name,
          taskTitle: task.title,
          phase,
          message: `${tab.name} · ${task.title}: ${prompt}`,
        });
      }
    }
  return { state: alerts.length ? next : state, alerts };
}
