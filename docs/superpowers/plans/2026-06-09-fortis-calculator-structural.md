# Fortis Calculator: Budget-Flag + Structural Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the report showing budget as "applied" when the user never applied it (item 7), and replace money-based comparison with a structural profile while removing reference standards from core logic (item 8 + item 6 legacy tail).

**Architecture:** Add a `budgetApplied` flag to the Zustand project store — reset in the single `applyProject` mutation funnel, set true only by `applyBudgetSelection`. Add a pure `buildStructuralProfile(project)` domain helper that counts objects/units/echelons/categories/conflicts/coverage zones from existing libs. Rewrite the Compare tab and report comparison section to use that profile; drop the reference-match cost override so the live map always costs honestly.

**Tech Stack:** TypeScript, React (Next.js App Router), Zustand. Tests run via `npx tsx <file>` with custom `assert()` helpers (no test framework).

> **Post-implementation note:** during code review the structural field `coverageZoneCount` was renamed to `coveredObjectCount` (it counts placed objects whose asset has a coverage type, per-record — not distinct geometric zones), and the UI labels were made honest accordingly ("Позиции с покрытием" / "С покрытием"). The code blocks below still show the original `coverageZoneCount` name; read them as `coveredObjectCount`.

---

### Task 1: `budgetApplied` flag in the project store

**Files:**
- Modify: `src/shared/lib/use-defense-project-store.ts`
- Test: `src/shared/lib/use-defense-project-store.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/shared/lib/use-defense-project-store.test.ts` (before any final success print; if there is a trailing `console.log`, insert above it):

```ts
// ── budgetApplied flag (item 7) ──────────────────────────────────────────────
storage.clear();
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);

{
  const s = useDefenseProjectStore.getState();
  assert(s.budgetApplied === false, "budgetApplied must default to false");

  // Applying a budget selection sets the flag true.
  const firstAssetId = s.project.assetLibrary[0]?.id;
  assert(firstAssetId, "expected at least one asset in library");
  s.applyBudgetSelection([{ assetId: firstAssetId, included: true }]);
  assert(
    useDefenseProjectStore.getState().budgetApplied === true,
    "applyBudgetSelection must set budgetApplied true",
  );

  // Any map mutation resets the flag to false.
  const layerId = useDefenseProjectStore.getState().project.layers[0]?.id;
  assert(layerId, "expected at least one layer");
  useDefenseProjectStore.getState().setAssetQuantity(firstAssetId, 2);
  assert(
    useDefenseProjectStore.getState().budgetApplied === false,
    "a map mutation must reset budgetApplied to false",
  );

  // clearProject resets the flag.
  useDefenseProjectStore.getState().applyBudgetSelection([{ assetId: firstAssetId, included: true }]);
  useDefenseProjectStore.getState().clearProject();
  assert(
    useDefenseProjectStore.getState().budgetApplied === false,
    "clearProject must reset budgetApplied to false",
  );
}

console.log("budgetApplied flag: OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/shared/lib/use-defense-project-store.test.ts`
Expected: FAIL — `budgetApplied must default to false` (property is `undefined`).

- [ ] **Step 3: Add the flag to the store type**

In `src/shared/lib/use-defense-project-store.ts`, add to the `DefenseProjectState` type (next to `hydrated`):

```ts
  hydrated: boolean;
  budgetApplied: boolean;
```

- [ ] **Step 4: Reset the flag in the mutation funnel**

Change `applyProject` so every mutation routed through it clears the flag:

```ts
function applyProject(project: DefenseProject, set: (state: Partial<DefenseProjectState>) => void) {
  persist(project);
  set({ project, budgetApplied: false, ...syncSelection(project) });
}
```

- [ ] **Step 5: Initialize the flag and set it in applyBudgetSelection / clearProject / restore**

In the store factory `return { ... }`, add the initial value next to `hydrated: false`:

```ts
    project: initialProject,
    hydrated: false,
    budgetApplied: false,
    ...syncSelection(initialProject),
```

