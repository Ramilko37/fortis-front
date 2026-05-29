import { evaluateDefense } from "@/modules/drone-defense/infra/mock-defense-repository";
import type { EvaluateRequest } from "@/shared/types/drone-defense";

export const dynamic = "force-static";

export async function POST(request: Request) {
  const payload = (await request.json()) as EvaluateRequest;
  if (!payload?.configuration || !payload.scope) {
    return Response.json({ error: "configuration and scope are required" }, { status: 400 });
  }

  const result = await evaluateDefense(payload);
  return Response.json(result);
}
