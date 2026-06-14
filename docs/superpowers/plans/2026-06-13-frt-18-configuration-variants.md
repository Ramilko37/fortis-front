# FRT-18 Configuration Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user save the current map (`DefenseProject`) as a named configuration variant, list saved variants, load one (fully replacing the active map), and overwrite an existing variant — backed by the real local Go backend.

**Architecture:** Three layers. (A) One small backend change so `PUT /api/v1/projects/update` can overwrite map content. (B) New Next BFF route handlers under `src/app/api/defense/projects/*` that proxy to `process.env.BACKEND_URL`. (C) A new `useDefenseVariantsStore` + a `replaceProject` action in the existing project store + a bar selector and a modal UI. The calculator and map already read reactively from `useDefenseProjectStore.project`, so loading a variant syncs both automatically once the project is replaced.

**Tech Stack:** Go (fasthttp, dig DI) backend; Next.js 15 App Router, React, Zustand, TypeScript, Vitest, antd, pnpm.

**Spec:** `frontend/docs/superpowers/specs/2026-06-13-frt-18-configuration-variants-design.md`

**Repo layout note:** This is a workspace with git submodules. Backend lives in `backend/` (its own repo), frontend in `frontend/` (its own repo). Run backend git commands from `backend/`, frontend git commands from `frontend/`. Frontend feature branch: `ulyanovvadim95/frt-18-fep1-sokhranenie-i-zahruzka-variantov-konfihuracii`.

---

## File Structure

**Backend (Go):**
- Modify: `backend/internal/modules/defense_project/ui/dto.go` — add `ProjectJSON` to `UpdateProjectRequest`
- Modify: `backend/internal/modules/defense_project/application/defense_project_service.go` — `UpdateProject` signature + overwrite logic
- Modify: `backend/internal/modules/defense_project/ui/controller.go` — pass `projectJson` through
- Test: `backend/internal/modules/defense_project/application/defense_project_service_update_test.go` (create)

**Frontend BFF (server-side proxy):**
- Create: `frontend/.env.local` — `BACKEND_URL`
- Create: `frontend/src/modules/drone-defense/infra/backend-proxy.ts` — shared fetch+error-map helper
- Create: `frontend/src/app/api/defense/projects/route.ts` — GET list, POST create
- Create: `frontend/src/app/api/defense/projects/[id]/route.ts` — GET, PUT, DELETE

**Frontend types + api-client:**
- Modify: `frontend/src/shared/types/defense-project.ts` — add `VariantSummary`, `VariantListResponse`
- Modify: `frontend/src/modules/drone-defense/infra/api-client.ts` — variant methods

**Frontend store + sync:**
- Modify: `frontend/src/shared/lib/use-defense-project-store.ts` — add `replaceProject`
- Create: `frontend/src/modules/drone-defense/domain/use-defense-variants-store.ts` — variants store
- Test: `frontend/src/modules/drone-defense/domain/use-defense-variants-store.test.ts` (create)

**Frontend UI:**
- Create: `frontend/src/modules/drone-defense/ui/variants-modal.tsx`
- Create: `frontend/src/modules/drone-defense/ui/variant-selector.tsx`
- Modify: `frontend/src/modules/drone-defense/ui/drone-defense-prototype.tsx` — mount selector + modal

---

## Task 1: Backend — `PUT /update` overwrites map content

**Files:**
- Modify: `backend/internal/modules/defense_project/ui/dto.go:117-130`
- Modify: `backend/internal/modules/defense_project/application/defense_project_service.go:308-327`
- Modify: `backend/internal/modules/defense_project/ui/controller.go` (Update handler)
- Test: `backend/internal/modules/defense_project/application/defense_project_service_update_test.go`

**Context:** `UpdateProject(ctx, id, name, enterpriseID)` currently loads the project, updates only name/enterpriseID, and saves. We add an optional `projectJson`. When non-empty, parse it (same `importPayload` used by `Import`/`CreateFromJSON`), validate `schemaVersion`, rebuild the domain object **reusing the existing project ID**, and save. `repo.Save` already enforces optimistic locking via the project's `version`.

- [ ] **Step 1: Add `ProjectJSON` to the update DTO**

In `backend/internal/modules/defense_project/ui/dto.go`, change `UpdateProjectRequest`:

```go
// UpdateProjectRequest DTO запроса на обновление проекта.
// swagger:parameters UpdateProjectRequest
type UpdateProjectRequest struct {
	// ID проекта
	// Required: true
	// In: query
	ID string `json:"id"`
	// Новое имя конфигурации
	// In: body
	Name string `json:"name"`
	// Новый enterprise ID
	// In: body
	EnterpriseID string `json:"enterpriseId"`
	// Полный JSON проекта (DefenseProject). Если передан — перезаписывает содержимое карты.
	// In: body
	ProjectJSON string `json:"projectJson,omitempty"`
}
```

- [ ] **Step 2: Write the failing service test**

