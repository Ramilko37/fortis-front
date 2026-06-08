# Fortis Map Core (items 1-5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the drone-defense map prototype a stable, single-source-of-truth interaction surface: real drag-to-map placement, an echelon objects inventory list with cards, map↔list selection sync, six visually distinct marker states, and a toggleable per-object coverage layer.

**Architecture:** All pure logic (state triggers, geometry, placement description, screen→slot resolution) lives in `domain/` as functions covered by `*-contract.test.ts` files run with `tsx`. The Zustand store (`use-defense-studio-store.ts`) gains a single `selectedPlacementId` plus thin action wrappers reusing the existing `buildCatalogPlacement` / `upsertLocalPlacement` / `removeLocalPlacement` flow. UI components (`gis-board.tsx`, the Каталог СЗ section + new `echelon-objects-list.tsx`) read from `domain` and never touch the catalog or geometry directly.

**Tech Stack:** Next.js (App Router), React 19, Zustand, deck.gl 9 (`ScatterplotLayer`/`PolygonLayer`/`IconLayer`/`TextLayer`), TypeScript. Tests: `pnpm dlx tsx <file>` (no jest/vitest; a contract test throws on failure and exits 0 on pass).

**Conventions discovered (follow these):**
- Test files: `src/modules/drone-defense/domain/<name>-contract.test.ts`. They import real fixtures from `infra/mock-defense-data.ts` (`buildCatalogPlacement`, `buildScenarioConfiguration`, `buildCatalogResponse`, `defenseLayers`, `facilities`), assert with plain `if (...) throw new Error(...)`, no test framework.
- Run a test: `pnpm dlx tsx src/modules/drone-defense/domain/<name>-contract.test.ts` — pass = exit 0, no output; fail = the thrown message + non-zero exit. The `@/` alias resolves natively under tsx.
- The live asset "library" the user drags FROM is the **Каталог СЗ** block in `drone-defense-prototype.tsx:314-362` (renders `filteredLayerGroups` of type `EchelonCatalogGroup`). `assets-panel.tsx` is a legacy/unused panel — do NOT modify it.
- A "placed object" is a `Placement` (`src/shared/types/drone-defense.ts:94-114`). Catalog placements carry `catalogGroupId`, `catalogGroupName`, `layerId`, `slotId`, `mapRef`, deterministic `id = ${facilityId}-${scenarioId}-${groupId}`.
- `buildCatalogPlacement({ facilityId, scenarioId, groupId, slotId?, mapRef? })` already returns a complete `Placement`. Reuse it; do not hand-build placements.
- Lint: `pnpm lint`. Build sanity: `pnpm build` (heavy — run only at the final task).

---

## File Structure

**Create:**
- `src/modules/drone-defense/domain/placement-helpers.ts` — pure helpers: `describePlacement`, `getMarkerState`, `getCoverageShape`, `buildSectorPolygon`, `screenPointToSlot`, plus `MarkerState`/`CoverageShape`/`PlacementSummary` types and threshold constants.
- `src/modules/drone-defense/domain/placement-helpers-contract.test.ts` — contract tests for the above.
- `src/modules/drone-defense/ui/echelon-objects-list.tsx` — inventory list of placed objects in the active echelon with cards + actions.

**Modify:**
- `src/modules/drone-defense/domain/use-defense-studio-store.ts` — add `selectedPlacementId`, `coverageVisible`, actions `selectPlacement`, `setCoverageVisible`, `placeAssetInSlot`, `removePlacement`.
- `src/modules/drone-defense/ui/drone-defense-prototype.tsx` — drag source on Каталог СЗ cards, drop wiring, render `EchelonObjectsList`, coverage toggle, wire `selectedPlacementId`.
- `src/modules/drone-defense/ui/gis-board.tsx` — drop overlay + slot preview, marker states via `getMarkerState`, coverage layer for the selected placement, emit `selectPlacement` on marker click.

---

## Task 1: Pure helper — `describePlacement`

Produces the card data (name / echelon / qty / status / cost) for a placed object without the UI touching the catalog.

**Files:**
- Create: `src/modules/drone-defense/domain/placement-helpers.ts`
- Test: `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`:

```ts
import { describePlacement } from "@/modules/drone-defense/domain/placement-helpers";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";

const catalog = buildCatalogResponse();
const facility = facilities[0];

const placement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l2-radar",
  slotId: "layer_02_detection-slot-01",
});

const summary = describePlacement({ placement, catalog, layers: defenseLayers });

if (summary.name !== "РЛС") {
  throw new Error(`describePlacement must use the catalog group name; got ${summary.name}`);
}
if (summary.echelonShortName !== "L2") {
  throw new Error(`describePlacement must resolve the echelon short name; got ${summary.echelonShortName}`);
}
if (summary.qty !== 1) {
  throw new Error(`describePlacement must report qty; got ${summary.qty}`);
}
if (!(summary.costRub > 0)) {
  throw new Error(`describePlacement must compute a positive cost from the asset; got ${summary.costRub}`);
}
if (summary.status !== "ready" && summary.status !== "warning" && summary.status !== "inactive") {
  throw new Error(`describePlacement must report a known status; got ${summary.status}`);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: FAIL — module/function `describePlacement` not found (non-zero exit).

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/drone-defense/domain/placement-helpers.ts`:

