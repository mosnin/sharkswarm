const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

/**
 * Authenticated API call — passes Clerk session token to backend.
 * Use this from client components where useAuth() is available.
 */
export async function authApi<T>(
  path: string,
  token: string | null,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}
