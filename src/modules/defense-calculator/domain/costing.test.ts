// Verification: reproduce the PDF slide-2 configuration totals exactly.
// Run: npx tsx src/modules/defense-calculator/domain/costing.test.ts
// Throws on any mismatch; prints a summary on success.

import {
  assets,
  bundleOverridesMln,
  criteria,
  defaultThresholds,
  echelons,
  referenceConfigurations,
} from "@/modules/defense-calculator/infra/catalog-data";
import { estimateConfiguration } from "@/modules/defense-calculator/domain/costing";

// Exact computed totals (млн руб) per the verified PDF arithmetic.
const EXPECTED_TOTAL_MLN: Record<string, number> = {
  nak: 2454.1,
  nev: 1987,
  fosforit: 3446.6,
  bmu: 1819.7,
};

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

for (const config of referenceConfigurations) {
  const estimate = estimateConfiguration(config, {
    assets,
    echelons,
    criteria,
    thresholds: defaultThresholds,
    lineTotalOverridesMln: bundleOverridesMln[config.id],
  });

  const expected = EXPECTED_TOTAL_MLN[config.id];
  const diff = Math.abs(estimate.totalMln - expected);
  assert(
    diff < 0.05,
    `Config ${config.name} total mismatch: got ${estimate.totalMln} млн, expected ${expected} млн (diff ${diff})`,
  );

  // Spot-check a known line: interceptor drones at 7 млн/комплект.
  const droneLine = estimate.echelons
    .flatMap((echelon) => echelon.lines)
    .find((line) => line.assetId === "interceptor-drones");
  if (droneLine) {
    assert(
      Math.abs(droneLine.lineTotalMln - droneLine.quantity * 7) < 1e-6,
      `Drone line cost wrong in ${config.name}: ${droneLine.lineTotalMln}`,
    );
  }

  console.log(
    `OK ${config.name}: ${estimate.totalMln} млн ≈ ${expected} млн (${(estimate.totalMln / 1000).toFixed(2)} млрд)`,
  );
}

console.log("costing.test.ts: all configuration totals reconcile ✓");
