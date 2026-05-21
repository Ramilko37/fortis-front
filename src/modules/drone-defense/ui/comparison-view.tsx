"use client";

import { defenseLayers, scenarioOptions } from "@/modules/drone-defense/infra/mock-defense-data";
import type { DefenseLayersResponse, DefenseScenarioId, KpiResult, Recommendation } from "@/shared/types/drone-defense";

type ComparisonViewProps = {
  kpiByScenario: Partial<Record<DefenseScenarioId, KpiResult>>;
  layersByScenario: Partial<Record<DefenseScenarioId, DefenseLayersResponse>>;
  recommendations: Recommendation[];
  budgetRub: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number, digits = 3) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatCostPerRiskPoint(value: number) {
  return `${formatMoney(value)} / risk`;
}

function layerSummary(layers?: DefenseLayersResponse) {
  if (!layers) return "—";
  const covered = layers.layerCoverage.filter((item) => item.coveredPct >= 0.55).length;
  const partial = layers.layerCoverage.filter((item) => item.coveredPct > 0.18 && item.coveredPct < 0.55).length;
  const weak = layers.layerCoverage.filter((item) => item.coveredPct > 0 && item.coveredPct <= 0.18).length;
  const strongest = layers.layerCoverage.toSorted((a, b) => b.coveredPct - a.coveredPct)[0];
  const strongestLayer = strongest ? defenseLayers.find((layer) => layer.id === strongest.layerId) : null;
  const strongestBand = strongest?.distanceBandM.label ?? strongestLayer?.distanceBandM.label ?? "—";
  const strongestLabel = strongestLayer ? `${strongestLayer.shortName} ${strongestBand}` : "—";
  return `${covered} covered / ${partial} partial / ${weak} weak · best ${strongestLabel}`;
}

export function ComparisonView({ kpiByScenario, layersByScenario, recommendations, budgetRub }: ComparisonViewProps) {
  const baseline = kpiByScenario.baseline;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Scenario Comparison</h2>
        <p className="mt-1 text-sm text-slate-600">CAPEX / TCO(3y) / residual risk / value per ruble</p>
        <div className="mt-4 overflow-hidden rounded border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">CAPEX</th>
                <th className="px-3 py-2">TCO (3y)</th>
                <th className="px-3 py-2">Residual Risk</th>
                <th className="px-3 py-2">Risk Reduction</th>
                <th className="px-3 py-2">Value/Ruble</th>
                <th className="px-3 py-2">Cost/Risk Point</th>
                <th className="px-3 py-2">Layer Readiness</th>
              </tr>
            </thead>
            <tbody>
              {scenarioOptions.map(({ id, label, summary }) => {
                const kpi = kpiByScenario[id];
                const residualDelta = baseline && kpi ? kpi.residualRisk - baseline.residualRisk : 0;
                const reductionAbsolute = baseline && kpi ? Math.max(0, baseline.residualRisk - kpi.residualRisk) : 0;
                return (
                  <tr key={id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <span className="block">{label}</span>
                      <span className="block text-xs font-normal text-slate-500">{summary}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{kpi ? formatMoney(kpi.capexRub) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{kpi ? formatMoney(kpi.tco3yRub) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {kpi ? `${kpi.residualRisk.toFixed(3)} (${formatDelta(residualDelta)} Δ vs baseline)` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {kpi ? `${reductionAbsolute.toFixed(3)} (${formatPct(kpi.riskReductionPct)})` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {kpi ? kpi.valuePerRuble.toExponential(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{kpi ? formatCostPerRiskPoint(kpi.costPerRiskPointRub) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{layerSummary(layersByScenario[id])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Recommendation Engine</h3>
          <p className="mt-1 text-xs text-slate-600">Budget: {formatMoney(budgetRub)}</p>
          <div className="mt-3 space-y-2">
            {recommendations.map((item, index) => (
              <article key={item.candidateAssetId} className="rounded border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-xs text-slate-500">#{index + 1}</p>
                <p className="text-sm font-medium text-slate-900">{item.candidateAssetName}</p>
                <p className="mt-1 text-xs text-slate-700">{item.reason}</p>
                <p className="mt-1 text-xs text-slate-700">
                  Layers: {item.affectedLayerIds.map((layerId) => defenseLayers.find((layer) => layer.id === layerId)?.shortName ?? layerId).join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-700">
                  Bands: {item.affectedLayerIds.map((layerId) => defenseLayers.find((layer) => layer.id === layerId)?.distanceBandM.label ?? "—").join(", ")}
                </p>
                <p className="mt-1 text-xs text-slate-700">ΔRisk: {item.deltaRisk.toFixed(4)} ({formatPct(item.deltaResidualRiskPct)})</p>
                <p className="text-xs text-slate-700">ΔTCO: {formatMoney(item.deltaTco)}</p>
                <p className="text-xs text-slate-700">Score: {item.score.toExponential(2)}</p>
              </article>
            ))}
            {recommendations.length === 0 ? (
              <p className="rounded border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                В рамках текущего бюджета подходящих next moves не найдено.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">KPI Snapshot</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p>Risk reduction: {baseline ? formatPct(baseline.riskReductionPct) : "—"}</p>
            <p>Protected assets: {baseline ? formatPct(baseline.protectedAssetsPct) : "—"}</p>
            <p>Perimeter covered: {baseline ? formatPct(baseline.perimeterCoveredPct) : "—"}</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
