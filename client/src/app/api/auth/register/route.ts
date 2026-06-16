import { forwardAuthRequest } from "../_lib";

export async function POST(request: Request) {
  return forwardAuthRequest("/auth/register", request, { storeToken: true });
}
