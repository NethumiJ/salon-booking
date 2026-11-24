import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl">💈</p>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-sm text-muted">This salon or page doesn’t exist.</p>
      <Link href="/" className="btn btn-brand">Go home</Link>
    </main>
  );
}
