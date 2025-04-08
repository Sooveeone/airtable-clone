import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Removed unused JsonData type definition

export const tableRouter = createTRPCRouter({
  getTablesForBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tables = await ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: {
          name: "asc", // Sort tables consistently
        },
      });
      return tables;
    }),

  createTable: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
        name: z.string(),
        columns: z.array(
          z.object({
            name: z.string(),
            type: z.enum(["text", "number"]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First create the table
      const table = await ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });

      // Then create the columns
      for (const column of input.columns) {
        await ctx.db.column.create({
          data: {
            name: column.name,
            type: column.type,
            tableId: table.id,
          },
        });
      }

      return table;
    }),

  getTableData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        searchQuery: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.string().optional(), // Add cursor for pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, searchQuery, limit = 50, cursor } = input;

      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

      const orFilter =
        searchQuery && searchQuery.trim().length > 0
          ? columns.flatMap((col) => {
              const filters: Prisma.JsonFilter[] = [
                {
                  path: [col.name],
                  string_contains: searchQuery,
                  mode: "insensitive",
                },
              ];

              // Add numeric comparison if searchQuery is a valid number
              const maybeNumber = Number(searchQuery);
              if (!isNaN(maybeNumber)) {
                filters.push({
                  path: [col.name],
                  equals: maybeNumber,
                });
              }

              return filters.map((f) => ({ data: f }));
            })
          : undefined;

      const rows = await ctx.db.row.findMany({
        where: {
          tableId,
          ...(orFilter ? { OR: orFilter } : {}),
          ...(cursor && !isNaN(parseInt(cursor, 10))
            ? { order: { gt: parseInt(cursor, 10) } }
            : {}),
        },
        orderBy: { order: "asc" },
        take: limit + 1, // Take one extra to determine if there are more rows
      });

      const hasNextPage = rows.length > limit;
      const lastRow = hasNextPage ? rows[limit - 1] : null;
      const nextCursor = lastRow?.order?.toString();
      const currentPageRows = hasNextPage ? rows.slice(0, -1) : rows;

      return {
        columns,
        rows: currentPageRows,
        nextCursor,
      };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        columnName: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
      });

      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

      // Convert the JSON data to a proper object
      const currentData = row.data as Prisma.JsonObject;

      // Create a new data object with the updated value
      const updatedData = {
        ...currentData,
        [input.columnName]: input.value,
      } as Prisma.InputJsonValue;

      return await ctx.db.row.update({
        where: { id: input.rowId },
        data: {
          data: updatedData,
        },
      });
    }),

  // For the createRow mutation - now with _clientId support
  createRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        defaultData: z.record(z.union([z.string(), z.number(), z.null()])),
        _clientId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newRow = await ctx.db.$transaction(async (prisma) => {
        const lastRow = await prisma.row.findFirst({
          where: { tableId: input.tableId },
          orderBy: { order: "desc" },
        });
        const nextOrder = (lastRow?.order ?? -1) + 1;
        const jsonData = {
          ...input.defaultData,
          ...(input._clientId ? { _clientId: input._clientId } : {}),
        } as Prisma.InputJsonValue;
        return await prisma.row.create({
          data: {
            tableId: input.tableId,
            data: jsonData,
            order: nextOrder,
          },
        });
      });
      return newRow;
    }),

  createColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        type: z.enum(["text", "number"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First check if column already exists
      const existingColumn = await ctx.db.column.findFirst({
        where: {
          tableId: input.tableId,
          name: input.name,
        },
      });

      if (existingColumn) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A column with this name already exists",
        });
      }

      // Get current highest order value
      const lastColumn = await ctx.db.column.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });

      const nextOrder = (lastColumn?.order ?? 0) + 1;

      const column = await ctx.db.column.create({
        data: {
          name: input.name,
          type: input.type,
          tableId: input.tableId,
          order: nextOrder, // ✅ set order here
        },
      });

      // Initialize this column for all existing rows
      const existingRows = await ctx.db.row.findMany({
        where: {
          tableId: input.tableId,
        },
      });

      // Update each row to add the new column with a default value

      for (const row of existingRows) {
        const currentData = row.data as Prisma.JsonObject;
        const defaultValue = input.type === "number" ? null : "";
        const updatedData = {
          ...currentData,
          [input.name]: defaultValue,
        } as Prisma.InputJsonValue;

        await ctx.db.row.update({
          where: { id: row.id },
          data: {
            data: updatedData,
            order: row.order, // explicitly preserve the row's order
          },
        });
      }

      return column;
    }),

  deleteColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        columnName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const column = await ctx.db.column.findFirst({
        where: {
          tableId: input.tableId,
          name: input.columnName,
        },
      });

      if (!column) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Column not found",
        });
      }

      await ctx.db.column.delete({
        where: {
          id: column.id,
        },
      });

      const rows = await ctx.db.row.findMany({
        where: { tableId: input.tableId },
      });

      for (const row of rows) {
        const data = row.data as Prisma.JsonObject;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [input.columnName]: removed, ...newData } = data;

        await ctx.db.row.update({
          where: { id: row.id },
          data: {
            data: newData as Prisma.InputJsonValue,
          },
        });
      }

      return { success: true };
    }),

  // For the createRows mutation - batch creation
  createRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rows: z.array(
          z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Get the current max order
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });

      let currentOrder = lastRow?.order ?? 0;

      // 2. Add rows with incrementing order
      const createdRows = [];
      for (const rowData of input.rows) {
        const row = await ctx.db.row.create({
          data: {
            tableId: input.tableId,
            order: ++currentOrder,
            data: rowData,
          },
        });
        createdRows.push(row);
      }

      return createdRows;
    }),

  // Delete Row route
  deleteRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, rowId } = input;
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.auth.userId },
      });
      if (!user) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User not found",
        });
      }
      const table = await ctx.db.table.findUnique({
        where: { id: tableId },
        include: { base: true },
      });
      if (!table || table.base.userId !== user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Table not found or you don't have access",
        });
      }
      await ctx.db.row.delete({ where: { id: rowId } });
      return { success: true };
    }),

  // Update Row Order route
  // Update Row Order route - Fixed version
  updateRowOrder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, rowIds } = input;

      try {
        // First, find the table
        const table = await ctx.db.table.findUnique({
          where: { id: tableId },
          include: { base: true },
        });

        if (!table) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Temporarily skip the permission check for testing
        // if (table.base.userId !== ctx.auth.userId) {
        //   throw new TRPCError({
        //     code: "FORBIDDEN",
        //     message: "You don't have access to this table",
        //   });
        // }

        // The key part: use a two-step approach to avoid unique constraint violations
        // 1. First, move all rows to temporary negative order values
        await ctx.db.$transaction(
          rowIds.map((rowId, index) =>
            ctx.db.row.update({
              where: {
                id: rowId,
                tableId,
              },
              data: {
                // Use a very negative order to avoid conflicts with existing rows
                order: -1000000 - index,
              },
            })
          )
        );

        // 2. Then set them to their final order values
        await ctx.db.$transaction(
          rowIds.map((rowId, index) =>
            ctx.db.row.update({
              where: {
                id: rowId,
                tableId,
              },
              data: {
                order: index,
              },
            })
          )
        );

        return { success: true };
      } catch (error) {
        console.error("Error updating row order:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update row order",
        });
      }
    }),
});