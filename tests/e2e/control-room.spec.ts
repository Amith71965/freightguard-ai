import { expect, test } from "@playwright/test";

test("loads isolated exception scenarios and switches shipment detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Keep exceptions from becoming failures." })).toBeVisible();
  await expect(page.getByText("4 active loads")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FG-28471" })).toBeVisible();

  await page.getByRole("button", { name: /FG-39204/ }).click();
  await expect(page.getByRole("heading", { name: "FG-39204" })).toBeVisible();
  await expect(page.getByText("Damage risk", { exact: true })).toHaveCount(2);
});

test("explains call setup when Retell credentials are absent", async ({ page }) => {
  await page.goto("/");
  const callButton = page.getByRole("button", { name: "Start dispatch call" });
  await expect(callButton).toBeDisabled();
  await expect(page.getByText("Add Retell public credentials to enable calls.")).toBeVisible();
});

test("resets mutated scenarios to their seeded state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("4 active loads")).toBeVisible();
  await page.getByRole("button", { name: "Reset scenarios" }).click();
  await expect(page.getByText("4 active loads")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FG-28471" })).toBeVisible();
});
