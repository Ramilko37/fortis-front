// Run: pnpm exec tsx src/modules/drone-defense/infra/seed-backend-asset-library.test.ts

import { buildPublicAssetSeedPayloads } from "@/modules/drone-defense/infra/seed-backend-asset-library";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const payloads = buildPublicAssetSeedPayloads();

assert(payloads.length === 34, `seed payloads must include all 34 frontend assets, got ${payloads.length}`);
assert(payloads.every((payload) => payload.isPublic === true), "all seeded assets must be marked public");
assert(payloads.every((payload) => payload.enterpriseId === undefined), "public seeded assets must not carry enterpriseId");

const mog = payloads.find((payload) => payload.legacyItemId === "l5-mobile-fire");
assert(mog, "seed payloads must include МОГ asset");
assert(mog.name === "МОГ", "МОГ seed must preserve asset name");
assert(mog.protectionType === "МОГ", "МОГ seed must preserve protectionType");
assert(typeof mog.compoundProfile === "object" && mog.compoundProfile !== null, "МОГ seed must preserve compoundProfile");

const radar = payloads.find((payload) => payload.legacyItemId === "mobile-radar");
assert(radar?.maxEffectiveDistance === 75, "serializer must keep frontend meters -> backend kilometers conversion");

console.log("seed-backend-asset-library.test.ts: seed payload contracts passed");
