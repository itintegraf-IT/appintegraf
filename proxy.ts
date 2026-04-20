import { auth } from "@/auth";

const publicPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/activate",
  "/api/auth",
  "/api/health",
  "/public",
  "/api/public",
];

/** Stránky pro přihlášení/registraci, na kterých nemá smysl být, pokud je uživatel přihlášen. */
const loginLikePaths = new Set(["/login", "/register"]);

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  if (isPublicPath(nextUrl.pathname)) {
    if (isLoggedIn && loginLikePaths.has(nextUrl.pathname)) {
      return Response.redirect(new URL("/", nextUrl.origin));
    }
    return;
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  return;
});

export { proxy };
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