Create `backend/internal/modules/defense_project/application/defense_project_service_update_test.go`. Look at an existing test in this package (e.g. an Import or Create test) to copy the exact repo-mock construction and service instantiation; mirror that setup. The test must assert two behaviors:

```go
package application

import (
	"context"
	"testing"
)

// TestUpdateProjectOverwritesContentWhenProjectJSONProvided verifies that
// passing a non-empty projectJson replaces the stored map content (placedObjects)
// while keeping the same project ID.
func TestUpdateProjectOverwritesContentWhenProjectJSONProvided(t *testing.T) {
	// ARRANGE: build a service with an in-memory/mock repo that already holds
	// a project with ID "p1" and zero placedObjects. (Mirror existing test setup.)
	// The new projectJson below has ONE placed object.
	const projectJSON = `{
		"schemaVersion": 1,
		"projectId": "ignored",
		"projectName": "Site Alpha",
		"baseObject": {"id":"o1","name":"Obj","center":{"lat":55.75,"lng":37.61}},
		"layers": [],
		"assetLibrary": [],
		"placedObjects": [
			{"id":"pl1","assetId":"a1","layerId":"l1","coordinates":{"lat":55.76,"lng":37.62},"quantity":1,"status":"planned"}
		],
		"mode": "view",
		"updatedAt": "2026-06-12T14:00:00.000Z"
	}`

	// ACT
	updated, err := svc.UpdateProject(context.Background(), "p1", "Renamed", "", projectJSON)

	// ASSERT
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.ProjectID() != "p1" {
		t.Fatalf("project ID must be preserved, got %s", updated.ProjectID())
	}
	if len(updated.PlacedObjects()) != 1 {
		t.Fatalf("expected content overwrite to 1 placed object, got %d", len(updated.PlacedObjects()))
	}
	if updated.Name() != "Renamed" {
		t.Fatalf("expected name Renamed, got %s", updated.Name())
	}
}

// TestUpdateProjectMetadataOnlyWhenNoProjectJSON verifies backward compatibility:
// empty projectJson updates only metadata, content untouched.
func TestUpdateProjectMetadataOnlyWhenNoProjectJSON(t *testing.T) {
	// ARRANGE: project "p1" with one existing placed object.
	// ACT
	updated, err := svc.UpdateProject(context.Background(), "p1", "OnlyName", "", "")
	// ASSERT
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(updated.PlacedObjects()) != 1 {
		t.Fatalf("content must be untouched, got %d placed objects", len(updated.PlacedObjects()))
	}
	if updated.Name() != "OnlyName" {
		t.Fatalf("expected name OnlyName, got %s", updated.Name())
	}
}
```

Note: replace the `svc` / repo setup comments with the concrete construction copied from a sibling test file in the same package. Confirm the exact getter names (`ProjectID()`, `PlacedObjects()`, `Name()`) against `backend/internal/modules/defense_project/domain/defense_project.go` and adjust if they differ.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && go test ./internal/modules/defense_project/application/ -run TestUpdateProject -v`
Expected: FAIL — compile error (`UpdateProject` takes 4 args, test passes 5) or assertion failure.

- [ ] **Step 4: Implement the overwrite logic**

In `backend/internal/modules/defense_project/application/defense_project_service.go`, replace `UpdateProject`:

```go
func (s *DefenseProjectService) UpdateProject(ctx context.Context, id, name, enterpriseID, projectJSON string) (*domain.DefenseProject, error) {
	project, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if projectJSON != "" {
		var payload importPayload
		if err := json.Unmarshal([]byte(projectJSON), &payload); err != nil {
			return nil, fmt.Errorf("unmarshal project json: %w", err)
		}
		if payload.SchemaVersion != domain.SchemaVersion {
			return nil, domain.ErrInvalidSchemaVersion
		}
		if payload.ProjectName == "" {
			return nil, fmt.Errorf("projectName: %w", domain.ErrInvalidProjectData)
		}

		mode := domain.DefenseProjectModeView
		if payload.Mode != "" {
			mode = domain.DefenseProjectMode(payload.Mode)
		}
		source := domain.DefenseProjectSourceCustom
		if payload.Source != "" {
			source = domain.DefenseProjectSource(payload.Source)
		}

		// Имя из явного аргумента имеет приоритет, иначе из payload, иначе текущее.
		newName := project.Name()
		if payload.Name != "" {
			newName = payload.Name
		}
		if name != "" {
			newName = name
		}
		newEnterpriseID := project.EnterpriseID()
		if payload.EnterpriseID != "" {
			newEnterpriseID = payload.EnterpriseID
		}
		if enterpriseID != "" {
			newEnterpriseID = enterpriseID
		}

		rebuilt, err := domain.NewDefenseProject(
			id, // СОХРАНЯЕМ существующий ID
			newName,
			newEnterpriseID,
			payload.ProjectName,
			domain.NewProtectedObject(
				payload.BaseObject.ID,
				payload.BaseObject.Name,
				domain.NewCoordinates(payload.BaseObject.Center.Lat, payload.BaseObject.Center.Lng),
			),
			mapImportLayers(payload.Layers),
			mapImportAssets(payload.AssetLibrary),
			mapImportPlacedObjects(payload.PlacedObjects),
			payload.ActiveLayerID,
			payload.SelectedAssetID,
			payload.SelectedObjectID,
			mode,
			source,
			payload.BasePresetID,
			time.Now().UTC(),
		)
		if err != nil {
			return nil, err
		}
		// Переносим version для optimistic lock из загруженного проекта.
		rebuilt.SetVersion(project.Version())
		project = rebuilt
	} else {
		if name != "" {
			project.SetName(name)
		}
		if enterpriseID != "" {
			project.SetEnterpriseID(enterpriseID)
		}
	}

	if err := s.repo.Save(ctx, project); err != nil {
		return nil, fmt.Errorf("save project: %w", err)
	}

	return project, nil
}
```

Note: verify the domain has `Version()` getter and a `SetVersion(int)` setter. If `NewDefenseProject` already accepts/sets version, or if `repo.Save` re-reads version differently, adjust to match how `Save` performs the optimistic check (see `defense_project_repository.go` `Save`). If no `SetVersion` exists, find how Import/Create preserve version through Save and mirror it — the requirement is only that the optimistic-lock check still works on overwrite.

- [ ] **Step 5: Update the controller to pass projectJson**

In `backend/internal/modules/defense_project/ui/controller.go`, in the `Update` handler, change the service call:

```go
	project, err := c.service.UpdateProject(ctx, projectID, req.Name, req.EnterpriseID, req.ProjectJSON)
