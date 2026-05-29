# Echelon Asset Icon Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic text slot glyphs on the active GIS echelon with real asset-image build buttons for provided L1/L2 defense assets, and build that exact asset into the clicked slot.

**Architecture:** Store provided PNGs under `public/` and add a domain-level build asset registry keyed by catalog group id. `GisBoard` renders image buttons with DeckGL `IconLayer` only for the active echelon’s empty/selected slots; occupied slots render the built asset image as the active state. Build actions pass the clicked slot explicitly to the existing `addCatalogGroup` flow.

**Tech Stack:** Next.js App Router, React client components, DeckGL `ScatterplotLayer`/`IconLayer`/`TextLayer`, TypeScript, existing FSD module boundaries in `src/modules/drone-defense`.

---

## Scope And Assumptions

- L1 uses all five images from `/Users/rr/Downloads/echelon_01_renamed_assets`.
- L2 uses five detection images from `/Users/rr/Downloads/echelon_02_03_assets/echelon_02`: radar, optoelectronic, thermal, acoustic, passive RF.
- `echelon_02_06_target_classification_software.png` maps to the existing `l3-classification` catalog group, because the current catalog places target classification in L3. Do not move it to L2 in this pass.
- Other echelons keep the current text glyph fallback until their image packs exist.
- A clicked icon builds the specific catalog group assigned to that slot index, not just the next unplaced group.
- If the assigned catalog group is already placed, the slot should not build a duplicate; it should show an occupied/disabled state.

## Files

- Create: `src/modules/drone-defense/domain/echelon-build-assets.ts`
  - Owns catalog-group to image metadata and the slot-index to build-option helper.
- Modify: `src/modules/drone-defense/domain/echelon-map-model.ts`
  - Add built placement metadata needed by the GIS UI: `catalogGroupId` and optional build asset profile.
- Create: `src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts`
  - Verifies asset registry coverage and slot-to-group behavior.
- Modify: `src/modules/drone-defense/ui/gis-board.tsx`
  - Render active echelon build icons via `IconLayer`.
  - Render occupied placement icons with active styling.
  - Click icon to build exact group into clicked slot.
- Modify: `src/modules/drone-defense/ui/drone-defense-prototype.tsx`
  - Keep `addCatalogGroup(groupId, targetSlot)` path and pass it to GIS.
- Add assets under: `public/drone-defense/echelons/l1/` and `public/drone-defense/echelons/l2/`.

---

### Task 1: Copy Provided Asset Images Into Public Assets

**Files:**
- Create directory: `public/drone-defense/echelons/l1/`
- Create directory: `public/drone-defense/echelons/l2/`
- Copy PNG files from the user-provided absolute paths.

- [ ] **Step 1: Create the public asset directories**

Run:

```bash
mkdir -p public/drone-defense/echelons/l1 public/drone-defense/echelons/l2
```

Expected: command exits `0`.

- [ ] **Step 2: Copy L1 images**

Run:

```bash
cp /Users/rr/Downloads/echelon_01_renamed_assets/echelon_01_01_regional_mchs_center.png public/drone-defense/echelons/l1/regional-mchs-center.png
cp /Users/rr/Downloads/echelon_01_renamed_assets/echelon_01_02_military_command_post.png public/drone-defense/echelons/l1/military-command-post.png
cp /Users/rr/Downloads/echelon_01_renamed_assets/echelon_01_03_regional_operations_hq_fsb_curator.png public/drone-defense/echelons/l1/regional-operations-hq-fsb-curator.png
cp /Users/rr/Downloads/echelon_01_renamed_assets/echelon_01_04_neighbor_enterprise_network_station.png public/drone-defense/echelons/l1/neighbor-enterprise-network-station.png
cp /Users/rr/Downloads/echelon_01_renamed_assets/echelon_01_05_osint_monitoring_workstation.png public/drone-defense/echelons/l1/osint-monitoring-workstation.png
```

Expected: command exits `0`; files exist under `public/drone-defense/echelons/l1/`.

- [ ] **Step 3: Copy L2 and classification images**

Run:

