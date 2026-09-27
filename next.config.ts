import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The root layout lives at app/[locale]/layout.tsx (a top-level dynamic segment),
  // so there's no single static root layout to compose a 404 from — this opts into
  // app/global-not-found.tsx for truly unmatched routes instead of Next's built-in page.
  experimental: {
    globalNotFound: true,
  },
  // react-pdf loads its own font/layout engine at runtime; keep it out of the bundle
  // and make sure the receipt fonts ship with the receipt route when deployed.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/receipts/[receiptNo]": ["./assets/fonts/**"],
    "/api/export/[entity]": ["./assets/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
