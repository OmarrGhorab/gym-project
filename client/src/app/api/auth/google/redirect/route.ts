import { NextResponse } from "next/server";
import { buildApiUrl } from "../../_lib";
import { getRequestedGoogleAuthLocale, setGoogleAuthLocale } from "../_lib";

const GOOGLE_REDIRECT_PATH = "/auth/google/redirect";

export function GET(request: Request) {
  const locale = getRequestedGoogleAuthLocale(request);
  const response = NextResponse.redirect(buildApiUrl(GOOGLE_REDIRECT_PATH));

  setGoogleAuthLocale(response, locale);
  return response;
}
