// Domain types for the defense calculator.
// See docs/product/defense-calculator-spec.md — these mirror the model described there.

/** The seven scoring criteria from PDF slide 3. */
export type CriterionId =
  | "effectiveness"
  | "deploySpeed"
  | "cost"
  | "scalability"
  | "availability"
  | "governance"
  | "adaptivity";

export type Criterion = {
  id: CriterionId;
  name: string;
  /** Weight 0–100. The sum across all criteria must equal 100. */
  weight: number;
};

/** Where an asset's per-criterion scores came from — surfaced honestly in the UI. */
export type ScoreSource = "excel" | "pdf" | "expert-stub";

/** The eight echelons from PDF slide 2. */
export type EchelonId =
  | "ech_1_external_warning"
  | "ech_2_detection"
  | "ech_3_suppression"
  | "ech_4_fire_priority"
  | "ech_5_fire_reserve"
  | "ech_6_passive_itz"
  | "ech_7_atz"
  | "ech_8_infrastructure";

export type Echelon = {
  id: EchelonId;
  order: number;
  name: string;
  /** Human-readable range, e.g. "5–75 км". */
  rangeLabel: string;
};

/** Per-criterion raw scores, each on the 1–5 expert scale. */
export type CriterionScores = Record<CriterionId, number>;

export type AssetUnit = "шт" | "комплект";

export type DefenseAsset = {
  id: string;
  name: string;
  echelonId: EchelonId;
  /** Unit price in millions of rubles. 0 = organizational item with no CAPEX. */
  unitPriceMln: number;
  unit: AssetUnit;
  scores: CriterionScores;
  scoreSource: ScoreSource;
};

/** Priority colour driven by the weighted score (PDF slide 1 colour coding). */
export type PriorityColor = "green" | "orange" | "red";

/** Thresholds (on the 0–100 weighted score) that map a score to a priority colour. */
export type PriorityThresholds = {
  /** score >= green => green */
  green: number;
  /** score >= orange (and < green) => orange; below => red */
  orange: number;
};

/** A single line of a configuration: an asset and how many of it. */
export type ConfigurationLine = {
  assetId: string;
  quantity: number;
};

export type Configuration = {
  id: string;
  name: string;
  lines: ConfigurationLine[];
};

/** Result of scoring one asset (blocks A + B). */
export type AssetScore = {
  assetId: string;
  /** Weighted score 0–100 — reproduces Excel column L. */
  weightedScore: number;
  priority: PriorityColor;
};

/** Costed line in a configuration estimate (block C). */
export type EstimateLine = {
  assetId: string;
  assetName: string;
  echelonId: EchelonId;
  quantity: number;
  unitPriceMln: number;
  lineTotalMln: number;
  priority: PriorityColor;
};

/** Per-echelon roll-up inside an estimate. */
export type EchelonEstimate = {
  echelonId: EchelonId;
  echelonName: string;
  lines: EstimateLine[];
  echelonTotalMln: number;
  /** Block D — coverage percent 0–1 (mean weighted score of assets in the echelon). */
  coveragePct: number;
  isEmpty: boolean;
};

/** Full configuration estimate (blocks C + D). */
export type ConfigurationEstimate = {
  configurationId: string;
  configurationName: string;
  echelons: EchelonEstimate[];
  /** Grand total in millions of rubles. */
  totalMln: number;
};

/** A single ranked pick from the budget fitter (block E). */
export type BudgetPick = {
  assetId: string;
  assetName: string;
  echelonId: EchelonId;
  unitPriceMln: number;
  weightedScore: number;
  priority: PriorityColor;
  /** Cumulative spend in millions after including this pick. */
  cumulativeMln: number;
  included: boolean;
};

export type BudgetFitResult = {
  budgetMln: number;
  picks: BudgetPick[];
  spentMln: number;
  remainingMln: number;
};
