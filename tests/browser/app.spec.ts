import { test, expect } from "@playwright/test";
test("create, run, complete and restore a task", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("One small step");
  await page.getByLabel("New task", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "One small step", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Start One small step", { exact: true }).click();
  await expect(
    page.getByLabel("Pause One small step", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Finish One small step", { exact: true }).click();
  await page.reload();
  await expect(page.getByText("Completed ·", { exact: false })).toBeVisible();
});
test("delete the last tab and recreate it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Delete My Tasks", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "+ Start work" }).click();
  await expect(
    page.getByRole("button", { name: /^My Tasks\s*0\/0$/ }),
  ).toBeVisible();
});

test("compact header, scrolling and theme persistence", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tiny Wins", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Small steps. Real progress.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Make room for one thing at a time."),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "My Tasks" })).toHaveCount(0);
  await expect(page.getByLabel("Rename My Tasks")).toHaveCount(0);
  await page.getByRole("button", { name: /^My Tasks\s*0\/0$/ }).dblclick();
  await page.getByLabel("Rename tab").fill("Focus");
  await page.getByLabel("Rename tab").press("Enter");
  await expect(
    page.getByRole("button", { name: /^Focus\s*0\/0$/ }),
  ).toBeVisible();
  const input = page.getByLabel("New task", { exact: true });
  for (let i = 0; i < 14; i++) {
    await input.fill(`Small step ${i}`);
    await input.press("Enter");
  }
  const list = page.getByRole("region", { name: "Tasks", exact: true });
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  const box = await input.boundingBox();
  expect(box!.y).toBeLessThan(220);
  await page.getByLabel("Toggle theme").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(input).toBeVisible();
});

test("task states stay explicit in both themes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).waitFor();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("todo.state.v1")!);
    const now = Date.now();
    state.tabs[0].tasks = [
      "Running",
      "Yellow",
      "Red",
      "Overtime",
      "Completed",
    ].map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      status: i === 0 ? "running" : i === 4 ? "completed" : "paused",
      createdAt: now - 100000,
      plannedMs: 100000,
      elapsedMs: [0, 60000, 90000, 110000, 40000][i],
      runningSince: i === 0 ? now : null,
      completedAt: i === 4 ? now : null,
      yellowShown: false,
    }));
    localStorage.setItem("todo.state.v1", JSON.stringify(state));
  });
  await page.reload();
  for (const theme of ["light", "dark"]) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const phase of ["yellow", "red", "overtime", "completed"])
      await expect(page.locator(`.task.${phase}`)).toBeVisible();
    await expect(page.getByText("In focus ·", { exact: false })).toBeVisible();
    await page.getByLabel("Delete Yellow", { exact: true }).click();
    await expect(
      page.getByLabel("Confirm delete Yellow", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-states.png`) });
    if (theme === "light") {
      await page.getByLabel("Toggle theme").click();
      await page.reload();
    }
  }
});

test("aqua glass styling survives theme changes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).waitFor();
  for (const theme of ["light", "dark"]) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const style = await page.locator(".workspace").evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        blur: css.backdropFilter,
        background: css.backgroundImage,
        radius: css.borderRadius,
        accent: getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim(),
      };
    });
    expect(style.blur).toContain("blur(22px)");
    expect(style.blur).toContain("saturate");
    expect(style.background).toContain("gradient");
    expect(style.radius).toBe("30px");
    expect(style.accent).toBe(theme === "light" ? "#006bdc" : "#80d8ff");
    if (theme === "light") await page.getByLabel("Toggle theme").click();
  }
});

test("one frosted workspace contains all task controls", async ({ page }) => {
  await page.goto("/");
  const workspace = page.locator(".workspace");
  await expect(workspace.locator("header .brand")).toContainText("Tiny Wins");
  await expect(page.locator("main > header")).toHaveCount(0);
  await expect(
    workspace.getByRole("navigation", { name: "Task sectors" }),
  ).toBeVisible();
  await expect(workspace.getByLabel("New task", { exact: true })).toBeVisible();
  const chrome = await workspace.evaluate((el) => ({
    navBorder: getComputedStyle(el.querySelector("nav")!).borderBottomWidth,
    footerBorder: getComputedStyle(el.querySelector("footer")!).borderTopWidth,
    brandDisplay: getComputedStyle(el.querySelector(".brand")!).display,
  }));
  expect(chrome.navBorder).toBe("0px");
  expect(chrome.footerBorder).toBe("0px");
  // Flex items are blockified by the browser, so inline-flex computes to flex.
  expect(chrome.brandDisplay).toBe("flex");
  await workspace.getByLabel("New task", { exact: true }).fill("Focus on this");
  await workspace.getByLabel("New task", { exact: true }).press("Enter");
  await workspace.getByLabel("Start Focus on this", { exact: true }).click();
  const row = workspace.locator('.task[data-status="running"]');
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe(
    "4px",
  );
});

test("Tiny Wins brand mark and favicon load", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Tiny Wins — Small steps. Real progress.");
  await expect(
    page.getByRole("heading", { name: "Tiny Wins", exact: true }),
  ).toBeVisible();
  const logo = page.locator(".brand-mark");
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/tiny-wins.svg",
  );
});

test("AI creates estimated tasks in order without exposing tab data", async ({
  page,
}) => {
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/ai/breakdown", async (r) => {
    expect(r.request().postDataJSON()).toEqual({ goal: "Write a report" });
    await r.fulfill({
      json: {
        tasks: [
          { title: "Open report", estimatedMinutes: 5 },
          { title: "Write outline", estimatedMinutes: 10 },
        ],
        scopeNote: "",
      },
    });
  });
  await page.goto("/");
  const input = page.getByLabel("New task", { exact: true });
  await expect(input).toHaveAttribute(
    "placeholder",
    "What's one small thing you can do? or Use AI to breakdown a topic to tasks",
  );
  await input.fill("Write a report");
  await page.getByLabel("Breakdown tasks using AI", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open report", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write outline", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".task").first()).toContainText("5 min");
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Write outline", exact: true }),
  ).toBeVisible();
});

test("AI generate remains retryable after helper status recovers", async ({
  page,
}) => {
  let statusCalls = 0;
  await page.route("**/api/ai/status", (r) => {
    statusCalls += 1;
    return r.fulfill({ json: { available: statusCalls >= 2 } });
  });
  await page.route("**/api/ai/breakdown", async (r) => {
    expect(r.request().postDataJSON()).toEqual({ goal: "Clean desk" });
    await r.fulfill({
      json: {
        tasks: [{ title: "Clear desktop", estimatedMinutes: 10 }],
        scopeNote: "",
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("Clean desk");
  await page.getByLabel("Breakdown tasks using AI", { exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("OPENAI_API_KEY");
  await page.getByLabel("Breakdown tasks using AI", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear desktop", exact: true }),
  ).toBeVisible();
});

test("empty AI click does not create tasks", async ({ page }) => {
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.goto("/");
  await page.getByLabel("Breakdown tasks using AI", { exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter a topic or task to break down with AI.",
  );
  await expect(page.locator(".task")).toHaveCount(0);
});
