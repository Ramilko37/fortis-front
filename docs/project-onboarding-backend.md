# Fortis Defense Studio: человекочитаемое описание проекта для backend onboarding

> Документ для быстрого входа нового backend-разработчика.  
> Статус: обзор текущего продукта и ближайших backend-возможностей.  
> Актуально на 2026-06-04.

## 1. Что мы строим

Fortis Defense Studio — это рабочая система для проектирования защиты промышленного объекта от угроз БПЛА.

Продукт помогает не просто “нарисовать карту”, а собрать причинную цепочку:

1. Есть защищаемый объект, например завод.
2. Вокруг него строятся эшелоны защиты: внешнее предупреждение, обнаружение, подавление, огневые рубежи, пассивная защита, hardening.
3. Пользователь размещает средства защиты на карте: РЛС, РЭБ, перехватчики, турели, пассивные средства и т.д.
4. Система считает стоимость, количество объектов, покрытие эшелонов, конфликты размещения.
5. Калькулятор показывает смету, сравнение вариантов и подбор средств под бюджет.
6. PDF-отчёт собирает всё это в табличный документ для обсуждения с заказчиком.

Главная идея: заменить ручную работу в Excel/PowerPoint живой конфигурацией, где карта, смета и отчёт читают одни и те же данные.

## 2. Какие задачи продукт решает

### Для пользователя

- Спроектировать многослойную защиту объекта.
- Понять, какие средства защиты нужны на каждом эшелоне.
- Увидеть, где средства физически размещены на карте.
- Проверить, попадает ли средство в допустимую зону эшелона.
- Быстро оценить CAPEX конфигурации.
- Сравнить свою конфигурацию с эталонами: НАК, НЕВ, ФОСФОРИТ, БМУ.
- Подобрать приоритетные покупки под заданный бюджет.
- Сформировать PDF-отчёт.

### Для команды продукта

- Демонстрировать заказчику не статичный слайд, а живую модель.
- Быстро менять конфигурацию и сразу видеть пересчёт.
- Постепенно заменить экспертные заглушки реальными данными backend/GIS/каталога.
- Подготовить основу для сохранения проектов, командной работы и сценарного анализа.

## 3. Из чего сейчас состоит frontend

Основные route:

- `/prototype` — карта и конфигуратор эшелонов.
- `/calculator` — калькулятор сметы, сравнение, бюджетный подбор, PDF.
- `/dashboard` — общий кабинет.
- `/models` — библиотека моделей.
- `/login`, `/register` — публичные страницы авторизации.

Оба defense-route обёрнуты в единый shell:

- `src/app/(defense-studio)/layout.tsx`
- `src/modules/drone-defense/ui/defense-studio-shell.tsx`

Карта:

- `src/modules/drone-defense/ui/drone-defense-prototype.tsx`
- `src/modules/drone-defense/ui/gis-board.tsx`
- `src/modules/drone-defense/ui/facility-drilldown.tsx`
- `src/modules/drone-defense/ui/defense-tools-panel.tsx`

Калькулятор:

- `src/modules/defense-calculator/ui/calculator-page.tsx`
- `src/modules/defense-calculator/ui/calculator-report.tsx`
- `src/modules/defense-calculator/domain/scoring.ts`
- `src/modules/defense-calculator/domain/costing.ts`
- `src/modules/defense-calculator/domain/budget-fit.ts`

Общая модель проекта:

- `src/shared/types/defense-project.ts`
- `src/shared/lib/defense-project.ts`
- `src/shared/lib/use-defense-project-store.ts`
- `src/shared/config/default-defense-layers.ts`
- `src/shared/config/defense-asset-library.ts`
- `src/shared/config/defense-catalog.ts`

## 4. Главный источник истины

Сейчас главный объект данных — `DefenseProject`.

Он описывает:

- защищаемый объект;
- эшелоны;
- библиотеку средств защиты;
- размещённые объекты;
- выбранный эшелон;
- выбранное средство;
- происхождение конфигурации;
- дату обновления.

Упрощённо:

