import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|.*\\..*|favicon.ico).*)", // Protects all non-static routes
    "/(api|trpc)(.*)", // Always run for API & tRPC routes
  ],
  publicRoutes: ["/sign-in", "/sign-up"], // Removed "/" from public routes
};
