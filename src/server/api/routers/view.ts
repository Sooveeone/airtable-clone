import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const viewRouter = createTRPCRouter({
  getViewsForTable: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const views = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { createdAt: "asc" },
      });
      return views;
    }),

  createView: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        type: z.string().default("grid"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if view name already exists for this table
      const existingView = await ctx.db.view.findFirst({
        where: {
          tableId: input.tableId,
          name: input.name,
        },
      });

      if (existingView) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A view with this name already exists",
        });
      }

      const view = await ctx.db.view.create({
        data: {
          name: input.name,
          type: input.type,
          tableId: input.tableId,
          hiddenColumns: [],
        },
      });

      return view;
    }),

  updateView: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        filter: z.any().optional(),
        sort: z.any().optional(),
        hiddenColumns: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      const view = await ctx.db.view.update({
        where: { id },
        data: updateData,
      });

      return view;
    }),

  deleteView: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.view.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
