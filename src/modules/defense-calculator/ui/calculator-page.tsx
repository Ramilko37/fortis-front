"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { BulbOutlined, MoonOutlined, PrinterOutlined } from "@ant-design/icons";
import {
  assets,
  bundleOverridesMln,
  criteria,
  defaultThresholds,
  echelons,
  referenceConfigurations,
} from "@/modules/defense-calculator/infra/catalog-data";
import { estimateConfiguration, type CostingContext } from "@/modules/defense-calculator/domain/costing";
import { computeWeightedScore, priorityForScore } from "@/modules/defense-calculator/domain/scoring";
import { fitToBudget } from "@/modules/defense-calculator/domain/budget-fit";
import { formatMln, priorityLabel } from "@/modules/defense-calculator/domain/format";
import { CalculatorReport } from "@/modules/defense-calculator/ui/calculator-report";
import type {
  Configuration,
  ConfigurationLine,
  PriorityColor,
} from "@/modules/defense-calculator/domain/calculator-types";

type Tab = "configure" | "compare" | "budget";

const PRIORITY_DOT: Record<PriorityColor, string> = {
  green: "bg-emerald-500 dark:bg-emerald-400",
  orange: "bg-amber-500 dark:bg-amber-400",
  red: "bg-rose-500",
};
const PRIORITY_TEXT: Record<PriorityColor, string> = {
  green: "text-emerald-600 dark:text-emerald-300",
  orange: "text-amber-600 dark:text-amber-300",
  red: "text-rose-600 dark:text-rose-300",
};