```ts
import type {
  DefenseCatalogResponse,
  DefenseLayer,
  Placement,
} from "@/shared/types/drone-defense";

export type PlacementStatus = "ready" | "warning" | "inactive";

export type PlacementSummary = {
  id: string;
  name: string;
  echelonShortName: string;
  echelonName: string;
  qty: number;
  status: PlacementStatus;
  costRub: number;
};

export const READINESS_WARNING_THRESHOLD = 0.4;
export const READINESS_INACTIVE_THRESHOLD = 0.05;

export function placementStatus(readiness: number): PlacementStatus {
  if (readiness <= READINESS_INACTIVE_THRESHOLD) return "inactive";
  if (readiness < READINESS_WARNING_THRESHOLD) return "warning";
  return "ready";
}

export function describePlacement({
  placement,
  catalog,
  layers,
}: {
  placement: Placement;
  catalog: DefenseCatalogResponse | null;
  layers: DefenseLayer[];
}): PlacementSummary {
  const asset = catalog?.assets.find((item) => item.id === placement.assetId) ?? null;
  const layer = layers.find((item) => item.id === placement.layerId) ?? null;
  const unitCost = asset?.cost.capexRub ?? 0;
  return {
    id: placement.id,
    name: placement.catalogGroupName ?? asset?.name ?? placement.assetId,
    echelonShortName: layer?.shortName ?? "—",
    echelonName: layer?.name ?? "Без эшелона",
    qty: placement.qty,
    status: placementStatus(placement.readiness),
    costRub: unitCost * placement.qty,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: PASS (exit 0, no output).

- [ ] **Step 5: Commit**

```bash
git add src/modules/drone-defense/domain/placement-helpers.ts src/modules/drone-defense/domain/placement-helpers-contract.test.ts
git commit -m "feat(drone-defense): describePlacement helper for object cards"
```

---

## Task 2: Pure helper — `getMarkerState`

Maps a placement + context to one of six marker states with a fixed priority.

**Files:**
- Modify: `src/modules/drone-defense/domain/placement-helpers.ts`
- Test: `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`

- [ ] **Step 1: Write the failing test (append to the existing test file)**

Append to `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`:

```ts
import { getMarkerState } from "@/modules/drone-defense/domain/placement-helpers";

const readyPlacement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l2-optical",
  slotId: "layer_02_detection-slot-02",
});

// default: placed, healthy, not selected/hovered
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "default") {
  throw new Error("a healthy unselected placement must be in the default state");
}

// hover beats default
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: null, hoveredPlacementId: readyPlacement.id, isDuplicateInSlot: false }) !== "hover") {
  throw new Error("hover must override default");
}

// selected beats everything
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: readyPlacement.id, hoveredPlacementId: readyPlacement.id, isDuplicateInSlot: true }) !== "selected") {
  throw new Error("selected must win over conflict, warning, hover");
}

// conflict beats warning/inactive/hover when not selected
const conflictPlacement = { ...readyPlacement, readiness: 0.2 };
if (getMarkerState({ placement: conflictPlacement, selectedPlacementId: null, hoveredPlacementId: conflictPlacement.id, isDuplicateInSlot: true }) !== "conflict") {
  throw new Error("conflict must win over warning and hover");
}

