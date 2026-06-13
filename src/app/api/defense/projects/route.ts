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
