# Fortis — калькулятор: бюджет-флаг и структурное сравнение (пункты 7, 8)

Дата: 2026-06-09
Модуль: `src/modules/defense-calculator`, `src/shared/lib`

## Контекст

Sub-project B дорабатывает калькулятор/отчёт/сравнение Fortis. На момент начала:

- **Пункт 6** (калькулятор считает живую карту) — по сути готов: `estimate`
  строится из `projectToCalculatorConfiguration(project)`, пустая карта даёт 0,
  summary пересчитывается при размещении/удалении. Остаётся один legacy-хвост —
  reference-override (см. ниже), который убирается в рамках пункта 8.
- **Пункт 7** (отчёт по текущей конфигурации) — частично готов: отчёт читает
  живой `myEstimate`/`layerSummaries`, есть пустое состояние. Не сделано:
  бюджетный подбор всегда показан как «применённый».
- **Пункт 8** (эталоны и сравнение) — не сделан: НАК/НЕВ/ФОСФОРИТ/БМУ в ядре,
  сравнение денежное.

## Решения (подтверждены пользователем)

1. Объём: остаток пункта 7 + весь пункт 8.
2. Бюджет — вариант A: явный флаг `budgetApplied`, сбрасывается при любом
   изменении карты; бюджетный раздел отчёта рендерится только при `true`.
3. Эталоны: убрать из ядра. Сравнение — структурное, стоимость — опциональный слой.
4. Вкладка «Сравнение» → структурный профиль текущей карты (без сравнения с эталоном).

## Часть A — флаг применённого бюджета (пункт 7)

**Проблема:** `budgetMln` инициализируется как `9300`, `budgetResult` всегда
непустой → в отчёте бюджет всегда показан заполненным, даже при конфигурации 0.
Противоречие «конфигурация 0, но бюджет заполнен».

**Решение:**
- В `useDefenseProjectStore` добавить состояние `budgetApplied: boolean`
  (по умолчанию `false`).
- `applyBudgetSelection(...)` → ставит `budgetApplied = true`.
- Любая мутация карты (размещение, удаление, перенос, изменение количества,
  загрузка/сброс проекта) → ставит `budgetApplied = false`.
- Калькулятор передаёт `budgetApplied` в `CalculatorReport`.
- **Отчёт** показывает раздел «4. Подбор под бюджет» и строку «Бюджетный режим»
  в сводке только при `budgetApplied === true`; иначе раздел опускается целиком.
- **Экран** вкладки «Подбор под бюджет» остаётся интерактивным всегда — это
  рабочий инструмент, не отчёт. Меняется только то, что попадает в PDF/сводку.

## Часть B — структурное сравнение (пункт 8 + хвост пункта 6)

### B1. Новый домен-хелпер
`defense-calculator/domain/structural-profile.ts` (+ контракт-тест
`structural-profile.test.ts`). Чистая функция:

```ts
buildStructuralProfile(project: DefenseProject): StructuralProfile
```

```ts
type StructuralProfile = {
  objectCount: number;       // позиций (calculateProjectTotalObjects)
  unitCount: number;         // единиц (calculateProjectTotalUnits)
  echelonCount: number;      // эшелонов с objectCount > 0
  categoryCount: number;     // distinct asset.category по размещённым
  conflictCount: number;     // Σ LayerSummary.conflictCount
  coverageZoneCount: number; // объектов с coverageType ≠ "none" — реализовано под именем coveredObjectCount
  totalMln: number;          // estimate.totalMln (опциональный слой)
  byEchelon: Array<{         // разбивка для таблицы
    layerId: string; layerCode: string; layerName: string;
    objectCount: number; unitCount: number;
    categoryCount: number; conflictCount: number; coverageZoneCount: number;
  }>;
};
```

Без JSX/fetch. Считает через существующие либы (`calculateLayerSummaries`,
`calculateProjectTotal*`, `project.assetLibrary`/`placedObjects`).
Пустая карта → все нули, `byEchelon` пустой или нули.

### B2. Убрать legacy reference-override из `estimate` (хвост пункта 6)
В `calculator-page.tsx` убрать `matchingRef`/`bundleOverridesMln`-подмену.
`estimate = estimateConfiguration(calculatorConfig, context)` — всегда честный
`unit×qty`, без `lineTotalOverridesMln`.

### B3. Вкладка «Сравнение» → «Структура»
`CompareTab` переписать: таблица структурных метрик текущей карты + разбивка
`byEchelon`. Денежная таблица по эшелонам с «мин» убирается. Стоимость — одна
строка внизу, помечена «опционально». Вкладку переименовать («Структура»).

### B4. Эталоны из ядра
- Убрать `referenceEstimates`, кнопки «Загрузить эталон», импорты
  `referenceConfigurations`/`bundleOverridesMln`/`loadPresetProject` из
  `calculator-page.tsx`.
- Данные в `catalog-data.ts`/`shared/config/defense-catalog.ts` **не удаляем** —
  просто перестают быть центральной логикой.

### B5. `CalculatorReport`
- Раздел «2. Сравнение конфигураций» → структурный профиль (та же таблица метрик),
  без `referenceEstimates`-колонок и «мин».
- Бюджетный раздел и строка сводки gated по `budgetApplied` (часть A).
- Убрать неиспользуемый проп `referenceEstimates`.

## Тестирование

- `structural-profile.test.ts`: пустая карта → нули; карта с объектами в 2 эшелонах
  с конфликтом и 3 категориями → корректные счётчики; coverageZoneCount исключает
  `coverageType: "none"`.
- Store-тест: `budgetApplied` сбрасывается при размещении/удалении/сбросе и
  ставится `true` при `applyBudgetSelection`.
- Существующие тесты (`costing.test.ts`, `defense-project.test.ts`) должны проходить.

## Вне объёма

- Не удаляем файлы эталонов/конфиги.
- Не трогаем вкладку «Конфигуратор» кроме удаления кнопок эталонов.
- Не трогаем карту/маркеры (пункты 1–5 готовы).