```

- [ ] **Step 6: Update any interface + other callers**

Search for the `UpdateProject` interface declaration and any other callers:

Run: `cd backend && grep -rn "UpdateProject(" internal/`
Update the service interface signature (likely in the same `application` package or a `domain`/port interface) to the new 5-arg form. Build will reveal any missed callers.

- [ ] **Step 7: Run the test to verify it passes + build**

Run: `cd backend && go test ./internal/modules/defense_project/... -run TestUpdateProject -v && go build ./...`
Expected: PASS, build succeeds.

- [ ] **Step 8: Commit (in backend repo)**

```bash
cd backend && git add -A && git commit -m "feat(defense_project): PUT /update overwrites map content when projectJson provided

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend — BACKEND_URL env + shared proxy helper

**Files:**
- Create: `frontend/.env.local`
- Create: `frontend/src/modules/drone-defense/infra/backend-proxy.ts`

**Context:** BFF route handlers run server-side in Next and forward to the Go backend. We centralize the base URL + fetch + error-normalization in one helper so each route handler stays tiny.

- [ ] **Step 1: Create `.env.local`**

Create `frontend/.env.local`:

```
BACKEND_URL=http://localhost:8090/api/v1
NEXT_PUBLIC_DEFENSE_RUNTIME=api
```

