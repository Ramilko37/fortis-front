// Catalog data for the defense calculator.
//
// PRICES: extracted from docs/3CA74B5B-...pdf (slide 2) and verified — unit prices are stable
//   across all four reference configurations, and each config's line items sum to its stated total.
// SCORES: criteria scores (1–5) are expert stubs tuned so the weighted score reproduces the Excel
//   "Средневзв. оценка" anchors (РЛС≈79, лазер≈35, ствольная ПВО≈57) under the PDF slide-3 weights,
//   which also makes the priority colours match PDF slide 1. Stubs are flagged scoreSource: "expert-stub".
//
// See docs/product/defense-calculator-spec.md for the full model.

import type {
  Configuration,
  Criterion,
  DefenseAsset,
  Echelon,
  PriorityThresholds,
} from "@/modules/defense-calculator/domain/calculator-types";

/** Criteria weights — canonical version from PDF slide 3 (sum = 100). */
export const criteria: Criterion[] = [
  { id: "effectiveness", name: "Эффективность защиты / поражения", weight: 25 },
  { id: "deploySpeed", name: "Скорость развёртывания", weight: 25 },
  { id: "cost", name: "Стоимость", weight: 20 },
  { id: "scalability", name: "Масштабируемость", weight: 10 },
  { id: "availability", name: "Доступность", weight: 10 },
  { id: "governance", name: "Управляемость", weight: 5 },
  { id: "adaptivity", name: "Адаптивность", weight: 5 },
];

/** Default priority colour thresholds on the 0–100 weighted score. */
export const defaultThresholds: PriorityThresholds = { green: 70, orange: 50 };

/** The eight echelons (PDF slide 2 columns). */
export const echelons: Echelon[] = [
  { id: "ech_1_external_warning", order: 1, name: "Внешнее предупреждение", rangeLabel: "до 300 км" },
  { id: "ech_2_detection", order: 2, name: "Обнаружение", rangeLabel: "5–75 км" },
  { id: "ech_3_suppression", order: 3, name: "Подавление", rangeLabel: "2–10 км" },
  { id: "ech_4_fire_priority", order: 4, name: "Огневое поражение (приоритет)", rangeLabel: "1–20 км" },
  { id: "ech_5_fire_reserve", order: 5, name: "Огневое поражение (резерв)", rangeLabel: "до 1,5 км" },
  { id: "ech_6_passive_itz", order: 6, name: "Пассивная защита / ИТЗ", rangeLabel: "0,5–2 км, на узлах" },
  { id: "ech_7_atz", order: 7, name: "АТЗ", rangeLabel: "n/a" },
  { id: "ech_8_infrastructure", order: 8, name: "Инфраструктура", rangeLabel: "на всех эшелонах" },
];

// Convenience builder so scores read clearly in order: eff, speed, cost, scale, avail, gov, adapt.
function scores(
  effectiveness: number,
  deploySpeed: number,
  cost: number,
  scalability: number,
  availability: number,
  governance: number,
  adaptivity: number,
) {
  return { effectiveness, deploySpeed, cost, scalability, availability, governance, adaptivity };
}