Change `applyBudgetSelection` to set the flag true AFTER `applyProject` (which would otherwise reset it):

```ts
    applyBudgetSelection: (picks) => {
      const lines = picks
        .filter((pick) => pick.included)
        .map((pick) => ({ assetId: pick.assetId, quantity: 1 }));
      applyProject({ ...applyAssetQuantityDraftsToProject(get().project, lines), source: "custom" }, set);
      set({ budgetApplied: true });
    },
```

Change `clearProject` to reset the flag (it calls `set` directly, not `applyProject`):

```ts
    clearProject: () => {
      const project = createDefaultDefenseProject();
      persist(project);
      set({ project, hydrated: true, budgetApplied: false, ...syncSelection(project) });
    },
```

Change `restoreProjectFromLocalStorage` likewise (also a direct `set`):

```ts
    restoreProjectFromLocalStorage: () => {
      const project = readProject() ?? readLegacyConfigurationProject() ?? createDefaultDefenseProject();
      set({ project, hydrated: true, budgetApplied: false, ...syncSelection(project) });
    },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx tsx src/shared/lib/use-defense-project-store.test.ts`
Expected: PASS — ends with `budgetApplied flag: OK`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/use-defense-project-store.ts src/shared/lib/use-defense-project-store.test.ts
git commit -m "feat(drone-defense): budgetApplied flag reset on map mutation (item 7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `buildStructuralProfile` domain helper

**Files:**
- Create: `src/modules/defense-calculator/domain/structural-profile.ts`
- Test: `src/modules/defense-calculator/domain/structural-profile.test.ts`

Counts derive from existing libs: `calculateProjectTotalObjects`, `calculateProjectTotalUnits`, `calculateLayerSummaries`, `calculateProjectTotalCost` (all in `@/shared/lib/defense-project`), plus `project.assetLibrary` for `category`/`coverageType`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/defense-calculator/domain/structural-profile.test.ts`:

```ts
// Run: npx tsx src/modules/defense-calculator/domain/structural-profile.test.ts

import { createDefaultDefenseProject, placeObjectInProject } from "@/shared/lib/defense-project";
import { buildStructuralProfile } from "@/modules/defense-calculator/domain/structural-profile";
import type { DefenseProject } from "@/shared/types/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Empty map → all zeros.
{
  const empty = createDefaultDefenseProject();
  const profile = buildStructuralProfile(empty);
  assert(profile.objectCount === 0, "empty objectCount must be 0");
  assert(profile.unitCount === 0, "empty unitCount must be 0");
  assert(profile.echelonCount === 0, "empty echelonCount must be 0");
  assert(profile.categoryCount === 0, "empty categoryCount must be 0");
  assert(profile.conflictCount === 0, "empty conflictCount must be 0");
  assert(profile.coverageZoneCount === 0, "empty coverageZoneCount must be 0");
  assert(profile.totalMln === 0, "empty totalMln must be 0");
  assert(profile.byEchelon.length === 0, "empty byEchelon must be empty");
}

// Map with placed objects → structural counts reflect them.
{
  let project: DefenseProject = createDefaultDefenseProject();
  const layer = project.layers[0];
  // pick two assets with different categories and a coverage type
  const withCoverage = project.assetLibrary.find((a) => a.coverageType !== "none");
  const noCoverage = project.assetLibrary.find((a) => a.coverageType === "none");
  assert(withCoverage, "fixture needs an asset with coverage");
  assert(noCoverage, "fixture needs an asset without coverage");

  // validateObjectPlacement ignores coordinates (it does `void coordinates`), so any point works.
  const at = project.baseObject.center;
  project = placeObjectInProject(project, withCoverage.id, layer.id, at, { quantity: 2 });
  project = placeObjectInProject(project, noCoverage.id, layer.id, at, { quantity: 1 });
  assert(project.placedObjects.length === 2, "fixture must place exactly 2 objects");

  const profile = buildStructuralProfile(project);
  assert(profile.objectCount === 2, `objectCount expected 2, got ${profile.objectCount}`);
  assert(profile.unitCount === 3, `unitCount expected 3, got ${profile.unitCount}`);
  assert(profile.echelonCount === 1, `echelonCount expected 1, got ${profile.echelonCount}`);
  assert(profile.coverageZoneCount === 1, `coverageZoneCount expected 1 (only the covered asset), got ${profile.coverageZoneCount}`);
  assert(profile.categoryCount >= 1, "categoryCount must count distinct categories");
  assert(profile.byEchelon.length === 1, "byEchelon must have one occupied echelon");
  assert(profile.byEchelon[0].objectCount === 2, "byEchelon objectCount mismatch");
}

