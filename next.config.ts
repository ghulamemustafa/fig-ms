import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // react-pdf loads its own font/layout engine at runtime; keep it out of the bundle
  // and make sure the receipt fonts ship with the receipt route when deployed.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: {
    "/api/receipts/[receiptNo]": ["./assets/fonts/**"],
    "/api/export/[entity]": ["./assets/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