```bash
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_01_radar_station.png public/drone-defense/echelons/l2/radar-station.png
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_02_optoelectronic_system.png public/drone-defense/echelons/l2/optoelectronic-system.png
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_03_thermal_imaging_system.png public/drone-defense/echelons/l2/thermal-imaging-system.png
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_04_acoustic_array.png public/drone-defense/echelons/l2/acoustic-array.png
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_05_passive_radio_frequency_detector.png public/drone-defense/echelons/l2/passive-rf-detector.png
cp /Users/rr/Downloads/echelon_02_03_assets/echelon_02/echelon_02_06_target_classification_software.png public/drone-defense/echelons/l2/target-classification-software.png
```

Expected: command exits `0`; files exist under `public/drone-defense/echelons/l2/`.

- [ ] **Step 4: Commit asset copy**

Run:

```bash
git add public/drone-defense/echelons
git commit -m "feat: add echelon defense asset icons"
```

Expected: commit succeeds.

---

### Task 2: Add Domain Registry For Build Asset Icons

**Files:**
- Create: `src/modules/drone-defense/domain/echelon-build-assets.ts`
- Test: `src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts`

- [ ] **Step 1: Write the failing registry contract test**

Create `src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  getBuildAssetForCatalogGroup,
  getBuildOptionForSlot,
} from "@/modules/drone-defense/domain/echelon-build-assets";
import { buildScenarioConfiguration, echelonCatalogGroups } from "@/modules/drone-defense/infra/mock-defense-data";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

const publicRoot = join(process.cwd(), "public");
const l1Groups = echelonCatalogGroups.filter((group) => group.layerId === "layer_01_external_warning");
const l2Groups = echelonCatalogGroups.filter((group) => group.layerId === "layer_02_detection");
const classificationGroup = echelonCatalogGroups.find((group) => group.id === "l3-classification");

for (const group of [...l1Groups, ...l2Groups, classificationGroup].filter(Boolean)) {
  const asset = getBuildAssetForCatalogGroup(group.id);
  if (!asset) {
    throw new Error(`${group.id} must have a build asset icon`);
  }

  if (!existsSync(join(publicRoot, asset.imageUrl))) {
    throw new Error(`${group.id} icon file must exist at public/${asset.imageUrl}`);
  }
}

const l1Slot: EchelonMapSlot = {
  id: "layer_01_external_warning-slot-02",
  layerId: "layer_01_external_warning",
  slotIndex: 2,
  label: "S2",
  position: [60.1, 56.1],
  status: "empty",
  color: [255, 255, 255, 235],
};
const option = getBuildOptionForSlot({
  slot: l1Slot,
  catalogGroups: echelonCatalogGroups,
  placements: buildScenarioConfiguration("facility-alpha", "baseline").placements,
});

if (option?.groupId !== "l1-military-command") {
  throw new Error("L1 slot 2 must build the military command post asset");
}

const placedConfiguration = buildScenarioConfiguration("facility-alpha", "baseline", [
  {
    id: "facility-alpha-baseline-l1-military-command",
    assetId: "asset-radar-l2",
    facilityId: "facility-alpha",
    scenarioId: "baseline",
    layerId: "layer_01_external_warning",
    catalogGroupId: "l1-military-command",
    catalogGroupName: "Военная комендатура",
    slotId: l1Slot.id,
    mapRef: { lon: 60.1, lat: 56.1 },
    qty: 1,
    readiness: 0.72,
    layerGapBoost: 1,
    criticalityBoost: 1,
    feasibility: 0.82,
    environmentModifier: 0.92,
  },
]);

const blockedOption = getBuildOptionForSlot({
  slot: l1Slot,
  catalogGroups: echelonCatalogGroups,
  placements: placedConfiguration.placements,
});

if (blockedOption !== null) {
  throw new Error("A slot assigned to an already-built catalog group must not build a duplicate");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm dlx tsx src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts
```

Expected: FAIL with module/function not found.

- [ ] **Step 3: Add build asset registry**

Create `src/modules/drone-defense/domain/echelon-build-assets.ts`:

