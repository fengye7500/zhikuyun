export interface User {
  nickname: string;
}

export interface SearchItem {
  id: string;
  name: string;
  extension: string;
  type: "file" | "folder";
  path: string;
  spaceName: string;
  modifiedAt: string;
  openUrl: string;
}

export interface SearchResult {
  items: SearchItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) {
    const error = new Error(body.message ?? "请求失败") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

export const api = {
  login: (account: string, password: string) =>
    request<{ authenticated: true; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ account, password })
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  status: () => request<{ authenticated: true; user: User }>("/api/auth/status"),
  search: (
    q: string,
    refine: string,
    type: "all" | "file" | "folder",
    extensions: string[],
    page: number,
    pageSize: number,
    signal?: AbortSignal
  ) => {
    const params = new URLSearchParams({
      q,
      refine,
      type,
      extensions: extensions.join(","),
      page: String(page),
      pageSize: String(pageSize)
    });
    return request<SearchResult>(`/api/files/search?${params}`, { signal });
  }
};
