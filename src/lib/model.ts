export type Role = "owner" | "editor" | "viewer";
export type Product = {
  id: string;
  label: string;
  optional: boolean;
  userAdded?: boolean;
  productUrl?: string;
  imageUrl?: string;
  images?: string[];
  imageSource?: string;
  candidates?: {
    image: string;
    thumbnail: string;
    title: string;
    source: string;
  }[];
  price?: string;
  description?: string;
  vendor?: string;
  searchStatus?: string;
  favorite?: boolean;
  wishlist?: boolean;
  needId?: string;
  tags?: string[];
  size?: string;
  color?: string;
  paidMinor?: number;
  purchasedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  previewStatus?: "pending" | "ready" | "unavailable";
};
export type Section = {
  id: string;
  title: string;
  subtitle: string;
  items: Product[];
  userAdded?: boolean;
};
export type Activity = { id: string; text: string; actor: string; at: number };
export type Room = {
  sections: Section[];
  done: string[];
  updatedAt: number;
  schemaVersion?: number;
  ownerId?: string;
  members?: Record<string, Role>;
  title?: string;
  budgetMinor?: number;
  activity?: Activity[];
};
const defaults = [
  {
    title: "Solid shirts",
    subtitle: "The everyday essentials",
    items: [
      "Brown",
      "Beige",
      "Cream",
      "Baby blue",
      "Pistachio green",
      "Olive green",
    ],
  },
  {
    title: "Lining / striped shirts",
    subtitle: "A little pattern, a lot of personality",
    items: [
      "Brown + cream stripes",
      "Beige + white stripes",
      "Cream + beige stripes",
      "Baby blue + white stripes",
      "Pistachio green + white stripes",
      "Olive green + cream stripes",
    ],
  },
  {
    title: "Checked shirts",
    subtitle: "Timeless checks for your rotation",
    items: ["Brown checked shirt"],
    optional: ["Beige checked shirt", "Olive-green checked shirt"],
  },
  {
    title: "Other pastel shirts",
    subtitle: "Soft shades, whenever you feel like it",
    optional: ["Lavender", "Pastel pink", "Butter yellow"],
  },
  {
    title: "Casual wear",
    subtitle: "Made for slow days",
    items: ["Casual sweatpants"],
  },
];
export function createDefaults(): Section[] {
  return defaults.map((s, n) => ({
    id: `sec${n}`,
    title: s.title,
    subtitle: s.subtitle,
    items: [
      ...(s.items || []).map((label, i) => ({
        id: `main${n}-${i}`,
        label,
        optional: false,
      })),
      ...(s.optional || []).map((label, i) => ({
        id: `opt${n}-${i}`,
        label,
        optional: true,
      })),
    ],
  }));
}
export const id = () => "i" + crypto.randomUUID();
export const roomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(20)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const list = <T>(v: T[] | Record<string, T> | undefined): T[] =>
  Array.isArray(v) ? v : Object.values(v || {});
export function normalizeRoom(value: Room): Room {
  return {
    ...value,
    sections: list(value.sections)
      .filter(Boolean)
      .map((s) => ({ ...s, items: list(s.items).filter(Boolean) })),
    done: list(value.done),
    activity: list(value.activity),
  };
}
export function newRoom(ownerId?: string): Room {
  return {
    sections: createDefaults(),
    done: [],
    updatedAt: Date.now(),
    ...(ownerId ? { schemaVersion: 2, ownerId } : {}),
    title: "Sania’s wardrobe",
    budgetMinor: 2000000,
  };
}
export const allItems = (room: Room) =>
  room.sections.flatMap((s) =>
    s.items.map((item) => ({
      ...item,
      sectionId: s.id,
      sectionTitle: s.title,
    })),
  );
