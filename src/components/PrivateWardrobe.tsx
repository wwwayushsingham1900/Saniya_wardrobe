import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onValue, ref, set, remove } from "firebase/database";
import { LockKeyhole, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { db } from "../lib/firebase";
import { newRoom, type Product } from "../lib/model";
import ItemForm from "./ItemForm";
import Modal from "./Modal";

type PrivateItem = Product & { categoryId: string };
const template = newRoom();
template.sections = template.sections.map((s) => ({ ...s, items: [] }));

export default function PrivateWardrobe({
  user,
  onLogin,
}: {
  user: User | null;
  onLogin: () => void;
}) {
  const [items, setItems] = useState<Record<string, PrivateItem>>({});
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PrivateItem | "new" | null>(null);
  const [query, setQuery] = useState("");
  const eligible = !!user && !user.isAnonymous;
  useEffect(() => {
    setItems({});
    setReady(false);
    setError("");
    setEditing(null);
    if (!eligible || !db || !user) return;
    const stopConnection = onValue(ref(db, ".info/connected"), (s) =>
      setConnected(s.val() === true),
    );
    const stop = onValue(
      ref(db, `users/${user.uid}/privateItems`),
      (snapshot) => {
        setItems(snapshot.val() || {});
        setReady(true);
        setError("");
      },
      () => {
        setReady(false);
        setError(
          "Your private wardrobe could not connect. Check your connection and make sure the updated database rules have been published.",
        );
      },
    );
    return () => {
      stop();
      stopConnection();
    };
  }, [eligible, user?.uid]);
  if (!eligible)
    return (
      <div className="empty-state private-empty">
        <span className="empty-icon">
          <LockKeyhole />
        </span>
        <h2>A wardrobe just for you.</h2>
        <p>
          Sign in to save personal clothes, product links and notes. Your shared
          wardrobe stays separate.
        </p>
        <p className="fine-print">
          Private notes use account access controls. They are not an encrypted
          password vault.
        </p>
        <button className="button primary" onClick={onLogin}>
          Sign in to your private space
        </button>
      </div>
    );
  const visible = Object.entries(items)
    .filter(([, item]) =>
      `${item.label} ${item.description || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  return (
    <section className="private-wardrobe" aria-label="Private wardrobe">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Only your account</span>
          <h2>Your personal wardrobe.</h2>
        </div>
        <LockKeyhole size={24} />
      </div>
      <p className="muted">
        These items sync across your devices, but never appear in the shared
        wardrobe. Go back to Overview or Checklist to see your shared items.
      </p>
      {error && (
        <p role="alert" className="form-message">
          {error}
        </p>
      )}
      {!connected && ready && (
        <p role="status">You’re offline. Reconnect to save changes.</p>
      )}
      <div className="private-toolbar">
        <label>
          Search private items
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find something of yours…"
          />
        </label>
        <button
          className="button primary"
          disabled={!ready || !connected}
          onClick={() => setEditing("new")}
        >
          <Plus size={18} /> Add private item
        </button>
      </div>
      {!ready && !error && <p role="status">Opening your private wardrobe…</p>}
      {ready && !visible.length && (
        <p className="empty-inline">
          {query
            ? "No matching private items."
            : "Your private wardrobe is empty. Add your first piece here."}
        </p>
      )}
      <div className="private-item-grid">
        {visible.map(([key, item]) => (
          <article className="panel private-item" key={key}>
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.label}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <small>
              {template.sections.find((s) => s.id === item.categoryId)?.title ||
                "Personal items"}
              {item.wishlist ? " · Wishlist" : ""}
            </small>
            <h3>{item.label}</h3>
            {item.description && <p>{item.description}</p>}
            <p className="muted">
              {[item.size, item.color, item.price].filter(Boolean).join(" · ")}
            </p>
            {item.purchasedAt && (
              <small>
                Purchased · ₹
                {((item.paidMinor || 0) / 100).toLocaleString("en-IN")}
              </small>
            )}
            <div className="private-item-actions">
              {item.productUrl && (
                <a
                  className="button"
                  href={item.productUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} /> View product
                </a>
              )}
              <button
                className="icon-button"
                disabled={!ready || !connected}
                aria-label={`Edit ${item.label}`}
                onClick={() => setEditing(item)}
              >
                <Pencil size={18} />
              </button>
              <button
                className="icon-button"
                disabled={!ready || !connected}
                aria-label={`Delete ${item.label}`}
                onClick={async () => {
                  if (
                    !confirm(
                      `Delete “${item.label}” from your private wardrobe?`,
                    )
                  )
                    return;
                  try {
                    await remove(
                      ref(db!, `users/${user!.uid}/privateItems/${key}`),
                    );
                  } catch {
                    setError(
                      "Could not delete this item. Check your connection and try again.",
                    );
                  }
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <Modal
          title={
            editing === "new" ? "A piece just for you." : "Your private piece."
          }
          onClose={() => setEditing(null)}
        >
          <ItemForm
            room={template}
            initial={editing === "new" ? undefined : editing}
            sectionId={editing === "new" ? undefined : editing.categoryId}
            onCancel={() => setEditing(null)}
            onSave={async (item, categoryId) => {
              if (!connected) throw Error("Reconnect before saving.");
              await set(
                ref(db!, `users/${user!.uid}/privateItems/${item.id}`),
                JSON.parse(JSON.stringify({ ...item, categoryId })),
              );
              setEditing(null);
              setError("");
            }}
          />
        </Modal>
      )}
    </section>
  );
}
