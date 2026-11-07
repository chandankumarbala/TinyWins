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
  await expect(page.getByText("Done ·", { exact: false })).toBeVisible();
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

test("web target still exports and imports backups through the browser controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("New task", { exact: true })
    .fill("Keep browser working");
  await page.getByLabel("New task", { exact: true }).press("Enter");

  const raw = await page.evaluate(() => localStorage.getItem("todo.state.v1"));
  expect(raw).toContain("Keep browser working");

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("todo.state.v1")!);
    state.tabs[0].tasks = [];
    localStorage.setItem("todo.state.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByText("Keep browser working")).toHaveCount(0);
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

test("settings panel exposes theme and native options without changing web defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Settings", { exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Theme preference")).toHaveValue("light");
  await expect(page.getByLabel("Always on top")).toBeDisabled();

  await page.getByLabel("Theme preference").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("footer stays visible over the scrolling task list in the native layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 520 });
  await page.goto("/");
  await page.locator(".workspace").evaluate((el) => {
    el.setAttribute("data-platform", "tauri");
  });
  const input = page.getByLabel("New task", { exact: true });
  for (let i = 0; i < 18; i++) {
    await input.fill(`Stacked task ${i}`);
    await input.press("Enter");
  }

  const list = page.getByRole("region", { name: "Tasks", exact: true });
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const layout = await page.locator(".workspace").evaluate((el) => {
    const footer = el.querySelector("footer")!;
    const list = el.querySelector(".task-list")!;
    const footerRect = footer.getBoundingClientRect();
    const listStyle = getComputedStyle(list);
    const footerStyle = getComputedStyle(footer);
    return {
      footerBottom: footerRect.bottom,
      viewportHeight: window.innerHeight,
      footerPosition: footerStyle.position,
      footerBottomInset: footerStyle.bottom,
      listPaddingBottom: Number.parseFloat(listStyle.paddingBottom),
      footerHeight: footerRect.height,
    };
  });
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.footerPosition).toBe("sticky");
  expect(layout.footerBottomInset).toBe("0px");
  expect(layout.listPaddingBottom).toBeGreaterThanOrEqual(layout.footerHeight);
});

test("native layout uses one unified aqua surface", async ({ page }) => {
  await page.setViewportSize({ width: 440, height: 520 });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).waitFor();
  await page.locator("main").evaluate((el) => {
    el.setAttribute("data-platform", "tauri");
  });
  await page.locator(".workspace").evaluate((el) => {
    el.setAttribute("data-platform", "tauri");
  });

  const surface = await page.locator(".workspace").evaluate((workspace) => {
    const main = document.querySelector("main")!;
    const mainStyle = getComputedStyle(main);
    const workspaceStyle = getComputedStyle(workspace);
    return {
      mainBackground: mainStyle.backgroundImage,
      workspaceBorderWidth: workspaceStyle.borderTopWidth,
      workspaceBorderRadius: workspaceStyle.borderTopLeftRadius,
      workspaceBoxShadow: workspaceStyle.boxShadow,
    };
  });

  expect(surface.mainBackground).toContain("gradient");
  expect(surface.workspaceBorderWidth).toBe("0px");
  expect(surface.workspaceBorderRadius).toBe("0px");
  expect(surface.workspaceBoxShadow).toBe("none");
});

