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
  await expect(page.getByRole("heading", { name: "My Tasks" })).toBeVisible();
});