```ts
type DefenseProject = {
  projectId: string;
  projectName: string;
  baseObject: ProtectedObject;
  layers: EditableDefenseLayer[];
  assetLibrary: DefenseAssetLibraryItem[];
  placedObjects: PlacedDefenseObject[];
  activeLayerId?: string;
  selectedAssetId?: string;
  updatedAt: string;
};
```

Эшелон не хранит внутри себя список средств. Его наполнение считается по размещённым объектам:

```ts
project.placedObjects.filter((object) => object.layerId === layer.id)
```

Это важно для backend: связь “объект принадлежит эшелону” должна жить на уровне placed object.

## 5. Что такое эшелон

Эшелон — это зона вокруг защищаемого объекта. В v1 поддерживаем кольца:

- `innerRadiusM` — удалённость от объекта;
- `widthM` — ширина зоны;
- `outerRadiusM = innerRadiusM + widthM`.

В данных это хранится как:

```ts
geometry: {
  type: "ring";
  center: { lat, lng };
  minRadiusM: number;
  maxRadiusM: number;
}
```

Стартовый шаблон содержит 9 эшелонов L1-L9:

- L1 — внешнее предупреждение;
- L2 — обнаружение;
- L3 — идентификация;
- L4 — подавление;
- L5 — средний рубеж;
- L6 — последний рубеж;
- L7 — срыв точности;
- L8 — пассивная защита;
- L9 — hardening.

Пользовательская модель уже допускает изменение количества эшелонов. Сейчас UI ограничен минимумом 1 и максимумом 20.

## 6. Что такое средство защиты

Средство защиты — элемент каталога:

- РЛС;
- оптико-электронные системы;
- РЭБ;
- перехватчики;
- турели;
- ствольная ПВО;
- ЗРПК;
- пассивные сетки;
- командные пункты;
- инфраструктурные и организационные средства.

У средства есть:

- цена за единицу в млн рублей;
- единица измерения;
- рекомендуемый эшелон;
- score;
- priority;
- mapping на карту;
- mapping на калькулятор;
- тип размещения: физический объект, зона или non-physical.

Сейчас часть данных экспертная и ориентировочная. Это нормально для прототипа, но backend должен быть готов хранить источник значения: `pdf`, `excel`, `expert-estimate`, `vendor`, `manual`.

## 7. Что такое размещённый объект

`PlacedDefenseObject` — это конкретное размещение средства защиты на карте.

Примерно:

```ts
type PlacedDefenseObject = {
  id: string;
  assetId: string;
  layerId: string;
  name?: string;
  coordinates: { lat: number; lng: number; altitude?: number };
  quantity: number;
  status: "planned" | "active" | "inactive" | "maintenance";
  customPricePerUnitMln?: number;
  notes?: string;
};
```

Именно placed objects дают калькулятору количество и стоимость. Если на карте добавили РЛС, калькулятор должен увидеть РЛС. Если в калькуляторе изменили quantity, карта должна обновиться.

## 8. Как сейчас работает связка карта -> калькулятор

1. Пользователь выбирает эшелон на карте.
2. Выбирает средство защиты в каталоге.
3. Кликает по карте.
4. Frontend проверяет, попала ли точка в кольцо выбранного эшелона.
5. Если всё нормально, создаёт `PlacedDefenseObject`.
6. `DefenseProject` сохраняется в `localStorage`.
7. Калькулятор берёт `DefenseProject.placedObjects`.
8. `projectToCalculatorConfiguration()` агрегирует объекты в строки калькулятора.
9. `estimateConfiguration()` считает смету.
10. PDF получает тот же estimate и summaries по эшелонам.

Текущий persistence — только `localStorage`. Backend пока не участвует.

## 9. Что сейчас реализовано как mock/frontend-only

Backend-разработчику важно понимать: сейчас многие вещи выглядят как готовая система, но фактически живут во фронте.

Frontend-only сейчас:

- проекты и конфигурации;
- сохранение в `localStorage`;
- каталог средств защиты;
- стартовые эшелоны;
- цены и экспертные оценки;
- эталонные конфигурации;
- расчёт сметы;
- budget fit;
- валидация попадания точки в кольцо;
- конфликтность объекта после изменения зоны;
- PDF через browser print;
- mock GIS data;
- mock threat routes;
- 3D demo placements.