export const assets: DefenseAsset[] = [
  // Echelon 2 — Detection
  {
    id: "mobile-radar",
    name: "Мобильный РЛС",
    echelonId: "ech_2_detection",
    unitPriceMln: 20,
    unit: "шт",
    scores: scores(4, 4, 4, 5, 3, 4, 3), // ≈79 — matches Excel РЛС
    scoreSource: "expert-stub",
  },
  // Echelon 3 — Suppression (РЭБ, organizational/variable price -> stub small price)
  {
    id: "ew-narrowband",
    name: "РЭБ узкополосный (против GNSS)",
    echelonId: "ech_3_suppression",
    unitPriceMln: 15,
    unit: "шт",
    scores: scores(4, 4, 4, 4, 3, 4, 4), // ≈78
    scoreSource: "expert-stub",
  },
  {
    id: "ew-broadband",
    name: "РЭБ широкополосный (против радиоканалов)",
    echelonId: "ech_3_suppression",
    unitPriceMln: 18,
    unit: "шт",
    scores: scores(4, 4, 3, 4, 3, 4, 4), // ≈74
    scoreSource: "expert-stub",
  },
  // Echelon 4 — Fire priority (all four prices verified across configs)
  {
    id: "interceptor-drones",
    name: "Дроны-перехватчики",
    echelonId: "ech_4_fire_priority",
    unitPriceMln: 7,
    unit: "комплект",
    scores: scores(4, 4, 4, 3, 3, 3, 3), // ≈74 — matches Excel дроны
    scoreSource: "expert-stub",
  },
  {
    id: "aircraft",
    name: "Самолёты",
    echelonId: "ech_4_fire_priority",
    unitPriceMln: 20,
    unit: "шт",
    scores: scores(4, 3, 4, 3, 4, 4, 3), // ≈72
    scoreSource: "expert-stub",
  },
  {
    id: "turret-complex",
    name: "Турельный комплекс",
    echelonId: "ech_4_fire_priority",
    unitPriceMln: 7.9,
    unit: "шт",
    scores: scores(4, 4, 4, 4, 4, 4, 4), // ≈80 — matches Excel МОГ+турели
    scoreSource: "expert-stub",
  },
  {
    id: "armored-vehicle",
    name: "Бронеавтомобиль",
    echelonId: "ech_4_fire_priority",
    unitPriceMln: 28,
    unit: "шт",
    scores: scores(3, 4, 3, 4, 4, 4, 3), // ≈70
    scoreSource: "expert-stub",
  },
  // Echelon 5 — Fire reserve
  {
    id: "laser",
    name: "Лазер",
    echelonId: "ech_5_fire_reserve",
    unitPriceMln: 690,
    unit: "шт",
    scores: scores(4, 1, 1, 2, 1, 2, 3), // ≈40 (red) — matches Excel лазер
    scoreSource: "expert-stub",
  },
  {
    id: "barrel-aa",
    name: "Ствольная ПВО 30 мм (цитадель или аналог)",
    echelonId: "ech_5_fire_reserve",
    unitPriceMln: 290,
    unit: "шт",
    scores: scores(4, 3, 2, 3, 3, 2, 3), // ≈60 (orange) — matches Excel ствольная ПВО
    scoreSource: "expert-stub",
  },
  {
    id: "pantsir-zrpk",
    name: "ЗРПК «Панцирь»",
    echelonId: "ech_5_fire_reserve",
    unitPriceMln: 850, // ориентировочная CAPEX-оценка; цена не была указана в исходном PDF
    unit: "шт",
    scores: scores(5, 3, 1, 3, 2, 1, 3), // ≈58 (orange)
    scoreSource: "expert-stub",
  },
  // Echelon 6 — Passive / ИТЗ (bundled price in PDF; per-config totals differ, so treat as one line)
  {
    id: "passive-itz-bundle",
    name: "Тросы, сетки, укрепление критических узлов и т.п.",
    echelonId: "ech_6_passive_itz",
    unitPriceMln: 174, // BMU bundle value; configs override quantity/price via reference data
    unit: "комплект",
    scores: scores(3, 2, 3, 3, 5, 5, 2), // ≈55 (orange)
    scoreSource: "expert-stub",
  },
  // Echelon 7 — АТЗ (bundled)
  {
    id: "atz-bundle",
    name: "КПП и защита персонала (бомбоубежища и т.п.)",
    echelonId: "ech_7_atz",
    unitPriceMln: 122,
    unit: "комплект",
    scores: scores(2, 3, 3, 4, 5, 5, 2), // ≈52 (orange)
    scoreSource: "expert-stub",
  },
  // Echelon 8 — Infrastructure
  {
    id: "command-post",
    name: "Командный пункт",
    echelonId: "ech_8_infrastructure",
    unitPriceMln: 25,
    unit: "шт",
    scores: scores(4, 4, 5, 4, 4, 5, 3), // ≈79 (green) — green on PDF
    scoreSource: "expert-stub",
  },
];

