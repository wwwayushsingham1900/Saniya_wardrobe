import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Copy,
  Heart,
  LayoutDashboard,
  Link2,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Shirt,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Wallet,
  X,
  Activity as ActivityIcon,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
} from "lucide-react";
import { useWardrobe } from "./hooks/useWardrobe";
import {
  addProduct,
  allItems,
  categorySuggestion,
  fallbackTitle,
  id,
  mergePreview,
  money,
  normalizeUrl,
  removeItem,
  setCompleted,
  stats,
  toMinor,
  type Product,
  type Room,
} from "./lib/model";
import { auth } from "./lib/firebase";
import { api } from "./lib/api";
import Modal from "./components/Modal";
import AuthForm from "./components/AuthForm";
import ItemForm from "./components/ItemForm";
import PrivateNotes from "./components/PrivateNotes";
import PrivateWardrobe from "./components/PrivateWardrobe";
type Page =
  "overview" | "checklist" | "wishlist" | "budget" | "activity" | "private";
type Editor = { item?: Product; sectionId?: string };
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "checklist", label: "My checklist", icon: ClipboardList },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "budget", label: "Budget", icon: Wallet },
  { id: "activity", label: "Activity", icon: ActivityIcon },
] as const;
const categoryColors = ["sand", "sage", "rose", "lavender", "blue"];
function WardrobeArt() {
  return (
    <svg
      className="wardrobe-art"
      viewBox="0 0 360 240"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="198"
        cy="223"
        rx="135"
        ry="10"
        fill="#244d3d"
        opacity=".08"
      />
      <path
        d="M59 215V37a10 10 0 0 1 10-10h217a10 10 0 0 1 10 10v178M46 216h26m211 0h26"
        stroke="#557561"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M106 46c0-10 15-10 15 0 0 5-7 7-7 11l-32 19h65l-33-19"
        stroke="#9b7951"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m90 73-31 16 14 31 17-8v79h52v-79l17 8 14-31-31-16-14 14h-24L90 73Z"
        fill="#d7bc91"
      />
      <path
        d="m103 73 12 15 13-15m-13 16v102"
        stroke="#b8976d"
        strokeWidth="2"
      />
      <path d="m102 73 13 15-10 9-15-24m38 0-13 15 11 9 16-24" fill="#ebd5b2" />
      <path
        d="M167 46c0-10 15-10 15 0 0 5-7 7-7 11l-32 19h65l-33-19"
        stroke="#9b7951"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m151 73-25 18 16 29 9-5v84h56v-84l9 5 16-29-25-18-14 13h-28l-14-13Z"
        fill="#759180"
      />
      <path
        d="m164 74 14 13 15-13m-15 14v112"
        stroke="#4e705e"
        strokeWidth="2"
      />
      <path
        d="M225 46c0-10 15-10 15 0 0 5-7 7-7 11l-32 19h65l-33-19"
        stroke="#9b7951"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m211 73-24 18 12 31 12-7v74h52v-74l12 7 12-31-24-18-14 11h-24l-14-11Z"
        fill="#f0ede0"
      />
      <path
        d="M220 85v104m12-104v104m12-104v104m12-104v104"
        stroke="#a7b5a4"
        strokeWidth="3"
      />
      <path d="m225 74 12 12 12-12" stroke="#d0cabb" strokeWidth="3" />
      <path d="M307 159c17-4 28 8 21 20-15 2-22-6-21-20Z" fill="#769478" />
      <path d="M308 181c-17-3-25-15-16-23 15 2 21 10 16 23Z" fill="#52785d" />
      <path d="M308 194v-37" stroke="#507159" strokeWidth="3" />
      <path d="M289 189h37l-6 30h-25l-6-30Z" fill="#c79d7f" />
      <circle cx="48" cy="62" r="4" fill="#bc985e" />
      <path d="m301 48 3 7 8 2-8 3-3 7-2-7-8-3 8-2 2-7Z" fill="#bc985e" />
    </svg>
  );
}
export default function App() {
  const w = useWardrobe(),
    { room, demo, canEdit } = w;
  const [page, setPage] = useState<Page>("overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("default"),
    [sidebar, setSidebar] = useState(false),
    [modal, setModal] = useState<
      "auth" | "link" | "category" | "invite" | "settings" | null
    >(null),
    [editor, setEditor] = useState<Editor | null>(null),
    [toast, setToast] = useState(""),
    [dark, setDark] = useState(
      () => localStorage.getItem("wardrobe-theme") === "dark",
    ),
    [link, setLink] = useState(""),
    [linkCategory, setLinkCategory] = useState(""),
    [linkNeed, setLinkNeed] = useState(""),
    [linkWishlist, setLinkWishlist] = useState(false),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [newCategory, setNewCategory] = useState(""),
    [inviteRole, setInviteRole] = useState("editor"),
    [inviteUrl, setInviteUrl] = useState(""),
    [budget, setBudget] = useState(""),
    [photoItem, setPhotoItem] = useState<Product | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    search = useRef<HTMLInputElement>(null),
    accepting = useRef("");
  const summary = stats(room),
    items = allItems(room);
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("wardrobe-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!sidebar) return;
    const previous = document.body.style.overflow;
    if (matchMedia("(max-width:760px)").matches)
      document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", escape);
    };
  }, [sidebar]);
  useEffect(() => {
    const invite = new URLSearchParams(location.hash.slice(1)).get("invite");
    if (
      !invite ||
      !w.user ||
      w.user.isAnonymous ||
      accepting.current === invite
    )
      return;
    accepting.current = invite;
    void api("invite", { action: "accept", roomId: w.roomId, token: invite })
      .then(() => {
        notify("You’re in. Welcome to the wardrobe.");
        location.hash = `room=${w.roomId}`;
        location.reload();
      })
      .catch((e) => {
        notify(e.message);
        accepting.current = "";
      });
  }, [w.user?.uid, w.user?.isAnonymous, w.roomId]);
  async function change(fn: (draft: Room) => void, message: string) {
    try {
      await w.mutate(fn, message);
      notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  function openModal(next: typeof modal) {
    setFormError("");
    setSuggestion("");
    setInviteUrl("");
    setModal(next);
    if (next === "link") {
      setLink("");
      setLinkCategory(
        category !== "all" ? category : room.sections[0]?.id || "",
      );
      setLinkNeed("");
      setLinkWishlist(page === "wishlist");
    }
    if (next === "settings") setBudget(String((room.budgetMinor || 0) / 100));
  }
  function go(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    setSidebar(false);
    setQuery("");
    setFilter("all");
    setCategory("all");
  }
  async function enrich(item: Product) {
    const startedAt = Date.now();
    try {
      const data = await api<Partial<Product> & { title: string }>(
        "product-preview",
        { url: item.productUrl },
      );
      await w.mutate((d) => {
        const target = allItems(d).find((i) => i.id === item.id);
        if (!target) return;
        const original = d.sections
          .find((s) => s.id === target.sectionId)!
          .items.find((i) => i.id === item.id)!;
        mergePreview(original, { ...data, label: data.title }, startedAt);
      }, "Updated product details");
    } catch (e) {
      try {
        await w.mutate((d) => {
          for (const s of d.sections) {
            const target = s.items.find((i) => i.id === item.id);
            if (target) {
              target.previewStatus = "unavailable";
              target.searchStatus =
                "Details unavailable. You can edit them manually.";
            }
          }
        }, "Kept product link without a preview");
      } catch {}
      notify(`Link saved. ${(e as Error).message}`);
    }
  }
  async function saveLinks() {
    setBusy(true);
    setFormError("");
    try {
      const urls = [
        ...new Set(
          link
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => {
              const url = normalizeUrl(s);
              if (!url) throw Error("One of these links is invalid.");
              return url;
            }),
        ),
      ];
      if (!urls.length) throw Error("Paste a product link first.");
      if (urls.length > 10) throw Error("Add up to 10 links at a time.");
      const products: Product[] = urls.map((url) => ({
        id: id(),
        label: fallbackTitle(url),
        optional: false,
        userAdded: true,
        productUrl: url,
        vendor: new URL(url).hostname.replace(/^www\./, ""),
        createdAt: Date.now(),
        previewStatus: "pending",
        ...(linkNeed ? { needId: linkNeed } : {}),
        wishlist: linkWishlist,
      }));
      await w.mutate(
        (d) => {
          for (const product of products) addProduct(d, linkCategory, product);
        },
        `Saved ${products.length === 1 ? "a product" : `${products.length} products`}`,
      );
      setModal(null);
      notify("Links saved. You can keep browsing while details load.");
      if (!demo) {
        void (async () => {
          for (const product of products) await enrich(product);
        })();
      } else {
        await w.mutate((d) => {
          for (const s of d.sections)
            for (const p of s.items)
              if (products.some((i) => i.id === p.id)) {
                p.previewStatus = "unavailable";
                p.searchStatus = "Demo mode: add product details manually.";
              }
        }, "Saved demo products");
      }
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function suggest() {
    setBusy(true);
    setFormError("");
    try {
      const url = normalizeUrl(link.split("\n")[0] || "");
      if (!url) throw Error("Paste a product link first.");
      if (demo) {
        const suggested = categorySuggestion(fallbackTitle(url), room.sections);
        if (suggested) {
          setLinkCategory(suggested);
          setLinkNeed("");
          setSuggestion(
            "Suggested from the product name. You can change it below.",
          );
        } else
          setSuggestion(
            "Choose a category below. AI suggestions are available in your connected wardrobe.",
          );
      } else {
        const result = await api<{ categoryId: string | null; reason: string }>(
          "categorize",
          {
            title: fallbackTitle(url),
            categories: room.sections.map((s) => ({
              id: s.id,
              title: s.title,
            })),
          },
        );
        if (
          result.categoryId &&
          room.sections.some((s) => s.id === result.categoryId)
        ) {
          setLinkCategory(result.categoryId);
          setLinkNeed("");
        }
        setSuggestion(result.reason);
      }
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveItem(item: Product, sid: string) {
    await w.mutate(
      (d) => {
        const existing = allItems(d).find((i) => i.id === item.id);
        const target = d.sections.find((s) => s.id === sid);
        if (!target) throw Error("This category no longer exists.");
        if (
          item.productUrl &&
          allItems(d).some(
            (i) => i.id !== item.id && i.productUrl === item.productUrl,
          )
        )
          throw Error("This product is already saved.");
        if (existing) {
          const source = d.sections.find((s) => s.id === existing.sectionId)!;
          source.items = source.items.filter((i) => i.id !== item.id);
        } else if (editor?.item)
          throw Error("This item was removed by a collaborator.");
        target.items.push(item);
        if (item.purchasedAt) {
          setCompleted(d, item.id, true);
          if (item.needId) setCompleted(d, item.needId, true);
        }
      },
      editor?.item ? "Updated item" : "Added an item",
    );
    setEditor(null);
    notify("Saved to your wardrobe.");
  }
  const visible = (i: Product) => {
    const text = [i.label, i.vendor, i.description, i.color, ...(i.tags || [])]
      .join(" ")
      .toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (filter === "all" ||
        (filter === "done" && room.done.includes(i.id)) ||
        (filter === "pending" && !room.done.includes(i.id)) ||
        (filter === "favorites" && i.favorite)) &&
      (page !== "wishlist" || i.wishlist) &&
      (page === "wishlist" || !i.wishlist)
    );
  };
  const visibleSections = room.sections
    .filter((s) => category === "all" || category === s.id)
    .map((s) => ({
      ...s,
      items: s.items
        .filter(visible)
        .sort((a, b) =>
          sort === "name"
            ? a.label.localeCompare(b.label)
            : sort === "newest"
              ? (b.createdAt || 0) - (a.createdAt || 0)
              : 0,
        ),
    }))
    .filter(
      (s) =>
        s.items.length || (!query && filter === "all" && page !== "wishlist"),
    );
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(room, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wardrobe-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Wardrobe backup downloaded.");
  };
  const name = w.user?.displayName?.split(" ")[0] || "Sania";
  function renderItem(item: Product, sid: string) {
    const checked = room.done.includes(item.id),
      safeUrl = item.productUrl ? normalizeUrl(item.productUrl) : null;
    return (
      <article
        className={`item-row ${checked ? "is-done" : ""} ${item.productUrl ? "has-product" : ""}`}
        key={item.id}
      >
        <div className="item-main">
          <label className="item-check">
            <input
              type="checkbox"
              checked={checked}
              disabled={!canEdit}
              onChange={(e) => {
                const value = e.target.checked;
                void change(
                  (d) => setCompleted(d, item.id, value),
                  value ? "Checked off an item" : "Marked item pending",
                );
              }}
            />
            <span>
              <Check size={13} />
            </span>
            <span className="sr-only">
              Mark {item.label} {checked ? "pending" : "complete"}
            </span>
          </label>
          <button
            className="item-label"
            onClick={() => setEditor({ item, sectionId: sid })}
            disabled={!canEdit}
          >
            <span>{item.label}</span>
            <small>
              {item.needId
                ? "Product option"
                : item.optional
                  ? "Optional"
                  : item.size
                    ? `Size ${item.size}`
                    : ""}
            </small>
          </button>
          <button
            className={`icon-button favorite ${item.favorite ? "is-favorite" : ""}`}
            aria-label={`${item.favorite ? "Unfavorite" : "Favorite"} ${item.label}`}
            disabled={!canEdit}
            onClick={() =>
              void change(
                (d) => {
                  const t = d.sections
                    .find((s) => s.id === sid)
                    ?.items.find((i) => i.id === item.id);
                  if (t) t.favorite = !item.favorite;
                },
                item.favorite ? "Removed from favorites" : "Saved to favorites",
              )
            }
          >
            <Heart size={16} fill={item.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button item-edit"
            aria-label={`Edit ${item.label}`}
            disabled={!canEdit}
            onClick={() => setEditor({ item, sectionId: sid })}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        {item.productUrl && (
          <div className="product-detail">
            <div className="product-thumbnail">
              {item.imageUrl?.startsWith("https://") ? (
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Shirt size={28} />
              )}
            </div>
            <div className="product-copy">
              <span className="eyebrow">{item.vendor || "Saved product"}</span>
              {item.price && <strong>{item.price}</strong>}
              {item.description && <p>{item.description}</p>}
              {item.previewStatus === "pending" && (
                <small>
                  {Date.now() - (item.createdAt || 0) > 30000
                    ? "Preview paused · use refresh to try again"
                    : "Finding the little details…"}
                </small>
              )}
              {item.previewStatus === "unavailable" && !item.price && (
                <small>Link saved · details can be added manually</small>
              )}
              {item.imageSource?.startsWith("image-search") && (
                <small>Search photo · verify colour and model</small>
              )}
              <div className="product-actions">
                {safeUrl && (
                  <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                    View product <ArrowUpRight size={12} />
                  </a>
                )}
                {canEdit && !demo && (
                  <button
                    onClick={() => void enrich(item)}
                    aria-label={`Refresh ${item.label}`}
                  >
                    <RefreshCw size={13} />
                  </button>
                )}
                {canEdit && !!item.candidates?.length && (
                  <button
                    onClick={() => setPhotoItem(item)}
                    aria-label={`Choose photo for ${item.label}`}
                  >
                    <ImagePlus size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "is-open" : ""}`}>
        <button
          className="icon-button sidebar-close"
          aria-label="Close menu"
          onClick={() => setSidebar(false)}
        >
          <X size={21} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">
            <Shirt size={23} strokeWidth={1.4} />
          </span>
          <span>
            Sania’s<span className="brand-sub">WARDROBE</span>
          </span>
        </a>
        <div className="workspace-label">YOUR LITTLE CORNER</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} strokeWidth={1.6} />
              <span>{n.label}</span>
              {n.id === "wishlist" &&
                items.filter((i) => i.wishlist).length > 0 && (
                  <span className="nav-count">
                    {items.filter((i) => i.wishlist).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <nav>
          <button
            className={page === "private" ? "active" : ""}
            onClick={() => go("private")}
          >
            <LockKeyhole size={18} strokeWidth={1.6} />
            Private space
            <span className="tiny-dot" />
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-spark">✧</span>
          <p>
            Less impulse.
            <br />
            More <em>you.</em>
          </p>
          <small>A wardrobe built with intention.</small>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => openModal("settings")}>
            <Settings2 size={17} /> Settings & backup
          </button>
          <button onClick={() => setDark(!dark)}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}{" "}
            {dark ? "Light appearance" : "Dark appearance"}
          </button>
          <div className="profile">
            <span className="avatar">{demo ? "S" : name.slice(0, 1)}</span>
            <div>
              <strong>
                {demo
                  ? "Your local preview"
                  : w.user?.displayName ||
                    w.user?.email?.split("@")[0] ||
                    "Guest"}
              </strong>
              <small>
                {demo
                  ? "Explore your new wardrobe"
                  : w.user?.isAnonymous
                    ? "Shared with a private link"
                    : "A space of your own"}
              </small>
            </div>
            <button
              aria-label={
                w.user && !w.user.isAnonymous ? "Sign out" : "Sign in"
              }
              onClick={() => {
                if (w.user && !w.user.isAnonymous && auth)
                  void signOut(auth).catch((e) => notify(e.message));
                else openModal("auth");
              }}
            >
              {w.user && !w.user.isAnonymous ? (
                <LogOut size={16} />
              ) : (
                <ArrowRight size={16} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
              aria-expanded={sidebar}
            >
              <Menu size={21} />
            </button>
            <span>My space</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {page === "private"
                ? "Private space"
                : nav.find((n) => n.id === page)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${w.connected ? "online" : ""}`}>
              <i />
              {page === "private"
                ? "Only you"
                : demo
                  ? "Local demo"
                  : w.pending
                    ? "Saving…"
                    : w.connected && w.ready
                      ? "Live together"
                      : "Connecting"}
            </span>
            <button
              className="icon-button"
              aria-label="About this wardrobe"
              onClick={() => openModal("settings")}
            >
              <CircleHelp size={18} />
            </button>
            <button
              className="avatar small-avatar"
              onClick={() => openModal("auth")}
              aria-label="Account"
            >
              {name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main className="main-content">
          {demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={14} /> You’re exploring a local demo. Your
                shared wardrobe is untouched.
              </span>
              <button onClick={() => openModal("auth")}>
                Sign in <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!demo && w.error && (
            <div className="error-banner" role="alert">
              <span>{w.error}</span>
              <button className="button" onClick={() => openModal("auth")}>
                Sign in
              </button>
              <button className="text-button" onClick={() => location.reload()}>
                Retry
              </button>
            </div>
          )}
          {page !== "private" && !demo && !w.ready && !w.error ? (
            <div className="loading-state">
              <span className="loading-dot" />
              <h2>Opening your wardrobe…</h2>
              <p>Your little collection is on its way.</p>
            </div>
          ) : page !== "private" && !demo && !w.ready ? null : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {page === "overview"
                      ? "A LITTLE MORE INTENTIONAL, EVERY DAY"
                      : "THOUGHTFULLY YOURS"}
                  </span>
                  <h1>
                    {page === "overview"
                      ? `Hello, ${name}.`
                      : page === "checklist"
                        ? "Your wardrobe checklist."
                        : page === "wishlist"
                          ? "A little wishful thinking."
                          : page === "budget"
                            ? "Room for what matters."
                            : page === "activity"
                              ? "Coming together, together."
                              : "Your private space."}
                    <span className="heading-flower">
                      {page === "overview" ? " ✳" : ""}
                    </span>
                  </h1>
                  <p>
                    {page === "overview"
                      ? "Good things take a little planning. Let’s build a wardrobe you love."
                      : page === "checklist"
                        ? "The essentials, the maybes, and everything that feels like you."
                        : page === "wishlist"
                          ? "Keep the possibilities here. Decide when you’re ready."
                          : page === "budget"
                            ? "A thoughtful wardrobe starts with a little balance."
                            : page === "activity"
                              ? "The little changes that make this wardrobe yours."
                              : "Personal notes and little surprises, kept separate."}
                  </p>
                </div>
                <div className="heading-actions">
                  {page !== "private" && (
                    <button
                      className="button invite-button"
                      onClick={() => openModal("invite")}
                    >
                      <Users size={16} /> Invite
                    </button>
                  )}
                  {["overview", "checklist", "wishlist"].includes(page) && (
                    <button
                      className="button primary"
                      disabled={!canEdit}
                      onClick={() =>
                        setEditor({
                          sectionId: category !== "all" ? category : undefined,
                        })
                      }
                    >
                      <Plus size={17} /> Add item
                    </button>
                  )}
                </div>
              </div>
              {page === "overview" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="pill">
                        <span /> CURATED WITH CARE
                      </span>
                      <h2>
                        A little less clutter.
                        <br />A little more <em>you.</em>
                      </h2>
                      <p>
                        Your favourites, your everyday essentials,
                        <br className="desktop-only" /> and the pieces you’re
                        still dreaming of.
                      </p>
                      <button onClick={() => go("checklist")}>
                        Let’s make it yours <ArrowRight size={16} />
                      </button>
                    </div>
                    <WardrobeArt />
                    <div className="hero-stamp">
                      THE EVERYDAY
                      <br />
                      <strong>edit.</strong>
                    </div>
                  </section>
                  <div className="stats-grid">
                    <article className="stat-card">
                      <span className="stat-icon sage">
                        <ClipboardList size={20} />
                      </span>
                      <div>
                        <span>Wardrobe essentials</span>
                        <strong>
                          {summary.total}
                          <small>thoughtfully chosen</small>
                        </strong>
                      </div>
                    </article>
                    <article className="stat-card">
                      <span className="stat-icon sand">
                        <CheckCircle2 size={20} />
                      </span>
                      <div>
                        <span>Checked off</span>
                        <strong>
                          {summary.completed}
                          <small>of {summary.total} essentials</small>
                        </strong>
                      </div>
                      <div
                        className="mini-ring"
                        style={
                          {
                            "--progress": `${summary.percent}%`,
                          } as React.CSSProperties
                        }
                      >
                        <span>{summary.percent}%</span>
                      </div>
                    </article>
                    <article className="stat-card">
                      <span className="stat-icon rose">
                        <Link2 size={20} />
                      </span>
                      <div>
                        <span>Saved finds</span>
                        <strong>
                          {summary.saved}
                          <small>worth a second look</small>
                        </strong>
                      </div>
                    </article>
                  </div>
                </>
              )}
              {["overview", "checklist", "wishlist"].includes(page) && (
                <>
                  <section className="quick-add">
                    <span className="quick-add-icon">
                      <Link2 size={20} />
                    </span>
                    <div>
                      <strong>Found something you love?</strong>
                      <p>
                        Save a product link. Keep all your possibilities in one
                        place.
                      </p>
                    </div>
                    <button
                      className="button"
                      disabled={!canEdit || !room.sections.length}
                      onClick={() => openModal("link")}
                    >
                      Paste a link <Plus size={15} />
                    </button>
                  </section>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        {page === "wishlist"
                          ? "THE SOMEDAY COLLECTION"
                          : "ONE PIECE AT A TIME"}
                      </span>
                      <h2>
                        {page === "wishlist"
                          ? "Your saved wishes"
                          : "Your collection"}{" "}
                        <span className="count-badge">
                          {room.sections.length}
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      disabled={!canEdit}
                      onClick={() => {
                        setNewCategory("");
                        openModal("category");
                      }}
                    >
                      <Plus size={15} /> New category
                    </button>
                  </div>
                  <div className="category-strip">
                    <button
                      className={`category-tile all-category ${category === "all" ? "selected" : ""}`}
                      onClick={() => setCategory("all")}
                    >
                      <span className="category-icon">
                        <LayoutDashboard size={20} />
                      </span>
                      <strong>All pieces</strong>
                      <small>
                        {
                          items.filter((i) =>
                            page === "wishlist" ? i.wishlist : !i.wishlist,
                          ).length
                        }{" "}
                        items
                      </small>
                    </button>
                    {room.sections.map((s, i) => (
                      <button
                        className={`category-tile ${categoryColors[i % 5]} ${category === s.id ? "selected" : ""}`}
                        key={s.id}
                        onClick={() =>
                          setCategory(category === s.id ? "all" : s.id)
                        }
                      >
                        <span className="category-icon">
                          <Shirt size={21} strokeWidth={1.4} />
                        </span>
                        <strong>{s.title}</strong>
                        <small>
                          {
                            s.items.filter((i) => room.done.includes(i.id))
                              .length
                          }{" "}
                          / {s.items.length} checked
                        </small>
                        <div className="category-progress">
                          <i
                            style={{
                              width: `${s.items.length ? (s.items.filter((i) => room.done.includes(i.id)).length / s.items.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="collection-toolbar">
                    <div className="tabs">
                      {[
                        { id: "all", label: "All items" },
                        { id: "pending", label: "To find" },
                        { id: "done", label: "Checked off" },
                        { id: "favorites", label: "Favourites" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          className={filter === f.id ? "active" : ""}
                          onClick={() => setFilter(f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="filter-tools">
                      <label className="search-field">
                        <Search size={16} />
                        <input
                          ref={search}
                          placeholder="Find a little something…"
                          aria-label="Search wardrobe"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query ? (
                          <button
                            onClick={() => setQuery("")}
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        ) : (
                          <kbd>⌘ K</kbd>
                        )}
                      </label>
                      <label className="sort-field">
                        <ListFilter size={16} />
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                          aria-label="Sort items"
                        >
                          <option value="default">Sort</option>
                          <option value="name">Name</option>
                          <option value="newest">Newest</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="sections-grid">
                    {visibleSections.map((s) => (
                      <section className="checklist-card" key={s.id}>
                        <header>
                          <div>
                            <h3>{s.title}</h3>
                            <p>{s.subtitle}</p>
                          </div>
                          <span className="section-count">
                            {
                              s.items.filter((i) => room.done.includes(i.id))
                                .length
                            }
                            <span>/{s.items.length}</span>
                          </span>
                        </header>
                        <div className="checklist-items">
                          {s.items.map((i) => renderItem(i, s.id))}
                          {!s.items.length && (
                            <p className="empty-inline">
                              A little room for something new.
                            </p>
                          )}
                        </div>
                        <footer>
                          <button
                            className="text-button"
                            disabled={!canEdit}
                            onClick={() => setEditor({ sectionId: s.id })}
                          >
                            <Plus size={14} /> Add a piece
                          </button>
                          {s.userAdded && (
                            <button
                              className="icon-button"
                              aria-label={`Delete category ${s.title}`}
                              disabled={!canEdit}
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Delete “${s.title}” and all its items? This affects everyone in this room.`,
                                  )
                                )
                                  return;
                                void change((d) => {
                                  const target = d.sections.find(
                                    (x) => x.id === s.id,
                                  );
                                  if (!target) return;
                                  for (const i of [...target.items])
                                    removeItem(d, i.id);
                                  d.sections = d.sections.filter(
                                    (x) => x.id !== s.id,
                                  );
                                }, "Removed category");
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </footer>
                      </section>
                    ))}
                  </div>
                  {!visibleSections.length && (
                    <div className="empty-state">
                      <Heart size={30} />
                      <h3>
                        {page === "wishlist"
                          ? "Your next favourite is out there."
                          : "Nothing here just yet."}
                      </h3>
                      <p>
                        {query
                          ? "Try another search or clear your filters."
                          : "Add a piece or save a link to start your collection."}
                      </p>
                      <button
                        className="button"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                          setCategory("all");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </>
              )}
              {page === "budget" && (
                <>
                  <section className="budget-hero panel">
                    <div>
                      <span className="eyebrow">YOUR WARDROBE BUDGET</span>
                      <h2>
                        {money(
                          Math.max(0, (room.budgetMinor || 0) - summary.spent),
                        )}
                      </h2>
                      <p>
                        {summary.spent > (room.budgetMinor || 0)
                          ? `${money(summary.spent - (room.budgetMinor || 0))} over your budget`
                          : "left for the pieces you’ll love"}
                      </p>
                    </div>
                    <button
                      className="button"
                      disabled={!canEdit}
                      onClick={() => openModal("settings")}
                    >
                      Set budget <Settings2 size={15} />
                    </button>
                    <div className="budget-track">
                      <i
                        style={{
                          width: `${Math.min(100, room.budgetMinor ? (summary.spent / room.budgetMinor) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                    <div className="budget-labels">
                      <span>{money(summary.spent)} spent</span>
                      <span>{money(room.budgetMinor || 0)} planned</span>
                    </div>
                  </section>
                  <div className="section-heading">
                    <h2>The pieces you brought home</h2>
                    <span className="muted">Actual purchases · INR</span>
                  </div>
                  <div className="purchase-list">
                    {items
                      .filter((i) => i.purchasedAt)
                      .map((i) => (
                        <article key={i.id}>
                          <span className="stat-icon sage">
                            <Shirt size={20} />
                          </span>
                          <div>
                            <strong>{i.label}</strong>
                            <small>
                              {i.sectionTitle} ·{" "}
                              {new Date(i.purchasedAt!).toLocaleDateString(
                                "en-IN",
                              )}
                            </small>
                          </div>
                          <strong>{money(i.paidMinor || 0)}</strong>
                          <button
                            className="icon-button"
                            aria-label={`Edit purchase ${i.label}`}
                            disabled={!canEdit}
                            onClick={() =>
                              setEditor({ item: i, sectionId: i.sectionId })
                            }
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </article>
                      ))}
                  </div>
                  {!items.some((i) => i.purchasedAt) && (
                    <div className="empty-state">
                      <Wallet size={32} />
                      <h3>Make room for something lovely.</h3>
                      <p>
                        Edit an item and record the amount you paid. Checklist
                        ticks won’t change your spending history.
                      </p>
                    </div>
                  )}
                </>
              )}
              {page === "activity" && (
                <div className="activity-list">
                  {[...(room.activity || [])].reverse().map((a) => (
                    <article key={a.id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{a.text}</strong>
                        <p>
                          {a.actor}{" "}
                          <span>
                            ·{" "}
                            {new Date(a.at).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                      </div>
                    </article>
                  ))}
                  {!room.activity?.length && (
                    <div className="empty-state">
                      <ActivityIcon size={30} />
                      <h3>Every little step, remembered.</h3>
                      <p>
                        New changes will appear here as your wardrobe comes
                        together.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {page === "private" && (
                <div className="private-space" key={w.user?.uid || "guest"}>
                  <PrivateWardrobe
                    user={w.user}
                    onLogin={() => openModal("auth")}
                  />
                  {w.user && !w.user.isAnonymous && (
                    <PrivateNotes
                      user={w.user}
                      demo={false}
                      onLogin={() => openModal("auth")}
                    />
                  )}
                </div>
              )}
              <footer className="page-footer">
                <span>
                  <Shirt size={14} /> Collected with care. Worn with love.
                </span>
                <span>
                  Sania’s Wardrobe <span className="footer-star">✧</span>
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          { id: "overview", label: "Home", icon: LayoutDashboard },
          { id: "checklist", label: "Checklist", icon: ClipboardList },
          { id: "wishlist", label: "Saved", icon: Heart },
          { id: "budget", label: "Spending", icon: Wallet },
        ].map((n) => (
          <button
            key={n.id}
            aria-current={page === n.id ? "page" : undefined}
            className={page === n.id ? "active" : ""}
            onClick={() => go(n.id as Page)}
          >
            <n.icon size={21} strokeWidth={1.7} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          onClick={() => setSidebar(true)}
          aria-expanded={sidebar}
          aria-label="More navigation"
        >
          <Menu size={21} strokeWidth={1.7} />
          <span>More</span>
        </button>
      </nav>
      {canEdit &&
        ["overview", "checklist", "wishlist"].includes(page) &&
        !modal &&
        !editor &&
        !photoItem &&
        !sidebar && (
          <button
            className="mobile-add-button"
            aria-label="Quick add item"
            onClick={() =>
              setEditor({
                sectionId: category !== "all" ? category : undefined,
              })
            }
          >
            <Plus size={22} />
          </button>
        )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "auth" && (
        <Modal title="Make yourself at home." onClose={() => setModal(null)}>
          {!w.user || w.user.isAnonymous ? (
            <AuthForm
              onDone={() => {
                notify("You’re signed in.");
                setModal(null);
              }}
            />
          ) : (
            <p className="muted">
              Signed in as {w.user.email || w.user.displayName}. Your shared
              wardrobe stays here. Open Private space for your personal items
              and notes; only your account can access them.
            </p>
          )}
          {w.user && !w.user.isAnonymous && (
            <button
              className="button create-room-button"
              onClick={() => {
                setModal(null);
                go("private");
              }}
            >
              Open private space <ArrowRight size={16} />
            </button>
          )}
        </Modal>
      )}
      {modal === "link" && (
        <Modal title="A find worth keeping." onClose={() => setModal(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void saveLinks();
            }}
          >
            <p className="muted">
              Paste up to 10 product links, one per line. Links save first;
              details follow.
            </p>
            <label>
              Product links
              <textarea
                autoFocus
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.myntra.com/…"
                rows={3}
                required
                maxLength={25000}
              />
            </label>
            <button
              type="button"
              className="button ai-button"
              disabled={busy || !link}
              onClick={() => void suggest()}
            >
              <Sparkles size={16} />{" "}
              {busy ? "One moment…" : "Suggest a category"}
            </button>
            {suggestion && <p className="suggestion">{suggestion}</p>}
            <label>
              Save under
              <select
                value={linkCategory}
                onChange={(e) => {
                  setLinkCategory(e.target.value);
                  setLinkNeed("");
                }}
              >
                {room.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Match to an existing need
              <select
                value={linkNeed}
                onChange={(e) => setLinkNeed(e.target.value)}
              >
                <option value="">Save as a separate item</option>
                {room.sections
                  .find((s) => s.id === linkCategory)
                  ?.items.filter((i) => !i.productUrl)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
              </select>
              <small>
                Options linked to a need won’t increase your essentials count.
              </small>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={linkWishlist}
                onChange={(e) => setLinkWishlist(e.target.checked)}
              />{" "}
              Keep in wishlist for now
            </label>
            {formError && (
              <p className="form-message" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              Save to wardrobe <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "category" && (
        <Modal title="Make a little more room." onClose={() => setModal(null)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const title = newCategory.trim();
              if (!title) return;
              const sid = id();
              if (
                await change((d) => {
                  if (d.sections.length >= 100)
                    throw Error(
                      "This wardrobe has reached its category limit.",
                    );
                  if (
                    d.sections.some(
                      (s) => s.title.toLowerCase() === title.toLowerCase(),
                    )
                  )
                    throw Error("That category already exists.");
                  d.sections.push({
                    id: sid,
                    title,
                    subtitle: "A collection of your own",
                    items: [],
                    userAdded: true,
                  });
                }, "Added a category")
              )
                setModal(null);
            }}
          >
            <label>
              Category name
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Weekend favourites"
                maxLength={75}
                required
              />
            </label>
            <button className="button primary">
              Create category <Plus size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "invite" && (
        <Modal title="Better, together." onClose={() => setModal(null)}>
          <div className="form-stack">
            <p className="muted">
              {demo
                ? "This is a local demo. Sign in and create a shared wardrobe to invite someone."
                : room.ownerId
                  ? "Editor access lets either of you add, edit, remove and check off items without asking the other person. Join once with your own account. Invitations expire after seven days; joined members keep access."
                  : "Both of you can add, edit, remove and check off items using this link, before or after signing in. No approval from the other person is needed. Anyone with this link can edit, so keep it between people you trust."}
            </p>
            {!demo && room.ownerId && w.role === "owner" && (
              <label>
                They can
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="editor">
                    Edit together — add, edit and remove pieces
                  </option>
                  <option value="viewer">View the wardrobe</option>
                </select>
              </label>
            )}
            {!demo && (!room.ownerId || w.role === "owner") && (
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    let url = location.href;
                    if (room.ownerId) {
                      const result = await api<{ token: string }>("invite", {
                        action: "create",
                        roomId: w.roomId,
                        role: inviteRole,
                      });
                      url = `${location.origin}/#room=${w.roomId}&invite=${result.token}`;
                    }
                    setInviteUrl(url);
                    try {
                      await navigator.clipboard.writeText(url);
                      notify("Invite link copied.");
                    } catch {
                      notify("Copy the link below.");
                    }
                  } catch (e) {
                    setFormError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Copy size={16} />{" "}
                {busy ? "Creating invite…" : "Copy invite link"}
              </button>
            )}
            {inviteUrl && typeof navigator.share === "function" && (
              <button
                className="button"
                onClick={() => {
                  void navigator
                    .share({ title: "Join my wardrobe", url: inviteUrl })
                    .catch((e) => {
                      if (e.name !== "AbortError")
                        notify("Use the copy link option to share.");
                    });
                }}
              >
                <Users size={16} /> Share on your phone
              </button>
            )}
            {inviteUrl && (
              <label>
                Invite link
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
            {!demo && room.ownerId && w.role !== "owner" && (
              <p>Ask the wardrobe owner for a new invitation.</p>
            )}
            {formError && (
              <p className="form-message" role="alert">
                {formError}
              </p>
            )}
            {demo && (
              <button
                className="button primary"
                onClick={() => openModal("auth")}
              >
                Sign in
              </button>
            )}
            {room.ownerId && w.role === "owner" && (
              <button
                className="text-button"
                onClick={async () => {
                  if (
                    !confirm(
                      "Revoke all unused invitation links? Existing members keep access.",
                    )
                  )
                    return;
                  try {
                    await api("invite", { action: "revoke", roomId: w.roomId });
                    notify("Unused invites revoked.");
                    setInviteUrl("");
                  } catch (e) {
                    setFormError((e as Error).message);
                  }
                }}
              >
                Revoke unused invites
              </button>
            )}
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Just the way you like it." onClose={() => setModal(null)}>
          <div className="form-stack">
            <label>
              Wardrobe budget (₹)
              <input
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={!canEdit}
              />
            </label>
            <button
              className="button primary"
              disabled={!canEdit}
              onClick={async () => {
                try {
                  const amount = toMinor(budget) ?? 0;
                  if (
                    await change((d) => {
                      d.budgetMinor = amount;
                    }, "Updated wardrobe budget")
                  )
                    setModal(null);
                } catch (e) {
                  setFormError((e as Error).message);
                }
              }}
            >
              Save budget
            </button>
            {formError && (
              <p className="form-message" role="alert">
                {formError}
              </p>
            )}
            <div className="settings-divider" />
            <button className="button" onClick={download}>
              <ArrowDownToLine size={16} /> Download JSON backup
            </button>
            <button
              className="button"
              disabled={!canEdit}
              onClick={() => {
                if (
                  confirm(
                    "Clear all checklist ticks? Recorded purchases and amounts paid are kept.",
                  )
                )
                  void change((d) => {
                    d.done = [];
                  }, "Reset checklist ticks");
              }}
            >
              Reset checklist ticks
            </button>
            <button
              className="button"
              onClick={() => {
                setModal(null);
                go("private");
              }}
            >
              <LockKeyhole size={16} /> Open private space
            </button>
            <p className="fine-print">
              {demo
                ? "Demo changes are saved only in this browser. Open your existing invite link to access your shared wardrobe."
                : room.ownerId
                  ? `Your role: ${w.role || "not a member"}.`
                  : "This legacy room retains private-link access. Ownership must be assigned by the project administrator before enabling account-based permissions."}
            </p>
            <p className="fine-print">
              Product photos and prices may be incomplete. Check the retailer
              before buying. Private notes are not an encrypted vault.
            </p>
          </div>
        </Modal>
      )}
      {editor && (
        <Modal
          title={editor.item ? "The little details." : "Add a piece of you."}
          onClose={() => setEditor(null)}
        >
          <ItemForm
            room={room}
            defaultWishlist={page === "wishlist"}
            initial={editor.item}
            sectionId={editor.sectionId}
            onSave={saveItem}
            onCancel={() => setEditor(null)}
          />
          {editor.item && canEdit && (
            <button
              className="text-button danger"
              onClick={async () => {
                if (!confirm(`Delete “${editor.item!.label}”?`)) return;
                if (
                  await change(
                    (d) => removeItem(d, editor.item!.id),
                    "Removed item",
                  )
                )
                  setEditor(null);
              }}
            >
              <Trash2 size={14} /> Delete item
            </button>
          )}
        </Modal>
      )}
      {photoItem && (
        <Modal title="Find the right match." onClose={() => setPhotoItem(null)}>
          <p className="muted">
            Search results may show another colour or model. Choose carefully.
          </p>
          <div className="photo-candidates">
            {photoItem.candidates?.map((c, i) => {
              const image = c.image?.startsWith("https://")
                ? c.image
                : c.thumbnail?.startsWith("https://")
                  ? c.thumbnail
                  : "";
              return (
                image && (
                  <button
                    key={i}
                    onClick={async () => {
                      if (
                        await change((d) => {
                          for (const s of d.sections) {
                            const item = s.items.find(
                              (x) => x.id === photoItem.id,
                            );
                            if (item) {
                              item.images = [image];
                              item.imageUrl = image;
                              item.imageSource = "image-search-selected";
                              item.updatedAt = Date.now();
                            }
                          }
                        }, "Saved your chosen photo")
                      )
                        setPhotoItem(null);
                    }}
                  >
                    <img
                      src={
                        c.thumbnail?.startsWith("https://")
                          ? c.thumbnail
                          : image
                      }
                      alt={c.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span>{c.title}</span>
                  </button>
                )
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
