import { describe, expect, it } from "vitest";
import {
  addProduct,
  mergePreview,
  newRoom,
  normalizeRoom,
  normalizeUrl,
  removeItem,
  setCompleted,
  stats,
  toMinor,
  type Product,
} from "../src/lib/model";
describe("legacy room compatibility", () => {
  it("preserves IDs and handles Firebase missing arrays", () => {
    const raw = {
      sections: {
        0: {
          id: "sec0",
          title: "Solid shirts",
          subtitle: "",
          items: { 0: { id: "main0-0", label: "Brown", optional: false } },
        },
        1: { id: "custom", title: "Empty", subtitle: "" },
      },
      done: { 0: "main0-0" },
      updatedAt: 1,
    };
    const room = normalizeRoom(raw as never);
    expect(room.sections[1].items).toEqual([]);
    expect(room.done).toEqual(["main0-0"]);
    expect(stats(room).completed).toBe(1);
  });
  it("starts with the original 14 required and 5 optional items", () => {
    const room = newRoom();
    expect(stats(room).total).toBe(14);
    expect(
      room.sections.flatMap((s) => s.items).filter((i) => i.optional),
    ).toHaveLength(5);
  });
  it("does not infer ownership for a legacy room", () =>
    expect(newRoom().ownerId).toBeUndefined());
});
describe("shopping workflow", () => {
  it("does not inflate essentials when saving product options or wishes", () => {
    const room = newRoom(),
      before = stats(room).total;
    addProduct(room, "sec0", {
      id: "p1",
      label: "Brown shirt",
      productUrl: "https://www.hm.com/product/1",
      optional: false,
      needId: "main0-0",
    });
    addProduct(room, "sec0", {
      id: "p2",
      label: "Wish",
      productUrl: "https://www.hm.com/product/2",
      optional: false,
      wishlist: true,
    });
    expect(stats(room).total).toBe(before);
    expect(stats(room).saved).toBe(2);
  });
  it("rejects duplicates and a category removed by a collaborator", () => {
    const room = newRoom(),
      item = {
        id: "p1",
        label: "Brown",
        productUrl: "https://www.hm.com/product/1",
        optional: false,
      };
    addProduct(room, "sec0", item);
    expect(() => addProduct(room, "sec1", { ...item, id: "p2" })).toThrow(
      "already saved",
    );
    expect(() =>
      addProduct(room, "gone", { ...item, productUrl: "https://hm.com/2" }),
    ).toThrow("removed");
  });
  it("sets intended checkbox state idempotently", () => {
    const room = newRoom();
    setCompleted(room, "main0-0", true);
    setCompleted(room, "main0-0", true);
    expect(room.done).toEqual(["main0-0"]);
    setCompleted(room, "main0-0", false);
    expect(room.done).toEqual([]);
  });
  it("keeps purchase history when ticks are reset", () => {
    const room = newRoom();
    Object.assign(room.sections[0].items[0], {
      purchasedAt: 100,
      paidMinor: 149900,
    });
    room.done = [];
    expect(stats(room).spent).toBe(149900);
  });
  it("unlinks options when their need is deleted", () => {
    const room = newRoom();
    addProduct(room, "sec0", {
      id: "p1",
      label: "Option",
      productUrl: "https://hm.com/1",
      optional: false,
      needId: "main0-0",
    });
    setCompleted(room, "main0-0", true);
    removeItem(room, "main0-0");
    expect(room.done).toEqual([]);
    expect(room.sections[0].items.at(-1)?.needId).toBeUndefined();
  });
  it("does not overwrite manual changes with a late preview", () => {
    const item: Product = {
      id: "p",
      label: "My label",
      optional: false,
      price: "₹1,299",
      images: ["https://example.com/mine.jpg"],
      updatedAt: 200,
    };
    mergePreview(
      item,
      {
        label: "Scraped name",
        price: "₹999",
        images: ["https://example.com/other.jpg"],
      },
      100,
    );
    expect(item.label).toBe("My label");
    expect(item.images).toEqual(["https://example.com/mine.jpg"]);
    expect(item.price).toBe("₹1,299");
  });
});
describe("input validation", () => {
  it("removes tracking without discarding product variants", () =>
    expect(normalizeUrl("https://hm.com/1?size=M&utm_source=ig#photo")).toBe(
      "https://hm.com/1?size=M",
    ));
  it("rejects executable URLs and embedded credentials", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("https://user:secret@hm.com/")).toBeNull();
  });
  it("stores accurate integer amounts and rejects invalid prices", () => {
    expect(toMinor("1499.99")).toBe(149999);
    expect(toMinor("")).toBeUndefined();
    expect(() => toMinor("-100")).toThrow();
    expect(() => toMinor("1.001")).toThrow();
  });
});
