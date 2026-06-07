import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const toolIconSource = readFileSync("src/modules/drone-defense/ui/defense-tool-icon.tsx", "utf8");
const toolsPanelSource = readFileSync("src/modules/drone-defense/ui/defense-tools-panel.tsx", "utf8");

for (const forbiddenCopy of ["РАЗМЕЩЕНО", "Размещено:", "не требует размещения", ">Разместить<"]) {
  assert(!toolIconSource.includes(forbiddenCopy), `Compact library card must not render legacy copy: ${forbiddenCopy}`);
}

for (const expectedCopy of ["На карте", "Нарисовать", "Перетащите"]) {
  assert(toolIconSource.includes(expectedCopy), `Compact library card must expose "${expectedCopy}" state/copy`);
}

for (const forbiddenCopy of ["Включено", "Без карты", "Добавить"]) {
  assert(!toolIconSource.includes(forbiddenCopy), `Compact library card must not expose split add-only copy: ${forbiddenCopy}`);
}

assert(toolIconSource.includes("placementType"), "DefenseToolIcon must receive placementType to split map and zone card labels");
assert(toolIconSource.includes("const canDrag = canAdd"), "DefenseToolIcon must make every enabled card draggable");
assert(!toolIconSource.includes("aspect-square w-full"), "Compact library card must not use the large square image preview");
assert(!toolIconSource.includes("MinusOutlined"), "Library card must not expose the large remove action");

assert(toolsPanelSource.includes("placementType={assetItem.placementType}"), "DefenseToolsPanel must pass placementType into compact cards");

console.log("compact-asset-cards-contract.test.mjs: compact draggable asset cards contract passed");
