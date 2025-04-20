/**
 * tRPC Configuration
 * 
 * This file sets up the tRPC backend infrastructure that enables type-safe API routes.
 * tRPC allows for end-to-end typesafe APIs without code generation or runtime bloat.
 */

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@clerk/nextjs/server";

import { db } from "~/server/db";

/**
 * Context Creation
 * 
 * The context is passed to all tRPC procedures and contains:
 * 1. The database connection (Prisma client)
 * 2. Authentication information from Clerk
 * 3. Request headers
 * 
 * This context is available in all procedures and middleware.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Get the authenticated user ID from Clerk
  const { userId } = await auth();

  return {
    db,              // Prisma client for database access
    auth: {
      userId,        // User ID from Clerk, null if not authenticated
    },
    ...opts,         // Include request headers and other options
  };
};

/**
 * tRPC Initialization
 * 
 * This creates the base tRPC instance with:
 * - Context typing
 * - Data transformer (SuperJSON for handling dates, etc.)
 * - Error formatting (with special handling for Zod validation errors)
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,   // Handles serialization of complex objects like Date
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Router Creator
 * 
 * Used to build tRPC routers that group related procedures together.
 * Each domain area (users, tables, etc.) gets its own router.
 */
export const createTRPCRouter = t.router;

/**
 * Timing Middleware
 * 
 * This middleware wraps all procedures and:
 * 1. Logs execution time for performance monitoring
 * 2. Adds artificial delay in development for testing loading states
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // Add artificial delay in development to simulate network latency
  // This helps with testing loading states in the UI
  if (process.env.NODE_ENV === "development") {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[tRPC] ${path} took ${end - start}ms`);

  return result;
});

/**
 * Public Procedure
 * 
 * Base procedure that can be called by anyone. Only applies timing middleware.
 * Used for public endpoints that don't require authentication.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected Procedure
 * 
 * Procedure that requires authentication.
 * If no user is authenticated, throws an "Unauthorized" error.
 * All protected routes in the application use this procedure type.
 */
export const protectedProcedure = t.procedure.use(timingMiddleware).use(
  t.middleware(({ ctx, next }) => {
    // Check for authenticated user
    if (!ctx.auth?.userId) {
      throw new Error("Unauthorized");
    }
    // Continue to the procedure with confirmed authentication
    return next({
      ctx: {
        ...ctx,
        auth: {
          userId: ctx.auth.userId,
        },
      },
    });
  }),
);

/**
 * Caller Factory
 * 
 * Creates a caller that can be used to call tRPC procedures directly from the server.
 * Useful for server components, API routes, or server-side operations that need to call tRPC procedures.
 */
export const createCallerFactory = t.createCallerFactory;
