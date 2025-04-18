import { type Prisma, Prisma as PrismaNamespace } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

// Removed unused JsonData type definition

// Define cursor type used for pagination
type CursorType = {
  id?: string;
  order?: number;
  value?: number | null;
  textValue?: string;
  isNumeric?: boolean;
  isEmptyOrNull?: boolean;
  includeEmptyValues?: boolean;
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
          cursor: z.string().optional(), // This will be a JSON string containing all cursor information
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
      const { tableId, searchQuery, limit = 150, cursor, filter, sort } = input;

        // Get columns for the table
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

        // Define the Row type
      type Row = {
        id: string;
        tableId: string;
        order: number;
        data: Record<string, unknown>;
      };

      // Parse the cursor if provided
      let cursorData: CursorType | null = null;

      if (cursor) {
        try {
          // Fix unsafe assignment by explicitly typing the parsed JSON
          const parsed = JSON.parse(cursor) as CursorType;
          cursorData = parsed;
        } catch (e) {
          console.error("Invalid cursor format:", e);
        }
      }

        // Build the filter conditions
        const conditions = [];
        
        // Always include the tableId filter
        conditions.push(PrismaNamespace.sql`"tableId" = ${tableId}`);
        
        // Add search filter if provided
        if (searchQuery) {
          const searchConditions = columns.map(col => 
            PrismaNamespace.sql`CAST(data->>${col.name} AS TEXT) ILIKE ${"%" + searchQuery + "%"}`
          );
          conditions.push(
            PrismaNamespace.sql`(${PrismaNamespace.join(searchConditions, " OR ")})`
          );
        }
        
        // Add column-specific filter if provided
        if (filter) {
          if (filter.operator === "isEmpty") {
            conditions.push(
              PrismaNamespace.sql`(data->>${filter.columnName} IS NULL OR data->>${filter.columnName} = '' OR data->>${filter.columnName} = 'null')`
            );
          } else if (filter.operator === "isNotEmpty") {
            conditions.push(
              PrismaNamespace.sql`(data->>${filter.columnName} IS NOT NULL AND data->>${filter.columnName} != '' AND data->>${filter.columnName} != 'null')`
            );
          } else if (filter.operator === "contains") {
            conditions.push(
              PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) ILIKE ${"%" + filter.value + "%"}`
            );
          } else if (filter.operator === "notContains") {
            conditions.push(
              PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) NOT ILIKE ${"%" + filter.value + "%"}`
            );
          } else if (filter.operator === "equals") {
            conditions.push(
              PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) = ${String(filter.value)}`
            );
          } else if (filter.operator === "greaterThan") {
            conditions.push(
              PrismaNamespace.sql`(
                data->>${filter.columnName} ~ '^[0-9]+$' AND 
                CAST(data->>${filter.columnName} AS NUMERIC) > ${Number(filter.value)}
              )`
            );
          } else if (filter.operator === "lessThan") {
            conditions.push(
              PrismaNamespace.sql`(
                data->>${filter.columnName} ~ '^[0-9]+$' AND 
                CAST(data->>${filter.columnName} AS NUMERIC) < ${Number(filter.value)}
              )`
            );
          }
        }

        // Add cursor conditions if available and applicable
        if (cursorData && sort) {
          const columnType = columns.find(col => col.name === sort.columnName)?.type;
          const isNumberColumn = columnType === "number";
          
          // We'll use a different approach based on whether we're paginating through empty values
          // or non-empty values
          if (cursorData.isEmptyOrNull) {
            // Current cursor is pointing to an empty/null value
            // Use row order and ID for stable pagination
            if (sort.direction === "asc") {
              conditions.push(PrismaNamespace.sql`(
                (NOT data ? ${sort.columnName} OR 
                 data->>${sort.columnName} IS NULL OR 
                 data->>${sort.columnName}::text = '' OR 
                 data->>${sort.columnName}::text = 'null') AND
                ("order" > ${cursorData.order ?? 0} OR 
                 ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''}))
              )`);
            } else {
              conditions.push(PrismaNamespace.sql`(
                (NOT data ? ${sort.columnName} OR 
                 data->>${sort.columnName} IS NULL OR 
                 data->>${sort.columnName}::text = '' OR 
                 data->>${sort.columnName}::text = 'null') AND
                ("order" < ${cursorData.order ?? 0} OR 
                 ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''}))
              )`);
            }
          } else if (isNumberColumn && cursorData.value !== null && !Number.isNaN(cursorData.value)) {
            // For number columns with numeric values
            if (sort.direction === "asc") {
              conditions.push(PrismaNamespace.sql`(
                -- Either get non-empty values greater than current cursor
                (
                  data ? ${sort.columnName} AND
                  data->>${sort.columnName} IS NOT NULL AND
                  data->>${sort.columnName}::text != '' AND
                  data->>${sort.columnName}::text != 'null' AND
                  data->>${sort.columnName}::text ~ '^[0-9]+$' AND
                  (
                    CAST(data->>${sort.columnName} AS NUMERIC) > ${cursorData.value} OR
                    (CAST(data->>${sort.columnName} AS NUMERIC) = ${cursorData.value} AND
                     ("order" > ${cursorData.order ?? 0} OR 
                      ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''})))
                  )
                )
              )`);
            } else {
              // For DESC sort, ensure smooth pagination through both numeric and empty values
              // using row order as the consistent tie-breaker
              conditions.push(PrismaNamespace.sql`(
                -- Get non-empty numeric values smaller than current value
                (
                  data ? ${sort.columnName} AND
                  data->>${sort.columnName} IS NOT NULL AND
                  data->>${sort.columnName}::text != '' AND
                  data->>${sort.columnName}::text != 'null' AND
                  data->>${sort.columnName}::text ~ '^[0-9]+$' AND
                  (
                    -- Either a smaller number
                    CAST(data->>${sort.columnName} AS NUMERIC) < ${cursorData.value} OR
                    -- Or same number but later in row order
                    (CAST(data->>${sort.columnName} AS NUMERIC) = ${cursorData.value} AND
                     ("order" < ${cursorData.order ?? 0} OR 
                      ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''})))
                  )
                )
                -- OR any empty value (which should come after all numeric values in DESC sort)
                OR (
                  (NOT data ? ${sort.columnName} OR
                   data->>${sort.columnName} IS NULL OR
                   data->>${sort.columnName}::text = '' OR
                   data->>${sort.columnName}::text = 'null')
                )
              )`);
            }
          } else if (cursorData.textValue) {
            // For text columns or non-numeric values
            if (sort.direction === "asc") {
              conditions.push(PrismaNamespace.sql`(
                -- Either get non-empty values greater than current text value
                (
                  data ? ${sort.columnName} AND
                  data->>${sort.columnName} IS NOT NULL AND
                  data->>${sort.columnName}::text != '' AND
                  data->>${sort.columnName}::text != 'null' AND
                  (
                    CAST(data->>${sort.columnName} AS TEXT) > ${cursorData.textValue} OR
                    (CAST(data->>${sort.columnName} AS TEXT) = ${cursorData.textValue} AND
                     ("order" > ${cursorData.order ?? 0} OR 
                      ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''})))
                  )
                )
                -- For text columns, empty values come AFTER non-empty in ASC sort
                ${!isNumberColumn ? PrismaNamespace.sql`
                OR (
                  NOT data ? ${sort.columnName} OR
                  data->>${sort.columnName} IS NULL OR
                  data->>${sort.columnName}::text = '' OR
                  data->>${sort.columnName}::text = 'null'
                )` : PrismaNamespace.sql``}
              )`);
            } else {
              conditions.push(PrismaNamespace.sql`(
                -- Get non-empty values less than current text value in DESC sort
                (
                  data ? ${sort.columnName} AND
                  data->>${sort.columnName} IS NOT NULL AND
                  data->>${sort.columnName}::text != '' AND
                  data->>${sort.columnName}::text != 'null' AND
                  (
                    CAST(data->>${sort.columnName} AS TEXT) < ${cursorData.textValue} OR
                    (CAST(data->>${sort.columnName} AS TEXT) = ${cursorData.textValue} AND
                     ("order" < ${cursorData.order ?? 0} OR 
                      ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''})))
                  )
                )
              )`);
            }
          } else if (cursorData.order !== undefined && cursorData.id !== undefined) {
            // Fallback to row order and ID if no other cursor info is available
            if (sort.direction === "asc") {
              conditions.push(PrismaNamespace.sql`(
                "order" > ${cursorData.order} OR 
                ("order" = ${cursorData.order} AND "id" > ${cursorData.id})
              )`);
            } else {
              conditions.push(PrismaNamespace.sql`(
                "order" < ${cursorData.order} OR 
                ("order" = ${cursorData.order} AND "id" < ${cursorData.id})
              )`);
            }
          }
        } else if (cursorData?.order !== undefined && cursorData?.id !== undefined) {
          // If we have no sort but have a cursor with order and ID
          conditions.push(PrismaNamespace.sql`(
            "order" > ${cursorData.order} OR 
            ("order" = ${cursorData.order} AND "id" > ${cursorData.id})
          )`);
        }

        // Combine all filter conditions with AND
        const whereClause = PrismaNamespace.join(conditions, " AND ");

        // Execute count query with the same filters
        const countResult = await ctx.db.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count 
          FROM "Row"
          WHERE ${whereClause}
        `;
        
        const totalCount = Number(countResult[0].count);
        
        // Build the ORDER BY clause
        let orderByClause;
        if (sort) {
          const columnType = columns.find(col => col.name === sort.columnName)?.type;
          const isNumberColumn = columnType === "number";
          
          // Use a simplified ORDER BY clause that correctly handles nulls and empty values
          orderByClause = PrismaNamespace.sql`
            -- First determine if the value exists and is not null/empty
            CASE 
              WHEN data ? ${sort.columnName} AND 
                   data->>${sort.columnName} IS NOT NULL AND 
                   data->>${sort.columnName}::text != '' AND 
                   data->>${sort.columnName}::text != 'null' AND
                   data->>${sort.columnName}::text ~ '^[0-9]+$' AND
                   ${isNumberColumn}
              THEN 1 
              ELSE 0 
            END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`},
            
            -- Then sort by the actual numeric value for number columns
            CASE 
              WHEN data ? ${sort.columnName} AND 
                   data->>${sort.columnName} IS NOT NULL AND 
                   data->>${sort.columnName}::text != '' AND 
                   data->>${sort.columnName}::text != 'null' AND
                   data->>${sort.columnName}::text ~ '^[0-9]+$' AND
                   ${isNumberColumn}
              THEN CAST(data->>${sort.columnName} AS NUMERIC)
              ELSE NULL 
            END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`} NULLS LAST,
            
            -- Then by text value for text columns
            CASE 
              WHEN data ? ${sort.columnName} AND 
                   data->>${sort.columnName} IS NOT NULL AND 
                   data->>${sort.columnName}::text != '' AND 
                   data->>${sort.columnName}::text != 'null' AND
                   NOT ${isNumberColumn}
              THEN CAST(data->>${sort.columnName} AS TEXT)
              ELSE NULL 
            END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`} NULLS LAST,
            
            -- Finally by row order and id for stable sorting
            "order" ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`},
            "id" ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`}
          `;
        } else {
          orderByClause = PrismaNamespace.sql`"order" ASC, "id" ASC`;
        }

        // Execute the main query with LIMIT for pagination
        const rows = await ctx.db.$queryRaw<Row[]>`
          WITH filtered_rows AS (
            SELECT * 
            FROM "Row"
            WHERE ${whereClause}
          )
          SELECT *
          FROM filtered_rows
          ORDER BY ${orderByClause}
          LIMIT ${limit + 1}
        `;

        // Check if there are more results
      const hasNextPage = rows.length > limit;
        const items = hasNextPage ? rows.slice(0, limit) : rows;

        // Generate the next cursor based on the last row
      let nextCursor = null;
        if (hasNextPage && items.length > 0) {
          const lastRow = items[items.length - 1];
          
      if (lastRow && sort) {
        const sortValue = lastRow.data[sort.columnName];
        const columnType = columns.find(col => col.name === sort.columnName)?.type;
        const isNumberColumn = columnType === "number";
        
        // Check if value is empty in any form
        const isEmptyOrNull = 
          !lastRow.data.hasOwnProperty(sort.columnName) ||
          sortValue === null || 
          sortValue === undefined || 
          sortValue === "" || 
          sortValue === "null";
              
        if (isEmptyOrNull) {
          // For empty/null values, use row order and ID
          nextCursor = JSON.stringify({
            isEmptyOrNull: true,
            order: lastRow.order,
            id: lastRow.id
          });
        } else {
          // For non-empty values, include the sort value
          const isNumeric = isNumberColumn && (
            typeof sortValue === "number" ||
            (typeof sortValue === "string" && /^[0-9]+$/.test(sortValue))
          );

          // Get numeric value if applicable
          const numValue = isNumeric ? Number(sortValue) : null;

          // For non-empty values
          nextCursor = JSON.stringify({
            isEmptyOrNull: false,
            value: numValue,
            textValue: typeof sortValue === "string" 
              ? sortValue 
              : typeof sortValue === "number"
                ? String(sortValue)
                : "", 
            order: lastRow.order,
            id: lastRow.id
          });
        }
      } else if (lastRow) {
        // If there's no sort, just use row order and ID
        nextCursor = JSON.stringify({
          order: lastRow.order,
          id: lastRow.id
        });
      }
    }

      return {
        columns,
          rows: items,
        nextCursor,
          totalCount,
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

        // Initialize this column for all existing rows using raw SQL for better performance
        // Different handling based on column type
        if (input.type === "number") {
          // For number columns, we need to use NULL::jsonb to properly handle the type
          await ctx.db.$executeRaw`
            UPDATE "Row" 
            SET "data" = "data" || jsonb_build_object(${input.name}, NULL::jsonb)
            WHERE "tableId" = ${input.tableId}
          `;
        } else {
          // For text columns, we use an empty string
          await ctx.db.$executeRaw`
            UPDATE "Row" 
            SET "data" = "data" || jsonb_build_object(${input.name}, '')
            WHERE "tableId" = ${input.tableId}
          `;
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

        // Delete the column definition first
      await ctx.db.column.delete({
        where: {
          id: column.id,
        },
      });

        // Use raw SQL to remove the column from all rows at once
        await ctx.db.$executeRaw`
          UPDATE "Row"
          SET "data" = "data" - ${input.columnName}
          WHERE "tableId" = ${input.tableId}
        `;

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
