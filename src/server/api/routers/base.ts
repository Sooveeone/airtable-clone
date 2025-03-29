import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const baseRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkId: ctx.auth.userId }, //  lookup by Clerk ID
    });

    if (!user) {
      return [];
    }

    const bases = await ctx.db.base.findMany({
      where: {
        userId: user.id, // match Base.userId with User.id
      },
    });

    return bases;
  }),

  getById: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.auth.userId },
      });

      if (!user) throw new Error("User not found");

      const base = await ctx.db.base.findUnique({
        where: {
          id: input.baseId,
          userId: user.id,
        },
      });

      if (!base) throw new Error("Base not found");

      return base;
    }),

  delete: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.base.delete({
        where: {
          id: input.baseId,
        },
      });
    }),
});
