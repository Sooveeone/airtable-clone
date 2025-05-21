"use client";

// React hooks for state management and UI interactions
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
// Next.js navigation hooks
import { useParams } from "next/navigation";
// TanStack Table imports for data table functionality
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type AccessorKeyColumnDef,
  type CellContext,
  type Row,
} from "@tanstack/react-table";
// TRPC API client for backend communication
import { api } from "@/trpc/react";
// TanStack virtualization for efficient rendering of large datasets
import { useVirtualizer } from "@tanstack/react-virtual";
// UI components from Lucide
import { Loader2 } from "lucide-react";
// Faker library for generating test data
import { faker } from "@faker-js/faker";

// Import types for type-safety throughout the application
import type { 
  RecordRow,      // Type for a row in the table
  ColumnValue,    // Type for column values
  ColumnMeta,     // Type for column metadata
  FilterType,     // Type for filter configuration
  SortType,       // Type for sort configuration
  TableColumn     // Type for table column definition
} from "./types";

// Import utility functions and hooks
import { generateFakeRecord, defaultColumnsKeys } from "./utils";
import { useDelayedLoading, useOutsideClick } from "./hooks";

// Import UI components for the table and related interfaces
import { TopNavigation } from "./components/TopNavigation";
import { TableHeader } from "./components/TableHeader";
import { TableToolbar } from "./components/TableToolbar";
import { ColumnHeader as TableColumnHeader } from "./components/ColumnHeader";
import { CellRenderer as TableCellRenderer } from "./components/CellRenderer";
import { RowNumberCell as TableRowNumberCell } from "./components/RowNumberCell";
import { TableFooter } from "./components/TableFooter";
// import { AddFieldModal } from "./components/AddFieldModal";
import { ViewsSidebar } from "./ViewsSidebar";

