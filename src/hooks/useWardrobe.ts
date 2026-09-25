import { useCallback, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { onValue, ref, runTransaction } from "firebase/database";
import { auth, db } from "../lib/firebase";
import { id, newRoom, normalizeRoom, type Room, type Role } from "../lib/model";
import { initialSharedRoom, rememberSharedRoom } from "../lib/sharedRoom";
const DEMO_KEY = "wardrobe-demo-v2";
const hashRoom = () => {
  const value = new URLSearchParams(location.hash.slice(1)).get("room");
  return value && /^[a-f0-9]{40}$/.test(value) ? value : null;
};
function demoRoom(): Room {
  try {
    const value = localStorage.getItem(DEMO_KEY);
    if (value) return normalizeRoom(JSON.parse(value));
  } catch {}
  return newRoom();
}
export function useWardrobe() {
  const [roomId, setRoomId] = useState(initialSharedRoom),
    [user, setUser] = useState<User | null>(null),
    [room, setRoom] = useState<Room>(demoRoom),
    [connected, setConnected] = useState(false),
    [ready, setReady] = useState(!hashRoom()),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0);
  const [access, setAccess] = useState<{
    ownerId: string;
    members: Record<string, Role>;
  } | null>(null);
  const current = useRef(room);
  current.current = room;
  const demo = !roomId;
  useEffect(() => {
    const change = () => {
      setReady(false);
      setError("");
      setRoomId(hashRoom());
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!auth) {
      if (roomId) setError("Firebase configuration is missing.");
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u && roomId)
        void signInAnonymously(auth!).catch((e) => setError(e.message));
    });
  }, [roomId]);
  useEffect(() => {
    if (demo) {
      setRoom(demoRoom());
      setReady(true);
      setConnected(false);
      const sync = (e: StorageEvent) => {
        if (e.key === DEMO_KEY) setRoom(demoRoom());
      };
      window.addEventListener("storage", sync);
      return () => window.removeEventListener("storage", sync);
    }
    setReady(false);
    setAccess(null);
    if (!db || !user) return;
    let received = false;
    const timer = setTimeout(() => {
      if (!received)
        setError(
          "The shared wardrobe is taking longer to connect. Check your connection or retry.",
        );
    }, 12000);
    const stopConnection = onValue(ref(db, ".info/connected"), (s) =>
      setConnected(s.val() === true),
    );
    const stopAccess = onValue(
      ref(db, `roomAccess/${roomId}`),
      (s) => setAccess(s.val()),
      () => setAccess(null),
    );
    const stopRoom = onValue(
      ref(db, `rooms/${roomId}`),
      (snapshot) => {
        received = true;
        clearTimeout(timer);
        if (!snapshot.exists()) {
          setError("This wardrobe was not found. Check your invite link.");
          setReady(false);
          return;
        }
        rememberSharedRoom(roomId!);
        setRoom(normalizeRoom(snapshot.val()));
        setReady(true);
        setError("");
      },
      () => {
        received = true;
        clearTimeout(timer);
        setReady(false);
        setError(
          "You do not have access to this wardrobe. Sign in with an invited account or ask the owner for an invite.",
        );
      },
    );
    return () => {
      clearTimeout(timer);
      stopConnection();
      stopRoom();
      stopAccess();
    };
  }, [roomId, user?.uid, demo]);
  const role = demo
    ? "owner"
    : room.ownerId
      ? access?.members?.[user?.uid || ""]
      : "editor";
  const canEdit = ready && (demo || role === "owner" || role === "editor");
  const mutate = useCallback(
    async (change: (draft: Room) => void, text: string) => {
      if (!ready) throw Error("Wait for the wardrobe to connect.");
      if (!canEdit) throw Error("This wardrobe is view-only.");
      if (!demo && !connected)
        throw Error("You are offline. Reconnect before saving.");
      const at = Date.now(),
        event = {
          id: id(),
          text,
          actor: demo
            ? "You (demo)"
            : user?.displayName || user?.email?.split("@")[0] || "Guest",
          at,
        };
      const apply = (value: Room) => {
        const draft = normalizeRoom(structuredClone(value));
        change(draft);
        draft.updatedAt = at;
        draft.activity = [...(draft.activity || []), event].slice(-60);
        return JSON.parse(JSON.stringify(draft)) as Room;
      };
      setPending((n) => n + 1);
      try {
        if (demo) {
          const next = apply(current.current);
          localStorage.setItem(DEMO_KEY, JSON.stringify(next));
          current.current = next;
          setRoom(next);
        } else {
          const result = await runTransaction(
            ref(db!, `rooms/${roomId}`),
            (value) => {
              if (!value) return;
              return apply(value);
            },
            { applyLocally: false },
          );
          if (!result.committed)
            throw Error("The wardrobe changed. Please try again.");
        }
      } finally {
        setPending((n) => n - 1);
      }
    },
    [ready, canEdit, demo, connected, user, roomId],
  );
  return {
    room,
    roomId,
    user,
    access,
    role,
    demo,
    ready,
    connected,
    error,
    pending,
    canEdit,
    mutate,
  };
}