(`.env.local` is gitignored by Next's default `.gitignore`; confirm with `cd frontend && git check-ignore .env.local` — it should print the path. If it is NOT ignored, add `.env.local` to `frontend/.gitignore`.)

- [ ] **Step 2: Create the proxy helper**

Create `frontend/src/modules/drone-defense/infra/backend-proxy.ts`:

```typescript
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8090/api/v1";

export type BackendError = {
  code: string;
  message: string;
};

// Maps a backend error response/status into a stable shape for the client.
function mapError(status: number, raw: unknown): BackendError {
  const body = (raw ?? {}) as { code?: string; message?: string; error?: string };
  const code = body.code ?? (status === 404 ? "not_found" : status === 409 ? "version_conflict" : "request_failed");
  const message = body.message ?? body.error ?? `Backend request failed (${status})`;
  return { code, message };
}

// Performs a server-side request to the Go backend.
// Returns parsed JSON on success; throws an object {status, error} on failure.
export async function backendFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw { status: response.status, error: mapError(response.status, parsed) };
  }
  return parsed;
}

// Builds a Next Response from a thrown backendFetch error (or a generic failure).
export function backendErrorResponse(err: unknown): Response {
  const e = err as { status?: number; error?: BackendError };
  const status = e?.status ?? 502;
  const error = e?.error ?? { code: "proxy_error", message: "Failed to reach backend" };
  return Response.json({ error }, { status });
}
```

- [ ] **Step 3: Commit (in frontend repo)**

```bash
cd frontend && git add src/modules/drone-defense/infra/backend-proxy.ts .gitignore 2>/dev/null; git add -A && git commit -m "feat(defense): add backend proxy helper + BACKEND_URL env

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(`.env.local` will not be committed if gitignored — that is expected.)

---

## Task 3: Frontend — BFF route handlers for projects

**Files:**
- Create: `frontend/src/app/api/defense/projects/route.ts`
- Create: `frontend/src/app/api/defense/projects/[id]/route.ts`

**Context:** Mirror the existing route-handler style in `src/app/api/defense/catalog/route.ts`. These forward to the Go endpoints documented in the spec §4. The backend's list path is `/projects`, get is `/projects/get?id=`, update is `/projects/update?id=`, delete is `/projects/delete?id=`.

- [ ] **Step 1: Create collection route (list + create)**

Create `frontend/src/app/api/defense/projects/route.ts`:

```typescript
import { backendFetch, backendErrorResponse } from "@/modules/drone-defense/infra/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  try {
    const data = await backendFetch(`/projects${qs ? `?${qs}` : ""}`);
    return Response.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const data = await backendFetch(`/projects`, { method: "POST", body });
    return Response.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
```

- [ ] **Step 2: Create item route (get + put + delete)**

Create `frontend/src/app/api/defense/projects/[id]/route.ts`:

```typescript
import { backendFetch, backendErrorResponse } from "@/modules/drone-defense/infra/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const data = await backendFetch(`/projects/get?id=${encodeURIComponent(id)}`);
    return Response.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await request.text();
  try {
    const data = await backendFetch(`/projects/update?id=${encodeURIComponent(id)}`, { method: "PUT", body });
    return Response.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const data = await backendFetch(`/projects/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return Response.json(data);
  } catch (err) {
    return backendErrorResponse(err);
  }
}
```

(Note: `params` is a Promise in the installed Next version — confirm by checking another dynamic route if one exists, e.g. `grep -rn "params" src/app`. If `params` is synchronous in this version, drop the `await` and the `Promise<>` wrapper.)

- [ ] **Step 3: Verify build/typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors in the new files.

- [ ] **Step 4: Smoke test against the running backend**

With the Go backend running on `:8090`, run frontend dev (`cd frontend && pnpm dev`) in another terminal, then:

Run: `curl -s http://localhost:3000/api/defense/projects | head -c 400`
Expected: a JSON object with `items` and `totalItems` (empty list is fine: `{"items":[],"totalItems":0}` or similar). If you get a 502/proxy_error, the backend isn't reachable at `BACKEND_URL`.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add -A && git commit -m "feat(defense): add BFF route handlers proxying projects CRUD to backend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — variant types + api-client methods

**Files:**
- Modify: `frontend/src/shared/types/defense-project.ts`
- Modify: `frontend/src/modules/drone-defense/infra/api-client.ts`

**Context:** The backend's `ProjectResponse` is the summary shape; `GET /projects/get` returns the full serialized `DefenseProject`. We add summary types and five api-client methods. `exportDefenseProjectJson(project)` already exists (used by the project store's `persist`) — reuse it to serialize the project for POST/PUT bodies.

- [ ] **Step 1: Add summary types**

In `frontend/src/shared/types/defense-project.ts`, append:

```typescript
export type VariantSummary = {
  projectId: string;
  name: string;
  projectName: string;
  version: number;
  updatedAt: string;
};

export type VariantListResponse = {
  items: VariantSummary[];
  totalItems: number;
};
```

- [ ] **Step 2: Add api-client methods**

In `frontend/src/modules/drone-defense/infra/api-client.ts`, add imports and functions. First confirm the export name of the serializer:

Run: `cd frontend && grep -rn "export function exportDefenseProjectJson\|export const exportDefenseProjectJson" src/`

Then append (adjust the import path/name to match what the grep found):

```typescript
import type { DefenseProject, VariantSummary, VariantListResponse } from "@/shared/types/defense-project";
import { exportDefenseProjectJson } from "@/shared/lib/defense-project-serialization"; // adjust path to grep result

export function listVariants(): Promise<VariantListResponse> {
  return readJson<VariantListResponse>("/api/defense/projects");
}

export function loadVariant(id: string): Promise<DefenseProject> {
  return readJson<DefenseProject>(`/api/defense/projects/${encodeURIComponent(id)}`);
}

export function saveVariantAsNew(args: { name: string; project: DefenseProject }): Promise<VariantSummary> {
  return readJson<VariantSummary>("/api/defense/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: args.name, projectJson: exportDefenseProjectJson(args.project) }),
  });
}

export function overwriteVariant(args: { id: string; name: string; project: DefenseProject }): Promise<VariantSummary> {
  return readJson<VariantSummary>(`/api/defense/projects/${encodeURIComponent(args.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: args.name, projectJson: exportDefenseProjectJson(args.project) }),
  });
}

