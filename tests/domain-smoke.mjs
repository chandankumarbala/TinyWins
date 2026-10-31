import assert from "node:assert/strict";
import {
  initialState,
  transition,
  parseDuration,
  elapsedAt,
  phaseAt,
  evaluateAlerts,
} from "../src/domain.ts";
let state = initialState();
const tabId = state.selectedTabId;
const apply = (action, now = 1000) => (state = transition(state, action, now));
for (const [s, n] of [
  ["30", 1800000],
  ["30m", 1800000],
  ["30 min", 1800000],
  ["1h", 3600000],
  ["1.5h", 5400000],
  ["2 hours", 7200000],
])
  assert.equal(parseDuration(s), n);
for (const s of ["0", "-1", "hello", "Infinity"])
  assert.throws(() => parseDuration(s));
apply({ type: "task-add", tabId, title: "Focus" });
const id = state.tabs[0].tasks[0].id;
assert.throws(() => apply({ type: "task-add", tabId, title: " focus " }));
apply({ type: "task-edit", tabId, id, plannedMs: 1000000 });
apply({ type: "task-toggle", tabId, id }, 1000);
assert.equal(elapsedAt(state.tabs[0].tasks[0], 501000), 500000);
assert.equal(phaseAt(state.tabs[0].tasks[0], 501000), "yellow");
let alert = evaluateAlerts(state, 501000);
assert.equal(alert.alerts.length, 1);
state = alert.state;
assert.equal(evaluateAlerts(state, 501001).alerts.length, 0);
apply({ type: "task-toggle", tabId, id }, 601000);
assert.equal(elapsedAt(state.tabs[0].tasks[0], 900000), 600000);
apply({ type: "task-toggle", tabId, id }, 1000000);
apply({ type: "task-finish", tabId, id }, 1100000);
assert.equal(elapsedAt(state.tabs[0].tasks[0], 9999999), 700000);
apply({ type: "tab-delete", id: tabId });
assert.equal(state.tabs.length, 0);
apply({ type: "tab-add", name: "My Tasks" });
assert.equal(state.tabs.length, 1);
console.log(
  "Passed: duration formats, validation, duplicate names, active time, alert deduplication, pause/resume, completion freeze, zero-tab recovery.",
);
