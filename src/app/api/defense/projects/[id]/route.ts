import { backendFetch, backendErrorResponse } from "@/modules/drone-defense/infra/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const data = await backendFetch(`/projects/export?id=${encodeURIComponent(id)}`);
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
