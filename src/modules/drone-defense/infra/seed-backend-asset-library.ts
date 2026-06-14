import { defenseAssetLibrary } from "@/shared/config/defense-asset-library";
import { normalizeDefenseAssetPayload, serializeDefenseAssetMutation } from "@/modules/drone-defense/infra/asset-library-api";

type BackendAssetPayload = Record<string, unknown>;

type BackendAssetListResponse = {
  items?: BackendAssetPayload[];
  totalItems?: number;
};

const defaultBackendBaseUrl = "http://localhost:8090";

function backendBaseUrl() {
  return process.env.FORTIS_API_BASE_URL?.trim() || defaultBackendBaseUrl;
}

function buildBackendUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, backendBaseUrl());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

export function buildPublicAssetSeedPayloads() {
  return defenseAssetLibrary.map((asset) => ({
    ...serializeDefenseAssetMutation(asset),
    isPublic: true,
    enterpriseId: undefined,
  }));
}

async function readJson<T>(input: URL | string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const bodyText = await response.text();
  const body = bodyText ? (JSON.parse(bodyText) as T) : (undefined as T);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${String(input)}: ${bodyText}`);
  }
  return body;
}

async function listBackendPublicAssets() {
  const response = await readJson<BackendAssetListResponse | BackendAssetPayload[]>(
    buildBackendUrl("/api/v1/assets", { isPublic: true, limit: 200 }),
  );
  const items = Array.isArray(response) ? response : response.items ?? [];
  return items.map(normalizeDefenseAssetPayload);
}

export async function seedBackendPublicAssetLibrary() {
  const beforeAssets = await listBackendPublicAssets();
  const existingLegacyIds = new Set(beforeAssets.map((asset) => asset.legacyItemId ?? asset.id));
  const payloads = buildPublicAssetSeedPayloads();
  const missingPayloads = payloads.filter((payload) => {
    const legacyId = typeof payload.legacyItemId === "string" ? payload.legacyItemId : undefined;
    return legacyId ? !existingLegacyIds.has(legacyId) : true;
  });

  for (const payload of missingPayloads) {
    await readJson<BackendAssetPayload>(buildBackendUrl("/api/v1/assets"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  const afterAssets = await listBackendPublicAssets();
  return {
    beforeCount: beforeAssets.length,
    attemptedCount: payloads.length,
    createdCount: missingPayloads.length,
    afterCount: afterAssets.length,
  };
}

async function runCli() {
  const summary = await seedBackendPublicAssetLibrary();
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1]?.endsWith("seed-backend-asset-library.ts")) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
