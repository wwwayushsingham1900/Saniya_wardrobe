const KEY = "wardrobe-shared-room";
export const validRoomId = (
  value: string | null | undefined,
): value is string => !!value && /^[a-f0-9]{40}$/.test(value);

export function initialSharedRoom() {
  const params = new URLSearchParams(location.hash.slice(1));
  const explicit = params.get("room");
  if (validRoomId(explicit)) return explicit;
  // Explicit demo mode never connects to a real wardrobe.
  if (new URLSearchParams(location.search).get("demo") === "1") return null;
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(KEY);
  } catch {}
  const configured = import.meta.env.VITE_DEFAULT_ROOM_ID;
  const selected = validRoomId(configured)
    ? configured
    : validRoomId(remembered)
      ? remembered
      : null;
  if (selected) {
    params.set("room", selected);
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#${params}`,
    );
  }
  return selected;
}
export function rememberSharedRoom(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {}
}
