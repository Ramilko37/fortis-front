# FRT-18 — Сохранение и загрузка вариантов конфигурации

**Дата:** 2026-06-13
**Linear:** [FRT-18](https://linear.app/fortis-project/issue/FRT-18) · ветка `ulyanovvadim95/frt-18-fep1-sokhranenie-i-zahruzka-variantov-konfihuracii`
**Статус:** дизайн утверждён, готов к плану реализации

---

## 1. Цель

Дать пользователю сохранять несколько именованных вариантов конфигурации карты (`DefenseProject`) и переключаться между ними. Backend для хранения уже готов (FRT-29/30/31/39). Задача — frontend UI + проводка к реальному бэку, плюс одна точечная доработка бэка (overwrite содержимого при `PUT`).

Дополнительная цель этой работы: подключить фронт к **реальному локальному Go-бэку** вместо моков.

## 2. Ключевые решения

| # | Решение |
|---|---|
| 1 | **Модель данных:** 1 вариант = 1 `DefenseProject` = 1 запись на бэке. Источник правды — бэкенд. localStorage остаётся только как кэш черновика текущей карты. |
| 2 | **UI:** селектор активного варианта в верхнем баре (имя + статус) + модалка со списком/сохранением/удалением. |
| 3 | **Семантика save:** «Сохранить» (overwrite через `PUT`, только если вариант загружен) + «Сохранить как…» (`POST` новой записи). Для черновика доступна только «Сохранить как…». |
| 4 | **Синхронизация:** `loadVariant` кладёт `DefenseProject` в project-store → пересчитывает studio-store через существующий `project-map-adapter`. Однонаправленная связь, project — источник. |
| 5 | **Связь с бэком:** новые BFF route handlers Next проксируют на `process.env.BACKEND_URL` (`http://localhost:8090/api/v1`). Переключатель mock↔real — существующий `NEXT_PUBLIC_DEFENSE_RUNTIME=api`. |

## 3. Границы (scope)

**В scope:**
- Точечная доработка Go-бэка: `PUT /api/v1/projects/update` принимает опциональный `projectJson` и перезаписывает `project_data` + бампает `version`.
- BFF route handlers `src/app/api/defense/projects/*`.
- Новые методы `api-client.ts` + маппинг типов.
- Новый стор `useDefenseVariantsStore` + `replaceProject` в project-store + sync через адаптер.
- UI: селектор в баре + модалка со всеми состояниями.

**Вне scope (намеренно):**
- 409 Conflict / version-merge UX → **FRT-47** (здесь только понятный текст ошибки; поле `version` уже прокидываем как задел).
- Сравнение вариантов → **FRT-19**.
- Бюджетный режим → **FRT-20**.
- Любые МОГ-specific доработки UI → **FRT-40**. НО: `compoundProfile` сохраняется/восстанавливается автоматически как часть `DefenseProject` (уже в типе `PlacedDefenseObject`) — терять его нельзя.
- Backend CRUD как таковой — уже готов; трогаем только `PUT` overwrite.

## 4. Текущее состояние кодовой базы (факты)

### Backend (готов, Go)
Сервер: `http://localhost:8090`, базовый префикс `/api/v1`. Хранит весь `DefenseProject` как JSONB в `defense_projects.project_data`, плюс денормализованные `name`, `enterprise_id`, `version`.

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/api/v1/projects` | создать (тело: `{name, enterpriseId?, projectJson}`) |
| `GET` | `/api/v1/projects?limit&offset&enterpriseId` | список (`{items, totalItems}`) |
| `GET` | `/api/v1/projects/get?id=` | получить полный проект |
| `PUT` | `/api/v1/projects/update?id=` | **сейчас обновляет только метаданные** (`name`, `enterpriseId`) |
| `DELETE` | `/api/v1/projects/delete?id=` | удалить |
| `POST` | `/api/v1/projects/import` | импорт JSON |
| `GET` | `/api/v1/projects/export?id=` | экспорт JSON |

Ошибки бэка: `validation_error` (400), `version_conflict` (409, optimistic lock по `version`), `not_found` (404).
Auth сейчас не проверяется (whitelist-режим, `auth_url` пуст в dev-конфиге).

Ссылки на код:
- Контроллер: `backend/internal/modules/defense_project/ui/controller.go`
- DTO: `backend/internal/modules/defense_project/ui/dto.go` (`UpdateProjectRequest` — то, что расширяем)
- Сервис: `backend/internal/modules/defense_project/application/defense_project_service.go` (`UpdateProject`, `serializeProject`)
- Репозиторий: `backend/internal/modules/defense_project/infrastructure/defense_project_repository.go` (`Save` с optimistic lock)
- Роуты: `backend/cmd/app/router.go`

### Frontend (моки, Next.js)
- **Два независимых zustand-стора:**
  - `useDefenseProjectStore` (`src/shared/lib/use-defense-project-store.ts`) — активный `DefenseProject` (слои, объекты, `compoundProfile`), кэш в localStorage (`FORTIS_DEFENSE_PROJECT_STORAGE_KEY`, метод `restoreProjectFromLocalStorage`). **Это и есть «карта/конфигурация».**
  - `useDefenseStudioStore` (`src/modules/drone-defense/domain/use-defense-studio-store.ts`) — GIS-рантайм: `configuration`, `layers`, `localPlacementsByScenario`, `selectedPlacementId`, `facilityId`, `scenarioId`. Питает калькулятор через `Configuration`.
- **Тип `DefenseProject`** уже есть: `src/shared/types/defense-project.ts` — совпадает с бэкендом 1:1 по JSON-полям (`projectId`, `baseObject`, `layers`, `placedObjects`, `compoundProfile`, …).
- **`project-map-adapter`** (`src/modules/drone-defense/domain/project-map-adapter.ts`): `placedObjectsToMapPlacements({project, facilityId, scenarioId}) → Placement[]`. Переиспользуем для sync; уже round-trip'ит `compoundProfile` (есть тест).
- **Калькулятор:** route `src/app/(defense-studio)/calculator/page.tsx` → `defense-calculator/ui/calculator-page.tsx`; считает по `Configuration` из studio-store через `POST /api/defense/evaluate|recommend`.
- **api-client** (`src/modules/drone-defense/infra/api-client.ts`): только read/compute (`catalog`, `facilities`, `layers`, `evaluate`, `recommend`). Save/load методов **нет**.
- **BFF route handlers** (`src/app/api/defense/*`): сейчас все отдают моки из `mock-defense-repository`. Реального апстрима на Go **нет нигде** (ни `.env`, ни rewrites).
- **Runtime switch:** `useLocalRuntime = process.env.NEXT_PUBLIC_DEFENSE_RUNTIME !== "api"` (mock vs api-client).

## 5. Архитектура решения (3 слоя)

### Слой A — Backend (Go), точечная доработка
Расширить `UpdateProjectRequest` (`dto.go`) опциональным полем `projectJson string`. В `DefenseProjectService.UpdateProject`:
- если `projectJson` передан → распарсить, провалидировать `schemaVersion == 1`, перезаписать `project_data`, бампнуть `version` через `repo.Save` (optimistic lock уже есть);
- если не передан → старое поведение (только метаданные).
Обратносовместимо. Тест на оба пути + конфликт версий.

### Слой B — BFF (Next route handlers), новый
`.env.local`: `BACKEND_URL=http://localhost:8090/api/v1` (server-side, **не** `NEXT_PUBLIC_*`).

Новые handlers под `src/app/api/defense/projects/`:

| Frontend BFF | → Backend | Назначение |
|---|---|---|
| `GET /api/defense/projects` | `GET /projects` | список вариантов |
| `POST /api/defense/projects` | `POST /projects` | «Сохранить как…» |
| `GET /api/defense/projects/[id]` | `GET /projects/export?id=` | загрузить вариант (полный проект; `get` отдаёт только метаданные) |
| `PUT /api/defense/projects/[id]` | `PUT /projects/update?id=` | «Сохранить» (overwrite) |
| `DELETE /api/defense/projects/[id]` | `DELETE /projects/delete?id=` | удалить |

Каждый handler: server-side `fetch` на `BACKEND_URL`, нормализация ответа бэка (распаковка `body`-обёрток, плоские метаданные) в frontend-типы, маппинг кодов ошибок бэка в `{ error: { code, message } }`.

### Слой C — Frontend (стор + UI), основной объём

**Новый `useDefenseVariantsStore`** (`src/modules/drone-defense/domain/use-defense-variants-store.ts`):
```
state:
  variants: VariantSummary[]
  activeVariantId: string | null
  activeVariantName: string | null
  activeVariantVersion: number | null
  listStatus: 'idle' | 'loading' | 'error'
  saveStatus: 'idle' | 'saving' | 'error'
  loadStatus: 'idle' | 'loading' | 'error'
  error: string | null

actions:
  fetchVariants()
  saveAsNewVariant(name)        // POST → ставит активным → рефреш списка
  overwriteActiveVariant()      // PUT с текущим project + version (только если activeVariantId != null)
  loadVariant(id)               // GET → replace + sync (см. ниже)
  deleteVariant(id)             // DELETE → рефреш; если активный — activeVariant* = null
```
`VariantSummary = { projectId, name, projectName, version, updatedAt }`.

**`replaceProject(project)`** в `useDefenseProjectStore` — полная замена project-state (не merge), гарантия отсутствия смешивания данных вариантов.

**Поток `loadVariant(id)`:**
1. `loadStatus = 'loading'`; `GET /api/defense/projects/[id]` → полный `DefenseProject`.
2. `projectStore.replaceProject(loaded)` (`compoundProfile` внутри `placedObjects`).
3. Пересчёт studio-store через `placedObjectsToMapPlacements(...)` → обновляет `configuration`/placements (питает карту и калькулятор).
4. Сброс выбора: `selectedObjectId = null`, `selectedPlacementId = null`.
5. `activeVariantId/Name/Version` ← из загруженного.

**Новые методы `api-client.ts`:** `listVariants()`, `saveVariantAsNew({name, project})`, `loadVariant(id)`, `overwriteVariant({id, name, project, version})`, `deleteVariant(id)`. Подключить к runtime-switch (mock-ветки тоже, чтобы dev без бэка не падал).

**UI:**
- *Селектор в баре* (`drone-defense-prototype.tsx`, верхний бар): имя активного варианта + статус-точка (зелёная = загружен, жёлтая = черновик). Клик → открыть модалку. Рядом кнопки «Сохранить» (disabled для черновика) и «Сохранить как…».
- *Модалка* (новый компонент `ui/variants-modal.tsx`): список строк (имя · `v{version}` · дата · действия Загрузить/переименовать/удалить), активная строка подсвечена; внизу инпут имени + «Сохранить как новый».
- *Состояния:* пусто (empty-state), загрузка списка (спиннер), идёт сохранение (спиннер в кнопке), ошибка (красный баннер с понятным текстом).

## 6. Acceptance criteria → как закрывается

| AC | Закрытие |
|---|---|
| Сохранить A → изменить → сохранить B → вернуться к A | `saveAsNewVariant` дважды + `loadVariant(A)` |
| Имя варианта видно в UI и после загрузки | селектор в баре + `activeVariantName` |
| Загруженный вариант полностью заменяет активную карту | `replaceProject` (полная замена, не merge) |
| Объекты, включая compound, не теряются | `compoundProfile` едет внутри `DefenseProject`; round-trip покрыт тестом адаптера |
| `/calculator/` показывает данные варианта | sync пересчитывает `Configuration` в studio-store |
| Ошибки save/load показаны понятным текстом | `error` в сторе + баннер в модалке; маппинг кодов бэка |

## 7. Тестирование

- **Backend:** `PUT /update` с `projectJson` перезаписывает `project_data` + бампает `version`; без — старое поведение; конфликт версий → `version_conflict`.
- **Стор-контракт** (`use-defense-variants-store.test.ts`): `saveAsNewVariant` ставит активный; `loadVariant` заменяет project-state и сбрасывает выбор; `deleteVariant` активного отвязывает; переходы статусов.
- **Sync-контракт:** расширить `project-map-adapter.test.ts` — после load placements/configuration пересчитаны, `compoundProfile` сохранён.
- **Replace-без-смешивания:** загрузка B поверх A не оставляет объектов A.
- API-client/BFF: fetch замокан, реальную сеть в unit-тестах не дёргаем.

## 8. Порядок сборки (вертикальные срезы, каждый коммитим)

1. **Backend:** доработать `PUT /update` (+ тест), поднять локально, проверить `curl`.
2. **Env + BFF:** `.env.local` + route handlers `projects/*`; проверить с `NEXT_PUBLIC_DEFENSE_RUNTIME=api`, что фронт реально ходит на Go.
3. **api-client + types:** методы variants + маппинг (+ mock-ветки).
4. **Стор + sync:** `useDefenseVariantsStore` + `replaceProject` + sync через адаптер (+ тесты).
5. **UI:** селектор в баре + модалка + состояния + проводка к стору.
6. **E2E вручную:** прогнать все AC из §6 на реальном локальном бэке.

## 9. Открытые риски / заметки

- `PUT` overwrite — единственная backend-правка; держать обратносовместимой.
- `enterpriseId` сейчас опционален и auth не enforced — в этой задаче не привязываемся к enterprise-скоупу (передаём как есть/пусто), полноценный multi-tenant вне scope.
- Поле `version` прокидываем в стор и `PUT` уже сейчас, чтобы FRT-47 (409 UX) лёг сверху без рефактора.
