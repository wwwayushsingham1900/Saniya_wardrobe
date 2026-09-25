import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const theme of ["light", "dark"])
  test(`${theme} overview has no WCAG A/AA violations`, async ({
    page,
  }, info) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Hello, Sania." }),
    ).toBeVisible();
    if (theme === "dark") {
      const menu = page.getByRole("button", { name: "Open navigation" });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole("button", { name: "Dark appearance", exact: true })
        .click();
      if (await menu.isVisible())
        await page.getByRole("button", { name: "Close navigation" }).click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await page.screenshot({
      path: `/tmp/wardrobe-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
