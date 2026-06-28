import { NextResponse } from "next/server";

import { buildApiUrl } from "../../_lib";

export async function GET() {
  return NextResponse.redirect(buildApiUrl("/auth/google/redirect"));
}
