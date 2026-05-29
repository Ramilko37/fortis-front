# Defense Configuration Studio Remediation Spec

## Summary

`/prototype` должен демонстрировать не набор отдельных экранов, а цельную причинную цепочку:

1. GIS показывает территорию, facilities, маршруты угроз и пробелы по эшелонам.
2. Scenario selection меняет единую конфигурацию защиты.
3. Comparison объясняет стоимость, остаточный риск и эффективность на рубль.
4. 3D drill-down показывает физическую правдоподобность выбранной конфигурации.
5. Recommendation Engine предлагает следующий лучший шаг в рамках бюджета.

Главный критерий успеха: заказчик понимает, почему одна конфигурация лучше другой, сколько она стоит, какой риск остаётся и что стоит сделать следующим вложением.

## Product Requirements

- Использовать единый набор сценариев на всех экранах: `baseline`, `balanced`, `reinforced`.
- Использовать `Configuration` как источник правды для GIS, Comparison, Recommendation и 3D Drill-down.
- Передавать выбранные `facilityId`, `scenarioId`, `budgetRub` и текущую `configuration` из верхнего уровня в 3D Drill-down.
- Любое локальное размещение в 3D должно добавлять placement в текущую конфигурацию и запускать пересчёт KPI/recommendations.
- GIS Board должен показывать readiness/gaps по L1-L9, а не только общую heatmap.
- L1-L9 должны быть эшелонами удалённости от объекта: L1 самый дальний внешний слой, L9 ближнее hardening у критического узла.
- Расчёт эффективности каждого слоя должен учитывать distance fit между hex/facility distance и диапазоном эшелона.
- Comparison должен показывать CAPEX, TCO 3y, residual risk, risk reduction, value per ruble, cost per risk point и layer readiness.
- Recommendation cards должны объяснять, какой слой усиливается, какой gap закрывается и какой эффект даёт вложение.

## Implementation Notes

- Backend/PostGIS/GeoServer не внедряются в этой итерации; mock runtime остаётся source-of-truth для demo-build.
- Для demo-build используются фиксированные distance bands: L1 60-120 км, L2 30-60 км, L3 15-30 км, L4 8-15 км, L5 4-8 км, L6 1.5-4 км, L7 0.5-1.5 км, L8 100-500 м, L9 0-100 м.
- 3D-симуляция угроз остаётся cinematic/demo-only, но её сценарии синхронизированы с `baseline`, `balanced`, `reinforced`.
- Старые 3D-сценарии `unprotected`, `perimeter`, `assets`, `night` не должны быть самостоятельным состоянием прототипа.
- Synthetic “без защиты” можно вернуть позже только как отдельную строку сравнения, если она не смешивается с основным workflow.

## Acceptance Criteria

- При выборе `Balanced` на верхнем уровне 3D Drill-down открывается в `Balanced`.
- При добавлении локального средства в 3D увеличивается placement count, пересчитываются KPI и обновляются recommendations.
- Переключение `baseline -> balanced -> reinforced` меняет GIS heatmap и Layer Readiness L1-L9.
- В GIS и Comparison видны distance bands для L1-L9; дальние эшелоны не считаются ближней hardening-защитой и наоборот.
- Comparison view показывает абсолютный residual risk и delta от baseline.
- Recommendation cards содержат affected layers, reason, delta risk, delta TCO и score.
- За 2-3 минуты можно провести демо: GIS gaps -> Comparison -> 3D Drill-down -> Recommendation.
