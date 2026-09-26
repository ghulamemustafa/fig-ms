// Vitest stub for the "server-only" package. That package throws
// unconditionally outside Next.js's special "react-server" resolve
// condition, which Vite/Vitest don't provide — so we alias it to this no-op
// here (see vitest.config.ts) rather than weakening the real guard that
// protects lib/settings.ts and lib/auth-guards.ts from client bundles.
export {};
