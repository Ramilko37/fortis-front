import { readFileSync } from "node:fs";
import { canPlaceCatalogGroupInSlot } from "@/modules/drone-defense/domain/echelon-build-assets";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

const blockedWords = [/\bslot\b/i, /слот/i, /\basset\b/i, /ассет/i];

function assertNoLegacyWords(value: string, context: string) {
  const match = blockedWords.find((pattern) => pattern.test(value));
  if (match) {
    throw new Error(`${context} leaks legacy copy: "${value}"`);
  }
}

function extractUserFacingStringLiterals(source: string) {
  const literals: string[] = [];
  const stringPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match: RegExpExecArray | null;

  while ((match = stringPattern.exec(source))) {
    const value = match[2];
    const looksUserFacing =
      /[А-Яа-яЁё]/.test(value) ||
      (/\s/.test(value) && /\b(slot|asset)\b/i.test(value));

    if (looksUserFacing) {
      literals.push(value);
    }
  }

  return literals;
}

const l1Slot: EchelonMapSlot = {
  id: "layer_01_external_warning-slot-01",
  layerId: "layer_01_external_warning",
  slotIndex: 1,
  label: "S1",
  position: [60.1, 56.1],
  status: "empty",
  color: [255, 255, 255, 235],
};

const placementMessages = [
  canPlaceCatalogGroupInSlot({ groupId: "unknown-group", slot: l1Slot, placements: [] }).message,
  canPlaceCatalogGroupInSlot({ groupId: "l1-military-command", slot: { ...l1Slot, layerId: "layer_04_suppression" }, placements: [] }).message,
  canPlaceCatalogGroupInSlot({ groupId: "l1-military-command", slot: { ...l1Slot, status: "occupied" }, placements: [] }).message,
  canPlaceCatalogGroupInSlot({ groupId: "l1-military-command", slot: l1Slot, placements: [] }).message,
];

for (const message of placementMessages) {
  assertNoLegacyWords(message, "placement message");
}

const checkedFiles = [
  "src/modules/drone-defense/domain/echelon-build-assets.ts",
  "src/modules/drone-defense/ui/defense-tools-panel.tsx",
  "src/modules/drone-defense/ui/defense-tool-icon.tsx",
  "src/modules/drone-defense/ui/coordinate-placement-panel.tsx",
  "src/modules/drone-defense/ui/gis-board.tsx",
  "src/modules/drone-defense/ui/properties-panel.tsx",
  "src/modules/drone-defense/ui/assets-panel.tsx",
];

for (const filePath of checkedFiles) {
  const source = readFileSync(filePath, "utf8");
  for (const literal of extractUserFacingStringLiterals(source)) {
    assertNoLegacyWords(literal, filePath);
  }
}

const defenseToolIconSource = readFileSync("src/modules/drone-defense/ui/defense-tool-icon.tsx", "utf8");
for (const forbiddenCopy of ["РАЗМЕЩЕНО", "Размещено:", ">Разместить<", "не требует размещения"]) {
  if (defenseToolIconSource.includes(forbiddenCopy)) {
    throw new Error(`DefenseToolIcon must not expose legacy compact-card copy: ${forbiddenCopy}`);
  }
}
for (const expectedCopy of ["На карте", "Нарисовать", "Перетащите"]) {
  if (!defenseToolIconSource.includes(expectedCopy)) {
    throw new Error(`DefenseToolIcon must expose compact-card copy: ${expectedCopy}`);
  }
}
for (const forbiddenCopy of ["Включено", "Без карты", "Добавить"]) {
  if (defenseToolIconSource.includes(forbiddenCopy)) {
    throw new Error(`DefenseToolIcon must not expose add-only compact-card copy: ${forbiddenCopy}`);
  }
}

const coordinatePlacementPanelSource = readFileSync("src/modules/drone-defense/ui/coordinate-placement-panel.tsx", "utf8");
for (const expectedCopy of ["Средство", "Эшелон", "Широта", "Долгота", "Высота, м", "Комментарий", "Проверить точку", "Разместить"]) {
  if (!coordinatePlacementPanelSource.includes(expectedCopy)) {
    throw new Error(`CoordinatePlacementPanel must expose "${expectedCopy}"`);
  }
}

const defenseToolsPanelSource = readFileSync("src/modules/drone-defense/ui/defense-tools-panel.tsx", "utf8");
if (defenseToolsPanelSource.includes("slots[index]") || defenseToolsPanelSource.includes("onAddTool(assetItem, slot)")) {
  throw new Error("DefenseToolsPanel library cards must not bind common assets to positional slots by array index");
}
if (
  !defenseToolsPanelSource.includes("onDragAsset") ||
  !defenseToolsPanelSource.includes("onPointerDragAsset") ||
  !defenseToolsPanelSource.includes("onMouseDragAsset")
) {
  throw new Error("DefenseToolsPanel must expose drag-start for direct map placement");
}

const gisBoardSource = readFileSync("src/modules/drone-defense/ui/gis-board.tsx", "utf8");
if (
  !gisBoardSource.includes("application/x-fortis-defense-asset") ||
  !gisBoardSource.includes("onDropAsset") ||
  !gisBoardSource.includes("onPointerDropAsset")
) {
  throw new Error("GisBoard must accept dragged defense asset drops on the map");
}

const prototypeSource = readFileSync("src/modules/drone-defense/ui/drone-defense-prototype.tsx", "utf8");
for (const forbiddenCopy of ["Реком.", "Рекомендовано", "не рекомендовано", "Недоступно"]) {
  if (prototypeSource.includes(forbiddenCopy) || defenseToolIconSource.includes(forbiddenCopy)) {
    throw new Error(`Defense Studio must not expose recommendation copy: ${forbiddenCopy}`);
  }
}
if (prototypeSource.includes("catalogFilter") || prototypeSource.includes("catalogFilterCategories")) {
  throw new Error("Defense Studio library must not expose category/recommendation filter controls");
}

console.log("user-facing-copy-contract.test.ts: Defense Studio copy hides legacy slot/asset terms");
