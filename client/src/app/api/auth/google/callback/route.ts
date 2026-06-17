import type { NextRequest } from "next/server";
import { forwardAuthRequest } from "../../_lib";
import { clearGoogleAuthLocale, getGoogleAuthLocale } from "../_lib";

const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

export async function GET(request: NextRequest) {
  const locale = getGoogleAuthLocale(request);
  const response = await forwardAuthRequest(GOOGLE_CALLBACK_PATH, request, {
    method: "GET",
    storeToken: true,
    successRedirect: `/${locale}`,
    failureRedirect: `/${locale}/login`,
  });

  clearGoogleAuthLocale(response);
  return response;
}
