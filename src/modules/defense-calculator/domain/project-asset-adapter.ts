import { assets as calculatorSeedAssets } from "@/modules/defense-calculator/infra/catalog-data";
import type { DefenseAsset, EchelonId } from "@/modules/defense-calculator/domain/calculator-types";
import type { DefenseAssetLibraryItem } from "@/shared/types/defense-project";

const seedById = new Map(calculatorSeedAssets.map((asset) => [asset.id, asset]));

function scoreToSyntheticScores(score: number): DefenseAsset["scores"] {
  const normalized = Math.max(1, Math.min(5, score / 20));
  return {
    effectiveness: normalized,
    deploySpeed: normalized,
    cost: normalized,
    scalability: normalized,
    availability: normalized,
    governance: normalized,
    adaptivity: normalized,
  };
}

function fallbackEchelonId(asset: DefenseAssetLibraryItem): EchelonId {
  const preferredCode = asset.recommendedLayerCodes?.[0];
  switch (preferredCode) {
    case "L1":
      return "ech_1_external_warning";
    case "L2":
    case "L3":
      return "ech_2_detection";
    case "L4":
    case "L7":
      return "ech_3_suppression";
    case "L5":
      return "ech_4_fire_priority";
    case "L6":
      return "ech_5_fire_reserve";
    case "L8":
      return "ech_6_passive_itz";
    case "L9":
      return "ech_7_atz";
    default:
      return "ech_8_infrastructure";
  }
}

export function projectAssetToCalculatorAsset(asset: DefenseAssetLibraryItem): DefenseAsset {
  const calculatorId = asset.calculatorAssetId ?? asset.id;
  const seed = seedById.get(calculatorId);

  return {
    id: calculatorId,
    name: asset.name,
    echelonId: seed?.echelonId ?? fallbackEchelonId(asset),
    unitPriceMln: asset.pricePerUnitMln ?? 0,
    unit: asset.unitLabel === "комплект" ? "комплект" : "шт",
    scores: seed?.scores ?? scoreToSyntheticScores(asset.score ?? 0),
    scoreSource: seed?.scoreSource ?? "expert-stub",
  };
}

export function projectAssetsToCalculatorAssets(assets: DefenseAssetLibraryItem[]): DefenseAsset[] {
  const byCalculatorId = new Map<string, DefenseAsset>();
  assets.forEach((asset) => {
    const calculatorAsset = projectAssetToCalculatorAsset(asset);
    if (!byCalculatorId.has(calculatorAsset.id)) {
      byCalculatorId.set(calculatorAsset.id, calculatorAsset);
    }
  });
  return [...byCalculatorId.values()];
}
