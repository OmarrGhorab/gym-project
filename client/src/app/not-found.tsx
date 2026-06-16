export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The route does not exist or the locale is not configured yet.
        </p>
      </div>
    </main>
  );
}
