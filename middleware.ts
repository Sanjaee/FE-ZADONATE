import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes that require authentication (admin routes)
  const protectedRoutes = ["/donate/history", "/history"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Routes that should redirect if already authenticated
  const authRoutes = ["/auth/login"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Check protected routes
  if (isProtectedRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // If no session, redirect to login with callback URL
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url);
      // Only encode once - pathname is already a valid path
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user is admin
    const userType = token.userType || token.role;
    if (userType !== "admin") {
      // Redirect non-admin to home page
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Check auth routes (login page)
  if (isAuthRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // If already logged in, redirect to history
    if (token) {
      return NextResponse.redirect(new URL("/donate/history", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
