import { test, expect } from "@playwright/test";
test("one-handed navigation and quick add work on narrow phones", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone workflow");
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });
  await expect(navigation).toBeVisible();
  await navigation
    .getByRole("button", { name: "Checklist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your wardrobe checklist." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quick add item" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const bounds = await sheet.boundingBox();
  expect(Math.abs(bounds!.y + bounds!.height - 780)).toBeLessThan(3);
  await page.getByLabel("Item name").fill("Soft everyday tee");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Mark Soft everyday tee complete" }),
  ).toBeVisible();
  await navigation.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little wishful thinking." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
