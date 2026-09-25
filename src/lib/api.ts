import { auth } from "./firebase";
export async function api<T>(name: string, body: unknown): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw Error("Sign in to use online product tools.");
  const response = await fetch(`/.netlify/functions/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({
    error: "Product tools are unavailable. Your saved link is safe.",
  }));
  if (!response.ok) throw Error(data.error || "Request failed.");
  return data;
}
