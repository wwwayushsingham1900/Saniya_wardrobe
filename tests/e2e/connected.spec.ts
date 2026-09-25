import { test, expect, type Page } from "@playwright/test";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { newRoom } from "../../src/lib/model";

const sharedRoom = "a".repeat(40);

async function register(page: Page, name: string) {
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .first()
    .click();
  await page.getByLabel("Your name").fill(name);
  await page
    .getByLabel("Email address")
    .fill(`${name.toLowerCase()}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Demo-only-Password-928!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("two signed-in accounts keep sharing one room while private clothes stay separate", async ({
  page,
  browser,
}) => {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
  const fixtures = initializeApp(
    {
      projectId: "demo-wardrobe",
      databaseURL: "https://demo-wardrobe-default-rtdb.firebaseio.com",
    },
    `fixture-${Date.now()}`,
  );
  await getDatabase(fixtures).ref(`rooms/${sharedRoom}`).set(newRoom());
  await page.goto(`/#room=${sharedRoom}`);
  await register(page, "Owner");
  await expect(page).toHaveURL(new RegExp(`room=${sharedRoom}`));

  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  await partner.goto(`/#room=${sharedRoom}`);
  await register(partner, "Partner");
  await expect(partner).toHaveURL(new RegExp(`room=${sharedRoom}`));

  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item name").fill("Shared brown jacket");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(
    partner.getByText("Shared brown jacket", { exact: true }),
  ).toBeVisible();

  await partner.getByRole("button", { name: "Add item", exact: true }).click();
  await partner.getByLabel("Item name").fill("Shared green trousers");
  await partner.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(
    page.getByText("Shared green trousers", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Private space", exact: true })
    .click();
  await page.getByRole("button", { name: "Add private item" }).click();
  await page.getByLabel("Item name").fill("Personal silk dress");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.locator(".private-item")).toContainText(
    "Personal silk dress",
  );

  await partner
    .getByRole("button", { name: "Private space", exact: true })
    .click();
  await expect(partner.locator(".private-item")).toHaveCount(0);

  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByText("Personal silk dress", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Shared green trousers", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`room=${sharedRoom}`));
  await expect(
    page.getByText("Shared brown jacket", { exact: true }),
  ).toBeVisible();

  await partnerContext.close();
});
