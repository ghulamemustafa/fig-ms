import { getSession } from "@/lib/auth-guards";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The proxy (middleware) already redirects unauthenticated requests to
  // /login before any route under this group renders, so `session.user` is
  // expected to exist here — this is just a defensive fallback.
  const session = await getSession();
  const user = session?.user;

  if (!user) {
    return null;
  }

  return <AppShell user={{ name: user.name ?? user.email ?? "", role: user.role }}>{children}</AppShell>;
}
