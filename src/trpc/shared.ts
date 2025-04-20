/**
 * Shared tRPC Utilities
 * 
 * This file contains common configuration and utilities used by both 
 * client and server tRPC implementations.
 */

import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

// SuperJSON is used to serialize/deserialize complex JavaScript objects
// including dates, maps, sets, and other things JSON can't normally handle
export { SuperJSON as transformer } from "superjson";
