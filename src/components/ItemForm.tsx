import { useState } from "react";
import {
  type Product,
  type Room,
  id,
  normalizeUrl,
  fallbackTitle,
  toMinor,
} from "../lib/model";
export default function ItemForm({
  room,
  initial,
  sectionId,
  onSave,
  onCancel,
  defaultWishlist = false,
}: {
  room: Room;
  initial?: Product;
  sectionId?: string;
  defaultWishlist?: boolean;
  onSave: (item: Product, sid: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [sid, setSid] = useState(sectionId || room.sections[0]?.id || ""),
    [label, setLabel] = useState(initial?.label || ""),
    [url, setUrl] = useState(initial?.productUrl || ""),
    [price, setPrice] = useState(initial?.price || ""),
    [description, setDescription] = useState(initial?.description || ""),
    [optional, setOptional] = useState(initial?.optional || false),
    [wishlist, setWishlist] = useState(initial?.wishlist ?? defaultWishlist),
    [needId, setNeedId] = useState(initial?.needId || ""),
    [photos, setPhotos] = useState((initial?.images || []).join("\n")),
    [size, setSize] = useState(initial?.size || ""),
    [color, setColor] = useState(initial?.color || ""),
    [paid, setPaid] = useState(
      initial?.paidMinor !== undefined ? String(initial.paidMinor / 100) : "",
    ),
    [purchased, setPurchased] = useState(!!initial?.purchasedAt),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const productUrl = url ? normalizeUrl(url) : undefined;
          if (url && !productUrl)
            throw Error("Please enter a valid product URL.");
          const images = photos
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          if (images.some((s) => !normalizeUrl(s) || !s.startsWith("https://")))
            throw Error("Photo URLs must start with https://.");
          const item: Product = {
            ...initial,
            id: initial?.id || id(),
            label:
              label.trim() || (productUrl ? fallbackTitle(productUrl) : ""),
            optional,
            userAdded: initial?.userAdded ?? true,
            wishlist,
            price,
            description,
            size,
            color,
            images: images.slice(0, 5),
            imageUrl: images[0] || "",
            updatedAt: Date.now(),
            createdAt: initial?.createdAt || Date.now(),
          };
          if (!item.label) throw Error("Give your item a name.");
          if (productUrl) item.productUrl = productUrl;
          else delete item.productUrl;
          if (needId) item.needId = needId;
          else delete item.needId;
          if (purchased) {
            item.purchasedAt = initial?.purchasedAt || Date.now();
            item.paidMinor = toMinor(paid) ?? 0;
          } else {
            delete item.purchasedAt;
            delete item.paidMinor;
          }
          await onSave(item, sid);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Item name
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. The perfect olive shirt"
          maxLength={120}
          required
        />
      </label>
      <label>
        Category
        <select
          aria-label="Category"
          value={sid}
          onChange={(e) => {
            setSid(e.target.value);
            setNeedId("");
          }}
          required
        >
          {room.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Product link <span>(optional)</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2500}
          placeholder="https://…"
        />
      </label>
      {url && (
        <label>
          Fulfils a checklist need
          <select value={needId} onChange={(e) => setNeedId(e.target.value)}>
            <option value="">A separate item</option>
            {room.sections
              .find((s) => s.id === sid)
              ?.items.filter((i) => !i.productUrl && i.id !== initial?.id)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
          </select>
        </label>
      )}
      <details className="item-extra-details">
        <summary>Fit, price & other details</summary>
        <div className="form-stack">
          <div className="form-row">
            <label>
              Listed price
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="₹1,499"
                maxLength={45}
              />
            </label>
            <label>
              Size
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="M / 38"
                maxLength={30}
              />
            </label>
          </div>
          <label>
            Colour
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Olive green"
              maxLength={40}
            />
          </label>
          <label>
            Notes
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Fit, fabric, or a little reminder…"
            />
          </label>
          <details>
            <summary>Product photos</summary>
            <label>
              Direct image URLs (one per line, up to 5)
              <textarea
                value={photos}
                onChange={(e) => setPhotos(e.target.value)}
                placeholder="https://…"
              />
            </label>
          </details>
        </div>
      </details>
      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={optional}
            onChange={(e) => setOptional(e.target.checked)}
          />{" "}
          Optional item
        </label>
        <label>
          <input
            type="checkbox"
            checked={wishlist}
            onChange={(e) => setWishlist(e.target.checked)}
          />{" "}
          Keep in wishlist
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={purchased}
          onChange={(e) => setPurchased(e.target.checked)}
        />{" "}
        Record a purchase
      </label>
      {purchased && (
        <label>
          Amount actually paid (₹)
          <input
            inputMode="decimal"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="0.00"
            required
          />
          <small>Purchase history is separate from checklist ticks.</small>
        </label>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !sid}>
          {busy ? "Saving…" : "Save item"}
        </button>
      </div>
    </form>
  );
}
