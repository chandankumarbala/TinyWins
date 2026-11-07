# Stage 3 UI Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Stage 3 compact aqua-glass UI polish while preserving existing Tiny Wins behavior.

**Architecture:** Keep the current React app structure and domain model intact. Make small `App.tsx` markup/state changes only where visual affordances require them, and put the bulk of visual work in `src/style.css`; rely on the existing `/api/ai/status` endpoint for AI availability instead of adding a new backend contract.

**Tech Stack:** React 19, TypeScript, Vite, lucide-react, Playwright, Vitest, Express local AI helper.

**Spec:** `docs/superpowers/specs/2026-11-08-stage-3-ui-visualization-requirements.md`

## Global Constraints

- These requirements describe appearance, density, and presentation only.
- Do not change domain logic.
- Do not change persistence or state shape.
- Do not change delete confirmation behavior.
- Do not change AI request behavior, limits, prompts, provider calls, or fallback behavior.
- Do not change tab creation, tab deletion, tab rename, task creation, task edit, task reorder, task finish, task pause/start, import/export, settings, notifications, or timer rules.
- Do not adopt any preview-only explanatory content into the app.
- The AI assist control depends on the `OPENAI_API_KEY` system/environment variable.
- Do not expose, persist, or log the OpenAI key in the client UI.
- Manual task creation must remain fully available when AI is disabled.
- Existing tests for task creation, AI breakdown, tab behavior, footer visibility, task editing, and delete confirmation continue to pass or are updated only for visual/accessibility label changes.
- No state migration is required.
- No backend, provider, or native shell behavior changes are included.

---

## File Structure

- Modify `src/App.tsx`: add AI availability state, remove the composer leading plus icon, render the AI assist as an icon-only control with disabled tooltip semantics, add task action classes, and make task metadata more compact.
- Modify `src/style.css`: apply compact Stage 3 visual tokens, composer density, task row density, subtle delete button styling, compact metadata, footer reserved-scroll behavior, light/dark parity, and responsive adjustments.
- Modify `tests/browser/app.spec.ts`: update visual/accessibility expectations for the Stage 3 composer, AI availability, compact task rows, subtle delete button, metadata, and unchanged editing/action behavior.
- Modify `README.md`: update UI wording for the icon-only AI control and `OPENAI_API_KEY` availability, without changing functional claims.

---

### Task 1: AI Availability State And Disabled Tooltip

**Files:**
- Modify: `src/App.tsx`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: existing `/api/ai/status` response shape `{ available: boolean }`.
- Produces: `aiAvailable: boolean | null` local state in `App`, and constant `AI_UNAVAILABLE_TOOLTIP = "Set OPENAI_API_KEY system variable to enable AI task breakdown."`.

- [ ] **Step 1: Add failing browser test for missing AI key**

Add this test near the existing AI browser tests in `tests/browser/app.spec.ts`:

```ts
test("AI assist is disabled with setup tooltip when OPENAI_API_KEY is missing", async ({
  page,
}) => {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { available: false } }),
  );
  await page.goto("/");

  const ai = page.getByLabel("Breakdown tasks using AI", { exact: true });
  await expect(ai).toBeVisible();
  await expect(ai).toHaveAttribute("aria-disabled", "true");
  await expect(ai).toHaveAttribute(
    "title",
    "Set OPENAI_API_KEY system variable to enable AI task breakdown.",
  );

  await page.getByLabel("New task", { exact: true }).fill("Write a report");
  await ai.click();
  await expect(page.locator(".ai-composer")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByLabel("New task", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Write a report", exact: true }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "AI assist is disabled"`

Expected: FAIL because the AI button does not yet expose `aria-disabled="true"` or the new tooltip.

- [ ] **Step 3: Add AI availability state in `App`**

In `src/App.tsx`, add constants near the `time` helper:

```ts
const AI_UNAVAILABLE_TOOLTIP =
  "Set OPENAI_API_KEY system variable to enable AI task breakdown.";
const AI_AVAILABLE_TOOLTIP = "Breakdown tasks using AI";
```

Add local state inside `App` next to `aiRequest`:

```ts
const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
```

Add this effect after the existing initialization effects:

```ts
useEffect(() => {
  if (!ready) return;
  const controller = new AbortController();
  void fetch("/api/ai/status", { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error("status unavailable");
      return response.json() as Promise<{ available?: boolean }>;
    })
    .then((status) => setAiAvailable(status.available === true))
    .catch(() => {
      if (!controller.signal.aborted) setAiAvailable(false);
    });
  return () => controller.abort();
}, [ready]);
```

Update `requestAiBreakdown` before reading the goal:

```ts
if (aiAvailable !== true) return;
```

- [ ] **Step 4: Run test to verify it still fails on markup**

