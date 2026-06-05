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

console.log("user-facing-copy-contract.test.ts: Defense Studio copy hides legacy slot/asset terms");
