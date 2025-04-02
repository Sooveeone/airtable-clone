import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

// Helper type for JSON data
type JsonData = Prisma.JsonValue;

export const tableRouter = createTRPCRouter({
  getTablesForBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tables = await ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: {
          name: "asc",
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
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });

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
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: {
            orderBy: {
              order: "asc",
            },
          },
          rows: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      if (!table)
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      return {
        columns: table.columns,
        rows: table.rows,
      };
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rowId: z.string(),
        columnName: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
      });

      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

      const currentData = row.data as Prisma.JsonObject;
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

  createRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        defaultData: z.record(z.union([z.string(), z.number(), z.null()])),
        _clientId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });

      const nextOrder = (lastRow?.order ?? -1) + 1;

      const jsonData = {
        ...input.defaultData,
        ...(input._clientId ? { _clientId: input._clientId } : {}),
      } as Prisma.InputJsonValue;

      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          data: jsonData,
          order: nextOrder,
        },
      });

      return {
        ...row,
        _clientId: input._clientId,
      };
    }),

  createColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        type: z.enum(["text", "number"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
          order: nextOrder,
        },
      });

      const existingRows = await ctx.db.row.findMany({
        where: { tableId: input.tableId },
      });

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
      }),
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

  createRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const createdRows = [];

      const lastRow = await ctx.db.row.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });

      let currentOrder = (lastRow?.order ?? -1) + 1;

      for (const rowData of input.rows) {
        const row = await ctx.db.row.create({
          data: {
            tableId: input.tableId,
            data: rowData as Prisma.InputJsonValue,
            order: currentOrder++,
          },
        });
        createdRows.push(row);
      }

      return createdRows;
    }),
});
