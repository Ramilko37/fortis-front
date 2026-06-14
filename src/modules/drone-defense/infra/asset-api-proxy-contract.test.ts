// Run: pnpm exec tsx src/modules/drone-defense/infra/asset-api-proxy-contract.test.ts

import nextConfig from "../../../../next.config";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type RewriteRule = {
  source: string;
  destination: string;
};

async function readRewriteRules(): Promise<RewriteRule[]> {
  assert(typeof nextConfig.rewrites === "function", "next.config must define rewrites for backend API proxy");
  const rewrites = await nextConfig.rewrites();
  if (Array.isArray(rewrites)) return rewrites as RewriteRule[];
  return [
    ...(rewrites.beforeFiles ?? []),
    ...(rewrites.afterFiles ?? []),
    ...(rewrites.fallback ?? []),
  ] as RewriteRule[];
}

async function runProxyContract() {
  const rules = await readRewriteRules();

  assert(
    nextConfig.skipTrailingSlashRedirect === true,
    "Next config must disable automatic trailing slash redirects for backend API routes",
  );

  assert(
    rules.some((rule) => rule.source === "/api/v1/enterprises" && rule.destination === "http://localhost:8090/api/v1/enterprises"),
    "enterprise list/get route must proxy same-origin /api/v1/enterprises to backend without a trailing slash",
  );

  assert(
    rules.some((rule) => rule.source === "/api/v1/assets" && rule.destination === "http://localhost:8090/api/v1/assets"),
    "asset list/create route must proxy same-origin /api/v1/assets to backend without a trailing slash",
  );

  assert(
    rules.some((rule) => rule.source === "/api/v1/assets/get" && rule.destination === "http://localhost:8090/api/v1/assets/get"),
    "asset get route must proxy to backend /api/v1/assets/get",
  );

  assert(
    rules.some((rule) => rule.source === "/api/v1/assets/update" && rule.destination === "http://localhost:8090/api/v1/assets/update"),
    "asset update route must proxy to backend /api/v1/assets/update",
  );

  assert(
    rules.some((rule) => rule.source === "/api/v1/assets/delete" && rule.destination === "http://localhost:8090/api/v1/assets/delete"),
    "asset delete route must proxy to backend /api/v1/assets/delete",
  );
}

runProxyContract()
  .then(() => {
    console.log("asset-api-proxy-contract.test.ts: Next asset API proxy contract passed");
  })
  .catch((error) => {
    throw error;
  });