console.log("structural-profile: OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/modules/defense-calculator/domain/structural-profile.test.ts`
Expected: FAIL — `Cannot find module '.../structural-profile'`.

- [ ] **Step 3: Implement the helper**

Create `src/modules/defense-calculator/domain/structural-profile.ts`:

```ts
// Structural profile of the live map (item 8). Pure — no JSX, no fetch.
// Replaces money-first comparison with structural metrics; cost is one optional field.

import {
  calculateLayerSummaries,
  calculateProjectTotalCost,
  calculateProjectTotalObjects,
  calculateProjectTotalUnits,
} from "@/shared/lib/defense-project";
import type { DefenseProject } from "@/shared/types/defense-project";

export type StructuralEchelonProfile = {
  layerId: string;
  layerCode: string;
  layerName: string;
  objectCount: number;
  unitCount: number;
  categoryCount: number;
  conflictCount: number;
  coverageZoneCount: number;
};

export type StructuralProfile = {
  objectCount: number;
  unitCount: number;
  echelonCount: number;
  categoryCount: number;
  conflictCount: number;
  coverageZoneCount: number;
  totalMln: number; // optional layer — cost is no longer the headline metric
  byEchelon: StructuralEchelonProfile[];
};

export function buildStructuralProfile(project: DefenseProject): StructuralProfile {
  const assetsById = new Map(project.assetLibrary.map((asset) => [asset.id, asset]));
  const summaries = calculateLayerSummaries(project);

  const categories = new Set<string>();
  let coverageZoneCount = 0;
  for (const object of project.placedObjects) {
    const asset = assetsById.get(object.assetId);
    if (!asset) continue;
    categories.add(asset.category);
    if (asset.coverageType !== "none") coverageZoneCount += 1;
  }

  const byEchelon: StructuralEchelonProfile[] = summaries
    .filter((summary) => summary.objectCount > 0)
    .map((summary) => {
      const objects = project.placedObjects.filter((object) => object.layerId === summary.layerId);
      const layerCategories = new Set<string>();
      let layerCoverageZones = 0;
      for (const object of objects) {
        const asset = assetsById.get(object.assetId);
        if (!asset) continue;
        layerCategories.add(asset.category);
        if (asset.coverageType !== "none") layerCoverageZones += 1;
      }
      return {
        layerId: summary.layerId,
        layerCode: summary.layerCode,
        layerName: summary.layerName,
        objectCount: summary.objectCount,
        unitCount: summary.unitCount,
        categoryCount: layerCategories.size,
        conflictCount: summary.conflictCount,
        coverageZoneCount: layerCoverageZones,
      };
    });

  return {
    objectCount: calculateProjectTotalObjects(project),
    unitCount: calculateProjectTotalUnits(project),
    echelonCount: byEchelon.length,
    categoryCount: categories.size,
    conflictCount: summaries.reduce((acc, summary) => acc + summary.conflictCount, 0),
    coverageZoneCount,
    totalMln: calculateProjectTotalCost(project),
    byEchelon,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/modules/defense-calculator/domain/structural-profile.test.ts`
Expected: PASS — ends with `structural-profile: OK`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/defense-calculator/domain/structural-profile.ts src/modules/defense-calculator/domain/structural-profile.test.ts
git commit -m "feat(drone-defense): buildStructuralProfile helper for structural comparison (item 8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Remove reference-match cost override from the live estimate (item 6 tail)

**Files:**
- Modify: `src/modules/defense-calculator/ui/calculator-page.tsx:103-121`

- [ ] **Step 1: Replace the estimate useMemo**

In `calculator-page.tsx`, replace the `calculatorConfig` + `estimate` blocks (lines ~103–121) with an honest unit×qty estimate (no reference matching, no overrides):

```tsx
  const calculatorConfig = useMemo(
    () => projectToCalculatorConfiguration(project),
    [project],
  );

  // Live map always costs honestly as unit×qty — no reference lump-sum override (item 6/8).
  const estimate = useMemo(
    () => estimateConfiguration(calculatorConfig, context),
    [calculatorConfig, context],
  );
```

- [ ] **Step 2: Build to verify no broken references yet**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors only about now-unused imports (`referenceConfigurations`, `bundleOverridesMln`) — those are removed in Task 4. No errors about `estimate`/`calculatorConfig`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/defense-calculator/ui/calculator-page.tsx
git commit -m "refactor(drone-defense): drop reference lump-sum override from live estimate (item 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite Compare tab as structural profile + drop reference standards from core (item 8)

**Files:**
- Modify: `src/modules/defense-calculator/ui/calculator-page.tsx`

- [ ] **Step 1: Update imports**

Remove the reference-standard imports. Change the `catalog-data` import to drop `bundleOverridesMln` and `referenceConfigurations`:

```tsx
import {
  criteria,
  defaultThresholds,
  echelons,
} from "@/modules/defense-calculator/infra/catalog-data";
```

Add the profile helper import (near the other domain imports):

```tsx
import { buildStructuralProfile } from "@/modules/defense-calculator/domain/structural-profile";
```

- [ ] **Step 2: Remove referenceEstimates and loadReference; add structural profile + budgetApplied**

In `CalculatorPage`, delete the `referenceEstimates` useMemo and the `loadReference` function. Pull `budgetApplied` from the store and compute the profile:

```tsx
  const {
    project,
    applyBudgetSelection,
    restoreProjectFromLocalStorage,
    budgetApplied,
  } = useDefenseProjectStore();
```

(Note: `loadPresetProject` is removed from this destructure.)

Add after `estimate`:

```tsx
  const structuralProfile = useMemo(() => buildStructuralProfile(project), [project]);
```

- [ ] **Step 3: Update the tab label and the CompareTab call site**

Change the tabs array entry `{ id: "compare", label: "Сравнение" }` to `{ id: "compare", label: "Структура" }`.

Replace the CompareTab render:

```tsx
          {tab === "compare" ? (
            <StructureTab profile={structuralProfile} />
          ) : null}
```

Remove the `loadReference={loadReference}` prop from `<ConfigureTab .../>` and remove `loadReference` from the `ConfigureTab` props type and signature, plus delete the "Загрузить эталон" button row (the `<div className="flex flex-wrap items-center gap-2">…referenceConfigurations.map…</div>` block) from `ConfigureTab`'s JSX.

- [ ] **Step 4: Replace CompareTab component with StructureTab**

Replace the entire `CompareTab` function (the `// ─── Compare tab ───` section) with:

```tsx
// ─── Structure tab (item 8: structural profile, cost optional) ────────────────

function StructureTab({ profile }: { profile: ReturnType<typeof buildStructuralProfile> }) {
  const metrics: Array<{ label: string; value: number }> = [
    { label: "Объекты (позиции)", value: profile.objectCount },
    { label: "Единицы", value: profile.unitCount },
    { label: "Эшелоны (занятые)", value: profile.echelonCount },
    { label: "Категории средств", value: profile.categoryCount },
    { label: "Конфликты", value: profile.conflictCount },
    { label: "Зоны покрытия", value: profile.coverageZoneCount },
  ];

  if (profile.objectCount === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-sm text-amber-800">
        Конфигурация пуста — структурный профиль появится после размещения средств на карте.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-mono text-3xl font-bold tabular-nums text-slate-900">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-slate-500">Эшелон</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">Объекты</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">Единицы</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">Категории</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">Покрытие</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-slate-500">Конфликты</th>
            </tr>
          </thead>
          <tbody>
            {profile.byEchelon.map((layer) => (
              <tr key={layer.layerId} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-600">
                  <span className="font-mono text-[11px] font-bold text-blue-700">{layer.layerCode}</span>
                  <span className="ml-2">{layer.layerName}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{layer.objectCount}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{layer.unitCount}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{layer.categoryCount}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{layer.coverageZoneCount}</td>
                <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${layer.conflictCount > 0 ? "text-amber-600" : "text-slate-300"}`}>
                  {layer.conflictCount > 0 ? layer.conflictCount : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[11px] text-slate-400">
        Стоимость (опционально): {formatMln(profile.totalMln)}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Update the print report call site**

In the `print:block` wrapper at the bottom of `CalculatorPage`, replace `referenceEstimates={referenceEstimates}` with `structuralProfile={structuralProfile}` and add `budgetApplied={budgetApplied}`:

```tsx
        <CalculatorReport
          myEstimate={estimate}
          structuralProfile={structuralProfile}
          scoredAssets={scoredAssets}
          budgetResult={budgetResult}
          budgetApplied={budgetApplied}
          generatedAt={new Date()}
          layerSummaries={layerSummaries}
        />
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: only errors from `calculator-report.tsx` (props changed) — fixed in Task 5. No errors in `calculator-page.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/defense-calculator/ui/calculator-page.tsx
git commit -m "feat(drone-defense): structural Structure tab, drop reference standards from core (item 8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Report — structural comparison + budget gated by budgetApplied (items 7, 8)

**Files:**
- Modify: `src/modules/defense-calculator/ui/calculator-report.tsx`

- [ ] **Step 1: Update props and imports**

Replace the `referenceEstimates` prop with `structuralProfile` and `budgetApplied`. Update imports: drop `echelons` (only used by the old comparison) if now unused; add the profile type import. New props block:

```tsx
import {
  criteria,
  defaultThresholds,
} from "@/modules/defense-calculator/infra/catalog-data";
import { formatMln, priorityLabel } from "@/modules/defense-calculator/domain/format";
import type {
  ConfigurationEstimate,
  PriorityColor,
} from "@/modules/defense-calculator/domain/calculator-types";
import type { fitToBudget } from "@/modules/defense-calculator/domain/budget-fit";
import type { StructuralProfile } from "@/modules/defense-calculator/domain/structural-profile";
import type { LayerSummary } from "@/shared/types/defense-project";
```

Function signature:

```tsx
export function CalculatorReport({
  myEstimate,
  structuralProfile,
  scoredAssets,
  budgetResult,
  budgetApplied,
  generatedAt,
  layerSummaries,
}: {
  myEstimate: ConfigurationEstimate;
  structuralProfile: StructuralProfile;
  scoredAssets: ScoredAsset[];
  budgetResult: ReturnType<typeof fitToBudget>;
  budgetApplied: boolean;
  generatedAt?: Date;
  layerSummaries?: LayerSummary[];
}) {
```

- [ ] **Step 2: Remove old comparison locals**

Delete the now-unused `const columns = [...referenceEstimates, myEstimate];` and `const minTotal = Math.min(...columns.map((c) => c.totalMln));` lines.

- [ ] **Step 3: Gate the summary budget row**

In the "Сводка отчёта" table body, wrap the "Бюджетный режим" and "Позиции в бюджете" rows so they only render when applied:

```tsx
            {budgetApplied ? (
              <>
                <tr>
                  <td>Бюджетный режим</td>
                  <td className="num">{formatMln(budgetResult.budgetMln)}</td>
                  <td>
                    Распределено {formatMln(budgetResult.spentMln)}, остаток {formatMln(budgetResult.remainingMln)}
                  </td>
                </tr>
                <tr>
                  <td>Позиции в бюджете</td>
                  <td className="num">{picksIncludedCount} / {budgetResult.picks.length}</td>
                  <td>Количество включенных средств</td>
                </tr>
              </>
            ) : null}
```

- [ ] **Step 4: Replace comparison section with structural profile**

Replace the entire "2. Сравнение конфигураций" `<section>` with a structural one:

```tsx
      <section className="report-section">
        <h2>2. Структурный профиль конфигурации</h2>
        <table className="report-table report-table-tight">
          <thead>
            <tr>
              <th>Показатель</th>
              <th className="num">Значение</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Объекты (позиции)</td><td className="num strong">{structuralProfile.objectCount}</td></tr>
            <tr><td>Единицы</td><td className="num">{structuralProfile.unitCount}</td></tr>
            <tr><td>Эшелоны (занятые)</td><td className="num">{structuralProfile.echelonCount}</td></tr>
            <tr><td>Категории средств</td><td className="num">{structuralProfile.categoryCount}</td></tr>
            <tr><td>Конфликты</td><td className="num">{structuralProfile.conflictCount}</td></tr>
            <tr><td>Зоны покрытия</td><td className="num">{structuralProfile.coverageZoneCount}</td></tr>
            <tr><td>Стоимость (опционально)</td><td className="num total">{formatMln(structuralProfile.totalMln)}</td></tr>
          </tbody>
        </table>
      </section>
```

- [ ] **Step 5: Gate the budget section**

Wrap the entire "4. Подбор под бюджет" `<section>` in `{budgetApplied ? (...) : null}`.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no errors).
Run: `npx eslint src/modules/defense-calculator`
Expected: no errors (warnings about unused vars must be resolved — remove any leftover unused imports like `echelons`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/defense-calculator/ui/calculator-report.tsx
git commit -m "feat(drone-defense): structural report section + budget gated by budgetApplied (items 7-8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run all calculator/project tests**

```bash
npx tsx src/shared/lib/use-defense-project-store.test.ts
npx tsx src/modules/defense-calculator/domain/structural-profile.test.ts
npx tsx src/modules/defense-calculator/domain/costing.test.ts
npx tsx src/shared/lib/defense-project.test.ts
```
Expected: each prints its success line, no throws.

- [ ] **Step 2: Typecheck whole project**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npx eslint src`
Expected: no errors.

- [ ] **Step 4: Manual browser check (items 6, 7, 8 end to end)**

Run: `npm run dev`, open the calculator page.
- Empty map → headline "Итого по конфигурации" shows 0; "Структура" tab shows empty-state; PDF (Save as PDF) has NO budget section and NO "Бюджетный режим" row.
- Place an object on the map → headline updates; "Структура" tab shows non-zero metrics and the echelon row.
- Open "Подбор под бюджет", click "Применить подбор к карте" → PDF now shows the budget section.
- Place/delete another object → PDF budget section disappears again (flag reset).
- Confirm no "Загрузить эталон" (НАК/НЕВ/ФОСФОРИТ/БМУ) buttons remain on the Конфигуратор tab.

---

## Notes for the implementer

- Tests have **no framework** — they are plain `npx tsx` scripts that `throw` on failure and `console.log` a success line. Follow that pattern exactly; do not add vitest/jest.
- `applyProject` is the single mutation funnel — resetting `budgetApplied` there covers place/move/delete/transfer/layer edits/preset load automatically. Only `clearProject` and `restoreProjectFromLocalStorage` bypass it (direct `set`) and are handled explicitly.
- Reference data (`referenceConfigurations`, `bundleOverridesMln` in `catalog-data.ts`; НАК/НЕВ/ФОСФОРИТ/БМУ in `shared/config/defense-catalog.ts`) is **kept on disk** — only its use in the calculator UI/estimate is removed. `costing.test.ts` still imports it and must keep passing.
- Do not touch the map/markers modules (items 1–5 are done and merged).
```