export function deleteVariant(id: string): Promise<{ status: string }> {
  return readJson<{ status: string }>(`/api/defense/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
```

Note: `readJson` (already in this file) throws `Error("API request failed: <status>")` on non-2xx. That is sufficient for FRT-18 error display. The version_conflict (409) richer UX is FRT-47.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add -A && git commit -m "feat(defense): add variant summary types + api-client CRUD methods

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — `replaceProject` action in project store

**Files:**
- Modify: `frontend/src/shared/lib/use-defense-project-store.ts`
- Test: extend `frontend/src/modules/drone-defense/domain/use-defense-variants-store.test.ts` is created in Task 6; the unit check here is a direct store test below.

**Context:** The store already has a private `applyProject(project, set)` helper that persists + sets `project` + syncs selection. We expose a public `replaceProject` action that does a clean full replace (no merge), which is what loading a variant needs.

- [ ] **Step 1: Add `replaceProject` to the state type**

In `frontend/src/shared/lib/use-defense-project-store.ts`, in the `DefenseProjectState` type (near the other action declarations around line 80-86), add:

```typescript
  replaceProject: (project: DefenseProject) => void;
```

- [ ] **Step 2: Implement the action**

In the store body (where the other actions are defined), add:

```typescript
    replaceProject: (project) => applyProject(project, set),
```

`applyProject` already calls `persist` + sets `project` + `budgetApplied: false` + `syncSelection`. This guarantees a full replace with no leftover state from the previous variant.

- [ ] **Step 3: Write a focused test**

Create/extend a test file `frontend/src/shared/lib/use-defense-project-store.replace.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseProject } from "@/shared/types/defense-project";

function minimalProject(id: string, placedCount: number): DefenseProject {
  return {
    schemaVersion: 1,
    projectId: id,
    projectName: `proj-${id}`,
    baseObject: { id: "o1", name: "Obj", center: { lat: 55.75, lng: 37.61 } },
    layers: [],
    assetLibrary: [],
    placedObjects: Array.from({ length: placedCount }, (_, i) => ({
      id: `pl-${id}-${i}`,
      assetId: "a1",
      layerId: "l1",
      coordinates: { lat: 55.76, lng: 37.62 },
      quantity: 1,
      status: "planned",
    })) as DefenseProject["placedObjects"],
    mode: "view",
    updatedAt: "2026-06-12T14:00:00.000Z",
  };
}

describe("replaceProject", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });

  it("fully replaces project state with no leftover placed objects", () => {
    const store = useDefenseProjectStore.getState();
    store.replaceProject(minimalProject("A", 3));
    expect(useDefenseProjectStore.getState().project.placedObjects).toHaveLength(3);

    store.replaceProject(minimalProject("B", 1));
    const after = useDefenseProjectStore.getState().project;
    expect(after.projectId).toBe("B");
    expect(after.placedObjects).toHaveLength(1);
    expect(after.placedObjects.every((p) => p.id.startsWith("pl-B"))).toBe(true);
  });
});
```

Adjust the `minimalProject` shape if the actual `DefenseProject`/`PlacedDefenseObject` types require additional required fields (the typecheck in Step 5 will tell you).

- [ ] **Step 4: Run the test to verify it fails then passes**

Run: `cd frontend && pnpm exec vitest run src/shared/lib/use-defense-project-store.replace.test.ts`
Expected: FAIL before Steps 1-2 are applied (method missing); PASS after.

- [ ] **Step 5: Typecheck + commit**

Run: `cd frontend && pnpm exec tsc --noEmit`

```bash
cd frontend && git add -A && git commit -m "feat(defense): add replaceProject action for full variant load

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — `useDefenseVariantsStore`

**Files:**
- Create: `frontend/src/modules/drone-defense/domain/use-defense-variants-store.ts`
- Test: `frontend/src/modules/drone-defense/domain/use-defense-variants-store.test.ts`

**Context:** This store owns the variants list + active-variant identity + status flags. On `loadVariant`, it calls `useDefenseProjectStore.getState().replaceProject(...)` (map + calculator recompute automatically because both read from the project store) and resets the studio store's `selectedPlacementId`. It calls the api-client methods from Task 4.

- [ ] **Step 1: Write the failing store test**

Create `frontend/src/modules/drone-defense/domain/use-defense-variants-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/modules/drone-defense/infra/api-client", () => ({
  listVariants: vi.fn(),
  loadVariant: vi.fn(),
  saveVariantAsNew: vi.fn(),
  overwriteVariant: vi.fn(),
  deleteVariant: vi.fn(),
}));

import * as api from "@/modules/drone-defense/infra/api-client";
import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";
import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseProject, VariantSummary } from "@/shared/types/defense-project";

function project(id: string): DefenseProject {
  return {
    schemaVersion: 1, projectId: id, projectName: id,
    baseObject: { id: "o", name: "o", center: { lat: 1, lng: 1 } },
    layers: [], assetLibrary: [], placedObjects: [], mode: "view",
    updatedAt: "2026-06-12T14:00:00.000Z",
  };
}
const summary = (id: string): VariantSummary => ({
  projectId: id, name: `name-${id}`, projectName: id, version: 1, updatedAt: "2026-06-12T14:00:00.000Z",
});

