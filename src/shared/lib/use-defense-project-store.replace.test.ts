// Run: npx tsx src/shared/lib/use-defense-project-store.replace.test.ts

import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseProject } from "@/shared/types/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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

function minimalProject(id: string, placedCount: number): DefenseProject {
  return {
    schemaVersion: 1,
    projectId: id,
    projectName: `proj-${id}`,
    baseObject: { id: "o1", name: "Obj", center: { lat: 55.75, lng: 37.61 } },
    layers: [],
    assetLibrary: [],
    placedObjects: Array.from({ length: placedCount }, (_, i) => ({
      id: `pl-${id}-${i}`,
      assetId: "a1",
      layerId: "l1",
      coordinates: { lat: 55.76, lng: 37.62 },
      quantity: 1,
      status: "planned",
      createdAt: "2026-06-12T14:00:00.000Z",
      updatedAt: "2026-06-12T14:00:00.000Z",
    })) as DefenseProject["placedObjects"],
    mode: "view",
    updatedAt: "2026-06-12T14:00:00.000Z",
  };
}

storage.clear();
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);

// replaceProject fully replaces project state with no leftover placed objects.
const store = useDefenseProjectStore.getState();
store.replaceProject(minimalProject("A", 3));
assert(
  useDefenseProjectStore.getState().project.placedObjects.length === 3,
  "replaceProject must load all placed objects from variant A",
);

store.replaceProject(minimalProject("B", 1));
const after = useDefenseProjectStore.getState().project;
assert(after.projectId === "B", "replaceProject must swap projectId to variant B");
assert(after.placedObjects.length === 1, "replaceProject must not merge — variant B has exactly 1 object");
assert(
  after.placedObjects.every((p) => p.id.startsWith("pl-B")),
  "replaceProject must drop variant A objects entirely (no leftover placed objects)",
);

console.log("replaceProject: fully replaces project state with no leftover placed objects: OK");
console.log("use-defense-project-store.replace.test.ts: replaceProject contracts passed");
