import { type Prisma, Prisma as PrismaNamespace } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Removed unused JsonData type definition

type CursorData = {
  value?: number | null;
  textValue?: string;
  isNumeric?: boolean;
  order: number;
  id: string;
};

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

      // Create a default Grid view
      await ctx.db.view.create({
        data: {
          name: "Grid view 1",
          type: "grid",
          tableId: table.id,
          hiddenColumns: [],
        },
      });

      return table;
    }),

  getTableData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        searchQuery: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.string().optional(), // This will now be a JSON string containing sort value and row ID
        filter: z
          .object({
            columnName: z.string(),
            operator: z.enum([
              "isEmpty",
              "isNotEmpty",
              "contains",
              "notContains",
              "equals",
              "greaterThan",
              "lessThan",
            ]),
            value: z.union([z.string(), z.number(), z.null()]).optional(),
          })
          .optional(),
        sort: z
          .object({
            columnName: z.string(),
            direction: z.enum(["asc", "desc"]),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, searchQuery, limit = 100, cursor, filter, sort } = input;

      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

      type Row = {
        id: string;
        tableId: string;
        order: number;
        data: Record<string, unknown>;
      };

      // Parse the cursor if provided
      let cursorData: CursorData | null = null;
      if (cursor) {
        try {
          const parsed = JSON.parse(cursor) as CursorData;
          if (
            typeof parsed.order === "number" &&
            typeof parsed.id === "string"
          ) {
            cursorData = parsed;
          }
        } catch (e) {
          // Invalid cursor format, will ignore
          console.error("Invalid cursor format:", e);
        }
      }

      // Get rows with proper database-level sorting and keyset pagination
      const rows = await ctx.db.$queryRaw<Row[]>`
        SELECT * FROM "Row"
        WHERE "tableId" = ${tableId}
        ${
          searchQuery
            ? PrismaNamespace.sql`AND (${PrismaNamespace.join(
                columns.map(
                  (col) =>
                    PrismaNamespace.sql`CAST(data->>${
                      col.name
                    } AS TEXT) ILIKE ${"%" + searchQuery + "%"}`
                ),
                " OR "
              )})`
            : PrismaNamespace.empty
        }
        ${
          filter
            ? PrismaNamespace.sql`AND ${
                filter.operator === "isEmpty"
                  ? PrismaNamespace.sql`data->>${filter.columnName} IS NULL`
                  : filter.operator === "isNotEmpty"
                  ? PrismaNamespace.sql`data->>${filter.columnName} IS NOT NULL`
                  : filter.operator === "contains"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS TEXT) ILIKE ${"%" + filter.value + "%"}`
                  : filter.operator === "notContains"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS TEXT) NOT ILIKE ${"%" + filter.value + "%"}`
                  : filter.operator === "equals"
                  ? PrismaNamespace.sql`data->>${filter.columnName} = ${String(
                      filter.value
                    )}`
                  : filter.operator === "greaterThan"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS NUMERIC) > ${Number(filter.value)}`
                  : filter.operator === "lessThan"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS NUMERIC) < ${Number(filter.value)}`
                  : PrismaNamespace.empty
              }`
            : PrismaNamespace.empty
        }
        ${
          !sort && cursorData
            ? PrismaNamespace.sql`AND (
                "order" > ${cursorData.order} OR 
                ("order" = ${cursorData.order} AND "id" > ${cursorData.id})
              )`
            : PrismaNamespace.empty
        }
        ${
          sort && cursorData
            ? PrismaNamespace.sql`AND (
                ${
                  sort.direction === "asc"
                    ? PrismaNamespace.sql`
                        (
                          (
                            data->>${sort.columnName} ~ '^[0-9]+$' AND 
                            CAST(data->>${sort.columnName} AS NUMERIC) > ${
                        cursorData.value ?? 0
                      }
                          ) OR
                          (
                            (data->>${
                              sort.columnName
                            } !~ '^[0-9]+$' OR data->>${
                        sort.columnName
                      } IS NULL) AND
                            ${cursorData.isNumeric ?? false}
                          ) OR
                          (
                            data->>${sort.columnName} !~ '^[0-9]+$' AND 
                            data->>${sort.columnName} IS NOT NULL AND
                            NOT ${cursorData.isNumeric ?? false} AND
                            CAST(data->>${sort.columnName} AS TEXT) > ${
                        cursorData.textValue ?? ""
                      }
                          )
                        ) OR (
                          (
                            (data->>${
                              sort.columnName
                            } ~ '^[0-9]+$' AND CAST(data->>${
                        sort.columnName
                      } AS NUMERIC) = ${cursorData.value ?? 0}) OR
                            (data->>${
                              sort.columnName
                            } !~ '^[0-9]+$' AND data->>${
                        sort.columnName
                      } IS NOT NULL AND CAST(data->>${
                        sort.columnName
                      } AS TEXT) = ${cursorData.textValue ?? ""})
                          ) AND
                          ("order" > ${cursorData.order} OR ("order" = ${
                        cursorData.order
                      } AND "id" > ${cursorData.id}))
                        )
                      `
                    : PrismaNamespace.sql`
                        (
                          (
                            data->>${sort.columnName} ~ '^[0-9]+$' AND 
                            CAST(data->>${sort.columnName} AS NUMERIC) < ${
                        cursorData.value ?? 0
                      }
                          ) OR
                          (
                            (data->>${
                              sort.columnName
                            } !~ '^[0-9]+$' OR data->>${
                        sort.columnName
                      } IS NULL) AND
                            NOT ${cursorData.isNumeric ?? false}
                          ) OR
                          (
                            data->>${sort.columnName} !~ '^[0-9]+$' AND 
                            data->>${sort.columnName} IS NOT NULL AND
                            ${cursorData.isNumeric ?? false} AND
                            CAST(data->>${sort.columnName} AS TEXT) < ${
                        cursorData.textValue ?? ""
                      }
                          )
                        ) OR (
                          (
                            (data->>${
                              sort.columnName
                            } ~ '^[0-9]+$' AND CAST(data->>${
                        sort.columnName
                      } AS NUMERIC) = ${cursorData.value ?? 0}) OR
                            (data->>${
                              sort.columnName
                            } !~ '^[0-9]+$' AND data->>${
                        sort.columnName
                      } IS NOT NULL AND CAST(data->>${
                        sort.columnName
                      } AS TEXT) = ${cursorData.textValue ?? ""})
                          ) AND
                          ("order" < ${cursorData.order} OR ("order" = ${
                        cursorData.order
                      } AND "id" < ${cursorData.id}))
                        )
                      `
                }
              )`
            : PrismaNamespace.empty
        }
        ORDER BY
        ${
          sort
            ? PrismaNamespace.sql`
                CASE 
                  WHEN data->>${sort.columnName} ~ '^[0-9]+$' 
                  THEN CAST(data->>${sort.columnName} AS NUMERIC)
                  ELSE NULL 
                END ${
                  sort.direction === "asc"
                    ? PrismaNamespace.sql`ASC`
                    : PrismaNamespace.sql`DESC`
                } NULLS LAST,
                CAST(data->>${sort.columnName} AS TEXT) ${
                sort.direction === "asc"
                  ? PrismaNamespace.sql`ASC`
                  : PrismaNamespace.sql`DESC`
              } NULLS LAST,
                "order" ASC,
                "id" ASC
              `
            : PrismaNamespace.sql`"order" ASC, "id" ASC`
        }
        LIMIT ${limit + 1}
      `;

      const hasNextPage = rows.length > limit;
      const lastRow = hasNextPage ? rows[limit - 1] : null;

      // Create a new cursor that contains both the sort value and row ID
      let nextCursor = null;
      if (lastRow && sort) {
        const sortValue = lastRow.data[sort.columnName];
        const isNumeric =
          typeof sortValue === "number" ||
          (typeof sortValue === "string" && /^[0-9]+$/.test(sortValue));

        nextCursor = JSON.stringify({
          value: isNumeric ? Number(sortValue) : null,
          textValue:
            typeof sortValue === "string"
              ? sortValue
              : typeof sortValue === "number"
              ? String(sortValue)
              : "",
          isNumeric,
          order: lastRow.order,
          id: lastRow.id,
        });
      } else if (lastRow) {
        // If there's no sort, use row order
        nextCursor = JSON.stringify({
          order: lastRow.order,
          id: lastRow.id,
        });
      }

      const currentPageRows = hasNextPage ? rows.slice(0, -1) : rows;

      // Get total count with the same filters
      const totalCount = await ctx.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Row"
        WHERE "tableId" = ${tableId}
        ${
          searchQuery
            ? PrismaNamespace.sql`AND (${PrismaNamespace.join(
                columns.map(
                  (col) =>
                    PrismaNamespace.sql`CAST(data->>${
                      col.name
                    } AS TEXT) ILIKE ${"%" + searchQuery + "%"}`
                ),
                " OR "
              )})`
            : PrismaNamespace.empty
        }
        ${
          filter
            ? PrismaNamespace.sql`AND ${
                filter.operator === "isEmpty"
                  ? PrismaNamespace.sql`data->>${filter.columnName} IS NULL`
                  : filter.operator === "isNotEmpty"
                  ? PrismaNamespace.sql`data->>${filter.columnName} IS NOT NULL`
                  : filter.operator === "contains"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS TEXT) ILIKE ${"%" + filter.value + "%"}`
                  : filter.operator === "notContains"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS TEXT) NOT ILIKE ${"%" + filter.value + "%"}`
                  : filter.operator === "equals"
                  ? PrismaNamespace.sql`data->>${filter.columnName} = ${String(
                      filter.value
                    )}`
                  : filter.operator === "greaterThan"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS NUMERIC) > ${Number(filter.value)}`
                  : filter.operator === "lessThan"
                  ? PrismaNamespace.sql`CAST(data->>${
                      filter.columnName
                    } AS NUMERIC) < ${Number(filter.value)}`
                  : PrismaNamespace.empty
              }`
            : PrismaNamespace.empty
        }`;

      return {
        columns,
        rows: currentPageRows,
        nextCursor,
        totalCount: Number(totalCount[0].count),
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
          order: nextOrder,
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
      startOrder: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Use the provided startOrder or get the current max order
    let startOrder = input.startOrder;
    
    if (startOrder === undefined) {
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });
      startOrder = (lastRow?.order ?? 0);
    }
    
    // Prepare all row data for bulk insert
    const rowsToCreate = input.rows.map((rowData, index) => ({
      tableId: input.tableId,
      order: startOrder + index + 1,
      data: rowData,
    }));
    
    // Use createMany for bulk insertion
    const result = await ctx.db.row.createMany({
      data: rowsToCreate,
      skipDuplicates: false,
    });
    
    return {
      count: result.count,
      success: true
    };
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
