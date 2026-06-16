import { forwardAuthRequest } from "../_lib";

export async function POST(request: Request) {
  return forwardAuthRequest("/auth/reset-password", request);
}
