<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project Architecture

Lightweight FSD-inspired structure. Two roots inside `src/`:

```
src/
├── app/                  # Next.js App Router (routing only — no logic here)
│   ├── layout.tsx
│   ├── globals.css
│   └── [route]/
│       └── page.tsx      # thin: just imports and renders a module
│
├── shared/               # Truly global, project-wide utilities
│   ├── ui/               # Generic UI primitives (Button, Input, Badge…)
│   ├── config/           # Env vars, constants, feature flags
│   ├── lib/              # Pure helpers (cn, formatDate, etc.)
│   └── types/            # Global TS types shared across modules
│
└── modules/              # Features and pages, one folder per slice
    └── [module-name]/
        ├── ui/           # React components for this module
        ├── domain/       # Store, business logic, business hooks
        └── infra/        # API calls, request hooks, backend types
```

## Rules

**`app/` pages are thin.** A page file does one thing — imports the module's root component and renders it. No logic, no hooks.

```tsx
// src/app/prototype/page.tsx
import { DroneDefensePrototype } from "@/modules/drone-defense/ui/drone-defense-prototype";
export default function Page() {
  return <DroneDefensePrototype />;
}
```

**`shared/` has no dependency on `modules/`.** Shared code must not import anything from `modules/`. Modules can import from `shared/`, never the reverse.

**Module layers import strictly downward.**

```
ui  →  domain  →  infra
```

- `ui` may import from `domain` and `infra`
- `domain` may import from `infra`
- `infra` imports only from `shared/` or external packages
- No circular imports between layers

**`infra/` owns the backend boundary.** Backend types, API clients, and data-fetching hooks live here. Components never call fetch directly.

**`domain/` owns state and business rules.** Zustand stores, business-logic hooks (`useScenario`, `useObjectSelection`), derived state. No JSX, no fetch.

**`ui/` owns rendering.** Components, CSS modules, layout. Reads from `domain`, calls `infra` through `domain` hooks.

**Cross-module imports are allowed but kept minimal.** If module A needs something from module B's `domain` or `infra`, extract it to `shared/` instead.

## Where the current prototype fits

```
src/modules/drone-defense/
├── ui/
│   ├── drone-defense-prototype.tsx   ← root component / layout
│   ├── scene.tsx                     ← Three.js canvas
│   ├── topbar.tsx
│   ├── assets-panel.tsx
│   ├── properties-panel.tsx
│   ├── status-bar.tsx
│   └── drone-defense-prototype.module.css
└── domain/
    └── types.ts                      ← SceneObject, ScenarioId, presets
```

> `infra/` is empty for now — the prototype has no backend calls yet.

---

# neuraldeep.api — Model Rate Limits

**Mandatory for any agent, integration, script, CI job, or automation that uses models routed through `neuraldeep.api`.**

Models under `neuraldeep.api` enforce **~5 requests per minute** (resets every minute). Every HTTP call to the model endpoint counts separately: chat completion, streaming chunk requests, status polls, retries, etc. A single agent turn can run for minutes internally; your outbound API calls still consume the budget.

This section does **not** replace provider-specific docs — it is the project rule for staying within the neuraldeep.api quota.

## Required patterns

**Reuse conversation context — do not open a new session per step.**

```
❌ new request → poll → poll → new request → poll …
✅ one session → stream/wait → follow-up on same context → wait
```

- Send follow-up prompts on an existing agent/session when possible; avoid redundant cold starts.
- Prefer **one streaming connection** or a single long-lived wait over manual polling loops.
- If polling is unavoidable: **≥30–60 s** between status checks until the run is terminal.

**Client-side throttling is mandatory.** Target **≤4 req/min** to stay under the limit:

- Serialize requests through a token-bucket or queue (one worker per API key / credential).
- Never run parallel jobs/workers against the same neuraldeep.api credential.
- On `429`: honor `Retry-After`, then exponential backoff (1s → 2s → 4s → 8s). Do not blind-retry — duplicate requests can spawn duplicate agent runs.

**Cache aggressively.**

- Cache static lookups (repos, model lists, config) for hours; do not re-fetch before every call.
- Persist terminal results locally; do not re-fetch completed responses.

## Forbidden

- Polling more often than every 30 seconds.
- Opening a new session when a follow-up on an existing one would work.
- Burst retries immediately after `429`.
- Multiple concurrent integrations sharing one neuraldeep.api credential without a shared rate limiter.

## Queue architecture (when throughput > 5 RPM is needed)

```
Trigger (webhook / CI) → queue → single worker (≤4 req/min) → neuraldeep.api
```

Do not fan out parallel agent launches against the same credential.
