import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@clerk/nextjs/server";

import { db } from "~/server/db";

/**
 * Context
 * This adds the authenticated Clerk user ID to the context so you can access it in your procedures.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { userId } = await auth();

  return {
    db,
    auth: {
      userId,
    },
    ...opts,
  };
};

/**
 * Initialization
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
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
 * Helpers for creating routers and procedures
 */
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

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
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (requires Clerk user) procedure
 */
export const protectedProcedure = t.procedure.use(timingMiddleware).use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.auth?.userId) {
      throw new Error("Unauthorized");
    }
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

export const createCallerFactory = t.createCallerFactory;