export function getAssetById(assetId: string): DefenseAsset | undefined {
  return assets.find((asset) => asset.id === assetId);
}

// ---------------------------------------------------------------------------
// Reference configurations (PDF slide 2). Quantities are exact; per-line costs
// reconcile to the stated totals (see catalog-data tests). For the bundled ИТЗ
// and АТЗ items, the PDF gives a per-config lump sum, so we encode them as a
// single unit of an override-priced line via a dedicated override map below.
// ---------------------------------------------------------------------------

/** Per-configuration lump-sum overrides for bundled echelons (ИТЗ, АТЗ), in млн руб. */
export const bundleOverridesMln: Record<string, Record<string, number>> = {
  nak: { "passive-itz-bundle": 1182, "atz-bundle": 249.7 },
  nev: { "passive-itz-bundle": 840.3, "atz-bundle": 328.8 },
  fosforit: { "passive-itz-bundle": 1820, "atz-bundle": 20 },
  bmu: { "passive-itz-bundle": 174, "atz-bundle": 122 },
};

export const referenceConfigurations: Configuration[] = [
  {
    id: "nak",
    name: "НАК",
    lines: [
      { assetId: "mobile-radar", quantity: 6 },
      { assetId: "interceptor-drones", quantity: 6 },
      { assetId: "aircraft", quantity: 2 },
      { assetId: "turret-complex", quantity: 6 },
      { assetId: "armored-vehicle", quantity: 6 },
      { assetId: "barrel-aa", quantity: 2 },
      { assetId: "passive-itz-bundle", quantity: 1 },
      { assetId: "atz-bundle", quantity: 1 },
      { assetId: "command-post", quantity: 1 },
    ],
  },
  {
    id: "nev",
    name: "НЕВ",
    lines: [
      { assetId: "mobile-radar", quantity: 1 },
      { assetId: "interceptor-drones", quantity: 1 },
      { assetId: "aircraft", quantity: 2 },
      { assetId: "turret-complex", quantity: 1 },
      { assetId: "armored-vehicle", quantity: 1 },
      { assetId: "laser", quantity: 1 },
      { assetId: "passive-itz-bundle", quantity: 1 },
      { assetId: "atz-bundle", quantity: 1 },
      { assetId: "command-post", quantity: 1 },
    ],
  },
  {
    id: "fosforit",
    name: "ФОСФОРИТ",
    lines: [
      { assetId: "mobile-radar", quantity: 4 },
      { assetId: "interceptor-drones", quantity: 4 },
      { assetId: "aircraft", quantity: 3 },
      { assetId: "turret-complex", quantity: 4 },
      { assetId: "armored-vehicle", quantity: 4 },
      { assetId: "laser", quantity: 1 },
      { assetId: "barrel-aa", quantity: 2 },
      { assetId: "passive-itz-bundle", quantity: 1 },
      { assetId: "atz-bundle", quantity: 1 },
      { assetId: "command-post", quantity: 1 },
    ],
  },
  {
    id: "bmu",
    name: "БМУ",
    lines: [
      { assetId: "mobile-radar", quantity: 3 },
      { assetId: "interceptor-drones", quantity: 3 },
      { assetId: "aircraft", quantity: 2 },
      { assetId: "turret-complex", quantity: 3 },
      { assetId: "armored-vehicle", quantity: 3 },
      { assetId: "laser", quantity: 1 },
      { assetId: "barrel-aa", quantity: 2 },
      { assetId: "passive-itz-bundle", quantity: 1 },
      { assetId: "atz-bundle", quantity: 1 },
      { assetId: "command-post", quantity: 1 },
    ],
  },
];
