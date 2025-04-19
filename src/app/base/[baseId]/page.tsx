"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type AccessorKeyColumnDef,
  type CellContext,
  type Row,
} from "@tanstack/react-table";
import { api } from "@/trpc/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import { faker } from "@faker-js/faker";

// Import types
import type { 
  RecordRow, 
  ColumnValue, 
  ColumnMeta,
  FilterType,
  SortType,
  TableColumn
} from "./types";

// Import utils and hooks
import { generateFakeRecord, defaultColumnsKeys } from "./utils";
import { useDelayedLoading, useOutsideClick } from "./hooks";

// Import components
import { TopNavigation } from "./components/TopNavigation";
import { TableHeader } from "./components/TableHeader";
import { TableToolbar } from "./components/TableToolbar";
import { ColumnHeader as TableColumnHeader } from "./components/ColumnHeader";
import { CellRenderer as TableCellRenderer } from "./components/CellRenderer";
import { RowNumberCell as TableRowNumberCell } from "./components/RowNumberCell";
import { TableFooter } from "./components/TableFooter";
import { AddFieldModal } from "./components/AddFieldModal";
import { ViewsSidebar } from "./ViewsSidebar";

// -------------------------------------------------------------------------
// Types and Helpers
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// BasePage Component
// -------------------------------------------------------------------------
export default function BasePage() {
  const { baseId } = useParams();
  
  // All state declarations
  const [data, setData] = useState<RecordRow[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [isAddTableMenuOpen, setIsAddTableMenuOpen] = useState(false);
  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState(false);
  const [isViewSettingsUpdating, setIsViewSettingsUpdating] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false);
  const [isAddingBulkRows, setIsAddingBulkRows] = useState(false);
  const [bulkRowProgress, setBulkRowProgress] = useState({
    current: 0,
    total: 0,
  });
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number">("text");

  // All refs
  const parentRef = useRef<HTMLDivElement>(null);
  const initialTableCreationAttempted = useRef(false);
  const editedCellsRef = useRef<Map<string, { value: string | number | null }>>(new Map());
  const shouldCancelBulkRowsRef = useRef(false);
  const lastUpdateRef = useRef<string | null>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const addFieldModalRef = useRef<HTMLDivElement>(null);
  
  // Add click outside handlers for the popovers
  useOutsideClick(() => setIsFieldModalOpen(false), [addFieldModalRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsFilterModalOpen(false), [filterPopoverRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsSortModalOpen(false), [sortPopoverRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsHideFieldsOpen(false), [hideFieldsRef as React.RefObject<Element>]);
  useOutsideClick(() => setIsSearchModalOpen(false), [searchModalRef as React.RefObject<Element>]);
  
  // Track if we're in the middle of loading more data
  const isLoadingMoreRef = useRef(false);
  const dataRef = useRef<RecordRow[]>([]);
  
  // Add a ref to track deleted row IDs
  const deletedRowIdsRef = useRef<Set<string>>(new Set());
  
  // Add state for filters and sorts
  const [activeFilter, setActiveFilter] = useState<FilterType | undefined>(undefined);
  const [activeSort, setActiveSort] = useState<SortType | undefined>();
  
  // -----------------------------------------------------------------------
  // Data Fetching & Table Creation
  // -----------------------------------------------------------------------
  const { data: base, isLoading: isBaseLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });

  const {
    data: tables,
    isLoading: isTablesLoading,
    refetch: refetchTables,
  } = api.table.getTablesForBase.useQuery(
    { baseId: baseId as string },
    { enabled: !!baseId }
  );

  // Update view-related queries and mutations with proper typing
  const { data: views, refetch: refetchViews } =
    api.view.getViewsForTable.useQuery(
      { tableId: tableId ?? "" },
      {
        enabled: !!tableId,
      }
    );

  const updateViewMutation = api.view.updateView.useMutation();

  // Create a stable callback for updating view settings
  const updateViewSettings = useCallback(
    (viewId: string, settings: {
      filter: FilterType | null;
      sort: SortType | null;
      hiddenColumns: string[];
    }) => {
      // Create a hash of the settings to compare
      const settingsHash = JSON.stringify({
        viewId,
        ...settings
      });

      // Skip if this is the same update
      if (lastUpdateRef.current === settingsHash) {
        return;
      }

      // Update the view
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

  // Effect to handle initial view selection
  useEffect(() => {
    const firstView = views?.[0];
    if (!activeViewId && firstView) {
      setActiveViewId(firstView.id);
      
      // Apply the view's settings
      if (firstView.filter) {
        setActiveFilter(firstView.filter as FilterType);
      }
      if (firstView.sort && typeof firstView.sort === 'object') {
        const sortData = firstView.sort as { columnName: string; direction: "asc" | "desc" };
        if (sortData.columnName && sortData.direction) {
          setActiveSort(sortData);
        }
      }
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

  // Update the useEffect for view settings
  useEffect(() => {
    if (!activeViewId || isViewSettingsUpdating) return;

    const currentView = views?.find((v) => v.id === activeViewId);
    if (!currentView) return;

    // Get current settings, converting undefined to null for database storage
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

    // Compare settings using JSON.stringify
    if (JSON.stringify(currentSettings) === JSON.stringify(viewSettings)) {
      return;
    }

    // Update the view settings
    updateViewSettings(activeViewId, currentSettings);
  }, [activeViewId, activeFilter, activeSort, hiddenColumns, isViewSettingsUpdating, views, updateViewSettings]);

  // Update handleViewSelect
  const handleViewSelect = (viewId: string) => {
    const view = views?.find((v) => v.id === viewId);
    if (!view) return;

    // Reset the last update hash since we're switching views
    lastUpdateRef.current = null;
    setIsViewSettingsUpdating(true);

    // Batch all state updates together
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

  const {
    data: tableData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = api.table.getTableData.useInfiniteQuery(
    {
      tableId: tableId ?? "",
      limit: 150,
      searchQuery,
      filter: activeFilter,
      sort: activeSort,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!tableId,
    }
  );

  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

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

  // Create initial table if needed
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

  // Set initial table selection
  useEffect(() => {
    if (tables && tables.length > 0 && !tableId && tables[0]?.id) {
      setTableId(tables[0].id);
    }
  }, [tables, tableId]);

  // Add new effect to handle table switching and data refresh
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

  // Close search modal and clear search query when switching tables or views
  useEffect(() => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
  }, [tableId, activeViewId]);

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

  // Update the useEffect that processes tableData to respect edited cells
  useEffect(() => {
    if (tableData) {
      // Combine all rows from all pages
      const allRows = tableData.pages.flatMap((page) => page.rows);
      const formattedData = allRows
        .filter((row) => !deletedRowIdsRef.current.has(row.id))
        .map((row) => {
          const rowData: RecordRow = {
            id: row.id,
            ...(row.data as Record<string, string | number | null>),
          };

          // Apply any pending edits to this row
          const rowId = row.id;
          if (rowId) {
            for (const [key, value] of editedCellsRef.current.entries()) {
              const [editedRowId, columnName] = key.split("|");
              if (
                editedRowId === rowId &&
                columnName &&
                typeof columnName === "string"
              ) {
                rowData[columnName] = value.value;
              }
            }
          }

          return rowData;
        });

      // Update the data state
      setData(formattedData);
      dataRef.current = formattedData;

      setIsInitialLoading(false);
      isLoadingMoreRef.current = false;
    }
  }, [tableData]);

  // Initialize dataRef when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  
  // -----------------------------------------------------------------------
  // Column & Row Mutations
  // -----------------------------------------------------------------------
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

  // Update the deleteRowMutation to track deleted rows
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
  // Add type for the table data
  // Update the columns definition with proper types
  const columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[] =
    useMemo(() => {
      if (!tableData?.pages[0])
        return [] as AccessorKeyColumnDef<RecordRow, ColumnValue>[];
      const rowNumberColumn: AccessorKeyColumnDef<RecordRow, ColumnValue> = {
        accessorKey: "rowNumber",
        id: "rowNumber",
        header: () => (
          <div className="flex h-full w-full items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
            />
          </div>
        ),
        size: 80,
        enableResizing: false,
        cell: ({ row }: { row: Row<RecordRow> }) => (
          <TableRowNumberCell
            index={row.index}
            onDeleteRow={() => handleDeleteRow(row.original.id ?? "")}
          />
        ),
      };

      const currentData = tableData.pages[0];
      const dataColumns = (currentData.columns ?? [])
        .filter((col: TableColumn) => !hiddenColumns.has(col.name)) // Filter out hidden columns
        .map((col: TableColumn) => ({
          accessorKey: col.name,
          meta: { type: col.type as "text" | "number" },
          header: () => (
            <TableColumnHeader
              name={col.name}
              onDelete={() => handleDeleteColumn(col.name)}
              type={col.type as "text" | "number"}
            />
          ),
          cell: (props: CellContext<RecordRow, ColumnValue>) => (
            <TableCellRenderer
              {...props}
              keyName={col.name}
              fieldType={col.type as "text" | "number"}
              selectedCell={selectedCell}
              setSelectedCell={setSelectedCell}
              setData={setData}
              tableId={tableId}
              setIsSaving={setIsSaving}
              updateCellMutation={updateCellMutation}
              searchQuery={searchQuery}
              editedCellsRef={editedCellsRef}
              activeFilter={activeFilter}
              activeSort={activeSort}
            />
          ),
        }));
      return [rowNumberColumn, ...(dataColumns ?? [])];
    }, [
      tableData,
      handleDeleteColumn,
      handleDeleteRow,
      selectedCell,
      setSelectedCell,
      setData,
      tableId,
      setIsSaving,
      updateCellMutation,
      searchQuery,
      editedCellsRef,
      activeFilter,
      activeSort,
      hiddenColumns, // Add hiddenColumns to dependencies
    ]);
  
  // Row & Column Creation Mutations
  const createRowMutation = api.table.createRow.useMutation({
    onSuccess: (newRow) => {
      setData((prev) => [
        ...prev,
        {
          id: newRow.id,
          ...(newRow.data as Record<string, string | number | null>),
        },
      ]);
    },
  });

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

  const handleAddColumn = () => {
    if (!newFieldName.trim()) {
      return;
    }
    if (!tableId) {
      return;
    }
    const currentData = tableData?.pages[0];
    const exists = currentData?.columns?.some(
      (col: TableColumn) => col.name === newFieldName
    );
    if (exists) {
      return;
    }
    setIsAddingColumn(true);
    createColumnMutation.mutate({
      tableId,
      name: newFieldName,
      type: newFieldType,
    }, {
      onSuccess: () => {
        void refetch();
        setIsAddingColumn(false);
        setNewFieldName("");
        setNewFieldType("text");
        setIsFieldModalOpen(false);
      },
      onError: (error) => {
        console.error("Failed to add column:", error);
        setIsAddingColumn(false);
      }
    });
  };

  const createRowsMutation = api.table.createRows.useMutation();

  const createRowHandler = async () => {
    if (!tableId) return;
    if (isSaving) return;
    setIsSaving(true);
    const defaultData: Record<string, string | number | null> = {};

    // Get all columns except the rowNumber column
    const dataColumns = columns.filter(
      (col) => col.accessorKey && col.accessorKey !== "rowNumber"
    );

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
      await createRowMutation.mutateAsync({
        tableId,
        defaultData,
      });
      // Just refetch to get the latest data
      void refetch();
    } catch (error) {
      console.error("Failed to create row:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFakeRecords = async (count: number) => {
    if (!tableId) return;
    setIsSaving(true);
    setIsAddingBulkRows(true);
    setBulkRowProgress({ current: 0, total: count });
    shouldCancelBulkRowsRef.current = false;
  
    try {
      // Find the current max order
      const currentData = dataRef.current;
      const lastRow = currentData[currentData.length - 1];
      let startOrder = 0;
      
      if (lastRow && typeof lastRow.order === 'number') {
        startOrder = lastRow.order;
      } else {
        startOrder = currentData.length;
      }
      
      // Use larger batch size
      const batchSize = 5000;
      const batches = Math.ceil(count / batchSize);
      
      // Track when to refresh data
      let lastRefreshTime = Date.now();
      const REFRESH_INTERVAL = 2000; // Refresh every 2 seconds
      
      for (let i = 0; i < batches; i++) {
        if (shouldCancelBulkRowsRef.current) {
          console.log("Cancelling bulk row addition");
          break;
        }
        
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
          
          // Update progress
          const newProgress = Math.min((i + 1) * batchSize, count);
          setBulkRowProgress({
            current: newProgress,
            total: count,
          });
          
          // Check if we should refresh the data
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
      
      // Final refresh after all batches
      if (!shouldCancelBulkRowsRef.current) {
        console.log("Final refresh of table data");
        void refetch();
      }
      
    } finally {
      setIsSaving(false);
      setIsAddingBulkRows(false);
      shouldCancelBulkRowsRef.current = false;
    }
  };

  // Add a function to cancel the bulk row addition
  const cancelBulkRowAddition = () => {
    shouldCancelBulkRowsRef.current = true;
  };
  
  // Add a function to save all pending changes before navigating away
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

  // Add this handler function
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
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id ?? faker.string.uuid(),
    columnResizeMode: "onChange",
  });

  // This is useVirtualizer from TanStack Virtual which tracks how far I scrolled and if I need to load more data
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 25,
    onChange: (virtualizer) => {
      const lastItem = virtualizer.getVirtualItems().slice(-1)[0];
      if (
        lastItem &&
        lastItem.index >= data.length - 10 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        void fetchNextPage();
      }
    },
  });

  // Add a delayed loading state with shorter timeout
  const showLoading = useDelayedLoading(isFetchingNextPage);
  
  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <TopNavigation 
        baseName={base?.name ?? ""}
        isLoading={isBaseLoading}
        onSaveAllPendingChanges={saveAllPendingChanges}
      />

      {/* Table Header */}
      <TableHeader
        tables={tables}
        tableId={tableId}
        setTableId={setTableId}
        isAddTableMenuOpen={isAddTableMenuOpen}
        setIsAddTableMenuOpen={setIsAddTableMenuOpen}
        handleCreateNewTable={handleCreateNewTable}
        isCreatingTable={isCreatingTable}
        tableError={tableError}
      />

      {/* Column Toolbar */}
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
        {/* Views Sidebar */}
        <ViewsSidebar
          isOpen={isViewsSidebarOpen}
          tableId={tableId}
          activeViewId={activeViewId}
          onViewSelect={handleViewSelect}
        />

        {/* Table Body */}
        <div
          className={`h-full transition-all duration-300 ease-in-out ${
            isViewsSidebarOpen ? "pl-64" : "pl-0"
          }`}
          onClick={() => setSelectedCell(null)}
        >
          {isInitialLoading || isBaseLoading || isTablesLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-gray-400" />
              <span className="text-gray-600">Loading table data...</span>
            </div>
          ) : (
            <div
              ref={parentRef}
              className="h-full overflow-auto"
              onClick={() => setSelectedCell(null)}
            >
              {/* Table Container with max-width */}
              <div className="inline-block min-w-[800px]">
                {/* Table Header Row */}
                <div className="sticky top-0 z-10 flex w-max bg-[#f4f4f4] text-sm text-gray-800">
                  <div className="flex">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <div key={headerGroup.id} className="flex">
                        {headerGroup.headers.map((header) => (
                          <div
                            key={header.id}
                            style={{
                              width: `${header.getSize()}px`,
                              minWidth: `${header.getSize()}px`,
                              height: "30px",
                            }}
                            className="border-r border-b border-gray-200 px-3 py-1 text-left"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {/* Add field column with fixed width */}
                    <div
                      className="border-b border-r border-gray-200 px-3 py-1 text-left"
                      style={{
                        width: "90px",
                        minWidth: "90px",
                        height: "30px",
                      }}
                    >
                      <button
                        onClick={() => {
                          if (!isAddingColumn) {
                            setIsFieldModalOpen(!isFieldModalOpen);
                          }
                        }}
                        className="flex h-full w-full items-center justify-center text-lg font-medium text-gray-600 hover:text-gray-900"
                        disabled={isAddingColumn}
                      >
                        {isAddingColumn ? "..." : "+"}
                      </button>
                      {isFieldModalOpen && (
                        <div ref={addFieldModalRef}>
                          <AddFieldModal
                            onAddField={(name, type) => {
                              setNewFieldName(name);
                              setNewFieldType(type);
                              handleAddColumn();
                            }}
                            isAdding={isAddingColumn}
                            onClose={() => setIsFieldModalOpen(false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Virtualized Table Body */}
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = table.getRowModel().rows[virtualRow.index];
                    if (!row) return null;
                    return (
                      <div
                        key={row.id ?? virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          height: "35px",
                        }}
                        className="flex border-b border-gray-200"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <div
                            key={cell.id}
                            style={{
                              width: `${cell.column.getSize()}px`,
                              minWidth: `${cell.column.getSize()}px`,
                              height: "100%",
                            }}
                            className="border-r border-gray-200"
                          >
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

              {/* Loading indicator for pagination */}
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

      {/* Footer with Add Record buttons */}
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