// Run: npx tsx src/modules/drone-defense/domain/use-defense-variants-store.test.ts

import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";
import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseProject, VariantSummary } from "@/shared/types/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── localStorage stub (project store persists on replace) ────────────────────
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
});

// ── fetch stub ───────────────────────────────────────────────────────────────
// Shaped like the real Response: readJson() does `await fetch(...)`, checks
// `response.ok`, then `await response.json()`.
type FetchResult = { ok: boolean; status: number; data: unknown };

// Reassign this per case. Receives (method, url) so a single handler can serve
// both the primary request and the fetchVariants() refresh that follows.
let fetchHandler: (method: string, url: string) => FetchResult = () => ({
  ok: true,
  status: 200,
  data: {},
});

Object.defineProperty(globalThis, "fetch", {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const result = fetchHandler(method, url);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.data,
      text: async () => JSON.stringify(result.data),
    };
  },
  configurable: true,
  writable: true,
});

function resetStore(): void {
  useDefenseVariantsStore.setState(useDefenseVariantsStore.getInitialState(), true);
}

function summary(overrides: Partial<VariantSummary> = {}): VariantSummary {
  return {
    projectId: "A",
    name: "name-A",
    projectName: "proj-A",
    version: 1,
    updatedAt: "2026-06-12T14:00:00.000Z",
    ...overrides,
  };
}

function minimalProject(id: string): DefenseProject {
  return {
    schemaVersion: 1,
    projectId: id,
    projectName: `proj-${id}`,
    baseObject: { id: "o1", name: "Obj", center: { lat: 55.75, lng: 37.61 } },
    layers: [],
    assetLibrary: [],
    placedObjects: [],
    mode: "view",
    updatedAt: "2026-06-12T14:00:00.000Z",
  };
}

async function main() {
  // 1. fetchVariants() populates list and ends idle.
  resetStore();
  fetchHandler = () => ({ ok: true, status: 200, data: { items: [summary()], totalItems: 1 } });
  await useDefenseVariantsStore.getState().fetchVariants();
  assert(useDefenseVariantsStore.getState().variants.length === 1, "fetchVariants must load one variant");
  assert(useDefenseVariantsStore.getState().listStatus === "idle", "fetchVariants must end with listStatus idle");
  console.log("fetchVariants: OK");

  // 2. saveAsNewVariant sets active identity (and refreshes the list).
  resetStore();
  fetchHandler = (method) => {
    if (method === "POST") {
      return { ok: true, status: 200, data: summary({ projectId: "A", name: "name-A" }) };
    }
    // subsequent GET fetchVariants refresh
    return { ok: true, status: 200, data: { items: [summary()], totalItems: 1 } };
  };
  await useDefenseVariantsStore.getState().saveAsNewVariant("name-A");
  assert(useDefenseVariantsStore.getState().activeVariantId === "A", "saveAsNewVariant must set activeVariantId");
  assert(useDefenseVariantsStore.getState().activeVariantName === "name-A", "saveAsNewVariant must set activeVariantName");
  assert(useDefenseVariantsStore.getState().saveStatus === "idle", "saveAsNewVariant success must leave saveStatus idle");
  console.log("saveAsNewVariant: OK");

  // 3. loadVariant replaces the project and sets active id.
  resetStore();
  fetchHandler = () => ({ ok: true, status: 200, data: minimalProject("B") });
  await useDefenseVariantsStore.getState().loadVariant("B");
  assert(useDefenseProjectStore.getState().project.projectId === "B", "loadVariant must replace project to B");
  assert(useDefenseVariantsStore.getState().activeVariantId === "B", "loadVariant must set activeVariantId to B");
  console.log("loadVariant: OK");

  // 4. deleteVariant of the active variant clears the active id.
  resetStore();
  useDefenseVariantsStore.setState({ activeVariantId: "B", activeVariantName: "name-B" });
  fetchHandler = (method) => {
    if (method === "DELETE") return { ok: true, status: 200, data: { status: "ok" } };
    return { ok: true, status: 200, data: { items: [], totalItems: 0 } };
  };
  await useDefenseVariantsStore.getState().deleteVariant("B");
  assert(useDefenseVariantsStore.getState().activeVariantId === null, "deleteVariant must clear active id when deleting active");
  console.log("deleteVariant: OK");

  // 5. save failure surfaces an error.
  resetStore();
  fetchHandler = () => ({ ok: false, status: 500, data: { message: "boom" } });
  await useDefenseVariantsStore.getState().saveAsNewVariant("x");
  assert(useDefenseVariantsStore.getState().saveStatus === "error", "save failure must set saveStatus error");
  assert(Boolean(useDefenseVariantsStore.getState().error), "save failure must set a truthy error");
  console.log("saveAsNewVariant failure: OK");

  console.log("use-defense-variants-store.test.ts: variants store contracts passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
