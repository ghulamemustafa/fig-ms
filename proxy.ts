import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "./auth.config";
import createIntlMiddleware from "next-intl/middleware";
import { routing, locales, defaultLocale } from "./i18n/routing";

// Edge-safe: decodes the already-issued JWT only, never touches Prisma/bcrypt.
const { auth } = NextAuth(authConfig);

const intlMiddleware = createIntlMiddleware(routing);

function localeFromPathname(pathname: string) {
  const [, maybeLocale] = pathname.split("/");
  return (locales as readonly string[]).includes(maybeLocale)
    ? maybeLocale
    : defaultLocale;
}

function isLoginPath(pathname: string) {
  return /^\/(en|ur)\/login(\/.*)?$/.test(pathname);
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const locale = localeFromPathname(nextUrl.pathname);

  if (!isLoggedIn && !isLoginPath(nextUrl.pathname)) {
    const loginUrl = new URL(`/${locale}/login`, nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPath(nextUrl.pathname)) {
    return NextResponse.redirect(new URL(`/${locale}`, nextUrl));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
