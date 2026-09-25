import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
async function nav(page: import("@playwright/test").Page, label: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
test("demo preserves progress and linked products across reloads", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Hello, Sania." }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Mark Brown complete", exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Mark Brown pending", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Paste a link" }).click();
  await page
    .getByLabel("Product links")
    .fill("https://www.hm.com/product/brown-shirt?utm_source=test");
  await page.getByLabel("Match to an existing need").selectOption("main0-0");
  await page.getByRole("button", { name: "Save to wardrobe" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "View product" }),
  ).toHaveAttribute("href", "https://www.hm.com/product/brown-shirt");
  await expect(page.locator(".stat-card").first()).toContainText("14");
});
test("creates a category, edits a piece and records spending", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New category", exact: true }).click();
  await page.getByLabel("Category name").fill("Weekend favourites");
  await page.getByRole("button", { name: "Create category" }).click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item name").fill("Olive linen shirt");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Weekend favourites" });
  await page.getByLabel("Record a purchase").check();
  await page.getByLabel("Amount actually paid").fill("1499");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Mark Olive linen shirt pending" }),
  ).toBeChecked();
  await nav(page, "Budget");
  await expect(page.locator(".purchase-list")).toContainText("₹1,499");
});
test("wishlist, search and mobile layout work", async ({ page }) => {
  await nav(page, "Wishlist");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item name").fill("Dream sneakers");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("textbox", { name: "Search wardrobe" }).fill("Dream");
  await expect(
    page.getByRole("button", { name: "Dream sneakers", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
});
test("private notes require an account and invalid input stays in dialog", async ({
  page,
}) => {
  await nav(page, "Private space");
  await expect(
    page.getByText("Private notes use account access controls."),
  ).toBeVisible();
  await nav(page, "Overview");
  await page.getByRole("button", { name: "Paste a link" }).click();
  await page.getByLabel("Product links").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save to wardrobe" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid");
});
