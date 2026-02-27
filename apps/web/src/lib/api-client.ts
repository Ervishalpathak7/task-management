import type { ApiProblem } from "@task-management/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  public readonly status: number;
  public readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.detail);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number>;
}

/**
 * Core API client.
 * - All requests include credentials (cookies sent automatically).
 * - No tokens stored in JS — fully cookie-based auth.
 * - On 401, attempts a silent refresh and retries once.
 */
async function request<T>(options: RequestOptions): Promise<T> {
  const url = buildUrl(options.path, options.query);

  const response = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Origin: typeof window !== "undefined" ? window.location.origin : "",
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    // Attempt silent refresh
    const refreshed = await attemptRefresh();
    if (refreshed) {
      // Retry original request once
      const retryResponse = await fetch(url, {
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          Origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        credentials: "include",
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (retryResponse.ok) {
        return retryResponse.json() as Promise<T>;
      }

      const retryError = (await retryResponse.json()) as ApiProblem;
      throw new ApiError(retryError);
    }

    // Refresh failed — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    const errorBody = (await response.json()) as ApiProblem;
    throw new ApiError(errorBody);
  }

  if (!response.ok) {
    const errorBody = (await response.json()) as ApiProblem;
    throw new ApiError(errorBody);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildUrl(
  path: string,
  query?: Record<string, string | number>,
): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// ─── Convenience methods ────────────────────────────────────

export const api = {
  get<T>(path: string, query?: Record<string, string | number>): Promise<T> {
    return request<T>({ method: "GET", path, query });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>({ method: "POST", path, body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>({ method: "PATCH", path, body });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>({ method: "DELETE", path });
  },
};
