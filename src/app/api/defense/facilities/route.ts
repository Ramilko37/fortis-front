import { getFacilities } from "@/modules/drone-defense/infra/mock-defense-repository";

export const dynamic = "force-static";

export async function GET() {
  const items = await getFacilities();
  return Response.json(items);
}
