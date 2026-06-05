"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { BulbOutlined, MoonOutlined, PrinterOutlined } from "@ant-design/icons";
import {
  bundleOverridesMln,
  criteria,
  defaultThresholds,
  echelons,
  referenceConfigurations,
} from "@/modules/defense-calculator/infra/catalog-data";
import { projectAssetsToCalculatorAssets } from "@/modules/defense-calculator/domain/project-asset-adapter";
import { estimateConfiguration, type CostingContext } from "@/modules/defense-calculator/domain/costing";
import { computeWeightedScore, priorityForScore } from "@/modules/defense-calculator/domain/scoring";
import { fitToBudget } from "@/modules/defense-calculator/domain/budget-fit";
import { formatMln, priorityLabel } from "@/modules/defense-calculator/domain/format";
import { CalculatorReport } from "@/modules/defense-calculator/ui/calculator-report";
import {
  calculateProjectTotalObjects,
  calculateProjectTotalUnits,
  calculateLayerSummaries,
  projectToCalculatorConfiguration,
} from "@/shared/lib/defense-project";
import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseProject, LayerSummary } from "@/shared/types/defense-project";
import type {
  DefenseAsset,
  PriorityColor,
} from "@/modules/defense-calculator/domain/calculator-types";

type Tab = "configure" | "compare" | "budget";

const PRIORITY_DOT: Record<PriorityColor, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-rose-500",
};
const PRIORITY_TEXT: Record<PriorityColor, string> = {
  green: "text-emerald-600",
  orange: "text-amber-600",
  red: "text-rose-600",
};

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
  return `${meters.toLocaleString("ru-RU")} м`;
}

function layerRangeLabel(summary: LayerSummary) {
  return `${formatDistance(summary.innerRadiusM)}-${formatDistance(summary.outerRadiusM)}`;
}

function calculatorAssetIdForProjectAsset(project: DefenseProject, assetId: string) {
  return project.assetLibrary.find((asset) => asset.id === assetId)?.calculatorAssetId ?? assetId;
}

function projectAssetIdForCalculatorAsset(project: DefenseProject, calculatorAssetId: string) {
  return (
    project.assetLibrary.find((asset) => (asset.calculatorAssetId ?? asset.id) === calculatorAssetId)?.id ??
    calculatorAssetId
  );
}

function projectAssetForCalculatorAsset(project: DefenseProject, calculatorAssetId: string) {
  return project.assetLibrary.find((asset) => (asset.calculatorAssetId ?? asset.id) === calculatorAssetId) ?? null;
}

