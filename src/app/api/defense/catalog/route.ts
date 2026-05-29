import { getCatalog } from "@/modules/drone-defense/infra/mock-defense-repository";

export const dynamic = "force-static";

export async function GET() {
  const catalog = await getCatalog();
  return Response.json(catalog);
}
