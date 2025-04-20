/**
 * Server-Side tRPC Configuration
 * 
 * This file sets up tRPC for use in server components and API routes.
 * It allows making tRPC procedure calls directly on the server without going through HTTP.
 */

import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import { createCaller, type AppRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createQueryClient } from "./query-client";

/**
 * Creates a cached tRPC context for server components
 * 
 * This wraps the `createTRPCContext` helper and:
 * 1. Uses React's cache() to memoize the context
 * 2. Gets headers from the server request
 * 3. Sets a special header to identify RSC (React Server Component) requests
 * 4. Creates a proper context for tRPC to use
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

/**
 * Cached query client for server components
 * 
 * Creates a single instance of the query client per request
 * using React's cache() to optimize performance
 */
const getQueryClient = cache(createQueryClient);

/**
 * Server-side tRPC caller
 * 
 * This creates a direct caller to the tRPC procedures
 * that bypasses the HTTP transport layer completely
 */
const caller = createCaller(createContext);

/**
 * Exports for server components
 * 
 * - api: The tRPC client for use in server components
 * - HydrateClient: Component for hydrating tRPC state on the client
 * 
 * These helpers connect server-side tRPC calls with client-side
 * state management through React Query's hydration mechanism
 */
export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
