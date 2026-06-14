// Run: pnpm exec tsx src/modules/drone-defense/infra/enterprise-api.test.ts

import {
  buildEnterpriseGetUrl,
  buildEnterpriseListUrl,
  normalizeEnterprisePayload,
} from "@/modules/drone-defense/infra/enterprise-api";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const listUrl = buildEnterpriseListUrl({
  limit: 25,
  offset: 10,
});

assert(
  listUrl === "/api/v1/enterprises?limit=25&offset=10",
  `enterprise list URL must keep backend query names, got ${listUrl}`,
);

const getUrl = buildEnterpriseGetUrl("enterprise-1");
assert(
  getUrl === "/api/v1/enterprises?id=enterprise-1",
  `enterprise get URL must use query id parameter, got ${getUrl}`,
);

const normalized = normalizeEnterprisePayload({
  id: "enterprise-1",
  name: "АО Северный терминал",
  address: "Екатеринбург",
  status: "active",
  latitude: 56.8389,
  longitude: 60.6057,
});

assert(normalized.id === "enterprise-1", "normalizer must keep backend enterprise id as baseObject id");
assert(normalized.enterpriseId === "enterprise-1", "normalizer must expose enterpriseId for downstream FE filters");
assert(normalized.name === "АО Северный терминал", "normalizer must keep backend enterprise name");
assert(normalized.address === "Екатеринбург", "normalizer must keep backend address metadata");
assert(normalized.status === "active", "normalizer must keep backend status metadata");
assert(normalized.center.lat === 56.8389, "normalizer must map latitude to baseObject center.lat");
assert(normalized.center.lng === 60.6057, "normalizer must map longitude to baseObject center.lng");
assert(normalized.source === "backend", "normalizer must tag backend-backed base objects");

console.log("enterprise-api.test.ts: enterprise API contracts passed");
