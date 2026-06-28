import { forwardAuthRequest } from "../_lib";

export async function POST(request: Request) {
  return forwardAuthRequest("/auth/login", request, { storeToken: true });
}
