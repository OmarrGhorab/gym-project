import { forwardAuthRequest } from "../_lib";

export async function POST(request: Request) {
  return forwardAuthRequest("/auth/verify-email", request, { storeToken: true });
}
