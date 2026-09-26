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
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // "Remember me" sessions last 30 days (sliding); others end after 12 hours.
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.remember = user.remember;
        token.loginAt = Date.now();
      }
      // Without "remember me" the sign-in is short-lived; returning null ends the session.
      // Tokens issued before "remember me" existed have no loginAt and are left alone.
      if (!token.remember && token.loginAt && Date.now() - token.loginAt > SHORT_SESSION_MS) {
        return null;
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
