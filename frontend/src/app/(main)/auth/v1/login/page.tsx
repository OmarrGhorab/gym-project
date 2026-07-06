import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "../../_components/login-form";

export default function LoginV1() {
  return (
    <div className="flex h-dvh">
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
            <h1 className="font-light text-5xl">Hello again</h1>
            <p className="text-white/80 text-xl">Login to continue</p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-medium tracking-tight">Login</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Welcome back. Enter your email and password, let&apos;s hope you remember them this time.
            </div>
          </div>
          <div className="space-y-4">
            <LoginForm />
            <p className="text-center text-muted-foreground text-xs">
              Don&apos;t have an account?{" "}
              <Link prefetch={false} href="register" className="text-primary">
                Register
              </Link>
              <span className="px-1">·</span>
              <Link prefetch={false} href="../v2/forgot-password" className="text-primary">
                Forgot password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