```ts
import type { DefenseLayerId, Placement } from "@/shared/types/drone-defense";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

export type BuildAssetIcon = {
  groupId: string;
  layerId: DefenseLayerId;
  label: string;
  imageUrl: string;
};

export type BuildCatalogGroup = {
  id: string;
  layerId: DefenseLayerId;
  name: string;
};

export type SlotBuildOption = {
  groupId: string;
  label: string;
  imageUrl: string;
};

const buildAssetIcons: BuildAssetIcon[] = [
  { groupId: "l1-emergency-centers", layerId: "layer_01_external_warning", label: "МЧС", imageUrl: "/drone-defense/echelons/l1/regional-mchs-center.png" },
  { groupId: "l1-military-command", layerId: "layer_01_external_warning", label: "Комендатура", imageUrl: "/drone-defense/echelons/l1/military-command-post.png" },
  { groupId: "l1-regional-hq", layerId: "layer_01_external_warning", label: "Штаб", imageUrl: "/drone-defense/echelons/l1/regional-operations-hq-fsb-curator.png" },
  { groupId: "l1-neighbor-network", layerId: "layer_01_external_warning", label: "Соседи", imageUrl: "/drone-defense/echelons/l1/neighbor-enterprise-network-station.png" },
  { groupId: "l1-osint", layerId: "layer_01_external_warning", label: "OSINT", imageUrl: "/drone-defense/echelons/l1/osint-monitoring-workstation.png" },
  { groupId: "l2-radar", layerId: "layer_02_detection", label: "РЛС", imageUrl: "/drone-defense/echelons/l2/radar-station.png" },
  { groupId: "l2-optical", layerId: "layer_02_detection", label: "ОЭП", imageUrl: "/drone-defense/echelons/l2/optoelectronic-system.png" },
  { groupId: "l2-thermal", layerId: "layer_02_detection", label: "Тепло", imageUrl: "/drone-defense/echelons/l2/thermal-imaging-system.png" },
  { groupId: "l2-acoustic", layerId: "layer_02_detection", label: "Акустика", imageUrl: "/drone-defense/echelons/l2/acoustic-array.png" },
  { groupId: "l2-rf-passive", layerId: "layer_02_detection", label: "RF", imageUrl: "/drone-defense/echelons/l2/passive-rf-detector.png" },
  { groupId: "l3-classification", layerId: "layer_03_identification", label: "Классиф.", imageUrl: "/drone-defense/echelons/l2/target-classification-software.png" },
];

const buildAssetByGroupId = new Map(buildAssetIcons.map((asset) => [asset.groupId, asset]));

export function getBuildAssetForCatalogGroup(groupId: string) {
  return buildAssetByGroupId.get(groupId) ?? null;
}

export function getBuildAssetsForLayer(layerId: DefenseLayerId) {
  return buildAssetIcons.filter((asset) => asset.layerId === layerId);
}

export function getBuildOptionForSlot({
  slot,
  catalogGroups,
  placements,
}: {
  slot: EchelonMapSlot;
  catalogGroups: BuildCatalogGroup[];
  placements: Placement[];
}): SlotBuildOption | null {
  if (slot.status === "occupied") return null;

  const layerGroups = catalogGroups.filter((group) => group.layerId === slot.layerId);
  const group = layerGroups[slot.slotIndex - 1];
  if (!group) return null;

  const asset = getBuildAssetForCatalogGroup(group.id);
  if (!asset) return null;

  const isAlreadyPlaced = placements.some((placement) => placement.catalogGroupId === group.id);
  if (isAlreadyPlaced) return null;

  return {
    groupId: group.id,
    label: asset.label,
    imageUrl: asset.imageUrl,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm dlx tsx src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts
```

Expected: PASS with no output.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/modules/drone-defense/domain/echelon-build-assets.ts src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts
git commit -m "feat: map echelon build assets to catalog groups"
```

Expected: commit succeeds.

---

### Task 3: Attach Build Asset Metadata To Built Placements

**Files:**
- Modify: `src/modules/drone-defense/domain/echelon-map-model.ts`
- Modify: `src/modules/drone-defense/domain/echelon-slot-contract.test.ts`

- [ ] **Step 1: Write failing placement metadata assertion**

Append to `src/modules/drone-defense/domain/echelon-slot-contract.test.ts`:

```ts
const placedMarker = model.placements.find((item) => item.catalogGroupId === "l4-ew-gnss");

