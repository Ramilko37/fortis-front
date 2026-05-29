import { getLayers } from "@/modules/drone-defense/infra/mock-defense-repository";
import type { DefenseScenarioId } from "@/shared/types/drone-defense";

export const dynamic = "force-static";

const scenarioIds: DefenseScenarioId[] = ["baseline", "balanced", "reinforced"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get("facilityId");
  const scenarioId = searchParams.get("scenarioId");

  if (!facilityId || !scenarioId || !scenarioIds.includes(scenarioId as DefenseScenarioId)) {
    return Response.json(
      { error: "facilityId and scenarioId are required" },
      { status: 400 },
    );
  }

  const layers = await getLayers(facilityId, scenarioId as DefenseScenarioId);
  return Response.json(layers);
}