Run: `npm run test:e2e -- --grep "AI assist is disabled"`

Expected: FAIL because the button markup has not yet set `aria-disabled` and the disabled tooltip.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/browser/app.spec.ts
git commit -m "Plan stage 3 AI availability gate"
```

Commit only if the user has approved committing in this session.

---

### Task 2: Stage 3 Composer Markup

**Files:**
- Modify: `src/App.tsx`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `aiAvailable`, `AI_UNAVAILABLE_TOOLTIP`, and `AI_AVAILABLE_TOOLTIP` from Task 1.
- Produces: composer markup with no leading plus icon, manual add button unchanged, and icon-only AI assist with `aria-disabled`.

- [ ] **Step 1: Add failing test for composer visual contract**

Add this test near the tab/footer visual tests in `tests/browser/app.spec.ts`:

```ts
test("stage 3 composer keeps manual add primary and AI icon secondary", async ({
  page,
}) => {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.goto("/");

  const composer = page.locator(".add-task");
  await expect(composer.locator("> svg")).toHaveCount(0);
  await expect(composer.getByLabel("New task", { exact: true })).toBeVisible();
  await expect(
    composer.getByRole("button", { name: "ADD ↵", exact: true }),
  ).toBeVisible();

  const ai = composer.getByLabel("Breakdown tasks using AI", { exact: true });
  await expect(ai).toHaveAttribute("aria-disabled", "false");
  await expect(ai).toHaveAttribute("title", "Breakdown tasks using AI");
  await expect(composer).not.toContainText("AI");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "stage 3 composer"`

Expected: FAIL because the composer still renders the leading plus icon and the AI button does not expose the new state attributes.

- [ ] **Step 3: Update composer markup**

In `src/App.tsx`, remove this line from the add-task form:

```tsx
<Plus size={20} />
```

Replace the AI button with:

```tsx
<button
  type="button"
  className="ai"
  title={aiAvailable === true ? AI_AVAILABLE_TOOLTIP : AI_UNAVAILABLE_TOOLTIP}
  aria-label="Breakdown tasks using AI"
  aria-disabled={aiAvailable === true ? "false" : "true"}
  onClick={requestAiBreakdown}
>
  <Sparkles size={17} />
</button>
```

Keep the manual submit button as:

```tsx
<button type="submit">ADD ↵</button>
```

- [ ] **Step 4: Update existing AI tests for placeholder copy**

In `tests/browser/app.spec.ts`, replace the old placeholder expectation:

```ts
"What's one small thing you can do? or Use AI to breakdown a topic to tasks"
```

with:

```ts
"What's one small thing you can do?"
```

Update the input placeholder in `src/App.tsx` to the same string:

```tsx
placeholder="What's one small thing you can do?"
```

- [ ] **Step 5: Run composer and AI browser tests**

Run:

```bash
npm run test:e2e -- --grep "AI|composer"
```

Expected: PASS for the new disabled AI test, the composer visual test, and existing AI creation tests.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx tests/browser/app.spec.ts
git commit -m "Plan stage 3 composer controls"
```

Commit only if the user has approved committing in this session.

---

### Task 3: Compact Aqua Surface, Header, Tabs, Composer, And Footer Styling

**Files:**
- Modify: `src/style.css`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: current class names `.workspace`, `.brand`, `.header-tools`, `.icon`, `nav`, `.tab`, `.add-task`, `.task-list`, and `footer`.
- Produces: denser Stage 3 spacing and quieter glass depth without changing layout ownership.

- [ ] **Step 1: Add failing visual metric test for compact surface**

Add this test near the existing aqua glass tests:

```ts
test("stage 3 compact surface uses denser composer and quieter chrome", async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 620 });
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.goto("/");

  const metrics = await page.locator(".workspace").evaluate((workspace) => {
    const header = workspace.querySelector("header")!;
    const composer = workspace.querySelector(".add-task")!;
    const footer = workspace.querySelector("footer")!;
    const nav = workspace.querySelector("nav")!;
    return {
      headerHeight: header.getBoundingClientRect().height,
      composerHeight: composer.getBoundingClientRect().height,
      navHeight: nav.getBoundingClientRect().height,
      footerHeight: footer.getBoundingClientRect().height,
      shadow: getComputedStyle(workspace).boxShadow,
    };
  });

  expect(metrics.headerHeight).toBeLessThanOrEqual(52);
  expect(metrics.composerHeight).toBeLessThanOrEqual(56);
  expect(metrics.navHeight).toBeLessThanOrEqual(38);
  expect(metrics.footerHeight).toBeLessThanOrEqual(58);
  expect(metrics.shadow).toContain("rgba");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "stage 3 compact surface"`

Expected: FAIL because current Stage 2 sizes are still too tall.

- [ ] **Step 3: Update surface and chrome CSS**

In the final Stage 2 block of `src/style.css`, adjust these selectors:

```css
.workspace {
  border-radius: 24px;
  padding: 20px 18px 0;
  box-shadow:
    0 22px 56px rgba(26, 125, 164, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.workspace > header {
  min-height: 46px;
  margin-bottom: 12px;
}

.brand {
  gap: 9px;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.brand-mark {
  width: 34px;
  height: 34px;
}

.brand h1 {
  font-size: 17px;
  font-weight: 880;
}

.brand p {
  font-size: 11px;
  font-weight: 700;
}

.header-tools {
  gap: 6px;
}

.icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 4: Update tab, composer, list, and footer CSS**

Use these values in `src/style.css`:

```css
nav {
  gap: 7px;
  margin: 0 0 11px;
}

nav > .icon {
  width: 32px;
  height: 32px;
}

.tab {
  min-height: 34px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.tab > button:first-child {
  gap: 7px;
  padding: 8px 10px 8px 12px;
  font-size: 11.5px;
}

.tab-count {
  font-size: 10.5px;
  font-weight: 880;
}

.tab .icon {
  width: 24px;
  height: 24px;
  margin-right: 4px;
}

.add-task {
  gap: 8px;
  min-height: 54px;
  margin: 0 0 12px;
  padding: 8px 9px 8px 10px;
  border-radius: 17px;
  box-shadow:
    0 10px 22px rgba(24, 128, 173, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.84);
}

.add-task input {
  padding: 8px 10px;
  border: 1px solid rgba(43, 134, 169, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.48);
  font-size: 13px;
  font-weight: 620;
}

.add-task > button[type="submit"] {
  padding: 8px 10px;
  border-radius: 11px;
  color: #fff;
  background: var(--selected);
  font-size: 11px;
  font-weight: 900;
}

.add-task .ai {
  display: grid;
  width: 30px;
  height: 30px;
  min-width: 30px;
  place-items: center;
  padding-left: 0;
}

.task-list {
  padding: 0 0 66px;
}

.workspace > footer {
  min-height: 58px;
  padding: 21px 2px 12px;
  font-size: 10.5px;
  font-weight: 750;
}
```

- [ ] **Step 5: Run compact surface and existing tab/footer tests**

Run:

```bash
npm run test:e2e -- --grep "compact surface|footer stays visible|tabs use one full pill"
```

Expected: PASS after changing the existing tab test's add-tab size expectation from `>=36` to `>=32`, because Stage 3 deliberately compacts the add-tab button.

- [ ] **Step 6: Commit**

```bash
git add src/style.css tests/browser/app.spec.ts
git commit -m "Plan stage 3 compact shell styling"
```

Commit only if the user has approved committing in this session.

---

### Task 4: Compact Task Rows, Metadata, And Subtle Delete Button

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/style.css`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: existing `TaskRow` props and existing `Icon` helper.
- Produces: optional `className` support on `Icon`, compact metadata text, `.task-delete` styling hook, and unchanged action behavior.

- [ ] **Step 1: Add failing browser test for Stage 3 task row visuals**

Add this test near the task state tests:

```ts
test("stage 3 task rows are compact and use subtle delete control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 620 });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("Compact row");
  await page.getByLabel("New task", { exact: true }).press("Enter");

  const row = page.locator(".task").first();
  const metrics = await row.evaluate((element) => {
    const deleteButton = element.querySelector(
      ".task-delete",
    ) as HTMLButtonElement;
    const metadata = element.querySelector(".metadata")!;
    return {
      rowHeight: element.getBoundingClientRect().height,
      deleteWidth: deleteButton.getBoundingClientRect().width,
      deleteRadius: getComputedStyle(deleteButton).borderRadius,
      deleteColor: getComputedStyle(deleteButton).color,
      metadataWrap: getComputedStyle(metadata).whiteSpace,
      metadataText: metadata.textContent ?? "",
    };
  });

  expect(metrics.rowHeight).toBeLessThanOrEqual(68);
  expect(metrics.deleteWidth).toBeLessThanOrEqual(30);
  expect(metrics.deleteRadius).toBe("50%");
  expect(metrics.deleteColor).toBe("rgb(23, 73, 95)");
  expect(metrics.metadataWrap).toBe("nowrap");
  expect(metrics.metadataText).toContain("Created");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "stage 3 task rows"`

Expected: FAIL because current rows are taller and the delete button has no `.task-delete` class.

- [ ] **Step 3: Extend `Icon` helper with `className`**

In `src/App.tsx`, update `Icon` signature:

```tsx
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
```

Set delete action class in `TaskRow`:

```tsx
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
```

- [ ] **Step 4: Compact metadata text in `TaskRow`**

Replace the metadata JSX with:

```tsx
<div className="metadata">
  <span>
    {done ? "Done" : running ? "Running" : "Paused"} · {time(elapsed)}
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
    · Created {new Date(task.createdAt).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}
  </span>
</div>
```

- [ ] **Step 5: Apply compact row CSS**

Update `src/style.css`:

```css
.task {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto auto auto;
  gap: 7px;
  min-height: 64px;
  margin: 8px 0;
  padding: 9px 8px;
  border-radius: 16px;
  box-shadow:
    0 8px 18px rgba(25, 122, 162, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.task[data-status="running"] {
  border-left: 2px solid var(--accent);
  box-shadow:
    0 10px 24px rgba(8, 119, 238, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.task-title {
  padding: 0 0 4px;
  font-size: 13.5px;
  font-weight: 800;
  line-height: 1.2;
}

.metadata {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 650;
  line-height: 1.25;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.task .icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.task-delete {
  color: #17495f;
  background: rgba(247, 254, 255, 0.86);
  border-color: rgba(255, 255, 255, 0.82);
}
```

- [ ] **Step 6: Run task row and edit-action tests**

Run:

```bash
npm run test:e2e -- --grep "stage 3 task rows|task row actions hide|task states"
```

Expected: PASS. The existing edit test must continue to verify finish/start/delete controls disappear while editing.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/style.css tests/browser/app.spec.ts
git commit -m "Plan stage 3 compact task rows"
```

Commit only if the user has approved committing in this session.

---

### Task 5: Documentation And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: completed UI and AI availability behavior from Tasks 1-4.
- Produces: user-facing docs that describe visual labels accurately and a complete verification pass.

- [ ] **Step 1: Update README wording**

In `README.md`, replace:

```md
Click AI to open the inline composer.
```

with:

```md
Use the AI sparkle button to generate an inline task breakdown. The AI button is enabled only when the local helper reports `OPENAI_API_KEY`; otherwise it remains visible but disabled with setup guidance. Manual task entry remains available.
```

Keep the rest of the surrounding Phase 2 behavior text unchanged.

- [ ] **Step 2: Update stale visual expectations**

In `tests/browser/app.spec.ts`, update expectations that intentionally changed:

```ts
expect(metrics.addSize).toBeGreaterThanOrEqual(32);
expect(metrics.selectedCloseSize).toBeGreaterThanOrEqual(24);
expect(metrics.inactiveCloseSize).toBeGreaterThanOrEqual(24);
```

Keep these existing assertions unchanged:

```ts
expect(metrics.direction).toBe("row");
expect(metrics.selectedTextColor).toBe("rgb(255, 255, 255)");
expect(metrics.selectedNameColor).toBe("rgb(255, 255, 255)");
```

- [ ] **Step 3: Run static checks**

Run:

```bash
npm run typecheck
npm run lint
npm run format:check
```

Expected: PASS for all three commands.

- [ ] **Step 4: Run deterministic tests**

Run:

```bash
npm test
```

Expected: PASS. No domain tests should require updates because Stage 3 does not change domain behavior.

- [ ] **Step 5: Run browser acceptance tests**

Run:

```bash
npm run test:e2e
```

Expected: PASS. This validates footer visibility, tabs, task editing, AI availability, manual task creation, and unchanged AI generation behavior.

- [ ] **Step 6: Optional visual smoke check**

Run:

```bash
npm run dev
```

Open the printed local URL and confirm:

- Header and app surface read as one aqua surface.
- Tabs remain full pill tabs with labels, counts, and close controls.
- Composer has no leading plus.
- Manual add button remains visible.
- AI is icon-only and disabled when the helper reports missing `OPENAI_API_KEY`.
- Task rows are compact.
- Delete button is subtle by default and warning-colored only in confirmation state.
- Footer remains fully visible while tasks scroll.

- [ ] **Step 7: Commit**

```bash
git add README.md tests/browser/app.spec.ts
git commit -m "Plan stage 3 docs and verification"
```

Commit only if the user has approved committing in this session.

---

## Self-Review

- Spec coverage: covered visual density, header/surface, tabs, composer, AI availability, task rows, task actions, metadata, footer, accessibility constraints, docs, and acceptance criteria.
- Placeholder scan: no banned placeholder markers or unspecified implementation steps remain.
- Type consistency: `aiAvailable`, `AI_UNAVAILABLE_TOOLTIP`, `AI_AVAILABLE_TOOLTIP`, and `Icon` `className?: string` are introduced before later tasks consume them.
- Scope check: plan stays within `App.tsx`, `style.css`, Playwright tests, and README; no backend, domain, storage, native shell, or provider changes are planned.