export function CalculatorPage() {
  const [tab, setTab] = useState<Tab>("configure");
  const [config, setConfig] = useState<Configuration>(() => {
    const nak = referenceConfigurations.find((c) => c.id === "nak")!;
    return { id: "custom", name: "Моя конфигурация", lines: nak.lines.map((l) => ({ ...l })) };
  });
  const [budgetMln, setBudgetMln] = useState(9300);

  const context: CostingContext = useMemo(
    () => ({ assets, echelons, criteria, thresholds: defaultThresholds }),
    [],
  );

  const scoredAssets = useMemo(
    () =>
      assets.map((asset) => {
        const weightedScore = computeWeightedScore(asset.scores, criteria);
        return { asset, weightedScore, priority: priorityForScore(weightedScore, defaultThresholds) };
      }),
    [],
  );

  const quantityFor = (assetId: string) =>
    config.lines.find((line) => line.assetId === assetId)?.quantity ?? 0;

  const setQuantity = (assetId: string, quantity: number) => {
    const q = Math.max(0, Math.floor(quantity || 0));
    setConfig((prev) => {
      const without = prev.lines.filter((line) => line.assetId !== assetId);
      const lines: ConfigurationLine[] = q > 0 ? [...without, { assetId, quantity: q }] : without;
      return { ...prev, lines };
    });
  };

  const loadReference = (refId: string) => {
    const ref = referenceConfigurations.find((c) => c.id === refId);
    if (!ref) return;
    setConfig({ id: "custom", name: `Моя (на базе ${ref.name})`, lines: ref.lines.map((l) => ({ ...l })) });
  };

  // For reference-matching configs, apply the PDF bundled lump sums; otherwise honest unit×qty.
  const estimate = useMemo(() => {
    const matchingRef = referenceConfigurations.find(
      (ref) =>
        ref.lines.length === config.lines.length &&
        ref.lines.every((rl) => config.lines.some((cl) => cl.assetId === rl.assetId && cl.quantity === rl.quantity)),
    );
    const overrides = matchingRef ? bundleOverridesMln[matchingRef.id] : undefined;
    return estimateConfiguration(config, { ...context, lineTotalOverridesMln: overrides });
  }, [config, context]);

  const referenceEstimates = useMemo(
    () =>
      referenceConfigurations.map((ref) =>
        estimateConfiguration(ref, { ...context, lineTotalOverridesMln: bundleOverridesMln[ref.id] }),
      ),
    [context],
  );

  const budgetResult = useMemo(
    () => fitToBudget(budgetMln, { assets, criteria, thresholds: defaultThresholds }),
    [budgetMln],
  );

  const placedCount = config.lines.reduce((acc, line) => acc + line.quantity, 0);

  return (
    <div className="font-(family-name:--font-manrope) min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0b0f17] dark:text-slate-200">
      {/* ambient grid + glow (dark only) */}
      <div
        className="pointer-events-none fixed inset-0 hidden opacity-[0.18] dark:block print:hidden"
        style={{
          backgroundImage:
            "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none fixed -top-40 left-1/3 hidden h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px] dark:block print:hidden" />

      <div className="relative mx-auto max-w-7xl px-5 py-7 lg:px-8 print:hidden">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/prototype"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-cyan-600 dark:hover:text-cyan-300"
              >
                ← Прототип
              </Link>
              <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
              <Link
                href="/dashboard"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-cyan-600 dark:hover:text-cyan-300"
              >
                Кабинет
              </Link>
              <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Калькулятор защиты
              </span>
            </div>
            <h1 className="mt-2 font-(family-name:--font-syne) text-3xl tracking-tight text-slate-900 lg:text-4xl dark:text-white">
              Конфигурация средств защиты от&nbsp;БПЛА
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Автоматический расчёт сметы, приоритета и покрытия эшелонов. Заменяет ручной просчёт в&nbsp;Excel.
              <span className="ml-1 text-slate-400 dark:text-slate-500">
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
                className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-mono text-[11px] uppercase tracking-wider text-slate-600 transition hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-cyan-200"
                title="Сформировать PDF-отчёт (Сохранить как PDF)"
              >
                <PrinterOutlined /> PDF-отчёт
              </button>
            </div>
            {/* Headline total */}
            <div className="rounded-2xl border border-cyan-500/40 bg-cyan-50 px-6 py-4 text-right shadow-[0_0_40px_-12px] shadow-cyan-500/20 dark:bg-cyan-500/5 dark:shadow-cyan-500/30">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-600/90 dark:text-cyan-400/80">
                Итого по конфигурации
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
                {formatMln(estimate.totalMln)}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {placedCount} ед. · {config.lines.length} позиций
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="mt-6 flex gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 dark:border-slate-800 dark:bg-slate-900/40">
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
                  ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
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
              quantityFor={quantityFor}
              setQuantity={setQuantity}
              loadReference={loadReference}
            />
          ) : null}
          {tab === "compare" ? (
            <CompareTab referenceEstimates={referenceEstimates} myEstimate={estimate} />
          ) : null}
          {tab === "budget" ? (
            <BudgetTab budgetMln={budgetMln} setBudgetMln={setBudgetMln} result={budgetResult} />
          ) : null}
        </main>

        <footer className="mt-8 border-t border-slate-200 pt-4 font-mono text-[11px] text-slate-400 dark:border-slate-800/80 dark:text-slate-600">
          Цены — из эталонного документа (проверены арифметикой). Оценки по 7&nbsp;критериям — предварительная
          экспертная оценка, редактируется. Логика расчёта неизменна при масштабировании на новые объекты.
        </footer>
      </div>

      {/* Print-only report (rendered off-screen, shown only when printing) */}
      <div className="hidden print:block">
        <CalculatorReport
          myEstimate={estimate}
          referenceEstimates={referenceEstimates}
          scoredAssets={scoredAssets}
          budgetResult={budgetResult}
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
      className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-mono text-[11px] uppercase tracking-wider text-slate-600 transition hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-cyan-200"
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
  asset: (typeof assets)[number];
  weightedScore: number;
  priority: PriorityColor;
};

function ConfigureTab({
  scoredAssets,
  estimate,
  quantityFor,
  setQuantity,
  loadReference,
}: {
  scoredAssets: ScoredAsset[];
  estimate: ReturnType<typeof estimateConfiguration>;
  quantityFor: (assetId: string) => number;
  setQuantity: (assetId: string, quantity: number) => void;
  loadReference: (refId: string) => void;
}) {
  const card = "rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40";
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-700 transition hover:border-cyan-500/60 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-cyan-200"
            >
              {ref.name}
            </button>
          ))}
        </div>

        {echelons.map((echelon) => {
          const echelonAssets = scoredAssets.filter((s) => s.asset.echelonId === echelon.id);
          const echelonEstimate = estimate.echelons.find((e) => e.echelonId === echelon.id);
          if (echelonAssets.length === 0) return null;
          return (
            <section key={echelon.id} className={`${card} p-4`}>
              <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-baseline gap-2.5">
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-700 dark:bg-slate-800 dark:text-cyan-300">
                    {echelon.order}
                  </span>
                  <h3 className="font-(family-name:--font-syne) text-base font-semibold text-slate-900 dark:text-white">
                    {echelon.name}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{echelon.rangeLabel}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatMln(echelonEstimate?.echelonTotalMln ?? 0)}
                  </span>
                  <CoverageBar pct={echelonEstimate?.coveragePct ?? 0} />
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {echelonAssets.map(({ asset, weightedScore, priority }) => {
                  const qty = quantityFor(asset.id);
                  const lineTotal = asset.unitPriceMln * qty;
                  return (
                    <div
                      key={asset.id}
                      className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        qty > 0
                          ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[priority]}`} />
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{asset.name}</p>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {asset.unitPriceMln > 0 ? `${formatMln(asset.unitPriceMln)}/${asset.unit}` : "без CAPEX"}
                          <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                          <span className={PRIORITY_TEXT[priority]}>балл {weightedScore.toFixed(0)}</span>
                          <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-slate-400 dark:text-slate-600">{priorityLabel[priority]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {qty > 0 ? (
                          <span className="hidden w-20 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 sm:block">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Смета по эшелонам</p>
          <div className="mt-3 space-y-1">
            {estimate.echelons.map((e) => (
              <div key={e.echelonId} className="flex items-center justify-between gap-2 text-sm">
                <span className={`truncate ${e.isEmpty ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>
                  {e.echelonName}
                </span>
                <span
                  className={`font-mono tabular-nums ${e.isEmpty ? "text-slate-300 dark:text-slate-700" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {e.isEmpty ? "—" : formatMln(e.echelonTotalMln)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-600/90 dark:text-cyan-400/80">Итого</span>
            <span className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
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
    "grid h-7 w-7 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white";
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
        className="h-7 w-12 rounded-lg border border-slate-300 bg-white text-center font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
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
      <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-400"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
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
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <table className="w-full min-w-160 border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">Эшелон</th>
            {columns.map((col) => (
              <th
                key={col.configurationId}
                className="px-4 py-3 text-right font-(family-name:--font-syne) text-sm text-slate-900 dark:text-white"
              >
                {col.configurationName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {echelons.map((echelon) => (
            <tr key={echelon.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/20">
              <td className="px-4 py-2.5">
                <span className="text-slate-600 dark:text-slate-300">{echelon.name}</span>
                <span className="ml-2 font-mono text-[11px] text-slate-400 dark:text-slate-600">{echelon.rangeLabel}</span>
              </td>
              {columns.map((col) => {
                const e = col.echelons.find((x) => x.echelonId === echelon.id);
                return (
                  <td
                    key={col.configurationId}
                    className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                      e && !e.isEmpty ? "text-slate-700 dark:text-slate-200" : "text-slate-300 dark:text-slate-700"
                    }`}
                  >
                    {e && !e.isEmpty ? formatMln(e.echelonTotalMln) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
            <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-cyan-600/90 dark:text-cyan-400/80">
              Итого
            </td>
            {columns.map((col) => (
              <td
                key={col.configurationId}
                className={`px-4 py-3 text-right font-mono text-base font-bold tabular-nums ${
                  col.totalMln === minTotal ? "text-emerald-600 dark:text-emerald-300" : "text-slate-900 dark:text-white"
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
}: {
  budgetMln: number;
  setBudgetMln: (v: number) => void;
  result: ReturnType<typeof fitToBudget>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <label className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Бюджет, млн руб</label>
          <input
            type="number"
            min={0}
            step={100}
            value={budgetMln}
            onChange={(e) => setBudgetMln(Math.max(0, Number(e.target.value)))}
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-2xl font-bold tabular-nums text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
          />
          <p className="mt-1 font-mono text-xs text-slate-400 dark:text-slate-500">= {formatMln(budgetMln)}</p>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Распределено</span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-300">{formatMln(result.spentMln)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Остаток</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatMln(result.remainingMln)}</span>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            Порядок закупки: сначала первоочередные (зелёные) по убыванию балла, затем средний и последний
            приоритет. Жадный отбор в&nbsp;рамках бюджета.
          </p>
        </div>
      </aside>

      <div className="space-y-1.5">
        {result.picks.map((pick, index) => (
          <div
            key={pick.assetId}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-4 py-3 transition ${
              pick.included
                ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40"
                : "border-dashed border-slate-200 bg-transparent opacity-50 dark:border-slate-800"
            }`}
          >
            <span className="font-mono text-sm tabular-nums text-slate-400 dark:text-slate-600">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[pick.priority]}`} />
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{pick.assetName}</p>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                <span className={PRIORITY_TEXT[pick.priority]}>балл {pick.weightedScore.toFixed(0)}</span>
                <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
                {pick.unitPriceMln > 0 ? formatMln(pick.unitPriceMln) : "без CAPEX"}
              </p>
            </div>
            <div className="text-right">
              {pick.included ? (
                <>
                  <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">Σ {formatMln(pick.cumulativeMln)}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">включено</p>
                </>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-600">не вошло</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
