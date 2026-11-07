import { AiComposer } from "./AiComposer";
import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Sparkles,
  Sun,
  Moon,
  Download,
  Upload,
  Play,
  Pause,
  Check,
  Trash2,
  AlertTriangle,
  GripVertical,
  X,
  Pencil,
  Settings,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  initialState,
  transition,
  elapsedAt,
  phaseAt,
  parseDuration,
  evaluateAlerts,
  type State,
  type Task,
} from "./domain";
import type {
  NativeSettings,
  PlatformBridge,
  ThemePreference,
} from "./platform/types";
import { SettingsPanel } from "./SettingsPanel";
import { save } from "./storage";
function Icon({
  label,
  onClick,
  children,
  disabled = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon ${className}`.trim()}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
const time = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(
      2,
      "0",
    )}:${Math.floor(s / 60) % 60 < 10 ? "0" : ""}${Math.floor(s / 60) % 60}:${(s % 60).toString().padStart(2, "0")}`;
};
const AI_UNAVAILABLE_TOOLTIP =
  "Set OPENAI_API_KEY system variable to enable AI task breakdown.";
const AI_AVAILABLE_TOOLTIP = "Breakdown tasks using AI";

function resolveTheme(
  preference: ThemePreference,
  fallback: State["theme"],
): State["theme"] {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : fallback;
}

export function App({ platform }: { platform: PlatformBridge }) {
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [messages, setMessages] = useState<string[]>([]),
    [draft, setDraft] = useState(""),
    [tabDraft, setTabDraft] = useState<string | null>(null),
    [rename, setRename] = useState<string | null>(null),
    [inlineError, setInlineError] = useState(""),
    [confirmTab, setConfirmTab] = useState<string | null>(null),
    [imported, setImported] = useState<State | null>(null);
  const [aiRequest, setAiRequest] = useState<{
    id: number;
    goal: string;
  } | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<NativeSettings>({
    themePreference: platform.kind === "tauri" ? "system" : "light",
    alwaysOnTop: false,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ownsLock = useRef(false);
  const current = useRef<State | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const taskInput = useRef<HTMLInputElement>(null);
  const aiRun = useRef(0);
  useEffect(() => {
    let release: () => void = () => {};
    let disposed = false;
    const start = () => {
      try {
        void (async () => {
          const loadedSettings = await platform.loadSettings();
          setSettings(loadedSettings);
          await platform.setAlwaysOnTop(loadedSettings.alwaysOnTop);
          const next = (await platform.loadState()) ?? initialState();
          await platform.saveState(next);
          current.current = next;
          setState(next);
          setReady(true);
          setError("");
        })().catch((e) => setError(String(e)));
      } catch (e) {
        setError(String(e));
      }
    };
    if (platform.kind === "tauri") {
      start();
      return;
    }
    if (!navigator.locks) {
      setError(
        "This browser cannot safely lock local data. Use a current desktop browser on localhost or HTTPS.",
      );
      return;
    }
    void navigator.locks.request(
      "todo-writer",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          setError(
            "Tiny Wins is open in another window. Close it and reload this window.",
          );
          return;
        }
        if (disposed) return;
        ownsLock.current = true;
        start();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    );
    return () => {
      disposed = true;
      release();
    };
  }, [platform]);
  function commit(next: State) {
    try {
      void platform
        .saveState(next)
        .catch((e) => setError(`Changes could not be saved. ${String(e)}`));
      current.current = next;
      setState(next);
      setError("");
      return true;
    } catch (e) {
      setError(`Changes could not be saved. ${String(e)}`);
      return false;
    }
  }
  function act(action: any) {
    if (error || !current.current) return false;
    try {
      if (commit(transition(current.current, action))) {
        setInlineError("");
        return true;
      }
      return false;
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setClock(now);
      if (!current.current || error) return;
      const result = evaluateAlerts(current.current, now);
      if (result.alerts.length && commit(result.state)) {
        setMessages((v) =>
          [...v, ...result.alerts.map((alert) => alert.message)].slice(-5),
        );
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
    };
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [error, platform]);
  useEffect(() => {
    return platform.onNotificationFocus(({ tabId, taskId }) => {
      setRename(null);
      setDraft("");
      setAiRequest(null);
      setInlineError("");
      void act({ type: "tab-select", id: tabId });
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-task-id="${taskId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }, [platform]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(
      settings.themePreference,
      state?.theme ?? "light",
    );
  }, [settings.themePreference, state?.theme]);
  useEffect(() => {
    if (platform.kind !== "tauri") return;
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const tab = state?.tabs.find((t) => t.id === state.selectedTabId);
  const switchTab = (id: string) => {
    setRename(null);
    setDraft("");
    setAiRequest(null);
    setInlineError("");
    act({ type: "tab-select", id });
  };
  async function refreshAiAvailability(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/ai/status", { signal });
      if (!response.ok) throw new Error("status unavailable");
      const status = (await response.json()) as { available?: boolean };
      const available = status.available === true;
      setAiAvailable(available);
      return available;
    } catch {
      if (!signal?.aborted) setAiAvailable(false);
      return false;
    }
  }
  const requestAiBreakdown = async () => {
    if (aiAvailable !== true && !(await refreshAiAvailability())) return;
    const goal = draft.trim();
    if (!goal) {
      setInlineError("Enter a topic or task to break down with AI.");
      taskInput.current?.focus();
      return;
    }
    setInlineError("");
    setAiRequest({ id: ++aiRun.current, goal });
  };
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void refreshAiAvailability(controller.signal);
    return () => controller.abort();
  }, [ready]);
  async function updateSettings(next: NativeSettings) {
    setSettings(next);
    await platform.saveSettings(next);
    await platform.setAlwaysOnTop(next.alwaysOnTop);
    if (
      current.current &&
      (next.themePreference === "light" || next.themePreference === "dark")
    )
      act({ type: "theme", theme: next.themePreference });
  }
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
  return (
    <main data-platform={platform.kind}>
      <input
        hidden
        ref={file}
        type="file"
        accept="application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f)
            try {
              setImported(
                await platform.mergeImportedBackup(
                  await f.text(),
                  current.current ?? state ?? initialState(),
                ),
              );
            } catch (err) {
              setMessages((v) => [...v, String(err)]);
            }
          e.target.value = "";
        }}
      />
      {error && (
        <div role="alert" className="error">
          {error}
          <div>
            <button
              onClick={() => {
                try {
                  if (!ownsLock.current) {
                    location.reload();
                    return;
                  }
                  if (current.current) {
                    save(current.current);
                    setError("");
                  } else location.reload();
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Retry
            </button>{" "}
            <button
              onClick={() => {
                const raw = localStorage.getItem("todo.state.v1");
                if (raw) {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(
                    new Blob([raw], { type: "application/json" }),
                  );
                  a.download = "todo-recovery.json";
                  a.click();
                  URL.revokeObjectURL(a.href);
                }
              }}
            >
              Download stored data
            </button>{" "}
            <button
              onClick={() => {
                if (
                  ownsLock.current &&
                  window.confirm("Reset all local Tiny Wins data permanently?")
                ) {
                  try {
                    save(initialState());
                    location.reload();
                  } catch (e) {
                    setError(String(e));
                  }
                }
              }}
            >
              Reset local data
            </button>
          </div>
        </div>
      )}
      {ready && state && (
        <section className="workspace" data-platform={platform.kind}>
          <header>
            <div className="brand">
              <img
                className="brand-mark"
                src="/tiny-wins.svg"
                alt=""
                aria-hidden="true"
                width="32"
                height="32"
              />
              <h1>Tiny Wins</h1>
              <p>Small steps. Real progress.</p>
            </div>
            <div className="header-tools">
              <Icon
                label="Export backup"
                onClick={() => {
                  if (state) void platform.exportState(state);
                }}
              >
                <Download size={18} />
              </Icon>
              <Icon
                label="Import backup"
                onClick={() => void importFromPlatform()}
              >
                <Upload size={18} />
              </Icon>
              <Icon
                label="Toggle theme"
                onClick={() => {
                  const theme = state.theme === "dark" ? "light" : "dark";
                  void updateSettings({ ...settings, themePreference: theme });
                }}
              >
                {state.theme === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </Icon>
              <Icon label="Settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={18} />
              </Icon>
            </div>
          </header>
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
          <nav aria-label="Task sectors">
            {state.tabs.map((t) => {
              const count = `${t.tasks.filter((x) => x.status === "completed").length}/${t.tasks.length}`;
              return (
                <div
                  className={`tab ${tab?.id === t.id ? "selected" : ""}`}
                  key={t.id}
                  title={`Last operated: ${new Date(t.lastOperatedAt).toLocaleString()}`}
                >
                  {rename === t.id ? (
                    <input
                      autoFocus
                      aria-label="Rename tab"
                      defaultValue={t.name}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRename(null);
                        if (e.key === "Enter") {
                          try {
                            const next = transition(state, {
                              type: "tab-rename",
                              id: t.id,
                              name: e.currentTarget.value,
                            });
                            if (commit(next)) setRename(null);
                          } catch (err) {
                            setInlineError(String(err));
                          }
                        }
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => switchTab(t.id)}
                      onDoubleClick={() => setRename(t.id)}
                    >
                      <span className="tab-name">{t.name}</span>
                      <span className="tab-count">{count}</span>
                    </button>
                  )}
                  <Icon
                    label={`Delete ${t.name}`}
                    onClick={() => setConfirmTab(t.id)}
                  >
                    <X size={13} />
                  </Icon>
                </div>
              );
            })}
            <Icon label="Add tab" onClick={() => setTabDraft("")}>
              <Plus size={16} />
            </Icon>
          </nav>
          {tabDraft !== null && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const next = transition(state, {
                    type: "tab-add",
                    name: tabDraft,
                  });
                  if (commit(next)) setTabDraft(null);
                } catch (err) {
                  setInlineError(String(err));
                }
              }}
            >
              <input
                autoFocus
                aria-label="New tab name"
                placeholder="Name your space"
                value={tabDraft}
                onChange={(e) => setTabDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setTabDraft(null);
                }}
              />
              <button>Add tab</button>
            </form>
          )}
          {inlineError && (
            <p role="alert" className="error">
              {inlineError}
            </p>
          )}
          {tab ? (
            <>
              <form
                className="add-task"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  try {
                    const next = transition(state, {
                      type: "task-add",
                      tabId: tab.id,
                      title: draft,
                    });
                    if (commit(next)) {
                      setDraft("");
                      setAiRequest(null);
                      setInlineError("");
                    }
                  } catch (err) {
                    setInlineError(String(err));
                  }
                }}
              >
                <input
                  ref={taskInput}
                  aria-label="New task"
                  placeholder="What's one small thing you can do?"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (aiRequest) setAiRequest(null);
                  }}
                />
                <button type="submit">ADD ↵</button>
                <button
                  type="button"
                  className="ai"
                  title={
                    aiAvailable === true
                      ? AI_AVAILABLE_TOOLTIP
                      : AI_UNAVAILABLE_TOOLTIP
                  }
                  aria-label="Breakdown tasks using AI"
                  aria-disabled={aiAvailable === true ? "false" : "true"}
                  onClick={requestAiBreakdown}
                >
                  <Sparkles size={17} />
                </button>
              </form>
              {aiRequest && !imported && (
                <AiComposer
                  key={`${tab.id}-${aiRequest.id}`}
                  goal={aiRequest.goal}
                  onCancel={() => setAiRequest(null)}
                  onAdd={(batch) => {
                    if (error || !current.current) return false;
                    try {
                      const next = transition(current.current, {
                        type: "task-add-batch",
                        tabId: tab.id,
                        tasks: batch.tasks,
                      });
                      if (!commit(next)) return false;
                      setDraft("");
                      setMessages((v) => [
                        ...v,
                        `Created ${batch.tasks.length} tasks. ${batch.scopeNote}`,
                      ]);
                      return true;
                    } catch (e) {
                      setInlineError(String(e));
                      return false;
                    }
                  }}
                />
              )}
              <div className="task-list" role="region" aria-label="Tasks">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!over || active.id === over.id) return;
                    const ids = tab.tasks.map((t) => t.id);
                    act({
                      type: "task-reorder",
                      tabId: tab.id,
                      ids: arrayMove(
                        ids,
                        ids.indexOf(String(active.id)),
                        ids.indexOf(String(over.id)),
                      ),
                    });
                  }}
                >
                  <SortableContext
                    items={tab.tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tab.tasks.map((task) => (
                      <TaskRow
                        key={`${tab.id}-${task.id}`}
                        task={task}
                        now={clock}
                        disabled={!!error}
                        onAction={(a) =>
                          act({ ...a, tabId: tab.id, id: task.id })
                        }
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {!tab.tasks.length && (
                  <div className="empty">
                    <span>✳</span>
                    <h3>A fresh little start.</h3>
                    <p>No tasks yet. Add one small step.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty">
              <span>✳</span>
              <h2>Make space for your next win.</h2>
              <button
                onClick={() => act({ type: "tab-add", name: "My Tasks" })}
              >
                + Start work
              </button>
            </div>
          )}
          <footer>
            <span>One thing at a time. You’ve got this.</span>
            <span>Saved on this device</span>
          </footer>
        </section>
      )}
      <aside className="toasts" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i}>
            {m}
            <Icon
              label="Dismiss alert"
              onClick={() => setMessages((v) => v.filter((_, j) => j !== i))}
            >
              <X size={16} />
            </Icon>
          </div>
        ))}
      </aside>
      {(confirmTab || imported) && (
        <div className="overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setConfirmTab(null);
                setImported(null);
              }
              if (e.key === "Tab") {
                const items =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <h2 id="dialog-title">
              {imported ? "Replace local data?" : "Delete this tab?"}
            </h2>
            <p>
              {imported
                ? `Import ${imported.tabs.length} tabs and ${imported.tabs.reduce((n, t) => n + t.tasks.length, 0)} tasks. This replaces all current data.`
                : "This permanently deletes the tab and every task inside it."}
            </p>
            <button
              autoFocus
              onClick={() => {
                setConfirmTab(null);
                setImported(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setConfirmTab(null);
                  setImported(null);
                }
              }}
            >
              Cancel
            </button>
            <button
              className="danger"
              onClick={() => {
                if (imported) {
                  if (commit(imported)) {
                    setImported(null);
                    setReady(true);
                    setDraft("");
                    setRename(null);
                    setMessages([]);
                  }
                } else {
                  act({ type: "tab-delete", id: confirmTab });
                  setConfirmTab(null);
                }
              }}
            >
              Confirm
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
function TaskRow({
  task,
  now,
  onAction,
  disabled,
}: {
  task: Task;
  now: number;
  onAction: (a: any) => boolean;
  disabled: boolean;
}) {
  const [edit, setEdit] = useState<"title" | "duration" | null>(null),
    [value, setValue] = useState(""),
    [err, setErr] = useState(""),
    [deadline, setDeadline] = useState(0);
  const running = task.status === "running",
    done = task.status === "completed";
  const sortable = useSortable({ id: task.id, disabled: running || disabled });
  const elapsed = elapsedAt(task, now);
  const phase = phaseAt(task, now);
  const editing = edit !== null;
  useEffect(() => {
    if (running) setEdit(null);
  }, [running]);
  function begin(field: "title" | "duration") {
    setValue(field === "title" ? task.title : `${task.plannedMs / 60000}m`);
    setErr("");
    setEdit(field);
  }
  return (
    <article
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      data-status={task.status}
      data-task-id={task.id}
      className={`task ${phase} ${done ? "completed" : ""}`}
    >
      <div
        className="fill"
        style={{
          width: done
            ? "100%"
            : `${Math.min(100, (elapsed / task.plannedMs) * 100)}%`,
        }}
      />
      {!editing && (
        <button
          className="icon drag"
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={running || disabled}
          title="Drag task"
          aria-label={`Reorder ${task.title}`}
        >
          <GripVertical size={18} />
        </button>
      )}
      <div className="task-content">
        {edit ? (
          <input
            autoFocus
            aria-label={`Edit ${edit}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEdit(null);
                setErr("");
              }
              if (e.key === "Enter") {
                try {
                  const plannedMs =
                    edit === "duration" ? parseDuration(value) : undefined;
                  if (
                    onAction({
                      type: "task-edit",
                      ...(edit === "title" ? { title: value } : { plannedMs }),
                    })
                  )
                    setEdit(null);
                } catch (e) {
                  setErr(String(e));
                }
              }
            }}
          />
        ) : (
          <>
            <button
              className="task-title"
              disabled={running || disabled}
              onClick={() => begin("title")}
            >
              {task.title}
            </button>
            <div className="metadata">
              <span>
                {done ? "Done" : running ? "Running" : "Paused"} ·{" "}
                {time(elapsed)}
              </span>
              <button
                disabled={running || disabled}
                title="Edit planned duration"
                onClick={() => begin("duration")}
              >
                {" "}
                / {task.plannedMs / 60000}m <Pencil size={10} />
              </button>
              {phase === "overtime" && !done && (
                <strong>Overtime +{time(elapsed - task.plannedMs)}</strong>
              )}
              {done && task.completedAt && (
                <span title={new Date(task.completedAt).toLocaleString()}>
                  {" "}
                  · Done {new Date(task.completedAt).toLocaleDateString()}
                </span>
              )}
              <span title={new Date(task.createdAt).toLocaleString()}>
                {" "}
                · Created{" "}
                {new Date(task.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </>
        )}
        {err && <small role="alert">{err}</small>}
      </div>
      {!editing && (
        <>
          <Icon
            label={`Finish ${task.title}`}
            disabled={done || disabled}
            onClick={() => onAction({ type: "task-finish" })}
          >
            <Check size={20} />
          </Icon>
          <Icon
            label={`${running ? "Pause" : "Start"} ${task.title}`}
            disabled={done || disabled}
            onClick={() => onAction({ type: "task-toggle" })}
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
          </Icon>
          <Icon
            className="task-delete"
            label={
              deadline > now
                ? `Confirm delete ${task.title}`
                : `Delete ${task.title}`
            }
            disabled={disabled}
            onClick={() => {
              if (deadline > Date.now()) {
                onAction({ type: "task-delete" });
                setDeadline(0);
              } else setDeadline(Date.now() + 20000);
            }}
          >
            {deadline > now ? (
              <AlertTriangle color="#bc8400" size={16} />
            ) : (
              <Trash2 size={15} />
            )}
          </Icon>
        </>
      )}
    </article>
  );
}
