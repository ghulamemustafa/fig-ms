import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/rbac";

declare module "next-auth" {
  interface User {
    role: Role;
    remember?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    remember?: boolean;
    loginAt?: number;
  }
}
