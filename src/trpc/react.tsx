/**
 * tRPC React Integration
 * 
 * This file sets up the client-side React hooks for interacting with the tRPC API.
 * It provides the frontend with type-safe access to all backend procedures.
 */

"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    return createQueryClient(); // Server: always make a new query client
  }

  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient(); // Cleaner fix with `??=`

  return clientQueryClientSingleton;
};

/**
 * Create React hooks for tRPC
 * 
 * This creates the primary api object with React hooks that the frontend uses.
 * The api object contains hooks like useQuery, useMutation for all procedures.
 */
export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * TRPCProvider Component
 * 
 * This provider component must wrap any part of the application that needs
 * to make tRPC calls. Typically placed near the root of app.
 * 
 * It sets up:
 * 1. React Query's QueryClient (for data fetching and cache)
 * 2. tRPC client configuration with proper links and transformers
 */
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  // Use the query client with singleton pattern
  const queryClient = getQueryClient();

  // Create a new tRPC client instance for each session
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        // Add request/response logging in development
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        // HTTP batch link for efficient request batching
        // Multiple tRPC calls within a short time will be batched into a single request
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          // Include headers with each request
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    }),
  );

  // Provide both React Query and tRPC clients to the application
  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

/**
 * Helper function to get the base URL for API requests
 * 
 * Returns different URLs based on environment:
 * - Browser: Uses the current window location
 * - Vercel deployment: Uses the Vercel URL
 * - Local development: Uses localhost with the appropriate port
 */
function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
