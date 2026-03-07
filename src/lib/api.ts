import { auth } from "./firebase";

export async function apiFetch(url: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body && !(options.body instanceof FormData) && !options.headers?.toString().includes("Content-Type")
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });
}