export function stats(room: Room) {
  const items = allItems(room),
    needs = items.filter((i) => !i.optional && !i.needId && !i.wishlist);
  const completed = needs.filter((i) => room.done.includes(i.id)).length;
  return {
    total: needs.length,
    completed,
    percent: needs.length ? Math.round((completed / needs.length) * 100) : 0,
    saved: items.filter((i) => i.productUrl).length,
    spent: items.reduce(
      (sum, i) => sum + (i.purchasedAt ? i.paidMinor || 0 : 0),
      0,
    ),
  };
}
export function normalizeUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (
      !["https:", "http:"].includes(u.protocol) ||
      !u.hostname.includes(".") ||
      u.username ||
      u.password
    )
      return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$|igshid$)/i.test(key))
        u.searchParams.delete(key);
    return u.toString();
  } catch {
    return null;
  }
}
export function fallbackTitle(url: string) {
  const u = new URL(url),
    parts = u.pathname.split("/").filter(Boolean);
  const slug =
    u.hostname.endsWith("myntra.com") && parts.length >= 3
      ? parts[2]
      : parts.at(-1) === "buy"
        ? parts.at(-3)
        : parts.at(-1);
  let title = slug || "Saved product";
  try {
    title = decodeURIComponent(title);
  } catch {}
  return title
    .replace(/[-_]+/g, " ")
    .replace(/\.(html?|php)$/i, "")
    .slice(0, 120);
}
export const money = (minor: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
export function toMinor(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw Error("Enter a positive amount with up to two decimal places.");
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount > 100000000)
    throw Error("Amount is too large.");
  return amount;
}
export function setCompleted(room: Room, itemId: string, checked: boolean) {
  const found = allItems(room).some((i) => i.id === itemId);
  if (!found) throw Error("This item was removed.");
  room.done = checked
    ? [...new Set([...room.done, itemId])]
    : room.done.filter((i) => i !== itemId);
}
export function removeItem(room: Room, itemId: string) {
  for (const section of room.sections) {
    section.items = section.items.filter((i) => i.id !== itemId);
    for (const i of section.items) if (i.needId === itemId) delete i.needId;
  }
  room.done = room.done.filter((i) => i !== itemId);
}
export function addProduct(room: Room, sectionId: string, item: Product) {
  if (
    allItems(room).some((i) => i.productUrl && i.productUrl === item.productUrl)
  )
    throw Error("This product is already saved.");
  const section = room.sections.find((s) => s.id === sectionId);
  if (!section)
    throw Error("This category was removed. Choose another category.");
  if (section.items.length >= 200) throw Error("This category is full.");
  if (
    item.needId &&
    !section.items.some((i) => i.id === item.needId && !i.productUrl)
  )
    throw Error("This checklist need was removed.");
  section.items.push(item);
}
export function mergePreview(
  item: Product,
  preview: Partial<Product>,
  startedAt: number,
) {
  const manuallyEdited = (item.updatedAt || 0) > startedAt;
  if (!manuallyEdited) {
    if (preview.label) item.label = preview.label;
    for (const key of ["price", "description", "vendor"] as const)
      if (preview[key]) item[key] = preview[key];
    if (preview.images?.length) {
      item.images = preview.images;
      item.imageUrl = preview.images[0];
      item.imageSource = preview.imageSource || "retailer";
    }
  }
  item.candidates = preview.candidates || [];
  item.searchStatus = preview.searchStatus || "";
  item.previewStatus = preview.images?.length ? "ready" : "unavailable";
}
export function categorySuggestion(
  text: string,
  sections: Section[],
): string | null {
  const t = text.toLowerCase();
  const words = /sneaker|shoe/.test(t)
    ? ["sneaker", "shoe"]
    : /strip|lining/.test(t)
      ? ["strip", "lining"]
      : /check|plaid/.test(t)
        ? ["check"]
        : /sweat|jogger|casual/.test(t)
          ? ["casual"]
          : /shirt/.test(t)
            ? ["solid"]
            : [];
  return (
    sections.find((s) => words.some((w) => s.title.toLowerCase().includes(w)))
      ?.id || null
  );
}
