import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
export default function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(google = false) {
    setBusy(true);
    setMessage("");
    try {
      if (!auth) throw Error("Firebase is not configured.");
      if (google) {
        const provider = new GoogleAuthProvider();
        if (auth.currentUser?.isAnonymous) {
          try {
            await linkWithPopup(auth.currentUser, provider);
          } catch (e) {
            if (
              (e as { code: string }).code === "auth/credential-already-in-use"
            ) {
              const credential = GoogleAuthProvider.credentialFromError(
                e as Parameters<
                  typeof GoogleAuthProvider.credentialFromError
                >[0],
              );
              if (!credential) throw e;
              await signInWithCredential(auth, credential);
            } else throw e;
          }
        } else await signInWithPopup(auth, provider);
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage("If an account exists, a reset email will arrive shortly.");
        return;
      } else if (mode === "register") {
        const result = auth.currentUser?.isAnonymous
          ? await linkWithCredential(
              auth.currentUser,
              EmailAuthProvider.credential(email, password),
            )
          : await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim())
          await updateProfile(result.user, { displayName: name.trim() });
      } else await signInWithEmailAndPassword(auth, email, password);
      onDone();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMessage(
        code === "auth/operation-not-allowed"
          ? "This sign-in provider needs to be enabled in Firebase Console."
          : code === "auth/unauthorized-domain"
            ? `Google sign-in is not enabled for ${window.location.hostname}. Add this exact domain in Firebase Console → Authentication → Settings → Authorized domains, then retry. Your wardrobe has not been changed.`
            : code === "auth/popup-blocked"
              ? "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again. On mobile, open this link directly in Safari or Chrome."
              : code === "auth/popup-closed-by-user"
                ? "The Google sign-in window closed before sign-in finished. Tap Continue with Google to try again. Your wardrobe is unchanged."
                : code === "auth/invalid-credential"
                  ? "The email or password is incorrect."
                  : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted">
        Sign in to keep personal clothes and notes in Private space. Your
        current shared wardrobe and its items stay in place; signing in does not
        create a new room.
      </p>
      <div className="segmented">
        <button
          onClick={() => setMode("login")}
          className={mode === "login" ? "active" : ""}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("register")}
          className={mode === "register" ? "active" : ""}
        >
          Create account
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="form-stack"
      >
        {mode === "register" && (
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="name"
              required
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              minLength={8}
              required
            />
          </label>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "reset"
              ? "Send reset link"
              : mode === "register"
                ? "Create account"
                : "Sign in"}
        </button>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </form>
      <button
        className="text-button"
        onClick={() => {
          setMode("reset");
          setMessage("");
        }}
      >
        Forgot password?
      </button>
      <div className="divider-label">or</div>
      <button
        className="button google"
        disabled={busy}
        onClick={() => void submit(true)}
      >
        <span className="google-g">G</span> Continue with Google
      </button>
    </>
  );
}
