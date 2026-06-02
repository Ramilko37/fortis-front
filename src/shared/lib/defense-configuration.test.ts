// Run: npx tsx src/shared/lib/defense-configuration.test.ts

import {
  applyBudgetPicksToConfiguration,
  calculateTotalCost,
  configurationToCalculatorLines,
  createEmptyConfiguration,
  loadPresetIntoConfiguration,
  selectedConfigurationToPlacements,
  setDefenseItemQuantityInConfiguration,
} from "@/shared/lib/defense-configuration";
import { defenseItems, getDefenseItemByMapGroupId } from "@/shared/config/defense-catalog";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const radar = getDefenseItemByMapGroupId("l2-radar");
assert(radar?.id === "mobile-radar", "l2-radar must map to the calculator mobile-radar item");

let config = createEmptyConfiguration();
assert(Object.keys(config.selectedItems).length === 0, "empty configuration must not preload NAK or any preset");

config = setDefenseItemQuantityInConfiguration(config, "mobile-radar", 99);
assert(config.selectedItems["mobile-radar"] === radar.maxQuantity, "quantity must clamp to maxQuantity");
assert(config.source === "custom", "manual edit must produce a custom configuration");

config = setDefenseItemQuantityInConfiguration(config, "mobile-radar", -1);
assert(!("mobile-radar" in config.selectedItems), "zero or negative quantity must remove the active line");

const nak = loadPresetIntoConfiguration("nak");
assert(nak.source === "preset", "loading NAK must mark configuration as preset");
assert(nak.name === "НАК", "preset configuration must use the preset display name");
assert(nak.selectedItems["mobile-radar"] === 6, "NAK must carry mobile-radar quantity from calculator reference data");

const editedNak = setDefenseItemQuantityInConfiguration(nak, "mobile-radar", 5);
assert(editedNak.source === "custom", "editing a preset must switch source to custom");
assert(editedNak.name === "Моя конфигурация на базе НАК", "editing a preset must preserve its base name");

const lines = configurationToCalculatorLines(editedNak);
assert(lines.some((line) => line.assetId === "mobile-radar" && line.quantity === 5), "calculator lines must reflect shared quantities");

const mapOnlyConfig = setDefenseItemQuantityInConfiguration(createEmptyConfiguration(), "l2-optical", 1);
const mapOnlyLines = configurationToCalculatorLines(mapOnlyConfig);
assert(
  mapOnlyLines.some((line) => line.assetId === "l2-optical" && line.quantity === 1),
  "map-only items must remain visible to the calculator as estimated-cost lines",
);
assert(calculateTotalCost(mapOnlyConfig) > 0, "map-only items must carry estimated CAPEX values");
assert(
  defenseItems.every((item) => typeof item.pricePerUnitMln === "number" && item.pricePerUnitMln > 0),
  "all defense catalog items must have positive estimated CAPEX values",
);

const placements = selectedConfigurationToPlacements({
  configuration: editedNak,
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});
assert(
  placements.some((placement) => placement.catalogGroupId === "l2-radar" && placement.qty === 5),
  "map placements must reflect shared quantities",
);

const budgetApplied = applyBudgetPicksToConfiguration(
  createEmptyConfiguration(),
  [
    { assetId: "mobile-radar", included: true },
    { assetId: "laser", included: false },
  ],
  defenseItems,
);
assert(budgetApplied.selectedItems["mobile-radar"] === 1, "included budget picks must become selected map items");
assert(!("laser" in budgetApplied.selectedItems), "excluded budget picks must not be selected");

console.log("defense-configuration.test.ts: shared configuration contracts passed");
