/**
 * React Query Client Configuration
 * 
 * This file configures the React Query client used by tRPC.
 * React Query handles data fetching, caching, and synchronization
 * between server and client states.
 */

import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

/**
 * Creates and configures a React Query client with optimal settings
 * for server-side rendering and data serialization.
 * 
 * Key configurations:
 * - Sets a staleTime to prevent unnecessary refetches
 * - Uses SuperJSON for serializing complex data types during SSR
 * - Configures proper hydration/dehydration behavior for SSR
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000, // 30 seconds before data is considered stale
      },
      dehydrate: {
        // Use SuperJSON to serialize data that will be sent from server to client
        // This handles dates, Maps, Sets, and other complex JS types
        serializeData: SuperJSON.serialize,
        // Configure which queries should be included in the dehydrated state
        // We include pending queries to support streaming SSR
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        // Use SuperJSON to deserialize data received from the server
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