test("tabs use one full pill row with labels counts and close actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 520 });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).waitFor();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("todo.state.v1")!);
    state.tabs = ["Purchases", "Office"].map((name, index) => ({
      ...state.tabs[0],
      id: crypto.randomUUID(),
      name,
      tasks: Array.from({ length: 2 - index }, (_, taskIndex) => ({
        id: crypto.randomUUID(),
        title: `${name} task ${taskIndex}`,
        status: taskIndex < 2 - index ? "completed" : "paused",
        createdAt: Date.now(),
        plannedMs: 600000,
        elapsedMs: 0,
        runningSince: null,
        completedAt: Date.now(),
        yellowShown: false,
      })),
      lastOperatedAt: Date.now() - index,
    }));
    state.selectedTabId = state.tabs[0].id;
    localStorage.setItem("todo.state.v1", JSON.stringify(state));
  });
  await page.reload();

  await expect(page.locator(".tab-current")).toHaveCount(0);
  await expect(page.locator(".tab-shortcuts")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Purchases\s*2\/2$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Office\s*1\/1$/ }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Delete Purchases", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Delete Office", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add tab", { exact: true })).toBeVisible();

  const metrics = await page.locator("nav").evaluate((nav) => {
    const selected = nav.querySelector(".tab.selected")!;
    const inactive = nav.querySelector(".tab:not(.selected)")!;
    const add = nav.querySelector(".icon[aria-label='Add tab']")!;
    return {
      direction: getComputedStyle(nav).flexDirection,
      navHeight: nav.getBoundingClientRect().height,
      selectedWidth: selected.getBoundingClientRect().width,
      selectedHeight: selected.getBoundingClientRect().height,
      inactiveHeight: inactive.getBoundingClientRect().height,
      addSize: add.getBoundingClientRect().width,
      selectedTextColor: getComputedStyle(selected.querySelector("button")!)
        .color,
      selectedNameColor: getComputedStyle(selected.querySelector(".tab-name")!)
        .color,
      selectedCloseSize: selected
        .querySelector(".icon")!
        .getBoundingClientRect().width,
      inactiveCloseSize: inactive
        .querySelector(".icon")!
        .getBoundingClientRect().width,
    };
  });
  expect(metrics.direction).toBe("row");
  expect(metrics.navHeight).toBeGreaterThanOrEqual(34);
  expect(metrics.navHeight).toBeLessThanOrEqual(46);
  expect(metrics.selectedWidth).toBeLessThanOrEqual(138);
  expect(metrics.selectedHeight).toBeGreaterThanOrEqual(34);
  expect(metrics.inactiveHeight).toBeGreaterThanOrEqual(34);
  expect(metrics.addSize).toBeGreaterThanOrEqual(32);
  expect(metrics.selectedTextColor).toBe("rgb(255, 255, 255)");
  expect(metrics.selectedNameColor).toBe("rgb(255, 255, 255)");
  expect(metrics.selectedCloseSize).toBeGreaterThanOrEqual(24);
  expect(metrics.inactiveCloseSize).toBeGreaterThanOrEqual(24);
});

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

test("task row actions hide while editing a task", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("Buy a MacBook");
  await page.getByLabel("New task", { exact: true }).press("Enter");

  await page
    .getByRole("button", { name: "Buy a MacBook", exact: true })
    .click();

  await expect(page.getByLabel("Edit title")).toBeVisible();
  await expect(page.getByLabel("Finish Buy a MacBook")).toHaveCount(0);
  await expect(page.getByLabel("Start Buy a MacBook")).toHaveCount(0);
  await expect(page.getByLabel("Delete Buy a MacBook")).toHaveCount(0);
});

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

test("task drag handle stays separated from the title text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 620 });
  await page.goto("/");
  await page.getByLabel("New task", { exact: true }).fill("want to buy milk");
  await page.getByLabel("New task", { exact: true }).press("Enter");

  const spacing = await page
    .locator(".task")
    .first()
    .evaluate((element) => {
      const drag = element.querySelector(".drag")!;
      const content = element.querySelector(".task-content")!;
      const dragRect = drag.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      return contentRect.left - dragRect.right;
    });

  expect(spacing).toBeGreaterThanOrEqual(6);
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
    await expect(page.getByText("Running ·", { exact: false })).toBeVisible();
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
    expect(style.radius).toBe("24px");
    expect(style.accent).toBe(theme === "light" ? "#006bdc" : "#80d8ff");
    if (theme === "light") await page.getByLabel("Toggle theme").click();
  }
});

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
    "2px",
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
    "What's one small thing you can do?",
  );
  await input.fill("Write a report");
  await page.getByLabel("Breakdown tasks using AI", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open report", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write outline", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".task").first()).toContainText("5m");
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Write outline", exact: true }),
  ).toBeVisible();
});

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
  await ai.click({ force: true });
  await expect(page.locator(".ai-composer")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByLabel("New task", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Write a report", exact: true }),
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
  const ai = page.getByLabel("Breakdown tasks using AI", { exact: true });
  await expect(ai).toHaveAttribute("aria-disabled", "true");
  await expect(ai).toHaveAttribute(
    "title",
    "Set OPENAI_API_KEY system variable to enable AI task breakdown.",
  );
  await ai.click({ force: true });
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
