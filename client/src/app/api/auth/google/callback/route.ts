import { forwardAuthRequest } from "../../_lib";

export async function GET(request: Request) {
  return forwardAuthRequest("/auth/google/callback", request, {
    method: "GET",
    storeToken: true,
  });
}
