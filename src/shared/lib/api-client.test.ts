// Run: pnpm exec tsx src/shared/lib/api-client.test.ts

import {
  FortisApiError,
  buildApiV1Url,
  deleteApiJson,
  getApiJson,
  postApiJson,
  putApiJson,
  readApiJson,
  writeApiJson,
} from "@/shared/lib/api-client";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function createTextResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, init);
}

function readHeader(headers: HeadersInit | undefined, name: string) {
  if (!headers) return undefined;
  return new Headers(headers).get(name) ?? undefined;
}

async function runApiClientContract() {
  const listUrl = buildApiV1Url("/projects", {
    enterpriseId: "enterprise-1",
    limit: 25,
    includeArchived: false,
    empty: "",
    skipNull: null,
    skipUndefined: undefined,
  });

  assert(
    listUrl === "/api/v1/projects?enterpriseId=enterprise-1&limit=25&includeArchived=false&empty=",
    `buildApiV1Url must preserve backend query names and skip nullish values, got ${listUrl}`,
  );

  assert(
    buildApiV1Url("assets/get", { id: "asset-1" }) === "/api/v1/assets/get?id=asset-1",
    "buildApiV1Url must accept paths without a leading slash",
  );
  assert(
    buildApiV1Url("/api/v1/assets", { limit: 1 }) === "/api/v1/assets?limit=1",
    "buildApiV1Url must not duplicate the /api/v1 prefix",
  );

  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return createJsonResponse({ ok: true, input: String(input) }, { status: 200 });
  };

  const readViaVerbHelper = await getApiJson<{ ok: boolean; input: string }>("/projects/list", {
    query: { offset: 10 },
    fetcher,
  });

  assert(readViaVerbHelper.ok === true, "getApiJson must parse successful JSON response");
  assert(calls[0]?.input === "/api/v1/projects/list?offset=10", "getApiJson must append query params to /api/v1 URL");
  assert(calls[0]?.init?.method === "GET", "getApiJson must default to GET");

  const readResult = await readApiJson<{ ok: boolean; input: string }>("/projects/get", {
    query: { id: "project-1" },
    fetcher,
  });

  assert(readResult.ok === true, "readApiJson must parse successful JSON response");
  assert(calls[1]?.input === "/api/v1/projects/get?id=project-1", "readApiJson must call same-origin /api/v1 URL");
  assert(calls[1]?.init?.method === "GET", "readApiJson must default to GET");

  const postResult = await postApiJson<{ ok: boolean; input: string }>("/projects", {
    body: { name: "Variant A" },
    fetcher,
  });

  assert(postResult.ok === true, "postApiJson must return parsed JSON body");
  assert(calls[2]?.init?.method === "POST", "postApiJson must send POST");
  assert(calls[2]?.init?.body === JSON.stringify({ name: "Variant A" }), "postApiJson must JSON serialize body");

  const writeResult = await putApiJson<{ saved: boolean }>("/projects/update", {
    query: { id: "project-1" },
    body: { version: 3, name: "Variant A" },
    fetcher,
  });

  assert(writeResult.saved === undefined, "writeApiJson must return parsed backend body without local decoration");
  assert(calls[3]?.input === "/api/v1/projects/update?id=project-1", "putApiJson must append query params");
  assert(calls[3]?.init?.method === "PUT", "putApiJson must use PUT");
  assert(calls[3]?.init?.body === JSON.stringify({ version: 3, name: "Variant A" }), "putApiJson must JSON serialize body");
  assert(
    readHeader(calls[3]?.init?.headers, "Content-Type") === "application/json",
    "putApiJson must send JSON content type",
  );

  const deleteCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const deleteFetcher: typeof fetch = async (input, init) => {
    deleteCalls.push({ input, init });
    return new Response(null, { status: 204 });
  };

  const deleted = await deleteApiJson("/projects/delete", {
    query: { id: "project-1" },
    fetcher: deleteFetcher,
  });

  assert(deleted === undefined, "deleteApiJson must return undefined for 204 responses");
  assert(deleteCalls[0]?.input === "/api/v1/projects/delete?id=project-1", "deleteApiJson must keep same-origin delete URL");
  assert(deleteCalls[0]?.init?.method === "DELETE", "deleteApiJson must send DELETE");

  const conflictFetcher: typeof fetch = async () =>
    createJsonResponse(
      {
        code: "version_conflict",
        message: "Project version is stale",
        currentVersion: 4,
      },
      { status: 409, statusText: "Conflict" },
    );

  try {
    await writeApiJson("/projects/update", {
      method: "PUT",
      body: { version: 3 },
      fetcher: conflictFetcher,
    });
    throw new Error("writeApiJson must throw on non-2xx responses");
  } catch (error) {
    assert(error instanceof FortisApiError, "non-2xx response must throw FortisApiError");
    assert(error.status === 409, "FortisApiError must expose response status");
    assert(error.statusText === "Conflict", "FortisApiError must expose response statusText");
    assert(error.code === "version_conflict", "FortisApiError must expose backend code");
    assert(error.body?.currentVersion === 4, "FortisApiError must expose parsed backend body");
    assert(error.message === "Project version is stale", "FortisApiError must prefer backend message");
  }

  const textErrorFetcher: typeof fetch = async () => createTextResponse("Gateway timeout", { status: 504, statusText: "Gateway Timeout" });

  try {
    await writeApiJson("/projects/update", {
      method: "PUT",
      body: { version: 3 },
      fetcher: textErrorFetcher,
    });
    throw new Error("writeApiJson must throw on text error responses");
  } catch (error) {
    assert(error instanceof FortisApiError, "text error response must throw FortisApiError");
    assert(error.status === 504, "FortisApiError must expose text response status");
    assert(error.statusText === "Gateway Timeout", "FortisApiError must expose text response statusText");
    assert(error.body === "Gateway timeout", "FortisApiError must preserve parsed text body");
  }
}

runApiClientContract()
  .then(() => {
    console.log("api-client.test.ts: shared /api/v1 client contracts passed");
  })
  .catch((error) => {
    throw error;
  });