describe("useDefenseVariantsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDefenseVariantsStore.setState({
      variants: [], activeVariantId: null, activeVariantName: null,
      listStatus: "idle", saveStatus: "idle", loadStatus: "idle", error: null,
    });
  });

  it("fetchVariants populates list", async () => {
    (api.listVariants as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [summary("A")], totalItems: 1 });
    await useDefenseVariantsStore.getState().fetchVariants();
    expect(useDefenseVariantsStore.getState().variants).toHaveLength(1);
    expect(useDefenseVariantsStore.getState().listStatus).toBe("idle");
  });

  it("saveAsNewVariant sets it active", async () => {
    (api.saveVariantAsNew as ReturnType<typeof vi.fn>).mockResolvedValue(summary("A"));
    (api.listVariants as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [summary("A")], totalItems: 1 });
    await useDefenseVariantsStore.getState().saveAsNewVariant("name-A");
    expect(useDefenseVariantsStore.getState().activeVariantId).toBe("A");
    expect(useDefenseVariantsStore.getState().activeVariantName).toBe("name-A");
  });

  it("loadVariant replaces project and sets active identity", async () => {
    (api.loadVariant as ReturnType<typeof vi.fn>).mockResolvedValue(project("B"));
    await useDefenseVariantsStore.getState().loadVariant("B");
    expect(useDefenseProjectStore.getState().project.projectId).toBe("B");
    expect(useDefenseVariantsStore.getState().activeVariantId).toBe("B");
  });

  it("deleteVariant clears active identity when deleting the active variant", async () => {
    useDefenseVariantsStore.setState({ activeVariantId: "B", activeVariantName: "name-B" });
    (api.deleteVariant as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ok" });
    (api.listVariants as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], totalItems: 0 });
    await useDefenseVariantsStore.getState().deleteVariant("B");
    expect(useDefenseVariantsStore.getState().activeVariantId).toBeNull();
  });

  it("sets error status on save failure", async () => {
    (api.saveVariantAsNew as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    await useDefenseVariantsStore.getState().saveAsNewVariant("x");
    expect(useDefenseVariantsStore.getState().saveStatus).toBe("error");
    expect(useDefenseVariantsStore.getState().error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm exec vitest run src/modules/drone-defense/domain/use-defense-variants-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `frontend/src/modules/drone-defense/domain/use-defense-variants-store.ts`:

```typescript
import { create } from "zustand";

import {
  deleteVariant as apiDeleteVariant,
  listVariants as apiListVariants,
  loadVariant as apiLoadVariant,
  overwriteVariant as apiOverwriteVariant,
  saveVariantAsNew as apiSaveVariantAsNew,
} from "@/modules/drone-defense/infra/api-client";
import { useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import { useDefenseStudioStore } from "@/modules/drone-defense/domain/use-defense-studio-store";
import type { VariantSummary } from "@/shared/types/defense-project";

type Status = "idle" | "loading" | "error";

type VariantsState = {
  variants: VariantSummary[];
  activeVariantId: string | null;
  activeVariantName: string | null;
  listStatus: Status;
  saveStatus: "idle" | "saving" | "error";
  loadStatus: Status;
  error: string | null;

  fetchVariants: () => Promise<void>;
  saveAsNewVariant: (name: string) => Promise<void>;
  overwriteActiveVariant: () => Promise<void>;
  loadVariant: (id: string) => Promise<void>;
  deleteVariant: (id: string) => Promise<void>;
};

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Операция не удалась";
}

export const useDefenseVariantsStore = create<VariantsState>((set, get) => ({
  variants: [],
  activeVariantId: null,
  activeVariantName: null,
  listStatus: "idle",
  saveStatus: "idle",
  loadStatus: "idle",
  error: null,

  fetchVariants: async () => {
    set({ listStatus: "loading", error: null });
    try {
      const res = await apiListVariants();
      set({ variants: res.items, listStatus: "idle" });
    } catch (err) {
      set({ listStatus: "error", error: message(err) });
    }
  },

  saveAsNewVariant: async (name) => {
    set({ saveStatus: "saving", error: null });
    try {
      const project = useDefenseProjectStore.getState().project;
      const summary = await apiSaveVariantAsNew({ name, project });
      set({
        saveStatus: "idle",
        activeVariantId: summary.projectId,
        activeVariantName: summary.name,
      });
      await get().fetchVariants();
    } catch (err) {
      set({ saveStatus: "error", error: message(err) });
    }
  },

  overwriteActiveVariant: async () => {
    const { activeVariantId, activeVariantName } = get();
    if (!activeVariantId) return;
    set({ saveStatus: "saving", error: null });
    try {
      const project = useDefenseProjectStore.getState().project;
      const summary = await apiOverwriteVariant({
        id: activeVariantId,
        name: activeVariantName ?? project.projectName,
        project,
      });
      set({ saveStatus: "idle", activeVariantName: summary.name });
      await get().fetchVariants();
    } catch (err) {
      set({ saveStatus: "error", error: message(err) });
    }
  },

  loadVariant: async (id) => {
    set({ loadStatus: "loading", error: null });
    try {
      const project = await apiLoadVariant(id);
      useDefenseProjectStore.getState().replaceProject(project);
      // Map + calculator read from the project store and recompute automatically.
      // Only the studio store's transient selection needs clearing.
      useDefenseStudioStore.setState({ selectedPlacementId: null });
      set({
        loadStatus: "idle",
        activeVariantId: project.projectId,
        activeVariantName: project.projectName,
      });
    } catch (err) {
      set({ loadStatus: "error", error: message(err) });
    }
  },

  deleteVariant: async (id) => {
    set({ error: null });
    try {
      await apiDeleteVariant(id);
      if (get().activeVariantId === id) {
        set({ activeVariantId: null, activeVariantName: null });
      }
      await get().fetchVariants();
    } catch (err) {
      set({ error: message(err) });
    }
  },
}));
```

Note on `activeVariantName` after load: the backend's full-project payload uses `projectName` (the site name), while the variant's display `name` is metadata. For the selector we want the variant `name`. After `loadVariant`, the list (from `fetchVariants`) contains the matching `VariantSummary.name`; if you want the exact variant name immediately, set `activeVariantName` from `get().variants.find(v => v.projectId === id)?.name ?? project.projectName`. Use that refinement if the list is already loaded; otherwise `project.projectName` is an acceptable fallback for FRT-18.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && pnpm exec vitest run src/modules/drone-defense/domain/use-defense-variants-store.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Typecheck + commit**

Run: `cd frontend && pnpm exec tsc --noEmit`

```bash
cd frontend && git add -A && git commit -m "feat(defense): add variants store with save/load/delete + project sync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — variants modal component

**Files:**
- Create: `frontend/src/modules/drone-defense/ui/variants-modal.tsx`

**Context:** A modal listing variants with load/delete actions, a name input + "save as new", and empty/loading/saving/error states. Use antd (already a dependency: `Modal`, `Input`, `Button`, `List`, `Spin`, `Alert`) to match the codebase. Check an existing UI component for the exact antd import style before writing (`grep -rn "from \"antd\"" src/modules/drone-defense/ui | head`).

- [ ] **Step 1: Implement the modal**

Create `frontend/src/modules/drone-defense/ui/variants-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, List, Modal, Spin } from "antd";

import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function VariantsModal({ open, onClose }: Props) {
  const {
    variants,
    activeVariantId,
    listStatus,
    saveStatus,
    error,
    fetchVariants,
    saveAsNewVariant,
    loadVariant,
    deleteVariant,
  } = useDefenseVariantsStore();

  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) fetchVariants();
  }, [open, fetchVariants]);

  const saving = saveStatus === "saving";

  return (
    <Modal title="Варианты конфигурации" open={open} onCancel={onClose} footer={null}>
      {error ? <Alert type="error" message={error} style={{ marginBottom: 12 }} /> : null}

      {listStatus === "loading" ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin /> <span style={{ marginLeft: 8 }}>Загрузка списка…</span>
        </div>
      ) : variants.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
          Пока нет сохранённых вариантов. Сохраните текущую карту как первый вариант ниже.
        </div>
      ) : (
        <List
          dataSource={variants}
          rowKey={(v) => v.projectId}
          renderItem={(v) => (
            <List.Item
              style={v.projectId === activeVariantId ? { background: "#eff6ff" } : undefined}
              actions={[
                <Button key="load" type="link" onClick={() => loadVariant(v.projectId).then(onClose)}>
                  Загрузить
                </Button>,
                <Button key="del" type="link" danger onClick={() => deleteVariant(v.projectId)}>
                  Удалить
                </Button>,
              ]}
            >
              <List.Item.Meta title={v.name} description={`v${v.version} · ${new Date(v.updatedAt).toLocaleDateString("ru-RU")}`} />
            </List.Item>
          )}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Input
          placeholder="Имя нового варианта…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={saving}
        />
        <Button
          type="primary"
          loading={saving}
          disabled={!newName.trim()}
          onClick={() => saveAsNewVariant(newName.trim()).then(() => setNewName(""))}
        >
          Сохранить как новый
        </Button>
      </div>
    </Modal>
  );
}
```

Note: verify antd v6 `Modal`/`List` prop names (`open`, `footer={null}`) against an existing modal in the repo; antd 6 uses `open` (not `visible`). The repo is on `antd ^6.3.7` so `open` is correct.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add -A && git commit -m "feat(defense): add variants modal UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend — bar selector + wire into prototype

**Files:**
- Create: `frontend/src/modules/drone-defense/ui/variant-selector.tsx`
- Modify: `frontend/src/modules/drone-defense/ui/drone-defense-prototype.tsx`

**Context:** The selector shows the active variant name (or "Черновик") with a status dot, opens the modal, and exposes "Сохранить" (overwrite, disabled when no active variant) + "Сохранить как…" (opens the modal focused on the create input). Mount it in the prototype's top bar. Find the top bar markup first (`grep -n "FORTIS\|header\|top" src/modules/drone-defense/ui/drone-defense-prototype.tsx | head`).

- [ ] **Step 1: Implement the selector**

Create `frontend/src/modules/drone-defense/ui/variant-selector.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "antd";