Это хорошие кандидаты для постепенного переноса на backend.

## 10. Что backend может реализовать уже сейчас

Ниже — не абстрактный wishlist, а реальные backend-задачи, которые уже можно делать, потому что frontend-модель и workflow достаточно сформированы.

### 10.1. Хранение проектов

Первый и самый полезный backend-slice.

Нужны сущности:

- `Project`;
- `ProtectedObject`;
- `DefenseLayer`;
- `DefenseAsset`;
- `PlacedDefenseObject`;
- `ProjectVersion` или `ProjectSnapshot`.

Минимальные операции:

- создать проект;
- получить проект;
- обновить проект;
- удалить проект;
- список проектов пользователя/организации;
- сохранить snapshot;
- восстановить snapshot.

Пример API:

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PUT    /api/projects/:projectId
DELETE /api/projects/:projectId
POST   /api/projects/:projectId/snapshots
GET    /api/projects/:projectId/snapshots
POST   /api/projects/:projectId/restore/:snapshotId
```

Почему это важно: сейчас всё теряется при очистке browser storage и не может быть разделено между пользователями.

### 10.2. CRUD эшелонов

Backend может хранить пользовательские эшелоны как часть проекта.

Операции:

- создать эшелон;
- переименовать;
- изменить порядок;
- изменить геометрию;
- скрыть/показать;
- заблокировать;
- удалить.

Правила:

- минимум 1 эшелон;
- максимум 20;
- нельзя удалить эшелон с размещёнными объектами;
- нельзя удалить locked эшелон;
- при изменении геометрии не удалять объекты молча, а возвращать conflict summary.

Пример API:

```http
POST   /api/projects/:projectId/layers
PATCH  /api/projects/:projectId/layers/:layerId
DELETE /api/projects/:projectId/layers/:layerId
POST   /api/projects/:projectId/layers/reorder
GET    /api/projects/:projectId/layers/:layerId/conflicts
```

### 10.3. CRUD размещённых объектов

Backend может стать источником истины для `placedObjects`.

Операции:

- разместить объект;
- изменить quantity/status;
- удалить объект;
- перенести объект;
- получить все объекты проекта;
- получить объекты конкретного эшелона.

Пример API:

```http
GET    /api/projects/:projectId/objects
POST   /api/projects/:projectId/objects
PATCH  /api/projects/:projectId/objects/:objectId
DELETE /api/projects/:projectId/objects/:objectId
```

При создании/перемещении backend может валидировать:

- существует ли asset;
- существует ли layer;
- не locked ли layer;
- physical asset внутри геометрии layer;
- non-physical asset может быть без строгой геометрии.

### 10.4. Каталог средств защиты

Сейчас каталог захардкожен во frontend. Backend может вынести его в управляемую модель.

Сущности:

- `DefenseAsset`;
- `AssetCategory`;
- `AssetRole`;
- `AssetPrice`;
- `AssetScore`;
- `AssetCompatibility`;
- `AssetSourceMetadata`.

Полезные поля:

- `name`;
- `shortName`;
- `pricePerUnitMln`;
- `currency`;
- `unitLabel`;
- `score`;
- `priority`;
- `recommendedLayerCodes`;
- `placementType`;
- `deploymentType`;
- `mapCatalogGroupIds`;
- `calculatorAssetId`;
- `source`;
- `isActive`.

Пример API:

```http
GET    /api/defense-assets
POST   /api/defense-assets
GET    /api/defense-assets/:assetId
PATCH  /api/defense-assets/:assetId
DELETE /api/defense-assets/:assetId
```

### 10.5. Расчётный сервис

Расчёты пока pure frontend. Backend может реализовать тот же contract серверно.

Операции:

- посчитать смету проекта;
- посчитать summaries по эшелонам;
- посчитать priority list;
- посчитать budget fit;
- сравнить проект с эталонами.

Пример API:

```http
POST /api/calculations/estimate
POST /api/calculations/budget-fit
POST /api/calculations/compare
GET  /api/projects/:projectId/estimate
```

Почему это важно:

- единая логика для frontend, PDF и будущих интеграций;
- расчёты можно версионировать;
- можно хранить audit trail;
- можно запускать тяжёлые сценарии асинхронно.

### 10.6. PDF/report generation

Сейчас PDF — browser print. Backend может генерировать стабильный отчёт.

Операции:

- создать отчёт по проекту;
- получить ссылку на PDF;
- хранить историю отчётов;
- приложить отчёт к snapshot.

Пример API:

```http
POST /api/projects/:projectId/reports
GET  /api/projects/:projectId/reports
GET  /api/reports/:reportId/download
```

Рекомендуемый подход:

- хранить report input snapshot;
- хранить версию шаблона;
- генерировать PDF асинхронно;
- возвращать статус `pending | ready | failed`.

### 10.7. Пользователи, организации, роли

Сейчас авторизация есть как UI, но defense project persistence не привязан к пользователю.

Backend может добавить:

- users;
- organizations;
- memberships;
- roles;
- project permissions.

Минимальные роли:

- `owner`;
- `editor`;
- `viewer`;
- `admin`.

Типовые права:

- смотреть проект;
- редактировать проект;
- публиковать;
- экспортировать отчёт;
- управлять каталогом.

### 10.8. Версионирование и audit log

Очень полезно для B2B/инженерной системы.

Что логировать:

- кто создал проект;
- кто изменил эшелон;
- кто добавил/удалил средство;
- кто применил бюджетный подбор;
- кто сгенерировал отчёт;
- какие значения были до/после.

Пример API:

```http
GET /api/projects/:projectId/audit-log
GET /api/projects/:projectId/versions
POST /api/projects/:projectId/versions/:versionId/restore
```

### 10.9. GIS и геоданные

Сейчас карта использует mock/raster base map и frontend-геометрию.

Backend может постепенно добавить:

- хранение геометрий;
- PostGIS;
- protected object coordinates;
- layer polygons/rings;
- threat routes;
- facility boundaries;
- risk grid/H3 cells;
- spatial validation на backend.

Пример API:

```http
GET  /api/projects/:projectId/map
GET  /api/projects/:projectId/threat-routes
POST /api/projects/:projectId/spatial/validate-placement
GET  /api/projects/:projectId/risk-grid
```

### 10.10. Импорт/экспорт

Backend может поддержать:

- импорт Excel/PDF-derived catalog;
- экспорт project JSON;
- экспорт calculator table;
- экспорт PDF;
- импорт старых конфигураций.

Пример API:

```http
POST /api/import/catalog
POST /api/import/project
GET  /api/projects/:projectId/export/json
GET  /api/projects/:projectId/export/xlsx
```

## 11. Рекомендуемый backend MVP

Если выбирать минимальный backend scope, я бы делал в таком порядке:

1. **Projects persistence**
   - хранить `DefenseProject` целиком как JSONB;
   - добавить `ownerId`, `organizationId`, timestamps;
   - дать CRUD API.

2. **Project snapshots**
   - snapshot перед крупными изменениями;
   - restore;
   - простая история версий.

3. **Placed objects API**
   - отдельные endpoints для объектов;
   - backend validation;
   - конфликтные ответы.

4. **Catalog API**
   - отдать frontend текущий каталог с ценами;
   - сначала read-only;
   - позже admin CRUD.

5. **Estimate API**
   - повторить текущую frontend-логику серверно;
   - вернуть total, layer summaries, lines.

6. **Report API**
   - server-side PDF generation;
   - хранение отчётов.

Этот порядок даст максимальную пользу без большого GIS-переезда.

## 12. Возможная минимальная схема БД

Для MVP можно начать pragmatically:

```text
users
  id
  email
  name
  created_at

