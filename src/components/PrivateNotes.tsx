import { useEffect, useState } from "react";
import { onValue, ref, set, remove } from "firebase/database";
import { LockKeyhole, Plus, Trash2 } from "lucide-react";
import { db } from "../lib/firebase";
import { id } from "../lib/model";
import type { User } from "firebase/auth";
type Note = { title: string; body: string; updatedAt: number };
export default function PrivateNotes({
  user,
  demo,
  onLogin,
}: {
  user: User | null;
  demo: boolean;
  onLogin: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, Note>>({}),
    [error, setError] = useState(""),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  const eligible = !demo && !!user && !user.isAnonymous;
  useEffect(() => {
    setNotes({});
    setError("");
    if (!eligible || !db || !user) return;
    return onValue(
      ref(db, `users/${user.uid}/privateNotes`),
      (s) => setNotes(s.val() || {}),
      () =>
        setError(
          "Private notes are not available yet. The updated database rules must be published before you can save here.",
        ),
    );
  }, [eligible, user?.uid]);
  if (!eligible)
    return (
      <div className="empty-state private-empty">
        <span className="empty-icon">
          <LockKeyhole />
        </span>
        <h2>A space just for you.</h2>
        <p>
          Keep gift ideas, personal notes and a secret wishlist separate from
          your shared wardrobe.
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
  return (
    <div className="private-layout">
      <div>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Only your account</span>
            <h2>Little things, just for you.</h2>
          </div>
          <LockKeyhole size={24} />
        </div>
        <p className="muted">
          Collaborators cannot access this section. Notes are access-controlled,
          not end-to-end encrypted.
        </p>
        {error && (
          <p role="alert" className="form-message">
            {error}
          </p>
        )}
        <div className="notes-grid">
          {Object.entries(notes)
            .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
            .map(([nid, n]) => (
              <article className="note-card" key={nid}>
                <div>
                  <h3>{n.title}</h3>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${n.title}`}
                    onClick={async () => {
                      if (!confirm("Delete this private note?")) return;
                      try {
                        await remove(
                          ref(db!, `users/${user!.uid}/privateNotes/${nid}`),
                        );
                      } catch {
                        setError("Could not delete this note.");
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p>{n.body}</p>
                <small>
                  {new Date(n.updatedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </article>
            ))}
        </div>
        {!Object.keys(notes).length && (
          <p className="empty-inline">
            Your private collection starts with a little note.
          </p>
        )}
      </div>
      <form
        className="panel form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await set(ref(db!, `users/${user!.uid}/privateNotes/${id()}`), {
              title: title.trim(),
              body: body.trim(),
              updatedAt: Date.now(),
            });
            setTitle("");
            setBody("");
            setError("");
          } catch {
            setError(
              "Could not save. Check your connection and database rules.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>A new note</h3>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="A surprise for someone…"
          />
        </label>
        <label>
          Your note
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={5000}
            placeholder="Keep it here."
          />
        </label>
        <button className="button primary" disabled={busy || !!error}>
          <Plus size={16} /> {busy ? "Saving…" : "Save privately"}
        </button>
      </form>
    </div>
  );
}
