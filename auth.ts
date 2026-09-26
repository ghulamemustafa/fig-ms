import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { loginSchema } from "./lib/schemas/auth";
import { ROLES, type Role } from "./lib/rbac";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password, remember } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (!isRole(user.role)) return null;

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          remember: remember === "true",
        };
      },
    }),
  ],
});