// warning from low readiness
const warnPlacement = { ...readyPlacement, readiness: 0.2 };
if (getMarkerState({ placement: warnPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "warning") {
  throw new Error("low readiness must yield warning");
}

// inactive from near-zero readiness
const offPlacement = { ...readyPlacement, readiness: 0 };
if (getMarkerState({ placement: offPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "inactive") {
  throw new Error("near-zero readiness must yield inactive");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: FAIL — `getMarkerState` not exported.

- [ ] **Step 3: Write minimal implementation (append to `placement-helpers.ts`)**

```ts
export type MarkerState = "default" | "hover" | "selected" | "warning" | "conflict" | "inactive";

export function getMarkerState({
  placement,
  selectedPlacementId,
  hoveredPlacementId,
  isDuplicateInSlot,
}: {
  placement: Placement;
  selectedPlacementId: string | null;
  hoveredPlacementId: string | null;
  isDuplicateInSlot: boolean;
}): MarkerState {
  if (placement.id === selectedPlacementId) return "selected";
  if (isDuplicateInSlot) return "conflict";
  if (placement.readiness <= READINESS_INACTIVE_THRESHOLD) return "inactive";
  if (placement.readiness < READINESS_WARNING_THRESHOLD) return "warning";
  if (placement.id === hoveredPlacementId) return "hover";
  return "default";
}
```

(Priority: selected > conflict > inactive > warning > hover > default. Inactive is placed above warning so a fully-off object reads as inactive, not warning; both are below conflict/selected per the spec's "selected > conflict > warning > inactive > hover > default" intent where the dominant signal still wins — selected and conflict always win, and a near-zero-readiness object is inactive.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/modules/drone-defense/domain/placement-helpers.ts src/modules/drone-defense/domain/placement-helpers-contract.test.ts
git commit -m "feat(drone-defense): getMarkerState with fixed state priority"
```

---

## Task 3: Pure helper — `buildSectorPolygon` + `getCoverageShape`

Geometry for the coverage layer (circle / sector / zone / none).

**Files:**
- Modify: `src/modules/drone-defense/domain/placement-helpers.ts`
- Test: `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
import { buildSectorPolygon, getCoverageShape } from "@/modules/drone-defense/domain/placement-helpers";

const center = { lon: facility.center.lon, lat: facility.center.lat };
const ring = buildSectorPolygon({ center, azimuthDeg: 0, halfAngleDeg: 45, radiusM: 1000, segments: 16 });

// apex + arc points + (segments) ; must be a closed-area polygon with the apex included
if (ring.length < 4) {
  throw new Error(`sector polygon must have an apex and arc points; got ${ring.length}`);
}
const apex = ring[0];
if (Math.abs(apex[0] - center.lon) > 1e-9 || Math.abs(apex[1] - center.lat) > 1e-9) {
  throw new Error("sector polygon must start at the center apex");
}
// deck.gl closes rings internally — do not duplicate the first point
const last = ring[ring.length - 1];
if (apex[0] === last[0] && apex[1] === last[1]) {
  throw new Error("sector ring must not duplicate the apex as its last point");
}

// coverage shape: radar group -> sector
const radarShape = getCoverageShape(readyPlacement); // l2-optical (detection) -> sector
if (radarShape.kind !== "sector") {
  throw new Error(`detection/optical assets should default to a sector coverage; got ${radarShape.kind}`);
}

// kinetic group -> circle
const kineticPlacement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l6-barrel",
});
if (getCoverageShape(kineticPlacement).kind !== "circle") {
  throw new Error("kinetic assets should default to a circle coverage");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: FAIL — `buildSectorPolygon` / `getCoverageShape` not exported.

- [ ] **Step 3: Write minimal implementation (append)**

```ts
export type CoverageShape =
  | { kind: "none" }
  | { kind: "circle"; radiusM: number }
  | { kind: "sector"; azimuthDeg: number; halfAngleDeg: number; radiusM: number }
  | { kind: "zone" };

const COVERAGE_DEFAULT_RADIUS_M = 1200;

// Layers whose assets are directional sensors/emitters -> sector by default.
const SECTOR_LAYER_IDS = new Set([
  "layer_01_external_warning",
  "layer_02_detection",
  "layer_03_identification",
  "layer_04_suppression",
  "layer_07_accuracy_disruption",
]);
// Kinetic layers -> circle by default.
const CIRCLE_LAYER_IDS = new Set([
  "layer_05_mid_range_kinetic",
  "layer_06_last_line_kinetic",
]);

export function getCoverageShape(placement: Placement): CoverageShape {
  const layerId = placement.layerId;
  if (!layerId) return { kind: "none" };
  if (SECTOR_LAYER_IDS.has(layerId)) {
    return { kind: "sector", azimuthDeg: 0, halfAngleDeg: 45, radiusM: COVERAGE_DEFAULT_RADIUS_M };
  }
  if (CIRCLE_LAYER_IDS.has(layerId)) {
    return { kind: "circle", radiusM: COVERAGE_DEFAULT_RADIUS_M };
  }
  // passive / hardening -> the echelon zone itself, drawn elsewhere
  return { kind: "zone" };
}

function projectMeters(
  center: { lon: number; lat: number },
  eastM: number,
  northM: number,
): [number, number] {
  const lat = center.lat + northM / 111_320;
  const lon = center.lon + eastM / (111_320 * Math.cos(center.lat * (Math.PI / 180)));
  return [lon, lat];
}

export function buildSectorPolygon({
  center,
  azimuthDeg,
  halfAngleDeg,
  radiusM,
  segments = 24,
}: {
  center: { lon: number; lat: number };
  azimuthDeg: number;
  halfAngleDeg: number;
  radiusM: number;
  segments?: number;
}): Array<[number, number]> {
  const start = azimuthDeg - halfAngleDeg;
  const end = azimuthDeg + halfAngleDeg;
  const ring: Array<[number, number]> = [[center.lon, center.lat]];
  for (let index = 0; index <= segments; index += 1) {
    const angleDeg = start + ((end - start) * index) / segments;
    const angleRad = angleDeg * (Math.PI / 180);
    ring.push(projectMeters(center, Math.sin(angleRad) * radiusM, Math.cos(angleRad) * radiusM));
  }
  return ring;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/modules/drone-defense/domain/placement-helpers.ts src/modules/drone-defense/domain/placement-helpers-contract.test.ts
git commit -m "feat(drone-defense): coverage shape + sector polygon geometry"
```

---

## Task 4: Pure helper — `screenPointToSlot`

Resolves a pointer position to the nearest empty slot of the active echelon (snap target for drag-drop). Works in lon/lat space against slot positions already produced by `buildEchelonMapModel`.

**Files:**
- Modify: `src/modules/drone-defense/domain/placement-helpers.ts`
- Test: `src/modules/drone-defense/domain/placement-helpers-contract.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
import { screenPointToSlot } from "@/modules/drone-defense/domain/placement-helpers";
import { buildEchelonMapModel } from "@/modules/drone-defense/domain/echelon-map-model";
import { buildScenarioConfiguration } from "@/modules/drone-defense/infra/mock-defense-data";

const emptyConfig = buildScenarioConfiguration(facility.id, "balanced", []);
const dropModel = buildEchelonMapModel({
  facility,
  layers: defenseLayers,
  layerCoverage: null,
  configuration: emptyConfig,
  catalog,
  selectedLayerId: "layer_02_detection",
});
const detectionSlots = dropModel.slots.filter((slot) => slot.layerId === "layer_02_detection");
const target = detectionSlots[0];

// a coordinate exactly on a slot resolves to that slot
const hit = screenPointToSlot({
  lon: target.position[0],
  lat: target.position[1],
  activeLayerId: "layer_02_detection",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
if (hit?.id !== target.id) {
  throw new Error(`screenPointToSlot must snap to the nearest active-echelon slot; got ${hit?.id}`);
}

// a far-away coordinate resolves to null (drop outside echelon = cancel)
const miss = screenPointToSlot({
  lon: target.position[0] + 5,
  lat: target.position[1] + 5,
  activeLayerId: "layer_02_detection",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
if (miss !== null) {
  throw new Error("a drop far from any slot must resolve to null");
}

// only the active echelon's slots are considered
const wrongLayer = screenPointToSlot({
  lon: target.position[0],
  lat: target.position[1],
  activeLayerId: "layer_09_hardening",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
if (wrongLayer && wrongLayer.layerId !== "layer_09_hardening") {
  throw new Error("screenPointToSlot must only return slots from the active echelon");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: FAIL — `screenPointToSlot` not exported.

- [ ] **Step 3: Write minimal implementation (append)**

```ts
import type { DefenseLayerId } from "@/shared/types/drone-defense";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

function geoDistanceM(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const latM = (b.lat - a.lat) * 111_320;
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(latM, lonM);
}

export function screenPointToSlot({
  lon,
  lat,
  activeLayerId,
  slots,
  maxDistanceM = 8000,
}: {
  lon: number;
  lat: number;
  activeLayerId: DefenseLayerId;
  slots: EchelonMapSlot[];
  maxDistanceM?: number;
}): EchelonMapSlot | null {
  let best: EchelonMapSlot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    if (slot.layerId !== activeLayerId) continue;
    const distance = geoDistanceM({ lon, lat }, { lon: slot.position[0], lat: slot.position[1] });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  if (!best || bestDistance > maxDistanceM) return null;
  return best;
}
```

Note: keep the `import type` lines at the TOP of the file with the other imports — move them up if the file's import block is grouped; functionally tsx tolerates imports anywhere, but match the file's style by hoisting them.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm dlx tsx src/modules/drone-defense/domain/placement-helpers-contract.test.ts`
Expected: PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/modules/drone-defense/domain/placement-helpers.ts src/modules/drone-defense/domain/placement-helpers-contract.test.ts
git commit -m "feat(drone-defense): screenPointToSlot snap resolver for drag-drop"
```

---

## Task 5: Store — `selectedPlacementId`, `coverageVisible`, and action wrappers

Add the single selection field, the coverage toggle, and thin actions reusing the existing placement flow. `placeAssetInSlot` refuses a duplicate of the same catalog group in the same slot.

**Files:**
- Modify: `src/modules/drone-defense/domain/use-defense-studio-store.ts`

- [ ] **Step 1: Add state fields and action signatures to `StudioState`**

In `src/modules/drone-defense/domain/use-defense-studio-store.ts`, add to the `StudioState` type (after `recommendations: Recommendation[];`):

```ts
  selectedPlacementId: string | null;
  coverageVisible: boolean;
  selectPlacement: (placementId: string | null) => void;
  setCoverageVisible: (visible: boolean) => void;
  placeAssetInSlot: (args: { groupId: string; layerId: DefenseLayerId; slotId: string; mapRef: { lon: number; lat: number } }) => Promise<boolean>;
  removePlacement: (placementId: string) => Promise<void>;
```

Add `DefenseLayerId` to the type import from `@/shared/types/drone-defense` (it is not currently imported) and import `buildCatalogPlacement`:

```ts
// extend the existing import from mock-defense-data:
import { buildCatalogPlacement, buildScenarioConfiguration, hexCells, threatRoutes } from "@/modules/drone-defense/infra/mock-defense-data";
```

```ts
// extend the existing type import:
import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayerId,
  DefenseLayersResponse,
  DefenseScenarioId,
  Facility,
  KpiResult,
  Placement,
  Recommendation,
} from "@/shared/types/drone-defense";
```

- [ ] **Step 2: Add initial values in the `create(...)` object**

After `recommendations: [],` in the store initializer (around line 133), add:

```ts
  selectedPlacementId: null,
  coverageVisible: false,
```

- [ ] **Step 3: Implement the new actions**

Add these action implementations inside the store object (after `removeLocalPlacement` is fine, before `recompute`):

```ts
  selectPlacement: (placementId) => set({ selectedPlacementId: placementId }),
  setCoverageVisible: (visible) => set({ coverageVisible: visible }),
  placeAssetInSlot: async ({ groupId, layerId, slotId, mapRef }) => {
    const { facilityId, scenarioId } = get();
    const current = get().localPlacementsByScenario[scenarioId] ?? [];
    const duplicate = current.some((item) => item.slotId === slotId && item.catalogGroupId === groupId);
    if (duplicate) {
      set({ error: "Это средство уже стоит в выбранном слоте" });
      return false;
    }
    const placement = buildCatalogPlacement({ facilityId, scenarioId, groupId, slotId, mapRef });
    placement.layerId = layerId;
    await get().upsertLocalPlacement(placement);
    set({ selectedPlacementId: placement.id });
    return true;
  },
  removePlacement: async (placementId) => {
    if (get().selectedPlacementId === placementId) {
      set({ selectedPlacementId: null });
    }
    await get().removeLocalPlacement(placementId);
  },
```

- [ ] **Step 4: Type-check the store compiles**

Run: `pnpm dlx tsx -e "import('./src/modules/drone-defense/domain/use-defense-studio-store.ts').then(() => console.log('ok'))"`
Expected: prints `ok` (module imports without a type/runtime error). If tsx reports a missing-export or type error, fix it before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/drone-defense/domain/use-defense-studio-store.ts
git commit -m "feat(drone-defense): selectedPlacementId, coverage toggle, place/remove actions"
```

---

## Task 6: Echelon objects inventory list component

A list of placed objects for the active echelon, with card fields and select / locate / delete actions, plus an empty state.

**Files:**
- Create: `src/modules/drone-defense/ui/echelon-objects-list.tsx`

- [ ] **Step 1: Create the component**

Create `src/modules/drone-defense/ui/echelon-objects-list.tsx`:

```tsx
"use client";

import { describePlacement } from "@/modules/drone-defense/domain/placement-helpers";
import { defenseLayers } from "@/modules/drone-defense/infra/mock-defense-data";
import type {
  DefenseCatalogResponse,
  DefenseLayerId,
  Placement,
} from "@/shared/types/drone-defense";

const statusStyles: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  inactive: "bg-slate-200 text-slate-500",
};

const statusLabel: Record<string, string> = {
  ready: "Готов",
  warning: "Внимание",
  inactive: "Выключен",
};

function formatCostRub(costRub: number): string {
  if (costRub <= 0) return "—";
  return `${(costRub / 1_000_000).toFixed(1)} млн ₽`;
}

export function EchelonObjectsList({
  layerId,
  placements,
  catalog,
  selectedPlacementId,
  onSelect,
  onLocate,
  onRemove,
}: {
  layerId: DefenseLayerId;
  placements: Placement[];
  catalog: DefenseCatalogResponse | null;
  selectedPlacementId: string | null;
  onSelect: (placementId: string) => void;
  onLocate: (placement: Placement) => void;
  onRemove: (placementId: string) => void;
}) {
  const layerPlacements = placements.filter((placement) => placement.layerId === layerId);

  if (layerPlacements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-600">В этом эшелоне пока нет объектов</p>
        <p className="mt-1 text-xs text-slate-400">Перетащите средство из каталога на слот эшелона</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {layerPlacements.map((placement) => {
        const summary = describePlacement({ placement, catalog, layers: defenseLayers });
        const isSelected = placement.id === selectedPlacementId;
        return (
          <li
            key={placement.id}
            className={`rounded-lg border p-3 transition ${
              isSelected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <button type="button" className="block w-full text-left" onClick={() => onSelect(placement.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{summary.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[summary.status]}`}>
                  {statusLabel[summary.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.echelonShortName} · {summary.echelonName} · ×{summary.qty} · {formatCostRub(summary.costRub)}
              </p>
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="h-7 rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                onClick={() => onLocate(placement)}
              >
                На карте
              </button>
              <button
                type="button"
                className="h-7 rounded-md bg-rose-50 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                onClick={() => onRemove(placement.id)}
              >
                Удалить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `pnpm lint`
Expected: no new errors for `echelon-objects-list.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/drone-defense/ui/echelon-objects-list.tsx
git commit -m "feat(drone-defense): echelon objects inventory list with card actions"
```

---

## Task 7: Wire selection + inventory list + coverage toggle into the prototype

Replace component-local-only selection plumbing with the store's `selectedPlacementId`, render the inventory list under the Каталог СЗ section, and add the coverage toggle.

**Files:**
- Modify: `src/modules/drone-defense/ui/drone-defense-prototype.tsx`

- [ ] **Step 1: Pull new store fields and import the list**

Add to the destructured store hook (`useDefenseStudioStore()` call, around line 36-58):

```ts
    selectedPlacementId,
    coverageVisible,
    selectPlacement,
    setCoverageVisible,
    placeAssetInSlot,
    removePlacement,
```

Add the import near the other UI imports:

```ts
import { EchelonObjectsList } from "@/modules/drone-defense/ui/echelon-objects-list";
```

- [ ] **Step 2: Add a "locate on map" handler and a viewState bridge**

The map owns its own viewState today. Add a lightweight locate handler that selects the placement and stores a "locate target" the board can react to. Add this component state near the other `useState` calls (around line 33-35):

```ts
  const [locateTarget, setLocateTarget] = useState<{ lon: number; lat: number; at: number } | null>(null);
```

Add the handler near `addCatalogGroup` (around line 101):

```ts
  const handleLocatePlacement = (placement: { id: string; mapRef?: { lon: number; lat: number } }) => {
    selectPlacement(placement.id);
    if (placement.mapRef) {
      setLocateTarget({ lon: placement.mapRef.lon, lat: placement.mapRef.lat, at: Date.now() });
    }
  };
```

- [ ] **Step 3: Render the inventory list under the Каталог СЗ block**

Immediately AFTER the closing `</div>` of the catalog list (the `<div className="mt-3 space-y-2">…</div>` that maps `filteredLayerGroups`, ending around line 361), inside the same `<div className="p-4">`, add:

```tsx
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Объекты эшелона</p>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={coverageVisible}
                      onChange={(event) => setCoverageVisible(event.target.checked)}
                    />
                    Покрытие
                  </label>
                </div>
                <EchelonObjectsList
                  layerId={selectedLayerId}
                  placements={configuration.placements}
                  catalog={catalog}
                  selectedPlacementId={selectedPlacementId}
                  onSelect={(id) => selectPlacement(id)}
                  onLocate={handleLocatePlacement}
                  onRemove={(id) => void removePlacement(id)}
                />
              </div>
```

- [ ] **Step 4: Pass selection + coverage + locate target + drop handler to `GisBoard`**

Update the `<GisBoard ... />` props (around line 379-401). Add these props (the board prop types are added in Task 8):

```tsx
              selectedPlacementId={selectedPlacementId}
              coverageVisible={coverageVisible}
              locateTarget={locateTarget}
              onSelectPlacement={(id) => selectPlacement(id)}
              onDropAsset={(args) => void placeAssetInSlot(args)}
```

- [ ] **Step 5: Make the Каталог СЗ cards draggable**

In the catalog list `<article>` (around line 341), add drag attributes to the card so the asset can be dragged onto the map. Replace the opening `<article key={group.id} className="rounded-lg border border-slate-200 bg-white p-3">` with:

```tsx
                    <article
                      key={group.id}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                      draggable={!isSelected}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/x-fortis-group", group.id);
                        event.dataTransfer.effectAllowed = "copy";
                      }}
                    >
```

- [ ] **Step 6: Verify the app compiles via lint**

Run: `pnpm lint`
Expected: no new errors in `drone-defense-prototype.tsx`. (Type errors about unknown `GisBoard` props are expected until Task 8 — if `pnpm lint` is type-aware and fails on those, proceed to Task 8 and re-run lint at Task 8 Step 6.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/drone-defense/ui/drone-defense-prototype.tsx
git commit -m "feat(drone-defense): wire store selection, inventory list, coverage toggle"
```

---

## Task 8: GIS board — drop overlay, marker states, coverage layer, selection emit

Add the drop overlay (HTML drag events over the deck canvas), apply `getMarkerState` colors to placement markers, draw the coverage layer for the selected placement, react to `locateTarget`, and emit `onSelectPlacement` on marker click.

**Files:**
- Modify: `src/modules/drone-defense/ui/gis-board.tsx`

- [ ] **Step 1: Extend `GisBoardProps`**

Add to the `GisBoardProps` type (around line 41-60):

```ts
  selectedPlacementId: string | null;
  coverageVisible: boolean;
  locateTarget: { lon: number; lat: number; at: number } | null;
  onSelectPlacement: (placementId: string) => void;
  onDropAsset: (args: { groupId: string; layerId: DefenseLayerId; slotId: string; mapRef: { lon: number; lat: number } }) => void;
```

Destructure them in the component signature (around line 140-159):

```ts
  selectedPlacementId,
  coverageVisible,
  locateTarget,
  onSelectPlacement,
  onDropAsset,
```

Add imports at the top:

```ts
import {
  buildSectorPolygon,
  getCoverageShape,
  getMarkerState,
  screenPointToSlot,
  type MarkerState,
} from "@/modules/drone-defense/domain/placement-helpers";
```

- [ ] **Step 2: Add hovered-placement + drop-preview state**

Near the other `useState` calls (around line 160-164), add:

```ts
  const [hoveredPlacementId, setHoveredPlacementId] = useState<string | null>(null);
  const [dropPreviewSlotId, setDropPreviewSlotId] = useState<string | null>(null);
  const deckRef = useRef<DeckGL>(null);
```

Bind the ref on `<DeckGL ... ref={deckRef}>` (around line 588). (DeckGL's React ref exposes `.pickObject`; we instead unproject via the deck instance — see Step 4.)

- [ ] **Step 3: React to `locateTarget` by recentering the view**

Add an effect after the existing focus effect (around line 255):

```ts
  useEffect(() => {
    if (!locateTarget) return;
    const next = normalizeViewState({
      ...viewStateRef.current,
      longitude: locateTarget.lon,
      latitude: locateTarget.lat,
    });
    viewStateRef.current = next;
    setViewState(next);
  }, [locateTarget]);
```

- [ ] **Step 4: Add an HTML drop overlay over the canvas**

The deck instance can unproject screen pixels to `[lon, lat]`. Add a transparent overlay div as the LAST child inside the `<section>` (after the hover label block, around line 703), so HTML drag events land on it. The overlay is always present but transparent; `onDragOver`/`onDrop` only fire when an asset card is being dragged over it, so it does not interfere with clicks. Map pan/zoom is the one thing it can block — verified manually in Task 9, with the `pointer-events-none` fallback noted at the end of this step.

```tsx
      <div
        className="absolute inset-0 z-20"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          const deck = deckRef.current?.deck;
          if (!deck) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const coord = deck.unproject([event.clientX - rect.left, event.clientY - rect.top]);
          if (!coord) {
            setDropPreviewSlotId(null);
            return;
          }
          const slot = screenPointToSlot({
            lon: coord[0],
            lat: coord[1],
            activeLayerId: selectedLayerId,
            slots: echelonModel.slots,
          });
          setDropPreviewSlotId(slot?.id ?? null);
        }}
        onDragLeave={() => setDropPreviewSlotId(null)}
        onDrop={(event) => {
          event.preventDefault();
          const groupId = event.dataTransfer.getData("application/x-fortis-group");
          setDropPreviewSlotId(null);
          if (!groupId) return;
          const deck = deckRef.current?.deck;
          if (!deck) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const coord = deck.unproject([event.clientX - rect.left, event.clientY - rect.top]);
          if (!coord) return;
          const slot = screenPointToSlot({
            lon: coord[0],
            lat: coord[1],
            activeLayerId: selectedLayerId,
            slots: echelonModel.slots,
          });
          if (!slot) return; // drop outside an echelon slot = cancel
          onDropAsset({
            groupId,
            layerId: selectedLayerId,
            slotId: slot.id,
            mapRef: { lon: slot.position[0], lat: slot.position[1] },
          });
        }}
      />
```

**Fallback (apply only if Task 9 manual testing shows the overlay blocks map pan/zoom):** change the overlay class to `absolute inset-0 z-20 pointer-events-none` and move the three drag handlers (`onDragOver`/`onDragLeave`/`onDrop`) onto the parent `<section>` element instead, computing `rect` from `event.currentTarget.getBoundingClientRect()` the same way. Drag events bubble to the section even though the canvas captures pointer events, so map controls keep working while drag-drop still resolves.

- [ ] **Step 5: Color placement markers by `getMarkerState`**

Replace the `echelon-placement-objects` `ScatterplotLayer` (around line 492-515) `getFillColor`/`getLineColor`/`onClick`/`onHover` so markers reflect state. Add a state→color map above `deckLayers` (near line 269):

```ts
  const markerStateColors: Record<MarkerState, { fill: [number, number, number, number]; line: [number, number, number, number]; lineWidth: number }> = {
    default: { fill: [37, 99, 235, 235], line: [255, 255, 255, 220], lineWidth: 1 },
    hover: { fill: [37, 99, 235, 255], line: [191, 219, 254, 255], lineWidth: 2 },
    selected: { fill: [15, 23, 42, 255], line: [250, 204, 21, 255], lineWidth: 3 },
    warning: { fill: [245, 158, 11, 235], line: [180, 83, 9, 255], lineWidth: 2 },
    conflict: { fill: [239, 68, 68, 235], line: [153, 27, 27, 255], lineWidth: 3 },
    inactive: { fill: [148, 163, 184, 140], line: [203, 213, 225, 160], lineWidth: 1 },
  };

  const placementById = useMemo(
    () => new Map(configuration.placements.map((placement) => [placement.id, placement])),
    [configuration.placements],
  );

  // duplicate detection: same catalog group occupying the same slot more than once
  const duplicateSlotKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const placement of configuration.placements) {
      if (!placement.slotId || !placement.catalogGroupId) continue;
      const key = `${placement.slotId}:${placement.catalogGroupId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [configuration.placements]);
```

Then in the `echelon-placement-objects` layer, compute the source placement from the map id (`EchelonMapPlacement.id` is `${placement.id}:...`; the raw placement id is everything before the first `:`) and apply state colors:

```ts
        new ScatterplotLayer<EchelonMapPlacement>({
          id: "echelon-placement-objects",
          data: echelonModel.placements,
          getPosition: (item) => item.position,
          getRadius: (item) => (item.layerId === selectedLayerId ? 1700 : 1150),
          radiusMinPixels: 5,
          radiusMaxPixels: 16,
          stroked: true,
          pickable: true,
          getFillColor: (item) => {
            const rawId = item.id.split(":")[0];
            const placement = placementById.get(rawId);
            if (!placement) return item.color;
            const state = getMarkerState({
              placement,
              selectedPlacementId,
              hoveredPlacementId,
              isDuplicateInSlot: Boolean(
                placement.slotId && placement.catalogGroupId &&
                duplicateSlotKeys.has(`${placement.slotId}:${placement.catalogGroupId}`),
              ),
            });
            return markerStateColors[state].fill;
          },
          getLineColor: (item) => {
            const rawId = item.id.split(":")[0];
            const placement = placementById.get(rawId);
            if (!placement) return [255, 255, 255, 220];
            const state = getMarkerState({
              placement,
              selectedPlacementId,
              hoveredPlacementId,
              isDuplicateInSlot: Boolean(
                placement.slotId && placement.catalogGroupId &&
                duplicateSlotKeys.has(`${placement.slotId}:${placement.catalogGroupId}`),
              ),
            });
            return markerStateColors[state].line;
          },
          getLineWidth: (item) => {
            const rawId = item.id.split(":")[0];
            const placement = placementById.get(rawId);
            const state = placement
              ? getMarkerState({
                  placement,
                  selectedPlacementId,
                  hoveredPlacementId,
                  isDuplicateInSlot: Boolean(
                    placement.slotId && placement.catalogGroupId &&
                    duplicateSlotKeys.has(`${placement.slotId}:${placement.catalogGroupId}`),
                  ),
                })
              : "default";
            return markerStateColors[state as MarkerState].lineWidth;
          },
          lineWidthUnits: "pixels",
          updateTriggers: {
            getFillColor: [selectedPlacementId, hoveredPlacementId, duplicateSlotKeys],
            getLineColor: [selectedPlacementId, hoveredPlacementId, duplicateSlotKeys],
            getLineWidth: [selectedPlacementId, hoveredPlacementId, duplicateSlotKeys],
          },
          onClick: ({ object }) => {
            if (!object) return;
            const rawId = object.id.split(":")[0];
            onSelectPlacement(rawId);
          },
          onHover: ({ object }) => {
            const rawId = object ? object.id.split(":")[0] : null;
            setHoveredPlacementId(rawId);
            setHoverLabel(object ? `${object.label}` : null);
          },
        }),
```

Add `selectedPlacementId`, `hoveredPlacementId`, `placementById`, `duplicateSlotKeys`, `onSelectPlacement` to the `deckLayers` `useMemo` dependency array (around line 567-583).

- [ ] **Step 6: Draw the coverage layer for the selected placement**

Add, inside the `deckLayers` array (e.g. right after the `echelon-placement-objects` layer), a coverage layer block. First compute the selected placement + its center above `deckLayers`:

```ts
  const coverageLayers = useMemo(() => {
    if (!coverageVisible || !selectedPlacementId || !selectedFacility) return [];
    const placement = placementById.get(selectedPlacementId);
    if (!placement) return [];
    const center = placement.mapRef ?? selectedFacility.center;
    const shape = getCoverageShape(placement);
    if (shape.kind === "circle") {
      return [
        new ScatterplotLayer<{ center: { lon: number; lat: number }; radiusM: number }>({
          id: "coverage-circle",
          data: [{ center, radiusM: shape.radiusM }],
          getPosition: (item) => [item.center.lon, item.center.lat],
          getRadius: (item) => item.radiusM,
          radiusUnits: "meters",
          filled: true,
          stroked: true,
          getFillColor: [37, 99, 235, 40],
          getLineColor: [37, 99, 235, 200],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      ];
    }
    if (shape.kind === "sector") {
      const ring = buildSectorPolygon({
        center,
        azimuthDeg: shape.azimuthDeg,
        halfAngleDeg: shape.halfAngleDeg,
        radiusM: shape.radiusM,
      });
      return [
        new PolygonLayer<{ ring: Array<[number, number]> }>({
          id: "coverage-sector",
          data: [{ ring }],
          getPolygon: (item) => item.ring,
          filled: true,
          stroked: true,
          getFillColor: [37, 99, 235, 40],
          getLineColor: [37, 99, 235, 200],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      ];
    }
    return []; // "zone" reuses the existing echelon ring; "none" draws nothing
  }, [coverageVisible, selectedPlacementId, selectedFacility, placementById]);
```

Then spread `...coverageLayers` into the `deckLayers` array (e.g. just before `new PathLayer<ThreatRoute>(...)` around line 530), and add `coverageLayers` to the `deckLayers` dependency array.

- [ ] **Step 7: Lint and type-check via build of the module path**

Run: `pnpm lint`
Expected: no errors in `gis-board.tsx` or `drone-defense-prototype.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/drone-defense/ui/gis-board.tsx
git commit -m "feat(drone-defense): drag-drop overlay, marker states, coverage layer"
```

---

## Task 9: Full verification — tests, lint, build, manual

- [ ] **Step 1: Run all drone-defense contract tests**

Run:
```bash
for f in src/modules/drone-defense/domain/*-contract.test.ts; do echo "== $f"; pnpm dlx tsx "$f" || echo "FAILED: $f"; done
```
Expected: every test exits 0; no `FAILED:` lines.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: clean (or only pre-existing warnings unrelated to these files).

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: build succeeds (exit 0). Fix any type errors surfaced here.

- [ ] **Step 4: Manual browser verification**

Run `pnpm dev`, open the prototype route (the map view), and confirm:
- Drag a card from Каталог СЗ onto a slot of the active echelon → object appears, "Размещено" counter increments, the object shows in "Объекты эшелона".
- Drop outside any slot → nothing is created.
- Drop the same group on the same occupied slot → rejected (error toast), no duplicate.
- Click a marker → its card highlights; click a card → its marker highlights (selected = dark fill + yellow ring).
- "На карте" recenters the map on the object.
- "Удалить" removes the marker and the card; counter decrements; an emptied echelon shows the empty state.
- Toggle "Покрытие" with a selected object → circle (kinetic) or sector (sensor) overlay appears; untoggle hides it.
- Confirm map pan/zoom still works when not dragging (if blocked, apply the Task 8 Step 4 fallback: `pointer-events-none` overlay + drag handlers on `<section>`).

- [ ] **Step 5: Final commit (if manual fixes were needed)**

```bash
git add -A
git commit -m "fix(drone-defense): manual verification adjustments for map core"
```

---

## Self-Review Notes

- **Spec coverage:** Item 1 (stable drag-drop, no broken/dup objects, counters) → Tasks 4,5,7,8. Item 2 (echelon objects list with cards + name/echelon/count/status/cost + select/locate/delete + empty state) → Tasks 1,6,7. Item 3 (map↔list selection via single state) → Tasks 5,6,7,8. Item 4 (six marker states) → Tasks 2,8. Item 5 (toggleable coverage layer; circle/sector/zone/none; not embedded in marker) → Tasks 3,5,8.
- **Type consistency:** `placeAssetInSlot` signature identical in store (Task 5) and `onDropAsset` (Tasks 7,8). `selectedPlacementId`, `coverageVisible`, `selectPlacement`, `removePlacement` consistent across store/prototype/board. `MarkerState`/`CoverageShape`/`PlacementSummary` defined once in Tasks 1-4 and consumed in 6,8.
- **Known risk:** the drop overlay (Task 8 Step 4) may intercept map controls; the fallback is documented inline and verified manually in Task 9.
