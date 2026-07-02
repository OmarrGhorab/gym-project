import { isValidRouteId, proxyMedia } from "@/lib/api/media-proxy";
import { getAuthToken } from "@/lib/session";

export async function GET(_request: Request, context: RouteContext<"/api/media/members/[id]/photo">) {
  const token = await getAuthToken();
  const { id } = await context.params;

  if (!token) {
    return Response.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  if (!isValidRouteId(id)) {
    return Response.json({ error: { message: "Invalid member id." } }, { status: 400 });
  }

  return proxyMedia(`/members/${id}/photo`, token);
}
