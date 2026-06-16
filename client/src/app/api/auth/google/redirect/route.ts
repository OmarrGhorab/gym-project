import { redirect } from "next/navigation";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000/api/v1";

export function GET() {
  redirect(`${API_BASE_URL}/auth/google/redirect`);
}