if (!placedMarker?.catalogGroupId) {
  throw new Error("Placement markers must expose catalogGroupId for GIS asset icon rendering");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm dlx tsx src/modules/drone-defense/domain/echelon-slot-contract.test.ts
```

Expected: FAIL because `EchelonMapPlacement` does not expose `catalogGroupId`.

- [ ] **Step 3: Add `catalogGroupId` to map placement model**

Modify `src/modules/drone-defense/domain/echelon-map-model.ts`:

```ts
export type EchelonMapPlacement = {
  id: string;
  layerId: DefenseLayerId;
  label: string;
  position: [number, number];
  color: [number, number, number, number];
  isCatalogPlacement: boolean;
  slotId?: string;
  catalogGroupId?: string;
};
```

In the placement mapping return object, add:

```ts
catalogGroupId: placement.catalogGroupId,
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm dlx tsx src/modules/drone-defense/domain/echelon-slot-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/modules/drone-defense/domain/echelon-map-model.ts src/modules/drone-defense/domain/echelon-slot-contract.test.ts
git commit -m "feat: expose catalog group on map placements"
```

Expected: commit succeeds.

---

### Task 4: Render Active-Echelon Build Buttons With IconLayer

**Files:**
- Modify: `src/modules/drone-defense/ui/gis-board.tsx`

- [ ] **Step 1: Import `IconLayer` and build asset helpers**

Modify imports in `src/modules/drone-defense/ui/gis-board.tsx`:

```ts
import { IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import {
  getBuildAssetForCatalogGroup,
  getBuildOptionForSlot,
} from "@/modules/drone-defense/domain/echelon-build-assets";
```

- [ ] **Step 2: Add active build slot data inside `deckLayers`**

Inside the `zone` loop in `GisBoard`, after `zoneSlots`, add:

```ts
const buildSlots = zoneSlots
  .map((slot) => ({
    slot,
    option: getBuildOptionForSlot({
      slot,
      catalogGroups: buildableCatalogGroups,
      placements: configuration.placements,
    }),
  }))
  .filter((item) => isActive && item.option);
```

- [ ] **Step 3: Change slot click to build the slot’s assigned option**

Replace the current generic `findNextBuildableCatalogGroupForLayer` path in `handleSlotClick` with:

```ts
const handleSlotClick = (object: EchelonMapSlot | null | undefined) => {
  if (!object) return;

  onSelectSlot(object);

  const option = getBuildOptionForSlot({
    slot: object,
    catalogGroups: buildableCatalogGroups,
    placements: configuration.placements,
  });

  if (option) {
    onAddCatalogGroup(option.groupId, object);
  }
};
```

- [ ] **Step 4: Render image build buttons for active empty/selected slots**

Add this layer immediately after the slot `ScatterplotLayer` and before fallback text labels:

```ts
new IconLayer<(typeof buildSlots)[number]>({
  id: `echelon-${layerSlug}-build-icons`,
  data: buildSlots,
  getPosition: (item) => item.slot.position,
  getIcon: (item) => ({
    url: item.option?.imageUrl ?? "",
    width: 128,
    height: 128,
    anchorY: 64,
  }),
  getSize: (item) => (item.slot.status === "selected" ? 46 : 40),
  sizeUnits: "pixels",
  billboard: true,
  pickable: true,
  onClick: ({ object }) => handleSlotClick(object?.slot),
  onHover: ({ object }) =>
    setHoverLabel(object?.option ? `Построить: ${object.option.label}` : null),
}),
```

- [ ] **Step 5: Hide text glyphs for active image-backed slots**

Change the slot label layer `data`:

```ts
data: zoneSlots.filter((slot) => {
  if (!isActive) return true;
  return !getBuildOptionForSlot({
    slot,
    catalogGroups: buildableCatalogGroups,
    placements: configuration.placements,
  });
}),
```

Expected: L1/L2 active empty slots show image icons instead of `RAD/EYE` text. Other layers keep existing text fallback.

- [ ] **Step 6: Run targeted checks**

Run:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/modules/drone-defense/ui/gis-board.tsx src/modules/drone-defense/domain/echelon-build-assets.ts
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/modules/drone-defense/ui/gis-board.tsx
git commit -m "feat: render active echelon build icons on map"
```

Expected: commit succeeds.

---

### Task 5: Render Built Asset Icons As Active State

**Files:**
- Modify: `src/modules/drone-defense/ui/gis-board.tsx`

- [ ] **Step 1: Add built placement icon data**

Inside `deckLayers`, before `echelon-placement-objects`, add:

```ts
const iconPlacements = echelonModel.placements
  .map((placement) => ({
    placement,
    asset: placement.catalogGroupId ? getBuildAssetForCatalogGroup(placement.catalogGroupId) : null,
  }))
  .filter((item) => item.asset);
```

If this cannot live outside the layer array cleanly, compute it as a `useMemo` before `deckLayers`:

```ts
const iconPlacements = useMemo(
  () =>
    echelonModel.placements
      .map((placement) => ({
        placement,
        asset: placement.catalogGroupId ? getBuildAssetForCatalogGroup(placement.catalogGroupId) : null,
      }))
      .filter((item) => item.asset),
  [echelonModel.placements],
);
```

- [ ] **Step 2: Render occupied icon layer**

Add before `echelon-placement-objects`:

```ts
new IconLayer<(typeof iconPlacements)[number]>({
  id: "echelon-built-asset-icons",
  data: iconPlacements,
  getPosition: (item) => item.placement.position,
  getIcon: (item) => ({
    url: item.asset?.imageUrl ?? "",
    width: 128,
    height: 128,
    anchorY: 64,
  }),
  getSize: (item) => (item.placement.layerId === selectedLayerId ? 48 : 34),
  sizeUnits: "pixels",
  billboard: true,
  pickable: true,
  onClick: ({ object }) => {
    const slot = object?.placement.slotId
      ? echelonModel.slots.find((item) => item.id === object.placement.slotId)
      : null;
    if (slot) {
      onSelectSlot(slot);
    }
  },
  onHover: ({ object }) => setHoverLabel(object ? object.placement.label : null),
}),
```

- [ ] **Step 3: Keep circle layer as selection halo, not duplicate icon**

Change `echelon-placement-objects` data:

```ts
data: echelonModel.placements,
```

Keep it as-is if the visual halo helps; otherwise reduce opacity:

```ts
getFillColor: (item) =>
  item.catalogGroupId ? [255, 255, 255, 0] : item.color,
```

Expected: after building, the icon remains on the map as the built/active unit marker.

- [ ] **Step 4: Run checks**

Run:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/modules/drone-defense/ui/gis-board.tsx
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/modules/drone-defense/ui/gis-board.tsx
git commit -m "feat: show built asset icons on gis map"
```

Expected: commit succeeds.

---

### Task 6: Browser Verification

**Files:**
- No code files changed in this task.

- [ ] **Step 1: Open prototype**

Use the in-app browser at:

```text
http://localhost:3000/prototype/
```

Expected: the GIS screen loads with no app error overlay.

- [ ] **Step 2: Verify L1 icon build flow**

Manual actions:

1. Select `L1`.
2. Confirm active L1 slots show the five provided L1 image icons.
3. Click the second L1 icon.
4. Confirm `Размещено` increments by `1`.
5. Confirm the clicked slot becomes occupied and keeps the military command post icon.

Expected: no duplicate build occurs when clicking the same occupied slot again.

- [ ] **Step 3: Verify L2 icon build flow**

Manual actions:

1. Select `L2`.
2. Confirm active L2 slots show radar, optical, thermal, acoustic, and RF image icons.
3. Click the radar icon.
4. Confirm `Размещено` increments by `1`.
5. Confirm the clicked slot becomes occupied and keeps the radar image.

Expected: L2 uses the provided images, not text `EYE` labels, while active.

- [ ] **Step 4: Verify fallback layers**

Manual actions:

1. Select `L4`.
2. Confirm slots still use existing text glyph fallback.
3. Click an L4 slot.

Expected: existing build behavior still works for layers without image packs.

- [ ] **Step 5: Run final targeted checks**

Run:

```bash
pnpm dlx tsx src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts
pnpm dlx tsx src/modules/drone-defense/domain/echelon-slot-contract.test.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/modules/drone-defense/domain/echelon-build-assets.ts src/modules/drone-defense/domain/echelon-build-assets-contract.test.ts src/modules/drone-defense/domain/echelon-map-model.ts src/modules/drone-defense/domain/echelon-slot-contract.test.ts src/modules/drone-defense/ui/gis-board.tsx src/modules/drone-defense/ui/drone-defense-prototype.tsx
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit final verification adjustments**

If any small visual/timing fixes were needed during browser verification, commit them:

```bash
git add src/modules/drone-defense public/drone-defense
git commit -m "fix: polish echelon build icon interactions"
```

Expected: commit succeeds only if verification required extra changes.

---

## Self-Review

- Spec coverage: L1/L2 provided PNGs are copied to public assets, mapped to catalog groups, shown only on active echelon slots, and clicked to build exact assets.
- Placeholder scan: no deferred implementation steps; every task includes exact paths and commands.
- Type consistency: `getBuildOptionForSlot`, `BuildAssetIcon`, `catalogGroupId`, and `EchelonMapSlot` are used consistently across tests, domain, and UI.