// -------------------------------------------------------------------------
// Types and Helpers
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// BasePage Component - Main component for the Airtable clone base page
// -------------------------------------------------------------------------
export default function BasePage() {
  // Get baseId from URL parameters
  const { baseId } = useParams();
  
  // All state declarations
  // ---------------------
  // Core table data
  const [data, setData] = useState<RecordRow[]>([]); // Holds the table rows data
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null); // Tracks the currently selected cell for editing
  const [tableId, setTableId] = useState<string | null>(null); // Current active table ID
  const [activeViewId, setActiveViewId] = useState<string | null>(null); // Current active view ID
  
  // UI state flags
  const [isSaving, setIsSaving] = useState(false); // Indicates if data is being saved
  const [isAddingColumn, setIsAddingColumn] = useState(false); // Flag for column addition in progress
  const [isAddTableMenuOpen, setIsAddTableMenuOpen] = useState(false); // Controls table creation menu visibility
  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState(false); // Controls views sidebar visibility
  const [isViewSettingsUpdating, setIsViewSettingsUpdating] = useState(false); // Flag for view settings update in progress
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false); // Controls search modal visibility
  const [searchQuery, setSearchQuery] = useState(""); // Current search term
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Flag for initial data loading
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set()); // Set of hidden column names
  
  // Modal visibility states
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false); // Controls filter modal visibility
  const [isSortModalOpen, setIsSortModalOpen] = useState(false); // Controls sort modal visibility
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false); // Controls field addition modal visibility
  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false); // Controls field hiding options visibility
  
  // Bulk operations state
  const [isAddingBulkRows, setIsAddingBulkRows] = useState(false); // Flag for bulk row addition in progress
  const [bulkRowProgress, setBulkRowProgress] = useState({
    current: 0,
    total: 0,
  }); // Tracks progress of bulk row addition
  
  // New field attributes
  const [newFieldName, setNewFieldName] = useState(""); // Name for new field being created
  const [newFieldType, setNewFieldType] = useState<"text" | "number">("text"); // Type for new field
  const [fieldError, setFieldError] = useState<string>(""); // Error message for field validation

  // All refs
  // --------
  // DOM element refs for virtualization and UI interaction
  const parentRef = useRef<HTMLDivElement>(null); // Reference to the table container
  const initialTableCreationAttempted = useRef(false); // Tracks if initial table creation was attempted
  const editedCellsRef = useRef<Map<string, { value: string | number | null }>>(new Map()); // Stores edited cells before saving
  const shouldCancelBulkRowsRef = useRef(false); // Flag to cancel bulk row creation
  const lastUpdateRef = useRef<string | null>(null); // Tracks last update hash to prevent duplicate updates
  
  // Refs for popovers and modals
  const searchModalRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const addFieldModalRef = useRef<HTMLDivElement>(null);
  const addTableButtonRef = useRef<HTMLDivElement>(null); // Reference for the add table button
  
  // Add click outside handlers for the popovers
  useOutsideClick(() => setIsFieldModalOpen(false), [addFieldModalRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsFilterModalOpen(false), [filterPopoverRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsSortModalOpen(false), [sortPopoverRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsHideFieldsOpen(false), [hideFieldsRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsSearchModalOpen(false), [searchModalRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsAddTableMenuOpen(false), [addTableButtonRef as React.RefObject<Element>]);
  
  // Data loading state refs
  const isLoadingMoreRef = useRef(false); // Tracks if more data is being loaded during infinite scroll
  const dataRef = useRef<RecordRow[]>([]); // Ref to current data for asynchronous access
  
  // Track deleted row IDs to filter them from UI immediately
  const deletedRowIdsRef = useRef<Set<string>>(new Set());
  
  // Table filter and sort states
  const [activeFilter, setActiveFilter] = useState<FilterType | undefined>(undefined); // Current active filter
  const [activeSort, setActiveSort] = useState<SortType | undefined>(); // Current active sort
  
  // -----------------------------------------------------------------------
  // Data Fetching & Table Creation
  // -----------------------------------------------------------------------
  
  // Fetch base details using the baseId from URL params
  const { data: base, isLoading: isBaseLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });

  // Fetch all tables belonging to this base
  const {
    data: tables,
    isLoading: isTablesLoading,
    refetch: refetchTables,
  } = api.table.getTablesForBase.useQuery(
    { baseId: baseId as string },
    { enabled: !!baseId } // Only run query when baseId is available
  );

  // Fetch views for the selected table
  const { data: views, refetch: refetchViews } =
    api.view.getViewsForTable.useQuery(
      { tableId: tableId ?? "" },
      {
        enabled: !!tableId, // Only run query when tableId is available
      }
    );

  // Mutation for updating view settings (filters, sorts, hidden columns)
  const updateViewMutation = api.view.updateView.useMutation();

  // Create a stable callback for updating view settings
  // This prevents unnecessary rerenders and API calls
  const updateViewSettings = useCallback(
    (viewId: string, settings: {
      filter: FilterType | null;
      sort: SortType | null;
      hiddenColumns: string[];
    }) => {
      // Create a hash of the settings to compare with last update
      const settingsHash = JSON.stringify({
        viewId,
        ...settings
      });

      // Skip if this is the same update as last time
      if (lastUpdateRef.current === settingsHash) {
        return;
      }

      // Update the view with new settings
      setIsViewSettingsUpdating(true);
      updateViewMutation.mutate(
        {
          id: viewId,
          ...settings
        },
        {
          onSuccess: () => {
            lastUpdateRef.current = settingsHash;
            // Refetch the views to get updated data
            void refetchViews();
            setIsViewSettingsUpdating(false);
          },
          onError: () => {
            lastUpdateRef.current = null;
            setIsViewSettingsUpdating(false);
          }
        }
      );
    },
    [updateViewMutation, refetchViews]
  );

  // Effect to handle initial view selection when views are loaded
  useEffect(() => {
    const firstView = views?.[0];
    if (!activeViewId && firstView) {
      setActiveViewId(firstView.id);
      
      // Apply the view's filter settings if available
      if (firstView.filter) {
        setActiveFilter(firstView.filter as FilterType);
      }
      
      // Apply the view's sort settings if available
      if (firstView.sort && typeof firstView.sort === 'object') {
        const sortData = firstView.sort as { columnName: string; direction: "asc" | "desc" };
        if (sortData.columnName && sortData.direction) {
          setActiveSort(sortData);
        }
      }
      
      // Apply the view's hidden columns settings if available
      if (firstView.hiddenColumns) {
        const columns = Array.isArray(firstView.hiddenColumns)
          ? firstView.hiddenColumns.filter(
              (col): col is string => typeof col === "string"
            )
          : [];
        setHiddenColumns(new Set(columns));
      }
    }
  }, [views, activeViewId]);

  // Effect to automatically update view settings when filter, sort, or hidden columns change
  useEffect(() => {
    if (!activeViewId || isViewSettingsUpdating) return;

    const currentView = views?.find((v) => v.id === activeViewId);
    if (!currentView) return;

    // Get current settings, converting undefined to null for database storage, PostgreSQL does not support undefined
    const currentSettings = {
      filter: activeFilter ?? null,
      sort: activeSort ?? null,
      hiddenColumns: Array.from(hiddenColumns)
    };

    // Skip if nothing has changed from the view's current settings
    const viewSettings = {
      filter: currentView.filter ?? null,
      sort: currentView.sort ?? null,
      hiddenColumns: Array.isArray(currentView.hiddenColumns)
        ? currentView.hiddenColumns.filter(
            (col): col is string => typeof col === "string"
          )
        : []
    };

    // Compare settings using JSON.stringify to detect changes
    if (JSON.stringify(currentSettings) === JSON.stringify(viewSettings)) {
      return;
    }

    // Update the view settings if they've changed
    updateViewSettings(activeViewId, currentSettings);
  }, [activeViewId, activeFilter, activeSort, hiddenColumns, isViewSettingsUpdating, views, updateViewSettings]);

  // Handler for switching between different views
  const handleViewSelect = (viewId: string) => {
    const view = views?.find((v) => v.id === viewId);
    if (!view) return;

    // Reset the last update hash since we're switching views
    lastUpdateRef.current = null;
    setIsViewSettingsUpdating(true);

    // Batch all state updates together for better performance
    const newFilter = view.filter ? (view.filter as FilterType) : undefined;
    const newSort = view.sort ? (view.sort as SortType) : undefined;
    const newHiddenColumns = new Set(
      Array.isArray(view.hiddenColumns)
        ? view.hiddenColumns.filter((col): col is string => typeof col === "string")
        : []
    );

    // Update all states at once
    setActiveViewId(viewId);
    setActiveFilter(newFilter);
    setActiveSort(newSort);
    setHiddenColumns(newHiddenColumns);

    // Clear the updating flag after a short delay to allow state updates to complete
    setTimeout(() => {
      setIsViewSettingsUpdating(false);
    }, 100);
  };

  // Query to fetch table data with infinite scrolling support
  const {
    data: tableData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = api.table.getTableData.useInfiniteQuery(
    {
      // Input parameters
      tableId: tableId ?? "",
      limit: 150, // Number of rows to fetch per page
      searchQuery,  // Current search term
      filter: activeFilter, // Active filter settings
      sort: activeSort, // Active sort settings
    },
    {
      // Configuration options
      getNextPageParam: (lastPage) => lastPage.nextCursor, // Get cursor for next page, last page is the last page in the paginated result set.
      enabled: !!tableId, // Only run query when tableId is available
    }
  );

  // State for table creation
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  // Mutation for creating a new table
  const createTableMutation = api.table.createTable.useMutation({
    onSuccess: async (newTable) => {
      setTableId(newTable.id);
      setIsCreatingTable(false);
      setTableError(null);
      // Refetch both the tables list and table data
      await refetchTables();
      void refetch();
    },
    onError: (error) => {
      setTableError(error.message);
      setIsCreatingTable(false);
    },
  });

  // Effect to create initial table if none exists
  useEffect(() => {
    if (
      !baseId ||
      !tables ||
      isTablesLoading ||
      initialTableCreationAttempted.current
    )
      return;

    if (tables.length === 0) {
      initialTableCreationAttempted.current = true;
      void createTableMutation.mutateAsync({
        baseId: baseId as string,
        name: "Table 1",
        columns: defaultColumnsKeys.map((name) => ({ name, type: "text" })),
      });
    }
  }, [baseId, tables, isTablesLoading, createTableMutation]);

  // Effect to set initial table selection when tables are loaded
  useEffect(() => {
    if (tables && tables.length > 0 && !tableId && tables[0]?.id) {
      setTableId(tables[0].id);
    }
  }, [tables, tableId]);

  // Effect to handle table switching and data refresh
  useEffect(() => {
    if (tableId) {
      // Reset all view-related states when switching tables
      setActiveFilter(undefined);
      setActiveSort(undefined);
      setHiddenColumns(new Set());
      setActiveViewId(null);
      setData([]);
      setIsInitialLoading(true);
      // Refetch the table data
      void refetch();
    }
  }, [tableId, refetch]);

  // Function to create a new table
  const handleCreateNewTable = async () => {
    if (!baseId || !tables) return;

    setIsCreatingTable(true);
    setTableError(null);

    const nextTableNumber = tables.length + 1;

    try {
      await createTableMutation.mutateAsync({
        baseId: baseId as string,
        name: `Table ${nextTableNumber}`,
        columns: defaultColumnsKeys.map((name) => ({ name, type: "text" })),
      });
      setIsAddTableMenuOpen(false);
    } catch (error) {
      console.error("Failed to create table:", error);
    }
  };

  // Effect to clear search when switching tables or views
  useEffect(() => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
  }, [tableId, activeViewId]);

  // Mutation for updating cell values
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

  // Effect to process tableData and update local state
  /**
   * This effect handles processing the raw API response data (tableData) into the 
   * format needed for rendering in our table. It runs whenever tableData changes.
   * 
   * Key responsibilities:
   * 1. Combining data from all pages of the infinite query
   * 2. Filtering out deleted rows
   * 3. Applying pending edits from the editedCellsRef
   * 4. Updating local state and references
   * 5. Resetting loading states
   */
  useEffect(() => {
    if (tableData) {
      // Step 1: Combine all rows from all pages of the infinite query
      // The flatMap() merges rows from all pages into a single array
      const allRows = tableData.pages.flatMap((page) => page.rows);
      
      // Step 2: Process each row - filter deleted rows and format data
      const formattedData = allRows
        // Filter out any rows that have been marked as deleted
        // deletedRowIdsRef tracks rows deleted during the current session
        .filter((row) => !deletedRowIdsRef.current.has(row.id)) 
        
        // Step 3: Transform each row object into our RecordRow format
        .map((row) => {
          // Create a new row object with the ID and all data fields
          const rowData: RecordRow = {
            id: row.id,
            // Spread the row data as key-value pairs into the object
            // This converts the API row format to our internal format
            ...(row.data as Record<string, string | number | null>),
          };

          // Step 4: Apply any pending unsaved edits to this row
          // This ensures users immediately see their changes even before API save completes
          const rowId = row.id;
          if (rowId) {
            // Iterate through all pending edits in editedCellsRef
            for (const [key, value] of editedCellsRef.current.entries()) {
              // Each key is formatted as "rowId|columnName"
              const [editedRowId, columnName] = key.split("|");
              
              // If this edit applies to the current row, apply it to the row data
              if (
                editedRowId === rowId &&
                columnName &&
                typeof columnName === "string"
              ) {
                // Override the API data with the locally edited value
                rowData[columnName] = value.value;
              }
            }
          }

          return rowData;
        });

      // Step 5: Update React state with the processed data
      setData(formattedData);
      
      // Also update our ref for direct access outside of render cycles
      // This is important for async operations that need current data
      dataRef.current = formattedData;

      // Step 6: Clear loading states now that data is ready
      setIsInitialLoading(false);
      isLoadingMoreRef.current = false;
    }
  }, [tableData]);

  // Initialize dataRef when data changes
  /**
   * This secondary effect ensures dataRef always contains the latest data.
   * It runs whenever the data state changes, including from local edits.
   * The ref provides a way to access current data in callbacks without
   * causing dependency issues or re-renders.
   */
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  
  // -----------------------------------------------------------------------
  // Column & Row Mutations
  // -----------------------------------------------------------------------
  
  // Mutation for deleting a column
  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onSuccess: () => {
      // Refetch the table data after deleting a column
      if (tableId) {
        void fetchNextPage();
      }
    },
    onError: (err) => {
      console.error("Failed to delete column:", err);
    },
  });
  
  // Handler for deleting a column
  const handleDeleteColumn = useCallback(
    (name: string) => {
      if (!tableId) return;
      deleteColumnMutation.mutate({ tableId, columnName: name }, {
        onSuccess: () => {
          void refetch();
        }
      });
    },
    [tableId, deleteColumnMutation, refetch]
  );

  // Mutation for deleting a row
  const deleteRowMutation = api.table.deleteRow.useMutation({
    onSuccess: (_, variables) => {
      // Add the deleted row ID to our tracking set
      deletedRowIdsRef.current.add(variables.rowId);

      // Immediately update the UI by removing the deleted row
      setData((prevData) =>
        prevData.filter((row) => row.id !== variables.rowId)
      );
    },
    onError: (error) => {
      console.error("Failed to delete row:", error);
    },
  });

  // Handler for deleting a row
  const handleDeleteRow = useCallback(
    (rowId: string) => {
      if (!tableId || !rowId) return;
      deleteRowMutation.mutate({ tableId, rowId });
    },
    [tableId, deleteRowMutation]
  );
  
   // -----------------------------------------------------------------------
  // Build Columns (Prepending the row number column)
  // -----------------------------------------------------------------------
  
  /**
   * Defines the structure of table columns using TanStack Table's AccessorKeyColumnDef, defines how each column should behave and render.
   * 
   * This useMemo block:
   * 1. Creates a special first column for row numbers and selection
   * 2. Transforms the data columns from our backend into the format required by TanStack Table
   * 3. Handles column visibility (hiding/showing columns)
   * 4. Sets up the rendering for column headers and cell contents
   */
  const columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[] =
    useMemo(() => {
      // If we don't have any table data yet, return an empty array
      if (!tableData?.pages[0])
        return [] as AccessorKeyColumnDef<RecordRow, ColumnValue>[];
      
      // ---------------------------------------------------------------------------
      // Step 1: Create the special row number/selection column that appears first
      // ---------------------------------------------------------------------------
      const rowNumberColumn: AccessorKeyColumnDef<RecordRow, ColumnValue> = {
        accessorKey: "rowNumber", // Unique identifier for this column
        id: "rowNumber",          // ID used by TanStack Table for this column
        header: () => (
          // The header cell contains a checkbox for selecting all rows (not yet implemented)
          <div className="flex h-full w-full items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
            />
          </div>
        ),
        size: 80,               // Fixed width in pixels
        enableResizing: false,  // Prevents users from resizing this column
        cell: ({ row }: { row: Row<RecordRow> }) => (
          // Each row's cell contains the row number and a delete button
          <TableRowNumberCell
            index={row.index}                               // Pass the row index (0-based)
            onDeleteRow={() => handleDeleteRow(row.original.id ?? "")} // Pass delete handler
          />
        ),
      };

      // ---------------------------------------------------------------------------
      // Step 2: Get column metadata from the first page of table data
      // ---------------------------------------------------------------------------
      const currentData = tableData.pages[0];
      
      // ---------------------------------------------------------------------------
      // Step 3: Transform the backend column definitions into TanStack Table format
      // ---------------------------------------------------------------------------
      const dataColumns = (currentData.columns ?? [])
        // Filter out any columns that should be hidden based on user preferences
        .filter((col: TableColumn) => !hiddenColumns.has(col.name))
        // Transform each remaining column into the required format
        .map((col: TableColumn) => ({
          accessorKey: col.name,  // The column name is used as the key to access data
          meta: { 
            type: col.type as "text" | "number" // Store the column type as metadata
          },
          header: () => (
            // Render a custom header component for each column
            // This includes the column name and a delete button
            <TableColumnHeader
              name={col.name}
              onDelete={() => handleDeleteColumn(col.name)}
              type={col.type as "text" | "number"}
            />
          ),
          cell: (props: CellContext<RecordRow, ColumnValue>) => (
            // Render a custom cell component for displaying and editing data
            <TableCellRenderer
              {...props}                        // Pass all original props
              keyName={col.name}                // Column name for this cell
              fieldType={col.type as "text" | "number"}  // Data type
              selectedCell={selectedCell}       // Currently selected cell info
              setSelectedCell={setSelectedCell} // Function to select a cell
              setData={setData}                 // Function to update table data
              tableId={tableId}                 // Current table ID
              setIsSaving={setIsSaving}         // Function to toggle saving state
              updateCellMutation={updateCellMutation} // Mutation for saving changes
              searchQuery={searchQuery}         // Current search term
              editedCellsRef={editedCellsRef}   // Ref for tracking unsaved edits
              activeFilter={activeFilter}       // Current filter settings
              activeSort={activeSort}           // Current sort settings
            />
          ),
        }));
        
      // ---------------------------------------------------------------------------
      // Step 4: Combine the row number column with all data columns
      // ---------------------------------------------------------------------------
      // The row number column is first, followed by all the data columns
      return [rowNumberColumn, ...(dataColumns ?? [])];
    }, [
      // Dependencies for this useMemo - when any of these change, columns will be recalculated
      tableData,               // Recalculate when table data changes
      handleDeleteColumn,      // Recalculate when column deletion handler changes
      handleDeleteRow,         // Recalculate when row deletion handler changes
      selectedCell,            // Recalculate when selected cell changes
      setSelectedCell,         // Recalculate when cell selection handler changes
      setData,                 // Recalculate when data update handler changes
      tableId,                 // Recalculate when active table changes
      setIsSaving,             // Recalculate when saving state setter changes
      updateCellMutation,      // Recalculate when cell update mutation changes
      searchQuery,             // Recalculate when search query changes
      editedCellsRef,          // Recalculate when edited cells reference changes
      activeFilter,            // Recalculate when filter changes
      activeSort,              // Recalculate when sort changes
      hiddenColumns,           // Recalculate when hidden columns change
    ]);
  
  // -----------------------------------------------------------------------
  // Row & Column Creation Mutations
  // -----------------------------------------------------------------------
  
  // Mutation for creating a single row
  const createRowMutation = api.table.createRow.useMutation({
    onSuccess: (newRow) => {
      // Add the newly created row to the local data state
      setData((prev) => [
        ...prev,
        {
          id: newRow.id,
          ...(newRow.data as Record<string, string | number | null>),
        },
      ]);
    },
  });

  // Mutation for creating a new column
  const createColumnMutation = api.table.createColumn.useMutation({
    onSuccess: (newColumn) => {
      if (tableId) {
        // Force a complete refresh of the table data
        void refetch();

        // Update the local data to include the new column with default values
        setData((prevData) =>
          prevData.map((row) => ({
            ...row,
            [newColumn.name]: newColumn.type === "number" ? null : "",
          }))
        );
      }
      setIsAddingColumn(false);
    },
    onError: (error) => {
      console.error("Failed to add column:", error);
      setIsAddingColumn(false);
    },
  });

  // Handler for adding a new column
  const handleAddColumn = () => {
    // Clear previous errors
    setFieldError("");
    
    // Validate field name
    if (!newFieldName.trim()) {
      setFieldError("Field name is required");
      return;
    }
    
    if (!tableId) {
      setFieldError("No active table selected");
      return;
    }
    
    // Check for duplicate column name
    const columnExists = tableData?.pages[0]?.columns?.some(
      (col) => col.name.toLowerCase() === newFieldName.trim().toLowerCase()
    );
    
    if (columnExists) {
      setFieldError("A column with this name already exists");
      return;
    }
    
    // Create the new column
    setIsAddingColumn(true);
    createColumnMutation.mutate({
      tableId,
      name: newFieldName.trim(),
      type: newFieldType,
    }, {
      onSuccess: () => {
        void refetch();
        setIsAddingColumn(false);
        setNewFieldName("");
        setNewFieldType("text");
        setIsFieldModalOpen(false);
        setFieldError("");
      },
      onError: (error) => {
        console.error("Failed to add column:", error);
        setFieldError("Failed to create column");
        setIsAddingColumn(false);
      }
    });
  };

  // Mutation for creating multiple rows in bulk
  const createRowsMutation = api.table.createRows.useMutation();

  // Handler for creating a single row with fake data
  const createRowHandler = async () => {
    if (!tableId) return;
    if (isSaving) return;
    setIsSaving(true);
    
    // Create default data object with fake values for all columns
    const defaultData: Record<string, string | number | null> = {};

    // Get all columns except the rowNumber column
    const dataColumns = columns.filter(
      (col) => col.accessorKey && col.accessorKey !== "rowNumber"
    );

    // Generate fake data for each column based on its type
    dataColumns.forEach((col) => {
      if (!col.accessorKey) return;
      const key = col.accessorKey;
      const meta = col.meta as ColumnMeta | undefined;
      const columnType = meta?.type ?? "text"; // Default to text if not specified

      defaultData[key] =
        columnType === "number"
          ? faker.number.int({ min: 0, max: 100 })
          : faker.word.words({ count: faker.number.int({ min: 1, max: 3 }) });
    });

    try {
      // Create the row with the generated data
      await createRowMutation.mutateAsync({
        tableId,
        defaultData,
      });
      // Refetch to get the latest data
      void refetch();
    } catch (error) {
      console.error("Failed to create row:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for adding multiple fake records in bulk
  const handleAddFakeRecords = async (count: number) => {
    if (!tableId) return;
    setIsSaving(true);
    setIsAddingBulkRows(true);
    setBulkRowProgress({ current: 0, total: count });
    shouldCancelBulkRowsRef.current = false;
  
    try {
      // Find the current max order to append new rows at the end
      const currentData = dataRef.current;
      const lastRow = currentData[currentData.length - 1];
      let startOrder = 0;
      
      if (lastRow && typeof lastRow.order === 'number') {
        startOrder = lastRow.order;
      } else {
        startOrder = currentData.length;
      }
      
      // Use larger batch size for better performance
      const batchSize = 5000;
      const batches = Math.ceil(count / batchSize);
      
      // Track when to refresh data for UI updates
      let lastRefreshTime = Date.now();
      const REFRESH_INTERVAL = 2000; // Refresh every 2 seconds
      
      // Process each batch
      for (let i = 0; i < batches; i++) {
        // Check for cancellation request
        if (shouldCancelBulkRowsRef.current) {
          console.log("Cancelling bulk row addition");
          break;
        }
        
        // Calculate batch size and starting order
        const batchCount = Math.min(batchSize, count - i * batchSize);
        const batchStartOrder = startOrder + i * batchSize;
        
        // Generate fake records for this batch
        const fakeRecords = Array.from({ length: batchCount }, () => 
          generateFakeRecord(columns)
        );
        
        try {
          // Send the batch to the server
          await createRowsMutation.mutateAsync({
            tableId,
            rows: fakeRecords,
            startOrder: batchStartOrder,
          });
          
          // Update progress bar
          const newProgress = Math.min((i + 1) * batchSize, count);
          setBulkRowProgress({
            current: newProgress,
            total: count,
          });
          
          // Periodically refresh the data to show progress
          const currentTime = Date.now();
          if (currentTime - lastRefreshTime >= REFRESH_INTERVAL) {
            console.log("Refreshing table data...");
            await refetch();
            lastRefreshTime = currentTime;
          }
          
          // Brief pause to allow UI updates
          await new Promise(resolve => setTimeout(resolve, 0));
          
        } catch (err) {
          console.error("Failed to create batch:", err);
          break;
        }
      }
      
      // Final refresh after all batches complete
      if (!shouldCancelBulkRowsRef.current) {
        console.log("Final refresh of table data");
        void refetch();
      }
      
    } finally {
      // Clean up state regardless of success/failure
      setIsSaving(false);
      setIsAddingBulkRows(false);
      shouldCancelBulkRowsRef.current = false;
    }
  };

  // Function to cancel bulk row addition
  const cancelBulkRowAddition = () => {
    shouldCancelBulkRowsRef.current = true;
  };
  
  // Function to save all pending cell edits before navigating away
  const saveAllPendingChanges = async () => {
    if (editedCellsRef.current.size === 0) return true;

    setIsSaving(true);

    try {
      // Create an array of promises for all pending edits
      const savePromises = Array.from(editedCellsRef.current.entries()).map(
        async ([key, value]) => {
          const [rowId, columnName] = key.split("|");
          if (!rowId || !columnName || !tableId) return;

          return updateCellMutation.mutateAsync({
            tableId,
            rowId,
            columnName,
            value: value.value,
          });
        }
      );

      // Wait for all edits to be saved
      await Promise.all(savePromises);
      return true;
    } catch (error) {
      console.error("Failed to save pending changes:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for toggling column visibility
  const handleToggleColumn = (columnName: string) => {
    setHiddenColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnName)) {
        newSet.delete(columnName);
      } else {
        newSet.add(columnName);
      }
      return newSet;
    });
  };
  
  // -----------------------------------------------------------------------
  // Table Initialization & Virtualization
  // -----------------------------------------------------------------------
  
  /**
   * Table initialization using TanStack Table (formerly React Table)
   * 
   * The table object holds all the state and logic for the data grid:
   * - Row and column management
   * - Sorting, filtering, and pagination logic
   * - Cell selection and interaction handling
   */
  const table = useReactTable({
    data, // Our processed data rows from the API and local edits
    columns, // Column definitions we created in the useMemo above
    getCoreRowModel: getCoreRowModel(), // Processes data into rows and applies basic operations
    getRowId: (row) => row.id ?? faker.string.uuid(), // Function to extract unique ID for each row
                                                      // If no ID exists, generate one with faker
    columnResizeMode: "onChange", // Updates column widths as the user drags, not just on release
  });

  /**
   * Virtualization implementation using TanStack Virtual
   * 
   * Virtualization is critical for performance with large datasets:
   * - Only renders rows visible in the viewport plus a small buffer zone
   * - As the user scrolls, components are recycled rather than creating new DOM elements
   * - This keeps DOM size small and prevents memory/performance issues with large tables
   * - The virtualizer maintains a "virtual" representation of all items and their positions
   */
  const rowVirtualizer = useVirtualizer({
    // Configuration for the virtualizer
    count: table.getRowModel().rows.length, // Total number of rows to virtualize
    getScrollElement: () => parentRef.current, // The scrollable container reference
    estimateSize: () => 35, // Estimated height of each row in pixels
                           // Used to calculate total scroll area before actual rendering
    overscan: 25, // Number of extra rows to render above/below the visible area
                 // Higher values reduce blank areas when scrolling fast but use more memory
    
    /**
     * Change handler for implementing infinite scroll
     * This function runs whenever the scroll position changes
     * It detects when the user is approaching the end of loaded data and loads more
     */
    onChange: (virtualizer) => {
      // Get the last visible item in the viewport
      const lastItem = virtualizer.getVirtualItems().slice(-1)[0];
      
      // Check if we need to load more data
      if (
        lastItem && // If there is a last item
        lastItem.index >= data.length - 10 && // And we're within 10 rows of the end
        hasNextPage && // And there is more data to load
        !isFetchingNextPage // And we're not already loading data
      ) {
        // Fetch the next page of data
        // 'void' operator discards the Promise to avoid React warnings about unhandled promises
        void fetchNextPage();
      }
    },
  });

  // Add a delayed loading state with shorter timeout for better UX
  const showLoading = useDelayedLoading(isFetchingNextPage);
  
  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation - Shows base name and global actions */}
      <TopNavigation 
        baseName={base?.name ?? ""}
        isLoading={isBaseLoading}
        onSaveAllPendingChanges={saveAllPendingChanges}
      />

      {/* Table Header - Shows table selector and table creation options */}
      <TableHeader
        tables={tables}
        tableId={tableId}
        setTableId={setTableId}
        isAddTableMenuOpen={isAddTableMenuOpen}
        setIsAddTableMenuOpen={setIsAddTableMenuOpen}
        handleCreateNewTable={handleCreateNewTable}
        isCreatingTable={isCreatingTable}
        tableError={tableError}
        addTableButtonRef={addTableButtonRef as React.RefObject<HTMLDivElement>}
      />

      {/* Column Toolbar - Contains filtering, sorting, and column management controls */}
      <TableToolbar
        isViewsSidebarOpen={isViewsSidebarOpen}
        setIsViewsSidebarOpen={setIsViewsSidebarOpen}
        hiddenColumns={hiddenColumns}
        isHideFieldsOpen={isHideFieldsOpen}
        setIsHideFieldsOpen={setIsHideFieldsOpen}
        hideFieldsRef={hideFieldsRef as React.RefObject<HTMLDivElement>}
        onToggleColumn={handleToggleColumn}
        isFilterModalOpen={isFilterModalOpen}
        setIsFilterModalOpen={setIsFilterModalOpen}
        filterPopoverRef={filterPopoverRef as React.RefObject<HTMLDivElement>}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        isSortModalOpen={isSortModalOpen}
        setIsSortModalOpen={setIsSortModalOpen}
        sortPopoverRef={sortPopoverRef as React.RefObject<HTMLDivElement>}
        activeSort={activeSort}
        setActiveSort={setActiveSort}
        isSearchModalOpen={isSearchModalOpen}
        setIsSearchModalOpen={setIsSearchModalOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchModalRef={searchModalRef as React.RefObject<HTMLDivElement>}
        tableData={tableData?.pages[0]}
      />

      {/* Main Content Area with Views Sidebar */}
      <div className="relative flex-1 overflow-hidden">
        {/* Views Sidebar - Shows available views and allows switching between them */}
        <ViewsSidebar
          isOpen={isViewsSidebarOpen}
          tableId={tableId}
          activeViewId={activeViewId}
          onViewSelect={handleViewSelect}
        />

        {/* Table Body - The main data grid. This container handles the main data display area and adjusts based on sidebar state */}
        <div
          className={`h-full transition-all duration-300 ease-in-out ${
            // If the views sidebar is open, translate the table to the right with padding
            // This creates the sliding effect when the sidebar opens/closes
            isViewsSidebarOpen ? "pl-64" : "pl-0"
          }`}
          onClick={() => setSelectedCell(null)} // Clear any active cell selection when clicking the background
        >
          {/* 
            Loading state display
            Shows a spinner when any of these conditions are true:
            - Initial data loading (first fetch)
            - Base metadata is loading
            - Tables list is loading
          */}
          {isInitialLoading || isBaseLoading || isTablesLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-gray-400" />
              <span className="text-gray-600">Loading table data...</span>
            </div>
          ) : (
            /* 
              Main scrollable container for the table
              This is where the virtualization happens
              parentRef connects to the virtualizer for scroll position tracking
            */
            <div
              ref={parentRef} // Reference for virtualization and scroll tracking
              className="h-full overflow-auto" // Enable scrolling when content exceeds container
              onClick={() => setSelectedCell(null)} // Clear cell selection when clicking empty areas
            >
              {/* 
                Table container with minimum width
                Prevents the table from becoming too narrow on small screens
              */}
              <div className="inline-block min-w-[800px]">
                {/* 
                  Table Header Row
                  - sticky: keeps header visible during scrolling
                  - z-10: ensures header stays above table content
                  - w-max: allows header to expand to the full width of all columns
                */}
                <div className="sticky top-0 z-10 flex w-max bg-[#f4f4f4] text-sm text-gray-800">
                  <div className="flex">
                    {/* 
                      Render column headers from the TanStack table model
                      1. Map through each header group (typically just one in this case)
                      2. For each header group, map through individual headers
                      3. Each header represents one column in the table
                    */}
                    {table.getHeaderGroups().map((headerGroup) => (
                      <div key={headerGroup.id} className="flex">
                        {headerGroup.headers.map((header) => (
                          <div
                            key={header.id}
                            style={{
                              width: `${header.getSize()}px`, // Dynamic width based on column size
                              minWidth: `${header.getSize()}px`, // Maintain minimum width
                              height: "30px", // Fixed header height
                            }}
                            className="border-r border-b border-gray-200 px-3 py-1 text-left"
                          >
                            {/* 
                              Render the column header content
                              flexRender is a TanStack utility that handles rendering
                              custom header components defined in the columns array
                            */}
                            {flexRender(
                              header.column.columnDef.header, // The header component or content
                              header.getContext() // Context data for the header
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {/* 
                      Add Field Button Column
                      This is an extra column at the end of the table for adding new fields/columns
                    */}
                    <div
                      className="border-b border-r border-gray-200 px-3 py-1 text-left"
                      style={{
                        width: "90px", // Fixed width for the add column button
                        minWidth: "90px",
                        height: "30px", // Match height with other headers
                      }}
                    >
                      {/* 
                        Add Field Button
                        Toggles the field creation modal
                        Disabled when a column is currently being added
                      */}
                      <button
                        onClick={() => {
                          if (!isAddingColumn) {
                            setIsFieldModalOpen(!isFieldModalOpen); // Toggle modal visibility
                          }
                        }}
                        className="flex h-full w-full items-center justify-center text-lg font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                        disabled={isAddingColumn} // Prevent clicking while adding a column
                        style={{ caretColor: 'transparent' }} // Hide text cursor
                      >
                        {isAddingColumn ? "..." : "+"} {/* Show ... when loading, + when ready */}
                      </button>
                      {/* 
                        Field Addition Modal
                        Only shown when isFieldModalOpen is true
                        Contains form controls for adding a new column to the table
                      */}
                      {isFieldModalOpen && (
                        <div ref={addFieldModalRef} className="absolute z-10 mt-2 w-64 rounded border bg-white p-4 shadow-md">
                          {/* Modal header with title and close button */}
                          <div className="flex justify-between mb-2">
                            <h3 className="text-sm font-medium">Add new field</h3>
                            <button 
                              onClick={() => setIsFieldModalOpen(false)} 
                              className="text-gray-500 hover:text-gray-700 cursor-pointer"
                              type="button"
                            >
                              &times; {/* × character for close button */}
                            </button>
                          </div>
                          {/* 
                            Field name input
                            Captures the name for the new column
                            Clears error message when user types
                          */}
                          <input
                            type="text"
                            placeholder="Field name"
                            value={newFieldName}
                            onChange={(e) => {
                              setNewFieldName(e.target.value);
                              // Clear error when typing to provide immediate feedback
                              setFieldError("");
                            }}
                            className="mb-2 w-full rounded border px-2 py-1 text-sm"
                            autoFocus // Automatically focus this input when modal opens
                          />
                          {/* 
                            Field type selector
                            Allows choosing between text and number data types
                            Additional types could be added here in the future
                          */}
                          <select
                            value={newFieldType}
                            onChange={(e) =>
                              setNewFieldType(
                                e.target.value as "text" | "number"
                              )
                            }
                            className="mb-2 w-full rounded border px-2 py-1 text-sm"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                          </select>
                          {/* 
                            Error message display
                            Only shown when there's a validation error
                            Helps user understand why they can't add the field
                          */}
                          {fieldError && (
                            <p className="mb-2 text-xs text-red-600">
                              {fieldError}
                            </p>
                          )}
                          {/* 
                            Add Field button
                            Triggers the handleAddColumn function
                            Disabled during the column addition process
                          */}
                          <button
                            onClick={handleAddColumn}
                            className="w-full rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 cursor-pointer"
                            disabled={isAddingColumn}
                          >
                            {isAddingColumn ? "Adding..." : "Add Field"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Virtualized Table Body - Only renders visible rows */}
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`, // Total height of all rows
                    position: "relative", // Required for absolute positioning of rows
                  }}
                >
                  {/* 
                    How the virtualization works:
                    1. rowVirtualizer.getVirtualItems() returns only the currently visible rows
                    2. Each row is positioned absolutely based on its virtual position
                    3. As the user scrolls, rows are recycled rather than creating new DOM elements
                    4. This dramatically improves performance for large datasets
                  */}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = table.getRowModel().rows[virtualRow.index];
                    if (!row) return null; // Skip if row doesn't exist in the data
                    return (
                      <div
                        key={row.id ?? virtualRow.index}
                        style={{
                          position: "absolute", // Position rows absolutely within the container
                          top: 0, // Start from the top
                          transform: `translateY(${virtualRow.start}px)`, // Position based on scroll offset
                          height: "35px", // Fixed row height
                        }}
                        className="flex border-b border-gray-200"
                      >
                        {/* 
                          Render each cell in this row
                          Uses TanStack Table's cell model to ensure correct data display
                        */}
                        {row.getVisibleCells().map((cell) => (
                          <div
                            key={cell.id}
                            style={{
                              width: `${cell.column.getSize()}px`, // Match cell width to column width
                              minWidth: `${cell.column.getSize()}px`, // Ensure minimum width
                              height: "100%", // Fill the row height
                            }}
                            className="border-r border-gray-200"
                          >
                            {/* 
                              Render cell content using flexRender
                              This uses the CellRenderer component defined in the columns array
                              Cell renderer handles:
                              - Display formatting based on data type
                              - Cell selection and editing interactions
                              - Highlighting search matches
                            */}
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 
                Loading indicator for infinite scrolling
                Appears at the bottom when more data is being fetched
                Only visible during pagination loading, not during initial load
              */}
              {showLoading && (
                <div className="sticky bottom-0 flex w-full items-center justify-center bg-white/80 py-2 shadow-md">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">
                    Loading more rows...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Add Record buttons and bulk operations */}
      <TableFooter
        createRowHandler={createRowHandler}
        handleAddFakeRecords={handleAddFakeRecords}
        isSaving={isSaving}
        isAddingBulkRows={isAddingBulkRows}
        bulkRowProgress={bulkRowProgress}
        cancelBulkRowAddition={cancelBulkRowAddition}
        totalCount={tableData?.pages[0]?.totalCount}
      />
    </div>
  );
}