import Image from "next/image";
import Link from "next/link";

import "./globals.css";

// Next 16's experimental global-not-found convention (enabled in next.config.ts):
// the root layout lives at app/[locale]/layout.tsx (a top-level dynamic segment),
// so Next can't compose a normal 404 from layout.tsx + not-found.tsx and instead
// renders this file directly, bypassing every layout — hence its own <html>/<body>
// and plain bilingual copy instead of next-intl (no request/locale context here).
// app/[locale]/not-found.tsx still handles notFound() thrown inside a known route,
// e.g. a missing member id — that one's a normal nested page and stays as-is.
export default function GlobalNotFound() {
  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <Image
          src="/logo.jpg"
          alt=""
          width={64}
          height={64}
          className="size-16 rounded-full object-cover ring-1 ring-border"
        />
        <div className="space-y-1.5">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Page not found <span className="text-muted-foreground">·</span> صفحہ نہیں ملا
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
          </p>
        </div>
        <Link
          href="/en"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
      </body>
    </html>
  );
}