organizations
  id
  name
  created_at

organization_members
  organization_id
  user_id
  role

projects
  id
  organization_id
  owner_id
  name
  status
  project_json jsonb
  created_at
  updated_at

project_snapshots
  id
  project_id
  created_by
  reason
  project_json jsonb
  created_at

defense_assets
  id
  name
  category
  price_per_unit_mln
  currency
  unit_label
  score
  priority
  placement_type
  metadata jsonb
  created_at
  updated_at

reports
  id
  project_id
  snapshot_id
  status
  file_url
  template_version
  created_by
  created_at
```

Позже можно нормализовать layers и placed_objects в отдельные таблицы. На старте JSONB project storage быстрее даст рабочий backend и не заблокирует frontend.

## 13. Контракты, которые важно не сломать

### 13.1. Project shape

Frontend уже ожидает структуру, близкую к `DefenseProject`. Если backend отдаёт проект, он должен включать:

- `schemaVersion`;
- `projectId`;
- `projectName`;
- `baseObject`;
- `layers`;
- `assetLibrary`;
- `placedObjects`;
- `activeLayerId`;
- `updatedAt`.

### 13.2. Layer deletion

Backend не должен молча удалять эшелон с объектами. Нужно вернуть ошибку уровня:

```json
{
  "ok": false,
  "reason": "layer-has-objects",
  "message": "В эшелоне есть размещённые объекты. Сначала удалите или перенесите их."
}
```

### 13.3. Placement validation

Если physical asset вне кольца, backend должен вернуть ошибку:

```json
{
  "isValid": false,
  "level": "error",
  "message": "Нельзя разместить объект вне границ выбранного эшелона."
}
```

Если asset не рекомендован для эшелона, но placement допустим, лучше вернуть warning:

```json
{
  "isValid": true,
  "level": "warning",
  "message": "Это средство можно разместить в выбранном эшелоне, но оно не является рекомендованным для данной зоны."
}
```

### 13.4. Estimate response

Калькулятору нужны:

- configuration id/name;
- lines;
- totals;
- totals by layer/echelon;
- priority;
- empty flags;
- conflict count по layers.

## 14. Что backend не обязан делать прямо сейчас

Чтобы не расползтись:

- Не обязательно сразу делать PostGIS.
- Не обязательно сразу нормализовать весь `DefenseProject`.
- Не обязательно сразу делать real-time collaboration.
- Не обязательно сразу заменять все frontend расчёты.
- Не обязательно сразу делать полноценный admin для каталога.
- Не обязательно сразу делать AI/recommendation engine.

Для первого backend этапа достаточно сохранить проект и вернуть его обратно без потери данных.

## 15. Как backend-разработчику быстро проверить систему

1. Запустить frontend:

```bash
pnpm dev
```

2. Открыть `/prototype`.
3. Выбрать эшелон L2.
4. Выбрать РЛС.
5. Кликнуть внутри кольца.
6. Перейти в `/calculator`.
7. Убедиться, что количество и стоимость появились.
8. Вернуться на карту.
9. Удалить объект или изменить quantity в калькуляторе.
10. Проверить, что состояние синхронизируется.

Если backend подключает persistence, главный acceptance:

- refresh страницы не должен терять проект;
- другой браузер/пользователь с доступом должен увидеть тот же проект;
- калькулятор должен считать проект, пришедший с backend, так же как localStorage-проект.

## 16. Что читать дальше в коде

Минимальный маршрут по файлам:

1. `src/shared/types/defense-project.ts`
2. `src/shared/lib/defense-project.ts`
3. `src/shared/lib/use-defense-project-store.ts`
4. `src/shared/config/default-defense-layers.ts`
5. `src/shared/config/defense-asset-library.ts`
6. `src/shared/config/defense-catalog.ts`
7. `src/modules/drone-defense/ui/drone-defense-prototype.tsx`
8. `src/modules/drone-defense/ui/gis-board.tsx`
9. `src/modules/defense-calculator/ui/calculator-page.tsx`
10. `src/modules/defense-calculator/domain/costing.ts`
11. `src/modules/defense-calculator/ui/calculator-report.tsx`

Дополнительный обзор архитектуры:

- `docs/product/defense-studio-architecture.md`

## 17. Главное для backend

Если оставить одну мысль:

**Backend должен постепенно стать источником истины для `DefenseProject`: проекты, эшелоны, размещённые объекты, каталог, расчёты и отчёты.**

Frontend уже умеет работать с такой моделью локально. Поэтому первая задача backend — не придумать новую модель с нуля, а аккуратно забрать текущую project-модель из localStorage в серверное хранилище, сохранив поведение карты и калькулятора.
