const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8090/api/v1";

export type BackendError = {
  code: string;
  message: string;
};

// Maps a backend error response/status into a stable shape for the client.
function mapError(status: number, raw: unknown): BackendError {
  const body = (raw ?? {}) as { code?: string; message?: string; error?: string };
  const code = body.code ?? (status === 404 ? "not_found" : status === 409 ? "version_conflict" : "request_failed");
  const message = body.message ?? body.error ?? `Backend request failed (${status})`;
  return { code, message };
}

// Performs a server-side request to the Go backend.
// Returns parsed JSON on success; throws an object {status, error} on failure.
export async function backendFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw { status: response.status, error: mapError(response.status, parsed) };
  }
  return parsed;
}

// Builds a Next Response from a thrown backendFetch error (or a generic failure).
export function backendErrorResponse(err: unknown): Response {
  const e = err as { status?: number; error?: BackendError };
  const status = e?.status ?? 502;
  const error = e?.error ?? { code: "proxy_error", message: "Failed to reach backend" };
  return Response.json({ error }, { status });
}
