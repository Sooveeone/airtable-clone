// Import Prisma client types and namespaces for database operations
import { type Prisma, Prisma as PrismaNamespace } from "@prisma/client";
// Import Zod for input validation
import { z } from "zod";
// Import TRPC router and procedure creators
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
// Import TRPC error handling
import { TRPCError } from "@trpc/server";

// Removed unused JsonData type definition

// Define cursor type used for pagination
// This type is crucial for implementing efficient infinite scrolling
// with proper pagination through complex sort and filter scenarios
type CursorType = {
  id?: string;              // Row ID for stable pagination
  order?: number;           // Row order for sorting
  value?: number | null;    // Numeric value for sorted columns
  textValue?: string;       // Text value for sorted columns
  isNumeric?: boolean;      // Flag if the value is numeric
  isEmptyOrNull?: boolean;  // Flag if the value is empty or null
  includeEmptyValues?: boolean; // Flag to include empty values in pagination
};

// Create a TRPC router for table-related operations
export const tableRouter = createTRPCRouter({
  // Procedure to get all tables for a specific base
  // This retrieves the tables that belong to a base, sorted by name
  getTablesForBase: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Find all tables for the given base ID, sorted by name
      const tables = await ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: {
          name: "asc", // Sort tables consistently by name
        },
      });
      return tables;
    }),

  // Procedure to create a new table with columns
  // This creates a table, its columns, and a default Grid view
  createTable: protectedProcedure
    .input(
      z.object({
        baseId: z.string(), // Base this table belongs to
        name: z.string(),   // Name of the new table
        columns: z.array(   // Array of column definitions
          z.object({
            name: z.string(),
            type: z.enum(["text", "number"]), // Supported column types
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First create the table in the database
      const table = await ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });

      // Then create each column for the table
      for (const column of input.columns) {
        await ctx.db.column.create({
          data: {
            name: column.name,
            type: column.type,
            tableId: table.id,
          },
        });
      }

      // Create a default Grid view for the table
      // Every table needs at least one view
      await ctx.db.view.create({
        data: {
          name: "Grid view 1",
          type: "grid",
          tableId: table.id,
          hiddenColumns: [], // No hidden columns initially
        },
      });

      return table;
    }),

  // Procedure to get table data with filtering, sorting and pagination
  // This is the core data retrieval procedure that powers the Airtable-like grid
  getTableData: protectedProcedure
    .input(
      z.object({
        tableId: z.string(), // ID of the table to get data from
        searchQuery: z.string().optional(), // Optional text to search across all columns
        limit: z.number().optional(), // Number of rows to return (for pagination)
        cursor: z.string().optional(), // JSON string containing cursor information for pagination
        filter: z
          .object({
            columnName: z.string(), // Column to filter on
            operator: z.enum([
              "isEmpty",     // Field is empty/null
              "isNotEmpty",  // Field has content
              "contains",    // Text contains value
              "notContains", // Text does not contain value
              "equals",      // Exact match
              "greaterThan", // Numeric comparison
              "lessThan",    // Numeric comparison
            ]),
            value: z.union([z.string(), z.number(), z.null()]).optional(), // Filter value if applicable
          })
          .optional(), // Filtering is optional
        sort: z
          .object({
            columnName: z.string(),     // Column to sort by
            direction: z.enum(["asc", "desc"]), // Sort direction
          })
          .optional(), // Sorting is optional
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, searchQuery, limit = 150, cursor, filter, sort } = input;

      // Get columns for the table to understand its structure
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: "asc" },
      });

      // Define the Row type for TypeScript
      type Row = {
        id: string;
        tableId: string;
        order: number;
        data: Record<string, unknown>;
      };

      // Parse the cursor string into an object if provided
      // The cursor is critical for efficient pagination
      let cursorData: CursorType | null = null;

      if (cursor) {
        try {
          // Parse the JSON cursor with explicit typing for safety
          const parsed = JSON.parse(cursor) as CursorType;
          cursorData = parsed;
        } catch (e) {
          console.error("Invalid cursor format:", e);
        }
      }

      // Build SQL filter conditions for the query
      // This uses Prisma's raw SQL capabilities for complex filtering
      const conditions = [];
      
      // Always include the tableId filter to get rows from the correct table
      // PrismaNamespace.sql is used to create raw SQL queries safely
      conditions.push(PrismaNamespace.sql`"tableId" = ${tableId}`);
      
      // Add search filter if provided - searches across all columns
      if (searchQuery) {
        // Create OR conditions to search each column for the query text
        const searchConditions = columns.map(col => 
          PrismaNamespace.sql`CAST(data->>${col.name} AS TEXT) ILIKE ${"%" + searchQuery + "%"}` // ILIKE is used for case-insensitive search, % is used to search for any text that contains the search query, col.name is the name of the column to search
        );
        // Join the search conditions with OR to get all columns that contain the search query
        conditions.push(
          PrismaNamespace.sql`(${PrismaNamespace.join(searchConditions, " OR ")})`
        );
      }
      
      // Add column-specific filter if provided
      if (filter) {
        // Handle isEmpty filter - check if column is null, empty string or 'null' string
        if (filter.operator === "isEmpty") {
          // data->>${filter.columnName} is the syntax for accessing the value of a column in the data object
          conditions.push(
            PrismaNamespace.sql`(data->>${filter.columnName} IS NULL OR data->>${filter.columnName} = '' OR data->>${filter.columnName} = 'null')`
          );
        } 
        // Handle isNotEmpty filter - check if column has a value
        else if (filter.operator === "isNotEmpty") {
          conditions.push(
            PrismaNamespace.sql`(data->>${filter.columnName} IS NOT NULL AND data->>${filter.columnName} != '' AND data->>${filter.columnName} != 'null')`
          );
        } 
        // Handle contains filter - case-insensitive text search
        else if (filter.operator === "contains") {
          conditions.push(
            PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) ILIKE ${"%" + filter.value + "%"}`
          );
        } 
        // Handle notContains filter - case-insensitive negative text search
        else if (filter.operator === "notContains") {
          conditions.push(
            PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) NOT ILIKE ${"%" + filter.value + "%"}`
          );
        } 
        // Handle equals filter - exact match
        else if (filter.operator === "equals") {
          conditions.push(
            PrismaNamespace.sql`CAST(data->>${filter.columnName} AS TEXT) = ${String(filter.value)}`
          );
        } 
        // Handle greaterThan filter - numeric comparison
        else if (filter.operator === "greaterThan") {
          // ~ is used to check if the value is a number
          conditions.push(
            PrismaNamespace.sql`(
              data->>${filter.columnName} ~ '^[0-9]+$' AND 
              CAST(data->>${filter.columnName} AS NUMERIC) > ${Number(filter.value)}
            )`
          );
        } 
        // Handle lessThan filter - numeric comparison
        else if (filter.operator === "lessThan") {
          conditions.push(
            PrismaNamespace.sql`(
              data->>${filter.columnName} ~ '^[0-9]+$' AND 
              CAST(data->>${filter.columnName} AS NUMERIC) < ${Number(filter.value)}
            )`
          );
        }
      }

      // ===== CURSOR-BASED PAGINATION LOGIC =====
      // This section handles continuing from where the previous page left off
      // It's complex because we need to handle different data types and sort directions
      if (cursorData && sort) {
        // First, check what type of column we're sorting by (text or number)
        const columnType = columns.find(col => col.name === sort.columnName)?.type;
        const isNumberColumn = columnType === "number";
        
        // ===== CASE 1: PAGINATION AFTER EMPTY VALUES =====
        // If the last row of the previous page had an empty/null value in the sort column
        if (cursorData.isEmptyOrNull) {
          // We're continuing from a row with an empty value
          // We need to find more rows with empty values after that row
          if (sort.direction === "asc") {
            // For ascending sort:
            conditions.push(PrismaNamespace.sql`(
              /* First, make sure we only get rows with empty values in this column */
              (NOT data ? ${sort.columnName} OR                             /* Column doesn't exist */
               data->>${sort.columnName} IS NULL OR                         /* Column is NULL */
               data->>${sort.columnName}::text = '' OR                      /* Column is empty string */
               data->>${sort.columnName}::text = 'null') AND                /* Column is 'null' string */
              
              /* Ensure we only fetch rows that come after the last one seen */
              /* Prioritize rows with a higher 'order' value */
              /* If 'order' is the same, use 'id' to break the tie and avoid duplicates */
              /* This logic supports stable pagination in ascending sort order */
              ("order" > ${cursorData.order ?? 0} OR                        /* Either a higher order value */
               ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''}))  /* Or same order but higher ID */
            )`);
          } else {
            // For descending sort:
            conditions.push(PrismaNamespace.sql`(
              /* First, make sure we only get rows with empty values in this column */
              (NOT data ? ${sort.columnName} OR                             /* Column doesn't exist */
               data->>${sort.columnName} IS NULL OR                         /* Column is NULL */
               data->>${sort.columnName}::text = '' OR                      /* Column is empty string */
               data->>${sort.columnName}::text = 'null') AND                /* Column is 'null' string */
              
              /* Then ensure we get rows AFTER the current position (in descending order) */
              ("order" < ${cursorData.order ?? 0} OR                        /* Either a lower order value (because DESC) */
               ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''}))  /* Or same order but lower ID (because DESC) */
            )`);
          }
        } 
        
        // ===== CASE 2: PAGINATION AFTER NUMERIC VALUES =====
        // If the last row had a numeric value in a number column
        else if (isNumberColumn && cursorData.value !== null && !Number.isNaN(cursorData.value)) {
          // We need to continue from a specific numeric value
          if (sort.direction === "asc") {
            // For ascending sort (smaller to larger numbers):
            conditions.push(PrismaNamespace.sql`(
              /* This query gets rows with valid numeric values GREATER THAN the current cursor value */
              (
                data ? ${sort.columnName} AND                               /* Column exists */
                data->>${sort.columnName} IS NOT NULL AND                   /* Column is not NULL */
                data->>${sort.columnName}::text != '' AND                   /* Column is not empty string */
                data->>${sort.columnName}::text != 'null' AND               /* Column is not 'null' string */
                data->>${sort.columnName}::text ~ '^[0-9]+$' AND            /* Column contains only digits */
                (
                  /* Either the value is greater than our cursor */
                  CAST(data->>${sort.columnName} AS NUMERIC) > ${cursorData.value} OR
                  
                  /* OR the value equals our cursor but the row comes later in order/ID */
                  (CAST(data->>${sort.columnName} AS NUMERIC) = ${cursorData.value} AND
                   ("order" > ${cursorData.order ?? 0} OR 
                    ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''})))
                )
              )
            )`);
          } else {
            // For descending sort (larger to smaller numbers):
            conditions.push(PrismaNamespace.sql`(
              /* PART 1: Get rows with numeric values SMALLER THAN the current cursor value */
              /* rows with number values smaller than the previous page's last row */
              (
                data ? ${sort.columnName} AND                               /* Column exists */
                data->>${sort.columnName} IS NOT NULL AND                   /* Column is not NULL */
                data->>${sort.columnName}::text != '' AND                   /* Column is not empty string */
                data->>${sort.columnName}::text != 'null' AND               /* Column is not 'null' string */
                data->>${sort.columnName}::text ~ '^[0-9]+$' AND            /* Column contains only digits */
                (
                  /* Either the value is smaller than our cursor */
                  CAST(data->>${sort.columnName} AS NUMERIC) < ${cursorData.value} OR
                  
                  /* OR the value equals our cursor but the row comes later in order/ID */
                  (CAST(data->>${sort.columnName} AS NUMERIC) = ${cursorData.value} AND
                   ("order" < ${cursorData.order ?? 0} OR 
                    ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''})))
                )
              )

              /* PART 2: OR get rows with empty or missing values */
              /* rows where that column is empty or null*/
              /* In descending sort, these come AFTER all valid numeric rows */
              /* This ensures pagination continues into empty cells if needed */
              OR (
                (NOT data ? ${sort.columnName} OR                           /* Column doesn't exist */
                 data->>${sort.columnName} IS NULL OR                       /* Column is NULL */
                 data->>${sort.columnName}::text = '' OR                    /* Column is empty string */
                 data->>${sort.columnName}::text = 'null')                  /* Column is 'null' string */
              )
            )`);
          }
        } 
        // ===== CASE 3: PAGINATION AFTER TEXT VALUES =====
        // If the last row had a text value in the sort column
        else if (cursorData.textValue) {
          // We need to continue from a specific text value
          if (sort.direction === "asc") {
            // For ascending sort (A to Z):
            conditions.push(PrismaNamespace.sql`(
              /* PART 1: Get rows with text values GREATER THAN the current cursor value */
              (
                data ? ${sort.columnName} AND                               /* Column exists */
                data->>${sort.columnName} IS NOT NULL AND                   /* Column is not NULL */
                data->>${sort.columnName}::text != '' AND                   /* Column is not empty string */
                data->>${sort.columnName}::text != 'null' AND               /* Column is not 'null' string */
                (
                  /* Either the text comes after our cursor alphabetically */
                  CAST(data->>${sort.columnName} AS TEXT) > ${cursorData.textValue} OR
                  
                  /* OR the text equals our cursor but the row comes later in order/ID */
                  (CAST(data->>${sort.columnName} AS TEXT) = ${cursorData.textValue} AND
                   ("order" > ${cursorData.order ?? 0} OR 
                    ("order" = ${cursorData.order ?? 0} AND "id" > ${cursorData.id ?? ''})))
                )
              )
              
              /* PART 2: For text columns only, we might need to include empty values after all text */
              /* (This is excluded for number columns since empty values are already handled separately) */
              ${!isNumberColumn ? PrismaNamespace.sql`
              OR (
                NOT data ? ${sort.columnName} OR                           /* Column doesn't exist */
                data->>${sort.columnName} IS NULL OR                       /* Column is NULL */
                data->>${sort.columnName}::text = '' OR                    /* Column is empty string */
                data->>${sort.columnName}::text = 'null'                   /* Column is 'null' string */
              )` : PrismaNamespace.sql``}
            )`);
          } else {
            // For descending sort (Z to A):
            conditions.push(PrismaNamespace.sql`(
              /* Get rows with text values LESS THAN the current cursor value */
              (
                data ? ${sort.columnName} AND                               /* Column exists */
                data->>${sort.columnName} IS NOT NULL AND                   /* Column is not NULL */
                data->>${sort.columnName}::text != '' AND                   /* Column is not empty string */
                data->>${sort.columnName}::text != 'null' AND               /* Column is not 'null' string */
                (
                  /* Either the text comes before our cursor alphabetically (because DESC) */
                  CAST(data->>${sort.columnName} AS TEXT) < ${cursorData.textValue} OR
                  
                  /* OR the text equals our cursor but the row comes later in order/ID */
                  (CAST(data->>${sort.columnName} AS TEXT) = ${cursorData.textValue} AND
                   ("order" < ${cursorData.order ?? 0} OR 
                    ("order" = ${cursorData.order ?? 0} AND "id" < ${cursorData.id ?? ''})))
                )
              )
            )`);
          }
        } 
        // ===== CASE 4: FALLBACK TO ROW ORDER =====
        // If we have no specific value to continue from, just use row order and ID
        else if (cursorData.order !== undefined && cursorData.id !== undefined) {
          // This is a simple fallback that works for any sort configuration
          if (sort.direction === "asc") {
            // For ascending order:
            conditions.push(PrismaNamespace.sql`(
              /* Get rows that come after the current row in order/ID */
              "order" > ${cursorData.order} OR                              /* Either a higher order value */
              ("order" = ${cursorData.order} AND "id" > ${cursorData.id})   /* Or same order but higher ID */
            )`);
          } else {
            // For descending order:
            conditions.push(PrismaNamespace.sql`(
              /* Get rows that come after the current row in reverse order/ID */
              "order" < ${cursorData.order} OR                              /* Either a lower order value (because DESC) */
              ("order" = ${cursorData.order} AND "id" < ${cursorData.id})   /* Or same order but lower ID (because DESC) */
            )`);
          }
        }
      } 
      // ===== CASE 5: NO SORT, JUST PAGINATION BY ROW ORDER =====
      // If we have a cursor but no sort configuration (just paginating by row order)
      else if (cursorData?.order !== undefined && cursorData?.id !== undefined) {
        // Use simple pagination by row order and ID
        conditions.push(PrismaNamespace.sql`(
          /* Get rows after the current position using row order and ID */
          "order" > ${cursorData.order} OR                                 /* Either a higher order value */
          ("order" = ${cursorData.order} AND "id" > ${cursorData.id})      /* Or same order but higher ID */
        )`);
      }

      // Combine all filter conditions with AND
      const whereClause = PrismaNamespace.join(conditions, " AND ");

      // Execute count query with the same filters to get total row count
      // This helps with UI pagination indicators
      const countResult = await ctx.db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count 
        FROM "Row"
        WHERE ${whereClause}
      `;
      
      const totalCount = Number(countResult[0].count);
      
      // ===== ORDER BY LOGIC =====
      // Build the ORDER BY clause for proper sorting
      // This section creates a sophisticated SQL ORDER BY that handles mixed data types
      let orderByClause;
      if (sort) {
        // Get the column type to determine how to sort
        const columnType = columns.find(col => col.name === sort.columnName)?.type;
        const isNumberColumn = columnType === "number";
        
        // Create a complex ORDER BY clause that handles multiple requirements:
        // 1. Group rows by whether they have valid values or empty values
        // 2. Sort valid numbers correctly as numbers (2 < 10), not as text ("10" < "2")
        // 3. Sort text alphabetically
        // 4. Ensure consistent row ordering with fallback to row order and ID

        // If text column, will skip the first two criteria since first two criteria is for numbers and just sort by text value
        orderByClause = PrismaNamespace.sql`
          -- FIRST SORT CRITERIA: Sort by whether the value is a valid number or not
          -- This creates two groups: valid numbers first (1), then empty/invalid values (0)
          -- The key point is that we're dividing all rows into two priority groups
          -- Sort rows by whether they contain valid numeric values. This groups valid numbers together and separates empty/non-numeric cells for consistent ordering.
          -- Case checks each row to see if it has a valid number. If it does, it puts it in priority group 1. If it doesn't, it puts it in priority group 0.
          CASE 
            WHEN data ? ${sort.columnName} AND                              -- Column exists in the data
                 data->>${sort.columnName} IS NOT NULL AND                  -- Value is not NULL
                 data->>${sort.columnName}::text != '' AND                  -- Value is not empty string
                 data->>${sort.columnName}::text != 'null' AND              -- Value is not 'null' string
                 data->>${sort.columnName}::text ~ '^[0-9]+$' AND           -- Value contains only digits
                 ${isNumberColumn}                                          -- Column is defined as a number type
            THEN 1                                                          -- This row has a valid number, priority group 1
            ELSE 0                                                          -- This row has empty/invalid value, priority group 0
          END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`}, -- Sort the output of this CASE statement in ascending or descending order
          
          -- SECOND SORT CRITERIA: Sort by the actual number value (for number columns)
          -- This only affects rows in priority group 1 (valid numbers from above)
          -- For example, in this step we sort 5, 10, 25 in proper numeric order
          CASE 
            WHEN data ? ${sort.columnName} AND                              -- Column exists in the data
                 data->>${sort.columnName} IS NOT NULL AND                  -- Value is not NULL
                 data->>${sort.columnName}::text != '' AND                  -- Value is not empty string
                 data->>${sort.columnName}::text != 'null' AND              -- Value is not 'null' string
                 data->>${sort.columnName}::text ~ '^[0-9]+$' AND           -- Value contains only digits
                 ${isNumberColumn}                                          -- Column is defined as a number type
            THEN CAST(data->>${sort.columnName} AS NUMERIC)                 -- Convert to number for proper numeric sorting
            ELSE NULL                                                       -- Set to NULL for rows without valid numbers
          END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`} NULLS LAST,
          
          -- THIRD SORT CRITERIA: Sort by text value (for text columns)
          -- This handles alphabetical sorting for text columns
          -- For example, in this step we sort "Apple", "Banana", "Cherry"
          CASE 
            WHEN data ? ${sort.columnName} AND                              -- Column exists in the data
                 data->>${sort.columnName} IS NOT NULL AND                  -- Value is not NULL
                 data->>${sort.columnName}::text != '' AND                  -- Value is not empty string
                 data->>${sort.columnName}::text != 'null' AND              -- Value is not 'null' string
                 NOT ${isNumberColumn}                                      -- Column is defined as a text type
            THEN CAST(data->>${sort.columnName} AS TEXT)                    -- Use the text value for alphabetical sorting
            ELSE NULL                                                       -- Set to NULL for rows without valid text
          END ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`} NULLS LAST,
          
          -- FOURTH SORT CRITERIA: Tie-breakers for stable sorting
          -- These ensure consistent results when rows have identical values
          -- Without these, rows with the same values might appear in random order
          "order" ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`},
          "id" ${sort.direction === "asc" ? PrismaNamespace.sql`ASC` : PrismaNamespace.sql`DESC`}
        `;
      } else {
        // If no sort is specified, default to ordering by row order and ID
        // This gives a stable, predictable order based on row insertion sequence
        orderByClause = PrismaNamespace.sql`"order" ASC, "id" ASC`;
      }

      // ===== EXECUTE MAIN QUERY =====
      // Execute the main query to get the rows with pagination
      // Uses the WITH clause to apply all filters once before sorting and limiting
      const rows = await ctx.db.$queryRaw<Row[]>`
        WITH filtered_rows AS (
          SELECT * 
          FROM "Row"
          WHERE ${whereClause}
        )
        SELECT *
        FROM filtered_rows
        ORDER BY ${orderByClause}
        LIMIT ${limit + 1}  -- Fetch one extra row to check if there's more data
      `;

      // ===== PROCESS RESULTS AND SET UP NEXT PAGE =====
      // Check if there are more results beyond the requested limit
      // If we got more rows than requested, there must be a next page
      const hasNextPage = rows.length > limit;
      
      // Only return up to the limit, keeping the extra row just to check if there's a next page
      // This ensures we don't send more data than requested to the client
      // If we fetched 151 rows (and limit is 150), this slices it back down to just 150.
      // That extra row was only used to detect whether more data exists
      const items = hasNextPage ? rows.slice(0, limit) : rows;

      // ===== GENERATE NEXT CURSOR =====
      // Generate the next cursor for pagination based on the last row
      // This cursor is the key to effective continuation of pagination
      let nextCursor = null;
      if (hasNextPage && items.length > 0) {
        const lastRow = items[items.length - 1];
        
        // Create a different cursor format based on sort configuration
        if (lastRow && sort) {
          // Extract the value of the sort column from the last row
          const sortValue = lastRow.data[sort.columnName];
          const columnType = columns.find(col => col.name === sort.columnName)?.type;
          const isNumberColumn = columnType === "number";
          
          // Check if the value is empty or null in any form
          // This determines which pagination strategy to use next
          const isEmptyOrNull = 
            !lastRow.data.hasOwnProperty(sort.columnName) ||
            sortValue === null || 
            sortValue === undefined || 
            sortValue === "" || 
            sortValue === "null";
                  
          if (isEmptyOrNull) {
            // For empty values, the cursor just needs row order and ID
            // This will use CASE 1 pagination on the next request
            nextCursor = JSON.stringify({
              isEmptyOrNull: true,
              order: lastRow.order,
              id: lastRow.id
            });
          } else {
            // For non-empty values, include the actual sort value
            // Check if this is a numeric value in a number column
            const isNumeric = isNumberColumn && (
              typeof sortValue === "number" ||
              (typeof sortValue === "string" && /^[0-9]+$/.test(sortValue))
            );

            // Convert to numeric value if it's a number column with numeric content
            // This ensures proper comparison in the next query
            const numValue = isNumeric ? Number(sortValue) : null;

            // Create cursor with all necessary data for the next page
            // This will use CASE 2 or CASE 3 pagination depending on the value type
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
          // This will use CASE 5 pagination on the next request
          nextCursor = JSON.stringify({
            order: lastRow.order,
            id: lastRow.id
          });
        }
      }

      // Return all the table data with pagination information
      return {
        columns,     // Column definitions
        rows: items, // The actual row data
        nextCursor,  // Cursor for getting the next page
        totalCount,  // Total count of rows matching the filters
      };
    }),

  // Procedure to update a single cell value
  // This handles individual cell edits in the table
  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),     // Table ID for permission checking
        rowId: z.string(),       // Row to update
        columnName: z.string(),  // Column name to update
        value: z.union([z.string(), z.number(), z.null()]), // New value (supports text, numbers, or null)
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find the row to update
      const row = await ctx.db.row.findUnique({
        where: { id: input.rowId },
      });

      // Return error if row not found
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });

      // Convert the JSON data to a proper object
      const currentData = row.data as Prisma.JsonObject;

      // Create a new data object with the updated value
      // This preserves all other column values while updating just the one cell
      const updatedData = {
        ...currentData,
        [input.columnName]: input.value,
      } as Prisma.InputJsonValue;

      // Update the row with the new data
      return await ctx.db.row.update({
        where: { id: input.rowId },
        data: {
          data: updatedData,
        },
      });
    }),

  // Procedure to create a new row with default data
  // Supports client-side generated IDs for optimistic updates
  createRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(), // Table to add the row to
        defaultData: z.record(z.union([z.string(), z.number(), z.null()])), // Initial cell values
        _clientId: z.string().optional(), // Optional client-generated ID for optimistic updates
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use a transaction to ensure both operations succeed or fail together
      const newRow = await ctx.db.$transaction(async (prisma) => {
        // Find the last row to determine the next order value
        const lastRow = await prisma.row.findFirst({
          where: { tableId: input.tableId },
          orderBy: { order: "desc" },
        });
        
        // Calculate next order value (increment from last, or 0 if no rows)
        const nextOrder = (lastRow?.order ?? -1) + 1;
        
        // Prepare the JSON data, including client ID if provided
        const jsonData = {
          ...input.defaultData,
          ...(input._clientId ? { _clientId: input._clientId } : {}),
        } as Prisma.InputJsonValue;
        
        // Create the new row
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

  // Procedure to create a new column in a table
  createColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),    // Table to add the column to
        name: z.string(),       // Column name
        type: z.enum(["text", "number"]), // Column type
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First check if column already exists to prevent duplicates
      const existingColumn = await ctx.db.column.findFirst({
        where: {
          tableId: input.tableId,
          name: input.name,
        },
      });

      // Return error if column name already exists
      if (existingColumn) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A column with this name already exists",
        });
      }

      // Get current highest order value to position the new column
      const lastColumn = await ctx.db.column.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });

      // Calculate next order value
      const nextOrder = (lastColumn?.order ?? 0) + 1;

      // Create the column definition
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

  // Procedure to delete a column from a table
  // This removes both the column definition and the data from all rows
  deleteColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),    // Table containing the column
        columnName: z.string(), // Column name to delete
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find the column to verify it exists before deleting
      const column = await ctx.db.column.findFirst({
        where: {
          tableId: input.tableId,
          name: input.columnName,
        },
      });

      // Return error if column not found
      if (!column) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Column not found",
        });
      }

      // Delete the column definition first from the columns table
      await ctx.db.column.delete({
        where: {
          id: column.id,
        },
      });

      // Use raw SQL to efficiently remove the column from all rows at once
      // This is much faster than updating each row individually
      await ctx.db.$executeRaw`
        UPDATE "Row"
        SET "data" = "data" - ${input.columnName}
        WHERE "tableId" = ${input.tableId}
      `;

      return { success: true };
    }),

  // Procedure to create multiple rows in bulk
  // Used for adding fake data and importing large datasets
  createRows: protectedProcedure
  .input(
    z.object({
      tableId: z.string(), // Table to add rows to
      rows: z.array(      // Array of row data objects
        z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
      ),
      startOrder: z.number().optional(), // Optional starting order value
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Use the provided startOrder or get the current max order
    let startOrder = input.startOrder;
    
    if (startOrder === undefined) {
      // Find the highest order value if not provided
      const lastRow = await ctx.db.row.findFirst({
        where: { tableId: input.tableId },
        orderBy: { order: "desc" },
      });
      startOrder = (lastRow?.order ?? 0);
    }
    
    // Prepare all row data for bulk insert with sequential order values
    const rowsToCreate = input.rows.map((rowData, index) => ({
      tableId: input.tableId,
      order: startOrder + index + 1, // Increment order for each row
      data: rowData,
    }));
    
    // Use createMany for efficient bulk insertion
    // This is much faster than creating rows one by one
    const result = await ctx.db.row.createMany({
      data: rowsToCreate,
      skipDuplicates: false, // Don't skip duplicates, we want all rows
    });
    
    return {
      count: result.count, // Return number of rows created
      success: true
    };
  }),


  // Procedure to delete a row from a table
  deleteRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(), // Table containing the row
        rowId: z.string(),   // Row ID to delete
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, rowId } = input;
      
      // Verify the user has permissions to delete rows in this table
      const user = await ctx.db.user.findUnique({
        where: { clerkId: ctx.auth.userId },
      });
      if (!user) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User not found",
        });
      }
      
      // Verify the table exists and belongs to the user's base
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
      
      // Delete the row
      await ctx.db.row.delete({ where: { id: rowId } });
      return { success: true };
    }),

  // Procedure to update the order of rows
  // This allows reordering rows through drag and drop
  updateRowOrder: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),      // Table containing the rows
        rowIds: z.array(z.string()), // Array of row IDs in the new order
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tableId, rowIds } = input;

      try {
        // First, find the table to ensure it exists
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
        // Permission check normally verifies the user owns the table
        // if (table.base.userId !== ctx.auth.userId) {
        //   throw new TRPCError({
        //     code: "FORBIDDEN",
        //     message: "You don't have access to this table",
        //   });
        // }

        // The key part: use a two-step approach to avoid unique constraint violations
        // Step 1: First, move all rows to temporary negative order values
        // This prevents conflicts during reordering due to unique constraints
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

        // Step 2: Then set them to their final order values
        // Now we can safely set the final order values without conflicts
        await ctx.db.$transaction(
          rowIds.map((rowId, index) =>
            ctx.db.row.update({
              where: {
                id: rowId,
                tableId,
              },
              data: {
                order: index, // Final sequential order
              },
            })
          )
        );

        return { success: true };
      } catch (error) {
        // Log and return a friendly error message
        console.error("Error updating row order:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update row order",
        });
      }
    }),
});
