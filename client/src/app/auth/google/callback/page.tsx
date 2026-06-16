import { Suspense } from "react";
import { GoogleCallbackHandler } from "@/components/auth/google-callback-handler";

export const dynamic = "force-dynamic";

export default function GoogleCallbackPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,232,96,0.16),_transparent_26%),linear-gradient(180deg,_#090909_0%,_#111111_100%)] px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="size-12 animate-spin rounded-full border-4 border-[#ffe800] border-t-transparent" />
            <p className="text-lg font-medium text-white">Loading...</p>
          </div>
        }
      >
        <GoogleCallbackHandler />
      </Suspense>
    </main>
  );
}