import { useDefenseVariantsStore } from "@/modules/drone-defense/domain/use-defense-variants-store";
import { VariantsModal } from "@/modules/drone-defense/ui/variants-modal";

export function VariantSelector() {
  const { activeVariantId, activeVariantName, saveStatus, overwriteActiveVariant } = useDefenseVariantsStore();
  const [open, setOpen] = useState(false);

  const isDraft = !activeVariantId;
  const saving = saveStatus === "saving";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0",
          padding: "6px 10px", borderRadius: 8, cursor: "pointer",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: isDraft ? "#f59e0b" : "#22c55e" }} />
        <span style={{ fontWeight: 600 }}>{isDraft ? "Черновик (не сохранён)" : activeVariantName}</span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      <Button size="small" type="primary" disabled={isDraft || saving} loading={saving} onClick={() => overwriteActiveVariant()}>
        Сохранить
      </Button>
      <Button size="small" onClick={() => setOpen(true)}>
        Сохранить как…
      </Button>

      <VariantsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Mount in the prototype top bar**

In `frontend/src/modules/drone-defense/ui/drone-defense-prototype.tsx`:

Add the import near the other UI imports:

```tsx
import { VariantSelector } from "@/modules/drone-defense/ui/variant-selector";
```

Place `<VariantSelector />` in the top bar region (the header row that contains the brand/title and the link to the calculator). Insert it as a sibling there:

