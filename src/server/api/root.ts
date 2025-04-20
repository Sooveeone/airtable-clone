/**
 * tRPC Root Router
 * 
 * This file defines the main API router for your application.
 * It combines all feature-specific routers into a single entrypoint
 * that the frontend will communicate with.
 */

import { postRouter } from "~/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { usersRouter } from "./routers/users";
import { baseRouter } from "./routers/base";
import { tableRouter } from "./routers/table";
import { viewRouter } from "./routers/view";

/**
 * App Router Configuration
 * 
 * This is the primary router for the entire API server.
 * Each domain-specific router is mounted here with a namespace
 * that matches its functionality:
 * 
 * - post: Blog post operations
 * - users: User management
 * - base: Databases/workspaces (similar to Airtable bases)
 * - table: Tables within bases, with columns and rows
 * - view: Different views of tables (like Grid view, etc.)
 * 
 * When you add a new router in /api/routers, you must register it here
 * to make it available to the frontend.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  users: usersRouter,
  base: baseRouter,
  table: tableRouter,
  view: viewRouter,
});

// TypeScript type definition for the entire API
// This is used by the frontend to get full type safety
export type AppRouter = typeof appRouter;

/**
 * Server-Side Caller
 * 
 * Creates a server-side caller for the tRPC API that can be used
 * in server components, API routes, or other server-side code.
 * 
 * When used, it bypasses the HTTP transport layer and directly
 * calls the procedures, while maintaining all type safety.
 * 
 * Example usage:
 * ```
 * // In a server component or API route:
 * const trpc = createCaller({ db, auth: { userId } });
 * const tables = await trpc.table.getTablesForBase({ baseId: "123" });
 * ```
 */
export const createCaller = createCallerFactory(appRouter);
