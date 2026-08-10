import Image from "next/image";
import Link from "next/link";

import { redirectIfAuthenticated } from "@/lib/session";

import { RegisterForm } from "../../_components/register-form";

export default async function RegisterV1() {
  await redirectIfAuthenticated();

  return (
    <div className="flex h-dvh">
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-medium tracking-tight">Register</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Fill in your details below. We promise not to quiz you about your first pet&apos;s name (this time).
            </div>
          </div>
          <div className="space-y-4">
            <RegisterForm />
            <p className="text-center text-muted-foreground text-xs">
              Already have an account?{" "}
              <Link prefetch={false} href="login" className="text-primary">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary lg:block lg:w-1/3">
        <Image
          src="/authentication-img.png"
          alt="ATP Gym training floor"
          fill
          priority
          className="object-cover"
          sizes="33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/75" />
        <div className="relative flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-2 text-white">
            <h1 className="font-light text-5xl">Welcome!</h1>
            <p className="text-white/80 text-xl">You&apos;re in the right place.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