```tsx
<VariantSelector />
```

(Use the grep from the Context to find the exact JSX node for the top bar; mount the selector inside that flex row so it sits alongside the existing controls.)

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add -A && git commit -m "feat(defense): add variant selector to prototype top bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: End-to-end manual verification against the real backend

**Files:** none (verification only).

**Context:** Confirm all acceptance criteria from spec §6 with the Go backend running on `:8090` and frontend dev on `:3000` (`NEXT_PUBLIC_DEFENSE_RUNTIME=api` set in `.env.local`).

- [ ] **Step 1: Start both services**

Backend: `cd backend && make run` (or the documented dev command; Air is configured).
Frontend: `cd frontend && pnpm dev`.

- [ ] **Step 2: Verify save A → modify → save B → return to A**

1. On `/prototype/`, place some objects. Open the selector → "Сохранить как…" → name "План А" → save. The bar shows "План А" with a green dot.
2. Modify the map (move/add an object). Open modal → "Сохранить как новый" → "План Б". Bar shows "План Б".
3. Open modal → list shows both → "Загрузить" on "План А". The map reverts to A's objects; bar shows "План А".

Expected: A's exact placed objects return; no B objects remain (no mixing).

- [ ] **Step 3: Verify calculator reflects the loaded variant**

Navigate to `/calculator/` after loading "План А". KPI/inputs reflect A's configuration (the calculator reads from the project store, which `replaceProject` updated).

- [ ] **Step 4: Verify compound (МОГ) data survives**

If a placed object has a `compoundProfile` (azimuth/sector), confirm it is present after save+load (inspect via the object's panel or the exported JSON).

- [ ] **Step 5: Verify error states**

Stop the backend, then try to save/load. The modal shows a red error banner with a readable message; the empty list and loading spinner appear in the right conditions.

- [ ] **Step 6: Final commit / branch note**

All functional commits already landed per task. Confirm the frontend feature branch holds Tasks 2-8 and the backend repo holds Task 1. If the work was done on `develop`, create the feature branch and move commits as needed (coordinate with the user before pushing).

---

## Self-Review notes (for the executor)

- **Spec §2 decisions** all mapped: model (Task 1+4+6), UI placement (Task 7+8), save semantics (Task 6 `saveAsNewVariant`/`overwriteActiveVariant`, Task 8 button enable/disable), sync (Task 6 `loadVariant` + reactive recompute), backend connection (Task 2+3).
- **Spec §6 AC** all covered by Task 9 steps 2-5.
- **MOG boundary:** no МОГ-specific UI added; `compoundProfile` rides inside `DefenseProject` through serialize/replace — verified in Task 9 step 4.
- **Out of scope kept out:** no 409-merge UX (only error text), no comparison, no budget mode.
- **Assumptions the executor must confirm against code (flagged inline):** domain getter/setter names (`Version()`/`SetVersion()`, `PlacedObjects()`), the `exportDefenseProjectJson` import path, whether Next `params` is a Promise in this version, the exact `DefenseProject`/`PlacedDefenseObject` required fields for test fixtures, and the prototype top-bar JSON node.
