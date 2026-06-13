type ApiQueryValue = string | number | boolean | null | undefined;

export type ApiQueryParams = Record<string, ApiQueryValue>;

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: ApiQueryParams;
  fetcher?: typeof fetch;
};

export type ApiJsonReadOptions = Omit<ApiRequestOptions, "body">;

export type ApiJsonWriteOptions = Omit<ApiRequestOptions, "body"> & {
  body?: unknown;
};

export class FortisApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly code?: string;
  readonly body?: unknown;

  constructor(response: Response, body?: unknown) {
    const payload = isRecord(body) ? body : undefined;
    const message =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message
        : `API request failed: ${response.status}`;

    super(message);
    this.name = "FortisApiError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.code = typeof payload?.code === "string" ? payload.code : undefined;
    this.body = body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function appendQuery(path: string, query?: ApiQueryParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function buildApiV1Url(path: string, query?: ApiQueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith("/api/v1") ? normalizedPath : `/api/v1${normalizedPath}`;
  return appendQuery(apiPath, query);
}

async function parseJsonBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function readJson<T>(input: RequestInfo | URL, init?: RequestInit & { fetcher?: typeof fetch }): Promise<T> {
  const { fetcher = fetch, ...requestInit } = init ?? {};
  const response = await fetcher(input, requestInit);
  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new FortisApiError(response, body);
  }

  return body as T;
}

function withJsonContentType(headers?: HeadersInit) {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  return requestHeaders;
}

function requestApiJson<T>(path: string, method: string, options: ApiRequestOptions = {}) {
  const { body, headers, query, fetcher, ...init } = options;
  const hasBody = body !== undefined;
  return readJson<T>(buildApiV1Url(path, query), {
    ...init,
    method,
    headers: hasBody ? withJsonContentType(headers) : headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    fetcher,
  });
}

export function getApiJson<T>(path: string, options: ApiJsonReadOptions = {}) {
  return requestApiJson<T>(path, "GET", options);
}

export function postApiJson<T>(path: string, options: ApiJsonWriteOptions = {}) {
  return requestApiJson<T>(path, "POST", options);
}

export function putApiJson<T>(path: string, options: ApiJsonWriteOptions = {}) {
  return requestApiJson<T>(path, "PUT", options);
}

export function deleteApiJson<T>(path: string, options: ApiJsonWriteOptions = {}) {
  return requestApiJson<T>(path, "DELETE", options);
}

export function readApiJson<T>(path: string, options: ApiJsonReadOptions = {}) {
  return getApiJson<T>(path, options);
}

export function writeApiJson<T>(path: string, options: ApiJsonWriteOptions = {}) {
  const method = options.method?.toUpperCase();
  switch (method) {
    case undefined:
    case "POST":
      return postApiJson<T>(path, options);
    case "PUT":
      return putApiJson<T>(path, options);
    case "DELETE":
      return deleteApiJson<T>(path, options);
    default:
      return requestApiJson<T>(path, method, options);
  }
}
