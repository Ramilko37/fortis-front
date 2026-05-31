// Print-only report. Rendered inside a `print:block hidden` wrapper so it appears solely in the
// browser print / "Save as PDF" output. Mirrors the reference PDF slides: estimate, comparison,
// priorities, budget. Uses light colours only (print is on white paper).

import {
  criteria,
  defaultThresholds,
  echelons,
} from "@/modules/defense-calculator/infra/catalog-data";
import { formatMln, priorityLabel } from "@/modules/defense-calculator/domain/format";
import type {
  ConfigurationEstimate,
  PriorityColor,
} from "@/modules/defense-calculator/domain/calculator-types";
import type { estimateConfiguration } from "@/modules/defense-calculator/domain/costing";
import type { fitToBudget } from "@/modules/defense-calculator/domain/budget-fit";

const PRINT_PRIORITY_COLOR: Record<PriorityColor, string> = {
  green: "#15803d",
  orange: "#c2740c",
  red: "#dc2626",
};

type ScoredAsset = {
  asset: { id: string; name: string; unitPriceMln: number; unit: string };
  weightedScore: number;
  priority: PriorityColor;
};

export function CalculatorReport({
  myEstimate,
  referenceEstimates,
  scoredAssets,
  budgetResult,
}: {
  myEstimate: ConfigurationEstimate;
  referenceEstimates: Array<ReturnType<typeof estimateConfiguration>>;
  scoredAssets: ScoredAsset[];
  budgetResult: ReturnType<typeof fitToBudget>;
}) {
  const columns = [...referenceEstimates, myEstimate];
  const minTotal = Math.min(...columns.map((c) => c.totalMln));
  const weightsSummary = criteria.map((c) => `${c.name} ${c.weight}`).join(" · ");

  return (
    <div className="report-root">
      {/* Title block */}
      <div className="report-titlebar">
        <h1>Расчёт конфигурации средств защиты от&nbsp;БПЛА</h1>
        <p>
          Целевая угроза: дрон массой 200&nbsp;кг (включая БЧ&nbsp;75&nbsp;кг), предельная скорость 200&nbsp;км/ч.
          Автоматический просчёт сметы, приоритета и&nbsp;покрытия эшелонов.
        </p>
      </div>

      {/* 1. My estimate */}
      <section className="report-section">
        <h2>1. Смета выбранной конфигурации — {myEstimate.configurationName}</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>Эшелон</th>
              <th>Средство</th>
              <th className="num">Кол-во</th>
              <th className="num">Цена/ед.</th>
              <th className="num">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {myEstimate.echelons.flatMap((echelon) =>
              echelon.lines.map((line, idx) => (
                <tr key={line.assetId}>
                  {idx === 0 ? (
                    <td rowSpan={echelon.lines.length} className="echelon-cell">
                      {echelon.echelonName}
                    </td>
                  ) : null}
                  <td>
                    <span className="dot" style={{ background: PRINT_PRIORITY_COLOR[line.priority] }} />
                    {line.assetName}
                  </td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{line.unitPriceMln > 0 ? formatMln(line.unitPriceMln) : "—"}</td>
                  <td className="num strong">{formatMln(line.lineTotalMln)}</td>
                </tr>
              )),
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="num">
                ИТОГО
              </td>
              <td className="num total">{formatMln(myEstimate.totalMln)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 2. Comparison */}
      <section className="report-section">
        <h2>2. Сравнение конфигураций</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>Эшелон</th>
              {columns.map((col) => (
                <th key={col.configurationId} className="num">
                  {col.configurationName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {echelons.map((echelon) => (
              <tr key={echelon.id}>
                <td>{echelon.name}</td>
                {columns.map((col) => {
                  const e = col.echelons.find((x) => x.echelonId === echelon.id);
                  return (
                    <td key={col.configurationId} className="num">
                      {e && !e.isEmpty ? formatMln(e.echelonTotalMln) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="num">ИТОГО</td>
              {columns.map((col) => (
                <td
                  key={col.configurationId}
                  className="num total"
                  style={col.totalMln === minTotal ? { color: PRINT_PRIORITY_COLOR.green } : undefined}
                >
                  {formatMln(col.totalMln)}
                  {col.totalMln === minTotal ? " (мин)" : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 3. Priorities */}
      <section className="report-section">
        <h2>3. Приоритет средств защиты</h2>
        <p className="report-legend">
          <span className="dot" style={{ background: PRINT_PRIORITY_COLOR.green }} /> первоочередно (балл ≥{" "}
          {defaultThresholds.green})
          <span className="dot" style={{ background: PRINT_PRIORITY_COLOR.orange, marginLeft: 16 }} /> средний (≥{" "}
          {defaultThresholds.orange})
          <span className="dot" style={{ background: PRINT_PRIORITY_COLOR.red, marginLeft: 16 }} /> последний (&lt;{" "}
          {defaultThresholds.orange})
        </p>
        <table className="report-table">
          <thead>
            <tr>
              <th>Средство</th>
              <th className="num">Балл</th>
              <th>Приоритет</th>
              <th className="num">Цена/ед.</th>
            </tr>
          </thead>
          <tbody>
            {[...scoredAssets]
              .sort((a, b) => b.weightedScore - a.weightedScore)
              .map(({ asset, weightedScore, priority }) => (
                <tr key={asset.id}>
                  <td>
                    <span className="dot" style={{ background: PRINT_PRIORITY_COLOR[priority] }} />
                    {asset.name}
                  </td>
                  <td className="num strong" style={{ color: PRINT_PRIORITY_COLOR[priority] }}>
                    {weightedScore.toFixed(0)}
                  </td>
                  <td>{priorityLabel[priority]}</td>
                  <td className="num">{asset.unitPriceMln > 0 ? formatMln(asset.unitPriceMln) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="report-note">Веса критериев (сумма 100): {weightsSummary}.</p>
      </section>

      {/* 4. Budget fit */}
      <section className="report-section">
        <h2>4. Подбор под бюджет — {formatMln(budgetResult.budgetMln)}</h2>
        <p className="report-note">
          Распределено {formatMln(budgetResult.spentMln)} · Остаток {formatMln(budgetResult.remainingMln)}.
          Порядок: первоочередные по убыванию балла, затем средний и последний приоритет.
        </p>
        <table className="report-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Средство</th>
              <th className="num">Балл</th>
              <th className="num">Цена/ед.</th>
              <th className="num">Σ нарастающим</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {budgetResult.picks.map((pick, index) => (
              <tr key={pick.assetId} style={pick.included ? undefined : { color: "#94a3b8" }}>
                <td className="num">{index + 1}</td>
                <td>
                  <span className="dot" style={{ background: PRINT_PRIORITY_COLOR[pick.priority] }} />
                  {pick.assetName}
                </td>
                <td className="num">{pick.weightedScore.toFixed(0)}</td>
                <td className="num">{pick.unitPriceMln > 0 ? formatMln(pick.unitPriceMln) : "—"}</td>
                <td className="num">{pick.included ? formatMln(pick.cumulativeMln) : "—"}</td>
                <td>{pick.included ? "включено" : "не вошло"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="report-footer">
        Цены — из эталонного документа (проверены арифметикой). Оценки по 7&nbsp;критериям — предварительная
        экспертная оценка. Логика расчёта неизменна при масштабировании на новые объекты.
      </p>
    </div>
  );
}
