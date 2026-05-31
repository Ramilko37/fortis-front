// Verification: weighted scores reproduce the Excel "Средневзв. оценка" anchors and the
// priority colours match PDF slide 1.
// Run: npx tsx src/modules/defense-calculator/domain/scoring.test.ts

import { assets, criteria, defaultThresholds } from "@/modules/defense-calculator/infra/catalog-data";
import { computeWeightedScore, priorityForScore, weightsAreValid } from "@/modules/defense-calculator/domain/scoring";
import { getAssetById } from "@/modules/defense-calculator/infra/catalog-data";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Weights must sum to 100.
assert(weightsAreValid(criteria), "Criteria weights must sum to 100");

// Anchor scores (±2 tolerance) and expected colours vs PDF.
const ANCHORS: Array<{ id: string; score: number; color: "green" | "orange" | "red" }> = [
  { id: "mobile-radar", score: 79, color: "green" },
  { id: "interceptor-drones", score: 74, color: "green" },
  { id: "barrel-aa", score: 60, color: "orange" },
  { id: "laser", score: 40, color: "red" },
];

for (const anchor of ANCHORS) {
  const asset = getAssetById(anchor.id);
  assert(Boolean(asset), `Missing asset ${anchor.id}`);
  const score = computeWeightedScore(asset!.scores, criteria);
  const color = priorityForScore(score, defaultThresholds);
  assert(
    Math.abs(score - anchor.score) <= 2,
    `${asset!.name} score ${score} not within ±2 of ${anchor.score}`,
  );
  assert(color === anchor.color, `${asset!.name} colour ${color} != expected ${anchor.color}`);
  console.log(`OK ${asset!.name}: ${score.toFixed(0)} → ${color}`);
}

// Every asset must produce a score in [0, 100].
for (const asset of assets) {
  const score = computeWeightedScore(asset.scores, criteria);
  assert(score >= 0 && score <= 100, `${asset.name} score out of range: ${score}`);
}

console.log("scoring.test.ts: all scores and colours match PDF/Excel anchors ✓");
