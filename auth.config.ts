import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Role } from "@/lib/rbac";

/**
 * Edge-safe config: no Prisma / bcrypt imports here. This is shared by the
 * middleware (which may run on the Edge runtime and must only decode the
 * already-issued JWT, never touch the database) and by `auth.ts` (the full
 * config used everywhere else, which adds the Credentials provider's
 * `authorize()` — the only place that talks to Postgres + bcrypt).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as JWT;
      if (session.user) {
        session.user.id = (t.id ?? session.user.id) as string;
        session.user.role = (t.role ?? session.user.role) as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