export function CalculatorPage() {
  const [tab, setTab] = useState<Tab>("configure");
  const [budgetMln, setBudgetMln] = useState(9300);
  const {
    project,
    setAssetQuantity,
    loadPresetProject,
    applyBudgetSelection,
    restoreProjectFromLocalStorage,
  } = useDefenseProjectStore();

  useEffect(() => {
    restoreProjectFromLocalStorage();
  }, [restoreProjectFromLocalStorage]);

  const calculatorAssets = useMemo(() => projectAssetsToCalculatorAssets(project.assetLibrary), [project.assetLibrary]);

  const context: CostingContext = useMemo(
    () => ({ assets: calculatorAssets, echelons, criteria, thresholds: defaultThresholds }),
    [calculatorAssets],
  );

  const scoredAssets = useMemo(
    () =>
      calculatorAssets.map((asset) => {
        const weightedScore = computeWeightedScore(asset.scores, criteria);
        return { asset, weightedScore, priority: priorityForScore(weightedScore, defaultThresholds) };
      }),
    [calculatorAssets],
  );

  const budgetResult = useMemo(
    () => fitToBudget(budgetMln, { assets: calculatorAssets, criteria, thresholds: defaultThresholds }),
    [budgetMln, calculatorAssets],
  );

  const referenceEstimates = useMemo(
    () =>
      referenceConfigurations.map((ref) =>
        estimateConfiguration(ref, { ...context, lineTotalOverridesMln: bundleOverridesMln[ref.id] }),
      ),
    [context],
  );

  const calculatorConfig = useMemo(
    () => projectToCalculatorConfiguration(project),
    [project],
  );

  const quantityFor = (assetId: string) => {
    const projectAssetId = projectAssetIdForCalculatorAsset(project, assetId);
    return project.placedObjects
      .filter((object) => object.assetId === projectAssetId)
      .reduce((acc, object) => acc + object.quantity, 0);
  };

  const setQuantity = (assetId: string, quantity: number) => {
    setAssetQuantity(projectAssetIdForCalculatorAsset(project, assetId), quantity);
  };

  const loadReference = (refId: string) => {
    loadPresetProject(refId);
  };

  // For reference-matching configs, apply the PDF bundled lump sums; otherwise honest unit×qty.
  const estimate = useMemo(() => {
    const matchingRef = referenceConfigurations.find(
      (ref) =>
        ref.lines.length === calculatorConfig.lines.length &&
        ref.lines.every((rl) => calculatorConfig.lines.some((cl) => cl.assetId === rl.assetId && cl.quantity === rl.quantity)),
    );
    const overrides = matchingRef ? bundleOverridesMln[matchingRef.id] : undefined;
    return estimateConfiguration(calculatorConfig, { ...context, lineTotalOverridesMln: overrides });
  }, [calculatorConfig, context]);

  const placedCount = calculateProjectTotalUnits(project);
  const positionsCount = calculateProjectTotalObjects(project);
  const layerSummaries = useMemo(() => calculateLayerSummaries(project), [project]);
  const isConfigurationEmpty = positionsCount === 0;

  return (
    <div className="font-(family-name:--font-manrope) min-h-screen bg-[#eef3f8] text-slate-800">
      <div className="relative mx-auto max-w-7xl px-5 py-7 lg:px-8 print:hidden">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 ">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/prototype"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-blue-700"
              >
                ← Прототип
              </Link>
              <span className="h-3 w-px bg-slate-300" />
              <Link
                href="/dashboard"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-blue-700"
              >
                Кабинет
              </Link>
              <span className="h-3 w-px bg-slate-300" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 ">
                Калькулятор защиты
              </span>
            </div>
            <h1 className="mt-2 font-(family-name:--font-syne) text-3xl tracking-tight text-slate-900 lg:text-4xl ">
              Конфигурация средств защиты от&nbsp;БПЛА
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 ">
              Автоматический расчёт сметы, приоритета и покрытия эшелонов. Заменяет ручной просчёт в&nbsp;Excel.
              <span className="ml-1 text-slate-400 ">
                Целевая угроза: дрон 200&nbsp;кг (БЧ&nbsp;75&nbsp;кг), до&nbsp;200&nbsp;км/ч.
              </span>
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-mono text-[11px] uppercase tracking-wider text-slate-600 transition hover:border-blue-400 hover:text-blue-700"
                title="Сформировать PDF-отчёт (Сохранить как PDF)"
              >
                <PrinterOutlined /> PDF-отчёт
              </button>
            </div>
            {/* Headline total */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4 text-right shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue-600">
                Итого по конфигурации
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-slate-900 ">
                {formatMln(estimate.totalMln)}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400 ">
                {placedCount} ед. · {positionsCount} позиций
              </p>
            </div>
          </div>
        </header>

        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          isConfigurationEmpty ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-900"
        }`}>
          {isConfigurationEmpty
            ? "Конфигурация пока не собрана. Добавьте средства защиты на карте или загрузите эталон."
            : "Расчёт построен на основе текущей конфигурации карты"}
        </div>

        {/* Tabs */}
        <nav className="mt-6 flex gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 ">
          {(
            [
              { id: "configure", label: "Конфигуратор" },
              { id: "compare", label: "Сравнение" },
              { id: "budget", label: "Подбор под бюджет" },
            ] as Array<{ id: Tab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-lg px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition ${
                tab === item.id
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 "
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="mt-6">
          {tab === "configure" ? (
            <ConfigureTab
              scoredAssets={scoredAssets}
              estimate={estimate}
              project={project}
              layerSummaries={layerSummaries}
              quantityFor={quantityFor}
              setQuantity={setQuantity}
              loadReference={loadReference}
            />
          ) : null}
          {tab === "compare" ? (
            <CompareTab referenceEstimates={referenceEstimates} myEstimate={estimate} />
          ) : null}
          {tab === "budget" ? (
            <BudgetTab
              budgetMln={budgetMln}
              setBudgetMln={setBudgetMln}
              result={budgetResult}
              onApplySelection={() => applyBudgetSelection(budgetResult.picks)}
            />
          ) : null}
        </main>

        <footer className="mt-8 border-t border-slate-200 pt-4 font-mono text-[11px] text-slate-400">
          Базовые цены — из эталонного документа, расширенный каталог карты дополнен ориентировочными CAPEX-оценками.
          Оценки по 7&nbsp;критериям — предварительная экспертная оценка, редактируется.
        </footer>
      </div>

      {/* Print-only report (rendered off-screen, shown only when printing) */}
      <div className="hidden print:block">
        <CalculatorReport
          myEstimate={estimate}
          referenceEstimates={referenceEstimates}
          scoredAssets={scoredAssets}
          budgetResult={budgetResult}
          generatedAt={new Date()}
          layerSummaries={layerSummaries}
        />
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};
// Mount detection without setState-in-effect: server snapshot is false, client is true.
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-mono text-[11px] uppercase tracking-wider text-slate-600 transition hover:border-blue-400 hover:text-blue-700"
      title="Переключить тему"
      aria-label="Переключить тему"
    >
      {isDark ? <BulbOutlined /> : <MoonOutlined />}
      {mounted ? (isDark ? "Светлая" : "Тёмная") : "Тема"}
    </button>
  );
}

// ─── Configure tab ──────────────────────────────────────────────────────────

type ScoredAsset = {
  asset: DefenseAsset;
  weightedScore: number;
  priority: PriorityColor;
};

function ConfigureTab({
  scoredAssets,
  estimate,
  project,
  layerSummaries,
  quantityFor,
  setQuantity,
  loadReference,
}: {
  scoredAssets: ScoredAsset[];
  estimate: ReturnType<typeof estimateConfiguration>;
  project: DefenseProject;
  layerSummaries: LayerSummary[];
  quantityFor: (assetId: string) => number;
  setQuantity: (assetId: string, quantity: number) => void;
  loadReference: (refId: string) => void;
}) {
  const card = "rounded-2xl border border-slate-200 bg-white ";
  const layerSections = [...project.layers].sort((a, b) => a.order - b.order).map((layer) => {
    const summary = layerSummaries.find((item) => item.layerId === layer.id);
    const placedObjects = project.placedObjects.filter((object) => object.layerId === layer.id);
    const placedCalculatorAssetIds = new Set(
      placedObjects.map((object) => calculatorAssetIdForProjectAsset(project, object.assetId)),
    );
    const layerAssets = scoredAssets.filter((item) => {
      if (placedCalculatorAssetIds.has(item.asset.id)) return true;
      return projectAssetForCalculatorAsset(project, item.asset.id)?.recommendedLayerCodes?.includes(layer.code) ?? false;
    });
    const selectedAssetScores = layerAssets
      .filter(({ asset }) => quantityFor(asset.id) > 0)
      .map(({ weightedScore }) => weightedScore);
    const coveragePct =
      selectedAssetScores.length > 0
        ? selectedAssetScores.reduce((acc, value) => acc + value, 0) / selectedAssetScores.length / 100
        : 0;
    return {
      layer,
      assets: layerAssets,
      totalMln: summary?.totalMln ?? 0,
      coveragePct,
      isEmpty: (summary?.objectCount ?? 0) === 0,
      conflictCount: summary?.conflictCount ?? 0,
      rangeLabel: summary ? layerRangeLabel(summary) : "",
    };
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Загрузить эталон:</span>
          {referenceConfigurations.map((ref) => (
            <button
              key={ref.id}
              type="button"
              onClick={() => loadReference(ref.id)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
            >
              {ref.name}
            </button>
          ))}
        </div>

        {layerSections.map(({ layer, assets: layerAssets, totalMln, coveragePct, conflictCount, rangeLabel }) => {
          if (layerAssets.length === 0) return null;
          return (
            <section key={layer.id} className={`${card} p-4`}>
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-3 ">
                <div className="flex items-baseline gap-2.5">
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700">
                    {layer.code}
                  </span>
                  <h3 className="font-(family-name:--font-syne) text-base font-semibold text-slate-900 ">
                    {layer.name}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400 ">{rangeLabel}</span>
                  {conflictCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] text-amber-700">
                      конфликтов {conflictCount}
                    </span>
                  ) : null}
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-700 ">
                    {formatMln(totalMln)}
                  </span>
                  <CoverageBar pct={coveragePct} />
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {layerAssets.map(({ asset, weightedScore, priority }) => {
                  const qty = quantityFor(asset.id);
                  const lineTotal = asset.unitPriceMln * qty;
                  return (
                    <div
                      key={asset.id}
                      className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        qty > 0
                          ? "border-slate-200 bg-slate-50  "
                          : "border-transparent hover:bg-slate-50 "
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priority]}`} />
                          <p className="truncate text-sm font-medium text-slate-800">{asset.name}</p>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400 ">
                          {asset.unitPriceMln > 0 ? `${formatMln(asset.unitPriceMln)}/${asset.unit}` : "без CAPEX"}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className={PRIORITY_TEXT[priority]}>балл {weightedScore.toFixed(0)}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="text-slate-400">{priorityLabel[priority]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {qty > 0 ? (
                          <span className="hidden w-20 text-right font-mono text-xs tabular-nums text-slate-600  sm:block">
                            {formatMln(lineTotal)}
                          </span>
                        ) : null}
                        <Stepper value={qty} onChange={(v) => setQuantity(asset.id, v)} unit={asset.unit} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4  ">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Смета по эшелонам карты</p>
          <div className="mt-3 space-y-1">
            {layerSections.map(({ layer, totalMln, isEmpty, conflictCount }) => (
              <div key={layer.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={`truncate ${isEmpty ? "text-slate-400" : "text-slate-600 "}`}>
                  {layer.code} · {layer.name}
                  {conflictCount > 0 ? <span className="ml-1 text-amber-600">!</span> : null}
                </span>
                <span
                  className={`font-mono tabular-nums ${isEmpty ? "text-slate-300" : "text-slate-700 "}`}
                >
                  {isEmpty ? "—" : formatMln(totalMln)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 ">
            <span className="font-mono text-xs uppercase tracking-wider text-blue-600">Итого</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-900 ">
              {formatMln(estimate.totalMln)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stepper({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit: string }) {
  const btn =
    "grid h-7 w-7 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-30   ";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(value - 1)} className={btn} disabled={value <= 0} aria-label="Убавить">
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-12 rounded-lg border border-slate-300 bg-white text-center font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500   "
        aria-label={`Количество (${unit})`}
      />
      <button type="button" onClick={() => onChange(value + 1)} className={btn} aria-label="Добавить">
        +
      </button>
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-1.5">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-linear-to-r from-blue-500 to-emerald-400"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-slate-400 ">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

// ─── Compare tab ────────────────────────────────────────────────────────────

function CompareTab({
  referenceEstimates,
  myEstimate,
}: {
  referenceEstimates: Array<ReturnType<typeof estimateConfiguration>>;
  myEstimate: ReturnType<typeof estimateConfiguration>;
}) {
  const columns = [...referenceEstimates, myEstimate];
  const minTotal = Math.min(...columns.map((c) => c.totalMln));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white ">
      <table className="w-full min-w-160 border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 ">
            <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">Эшелон</th>
            {columns.map((col) => (
              <th
                key={col.configurationId}
                className="px-4 py-3 text-right font-(family-name:--font-syne) text-sm text-slate-900 "
              >
                {col.configurationName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {echelons.map((echelon) => (
            <tr key={echelon.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <span className="text-slate-600 ">{echelon.name}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-400">{echelon.rangeLabel}</span>
              </td>
              {columns.map((col) => {
                const e = col.echelons.find((x) => x.echelonId === echelon.id);
                return (
                  <td
                    key={col.configurationId}
                    className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                      e && !e.isEmpty ? "text-slate-700 " : "text-slate-300"
                    }`}
                  >
                    {e && !e.isEmpty ? formatMln(e.echelonTotalMln) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 bg-slate-50  ">
            <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-blue-600">
              Итого
            </td>
            {columns.map((col) => (
              <td
                key={col.configurationId}
                className={`px-4 py-3 text-right font-mono text-base font-bold tabular-nums ${
                  col.totalMln === minTotal ? "text-emerald-600" : "text-slate-900 "
                }`}
              >
                {formatMln(col.totalMln)}
                {col.totalMln === minTotal ? (
                  <span className="ml-1 font-sans text-[10px] font-normal uppercase text-emerald-500">мин</span>
                ) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Budget tab ─────────────────────────────────────────────────────────────

function BudgetTab({
  budgetMln,
  setBudgetMln,
  result,
  onApplySelection,
}: {
  budgetMln: number;
  setBudgetMln: (v: number) => void;
  result: ReturnType<typeof fitToBudget>;
  onApplySelection: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-5  ">
          <label className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Бюджет, млн руб</label>
          <input
            type="number"
            min={0}
            step={100}
            value={budgetMln}
            onChange={(e) => setBudgetMln(Math.max(0, Number(e.target.value)))}
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-2xl font-bold tabular-nums text-slate-900 outline-none focus:border-blue-500   "
          />
          <p className="mt-1 font-mono text-xs text-slate-400 ">= {formatMln(budgetMln)}</p>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm ">
            <div className="flex justify-between">
              <span className="text-slate-500 ">Распределено</span>
              <span className="font-mono tabular-nums text-emerald-600">{formatMln(result.spentMln)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 ">Остаток</span>
              <span className="font-mono tabular-nums text-slate-700 ">{formatMln(result.remainingMln)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400 ">
            Порядок закупки: сначала первоочередные (зелёные) по убыванию балла, затем средний и последний
            приоритет. Жадный отбор в&nbsp;рамках бюджета.
          </p>
          <button
            type="button"
            onClick={onApplySelection}
            className="mt-4 h-10 w-full rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Применить подбор к карте
          </button>
        </div>
      </aside>

      <div className="space-y-1.5">
        {result.picks.map((pick, index) => (
          <div
            key={pick.assetId}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-4 py-3 transition ${
              pick.included
                ? "border-slate-200 bg-white"
                : "border-dashed border-slate-200 bg-transparent opacity-50 "
            }`}
          >
            <span className="font-mono text-sm tabular-nums text-slate-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[pick.priority]}`} />
                <p className="truncate text-sm font-medium text-slate-800">{pick.assetName}</p>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400 ">
                <span className={PRIORITY_TEXT[pick.priority]}>балл {pick.weightedScore.toFixed(0)}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                {pick.unitPriceMln > 0 ? formatMln(pick.unitPriceMln) : "без CAPEX"}
              </p>
            </div>
            <div className="text-right">
              {pick.included ? (
                <>
                  <p className="font-mono text-xs tabular-nums text-slate-500 ">Σ {formatMln(pick.cumulativeMln)}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600">включено</p>
                </>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">не вошло</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
