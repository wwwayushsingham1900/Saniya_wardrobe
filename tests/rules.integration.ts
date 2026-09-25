import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { newRoom } from "../src/lib/model";
let env: RulesTestEnvironment;
const rid = "a".repeat(40),
  legacyId = "b".repeat(40);
const context = (uid: string, anonymous = false) =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: anonymous ? "anonymous" : "password" },
    })
    .database();
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-wardrobe",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: readFileSync("database.rules.json", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (c) => {
    await c
      .database()
      .ref()
      .set({
        rooms: { [rid]: newRoom("owner"), [legacyId]: newRoom() },
        roomAccess: {
          [rid]: {
            ownerId: "owner",
            members: { owner: "owner", editor: "editor", viewer: "viewer" },
          },
        },
      });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("room access boundaries", () => {
  it("allows members and denies outsiders", async () => {
    await assertSucceeds(context("viewer").ref(`rooms/${rid}`).once("value"));
    await assertFails(context("outsider").ref(`rooms/${rid}`).once("value"));
    await assertFails(
      env.unauthenticatedContext().database().ref(`rooms/${rid}`).once("value"),
    );
  });
  it("lets an editor edit but rejects a viewer", async () => {
    await assertSucceeds(
      context("editor").ref(`rooms/${rid}/budgetMinor`).set(150000),
    );
    await assertFails(
      context("viewer").ref(`rooms/${rid}/budgetMinor`).set(150000),
    );
  });
  it("lets both accounts add, edit and remove each other's items without approval", async () => {
    const path = `rooms/${rid}/sections/0/items/0`;
    const original = (await context("owner").ref(path).once("value")).val();
    await assertSucceeds(
      context("editor").ref(`${path}/label`).set("Updated by partner"),
    );
    await assertSucceeds(context("editor").ref(path).remove());
    await assertSucceeds(context("editor").ref(path).set(original));
    await assertSucceeds(
      context("owner").ref(`${path}/label`).set("Updated by owner"),
    );
    await assertSucceeds(context("owner").ref(path).remove());
    await assertSucceeds(context("owner").ref(path).set(original));
    expect((await context("editor").ref(path).once("value")).val()).toEqual(
      original,
    );
  });
  it("blocks role escalation and access-control deletion", async () => {
    await assertFails(
      context("editor").ref(`roomAccess/${rid}/members/editor`).set("owner"),
    );
    await assertFails(context("editor").ref(`roomAccess/${rid}`).remove());
    await assertFails(context("owner").ref(`roomAccess/${rid}`).remove());
    await assertFails(
      context("owner").ref(`roomAccess/${rid}/members/owner`).remove(),
    );
  });
  it("does not permit a room owner field to be overwritten", async () => {
    await assertFails(
      context("editor").ref(`rooms/${rid}/ownerId`).set("editor"),
    );
    await assertFails(context("editor").ref(`rooms/${rid}/ownerId`).remove());
  });
  it("allows owner revocation and immediately blocks a removed member", async () => {
    await assertSucceeds(
      context("owner").ref(`roomAccess/${rid}/members/editor`).remove(),
    );
    await assertFails(context("editor").ref(`rooms/${rid}/budgetMinor`).set(1));
  });
  it("keeps legacy room access but disallows link-based ownership claims", async () => {
    await assertSucceeds(
      context("guest", true).ref(`rooms/${legacyId}`).once("value"),
    );
    await assertSucceeds(
      context("guest", true).ref(`rooms/${legacyId}/done`).set(["main0-0"]),
    );
    await assertFails(
      context("guest")
        .ref(`roomAccess/${legacyId}`)
        .set({ ownerId: "guest", members: { guest: "owner" } }),
    );
    await assertFails(
      context("guest").ref(`rooms/${legacyId}/ownerId`).set("guest"),
    );
  });
  it("allows signed-in users to create a new secure room", async () => {
    const fresh = "c".repeat(40);
    await assertSucceeds(
      context("newuser")
        .ref(`roomAccess/${fresh}`)
        .set({ ownerId: "newuser", members: { newuser: "owner" } }),
    );
    await assertSucceeds(
      context("newuser").ref(`rooms/${fresh}`).set(newRoom("newuser")),
    );
    await assertFails(
      context("guest", true)
        .ref(`roomAccess/${"d".repeat(40)}`)
        .set({ ownerId: "guest", members: { guest: "owner" } }),
    );
  });
});
describe("data validation and private notes", () => {
  it("rejects dangerous URLs and invalid budgets", async () => {
    await assertFails(
      context("editor")
        .ref(`rooms/${rid}/sections/0/items/0/productUrl`)
        .set("javascript:alert(1)"),
    );
    await assertFails(
      context("editor").ref(`rooms/${rid}/budgetMinor`).set(-1),
    );
    await assertSucceeds(
      context("editor")
        .ref(`rooms/${rid}/sections/0/items/0/productUrl`)
        .set("https://www.hm.com/product/1"),
    );
  });
  it("handles Firebase empty-category arrays", async () => {
    await assertSucceeds(
      context("editor").ref(`rooms/${rid}/sections/5`).set({
        id: "new",
        title: "New category",
        subtitle: "",
        items: [],
        userAdded: true,
      }),
    );
  });
  it("keeps private notes inaccessible to collaborators and anonymous users", async () => {
    const note = { title: "Gift idea", body: "A surprise", updatedAt: 1 };
    await assertSucceeds(
      context("owner").ref("users/owner/privateNotes/n1").set(note),
    );
    await assertFails(
      context("editor").ref("users/owner/privateNotes").once("value"),
    );
    await assertFails(
      context("owner", true).ref("users/owner/privateNotes").once("value"),
    );
    await assertFails(
      context("editor").ref("users/owner/privateNotes/n1").set(note),
    );
  });
});
it("rejects malformed collection and media field types", async () => {
  await assertFails(
    context("editor").ref(`rooms/${rid}/sections`).set("not a collection"),
  );
  await assertFails(
    context("editor").ref(`rooms/${rid}/sections/0/items/0/imageUrl`).set(123),
  );
  await assertFails(
    context("editor")
      .ref(`rooms/${rid}/sections/0/items/0/images`)
      .set("not an array"),
  );
  await assertFails(context("editor").ref(`rooms/${rid}/done`).set("main0-0"));
});

it("isolates private clothes from collaborators and validates product links", async () => {
  const item = {
    id: "personal",
    label: "Private dress",
    optional: false,
    categoryId: "sec0",
  };
  const path = "users/owner/privateItems/personal";
  await assertSucceeds(context("owner").ref(path).set(item));
  await assertFails(context("editor").ref(path).once("value"));
  await assertFails(context("editor").ref(path).set(item));
  await assertFails(context("owner", true).ref(path).once("value"));
  await assertFails(
    context("owner").ref(`${path}/productUrl`).set("javascript:alert(1)"),
  );
  await assertSucceeds(
    context("owner").ref(`${path}/label`).set("Updated private dress"),
  );
  await assertSucceeds(context("owner").ref(path).remove());
});
