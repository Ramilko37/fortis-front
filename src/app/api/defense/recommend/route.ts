import { recommendDefense } from "@/modules/drone-defense/infra/mock-defense-repository";
import type { RecommendRequest } from "@/shared/types/drone-defense";

export const dynamic = "force-static";

export async function POST(request: Request) {
  const payload = (await request.json()) as RecommendRequest;
  if (!payload?.configuration || typeof payload?.budgetRub !== "number") {
    return Response.json({ error: "configuration and budgetRub are required" }, { status: 400 });
  }

  const result = await recommendDefense(payload);
  return Response.json(result);
}
