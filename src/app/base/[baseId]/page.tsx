"use client";

import type React from "react";
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
import { faker } from "@faker-js/faker";
import { api } from "@/trpc/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  ChevronDown,
  Eye,
  Filter,
  FolderKanban,
  LayoutGrid,
  Menu,
  Palette,
  Share2,
  SquareStack,
  AlignJustify,
  History,
  Loader2,
  CircleHelp,
  Plus,
  MoreHorizontal,
  Hash,
  TextIcon as LetterText,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import Link from "next/link";

// -------------------------------------------------------------------------
// Types and Helpers
// -------------------------------------------------------------------------
interface ColumnMeta {
  type?: "text" | "number";
}

type RecordRow = Record<string, string | number | null> & { id?: string };
type ColumnValue = string | number | null;

const defaultColumnsKeys = ["name", "notes", "assignee", "status"];

const generateFakeRecord = (
  columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[]
): RecordRow => {
  const record: RecordRow = {};
  for (const col of columns) {
    const key = col.accessorKey ?? "";
    if (key && key !== "rowNumber") { // Skip the rowNumber column
      // Get the column type from the meta property
      const meta = col.meta as ColumnMeta | undefined;
      const columnType = meta?.type ?? "text"; // Default to text if not specified
      
      record[key] =
        columnType === "number"
          ? faker.number.int({ min: 0, max: 100 })
          : faker.word.words(2);
    }
  }
  return record;
};

// -------------------------------------------------------------------------
// UI Components
// -------------------------------------------------------------------------
function ColumnHeader({
  name,
  onDelete,
  type = "text",
}: {
  name: string;
  onDelete: () => void;
  type?: "text" | "number";
}) {
  const [open, setOpen] = useState(false);

  // Determine which icon to show based on column type
  const TypeIcon = type === "number" ? Hash : LetterText;

  return (
    <div className="relative h-full w-full">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-full w-full items-center space-x-1 px-1 hover:bg-gray-100"
        title={name}
      >
        <TypeIcon size={14} className="flex-shrink-0 text-gray-500" />
        <span className="min-w-0 flex-1 truncate text-left text-sm">
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-gray-500 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-28 rounded border bg-white shadow-md">
          <button
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-red-100"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

type UpdateCellInput = {
  tableId: string;
  rowId: string;
  columnName: string;
  value: string | number | null;
};

function CellRenderer({
  row,
  column,
  keyName,
  fieldType,
  selectedCell,
  setSelectedCell,
  setData,
  tableId,
  setIsSaving,
  updateCellMutation,
  searchQuery,
  editedCellsRef,
}: {
  row: { index: number; original: RecordRow };
  column: { id: string };
  keyName: string;
  fieldType: "text" | "number";
  selectedCell: { rowIndex: number; columnId: string } | null;
  setSelectedCell: React.Dispatch<
    React.SetStateAction<{ rowIndex: number; columnId: string } | null>
  >;
  setData: React.Dispatch<React.SetStateAction<RecordRow[]>>;
  tableId: string | null;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  updateCellMutation: { mutate: (input: UpdateCellInput) => void };
  searchQuery?: string;
  editedCellsRef: React.MutableRefObject<Map<string, { value: string | number | null }>>;
}) {
  const value = row.original[keyName];
  const isSelected =
    selectedCell?.rowIndex === row.index &&
    selectedCell?.columnId === column.id;
  const [localValue, setLocalValue] = useState<string | number | null>(
    value === 0 && fieldType === "number" ? 0 : value ?? ""
  );
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value === 0 && fieldType === "number" ? 0 : value ?? "");
  }, [value, fieldType]);

  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  const saveCell = () => {
    if (!isEditing) return;
    const newValue =
      fieldType === "number"
        ? localValue === ""
          ? null
          : Number(localValue)
        : localValue;
    if (newValue !== value) {
      // Store the edited value in our ref
      if (row.original.id) {
        editedCellsRef.current.set(`${row.original.id}|${keyName}`, { value: newValue });
      }
      
      setData((prev) =>
        prev.map((item) =>
          item.id === row.original.id ? { ...item, [keyName]: newValue } : item
        )
      );
      if (tableId && row.original.id) {
        setIsSaving(true);
        updateCellMutation.mutate({
          tableId,
          rowId: row.original.id,
          columnName: keyName,
          value: newValue,
        });
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCell();
      setSelectedCell(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLocalValue(value === 0 && fieldType === "number" ? 0 : value ?? "");
      setIsEditing(false);
      setSelectedCell(null);
    } else if (!isEditing) {
      setIsEditing(true);
    }
  };

  const matchesQuery =
    searchQuery &&
    ((typeof value === "string" &&
      value.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (typeof value === "number" && value.toString().includes(searchQuery)));

  return (
    <div
      className="relative h-full w-full"
      onClick={(e) => {
        e.stopPropagation();
        setSelectedCell({ rowIndex: row.index, columnId: column.id });
      }}
    >
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 z-10 border-2 border-blue-500" />
      )}
      <input
        ref={inputRef}
        type={fieldType === "number" ? "number" : "text"}
        className={`h-full w-full border-none px-2 outline-none ${
          matchesQuery ? "bg-yellow-100" : "bg-transparent"
        }`}
        value={
          isEditing
            ? localValue === 0
              ? "0"
              : localValue ?? ""
            : value === 0
            ? "0"
            : value ?? ""
        }
        onChange={(e) => {
          const val =
            fieldType === "number"
              ? e.target.value === ""
                ? ""
                : e.target.value
              : e.target.value;
          setLocalValue(val);
          setIsEditing(true);
        }}
        onBlur={saveCell}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

// -------------------------------------------------------------------------
// NEW: RowNumberCell component
// -------------------------------------------------------------------------

function RowNumberCell({
  index,
  onDeleteRow,
}: {
  index: number;
  onDeleteRow: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.left });
    }
    setOpen(!open);
  };

  return (
    <div className="relative flex h-full w-full items-center px-2">
      {/* Number centered */}
      <div className="flex-1 text-center text-gray-500">{index + 1}</div>

      {/* Triple dot menu aligned to the right */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-gray-400 hover:text-gray-600"
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        popupPos &&
        createPortal(
          <div
            className="fixed z-50 w-28 rounded border bg-white shadow-md"
            style={{
              left: popupPos.left,
              top: popupPos.top - 45,
            }}
          >
            <button
              className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                onDeleteRow();
                setOpen(false);
              }}
            >
              Delete row
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

// -------------------------------------------------------------------------
// BasePage Component
// -------------------------------------------------------------------------
export default function BasePage() {
  const { baseId } = useParams();
  const [data, setData] = useState<RecordRow[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const initialTableCreationAttempted = useRef(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Add state for tracking bulk row addition progress
  const [isAddingBulkRows, setIsAddingBulkRows] = useState(false);
  const [bulkRowProgress, setBulkRowProgress] = useState({ current: 0, total: 0 });
  
  // Add a ref to track edited cells
  const editedCellsRef = useRef<Map<string, { value: string | number | null }>>(new Map());
  
  // Add a ref to track if the bulk row addition should be cancelled
  const shouldCancelBulkRowsRef = useRef(false);

  // Focus search input when modal opens
  useEffect(() => {
    if (isSearchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  // -----------------------------------------------------------------------
  // Data Fetching & Table Creation (using your table.ts mutations)
  // -----------------------------------------------------------------------
  const { data: base, isLoading: isBaseLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });
  const { data: tables, isLoading: isTablesLoading } =
    api.table.getTablesForBase.useQuery(
      { baseId: baseId as string },
      { enabled: !!baseId }
    );

  const createTableMutation = api.table.createTable.useMutation({
    onSuccess: (newTable) => {
      setTableId(newTable.id);
    },
  });

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (initialTableCreationAttempted.current) return;
    if (isTablesLoading || !tables) return;
    if (tables.length > 0 && tables[0]?.id) {
      setTableId(tables[0].id);
      initialTableCreationAttempted.current = true;
    } else if (tables.length === 0 && baseId) {
      initialTableCreationAttempted.current = true;
      createTableMutation.mutate(
        {
          baseId: baseId as string,
          name: "Table 1",
          columns: defaultColumnsKeys.map((name) => ({ name, type: "text" })),
        },
        {
          onSuccess: (newTable) => {
            setTableId(newTable.id);
          },
        }
      );
    }
  }, [tables, isTablesLoading, baseId, createTableMutation]);

  // Use standard query instead of useInfiniteQuery
  const {
    data: tableData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = api.table.getTableData.useInfiniteQuery(
    {
      tableId: tableId ?? "",
      limit: 50,
      searchQuery,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!tableId,
    }
  );

  // Track if we're in the middle of loading more data
  const isLoadingMoreRef = useRef(false);
  const dataRef = useRef<RecordRow[]>([]);

  // Add a ref to track deleted row IDs
  const deletedRowIdsRef = useRef<Set<string>>(new Set());

  // Update the useEffect that processes tableData to respect edited cells
  useEffect(() => {
    if (tableData) {
      // Combine all rows from all pages
      const allRows = tableData.pages.flatMap((page) => page.rows);
      const formattedData = allRows
        .filter(row => !deletedRowIdsRef.current.has(row.id))
        .map((row) => {
          const rowData: RecordRow = {
            id: row.id,
            ...(row.data as Record<string, string | number | null>),
          };
          
          // Apply any pending edits to this row
          const rowId = row.id;
          if (rowId) {
            for (const [key, value] of editedCellsRef.current.entries()) {
              const [editedRowId, columnName] = key.split('|');
              if (editedRowId === rowId && columnName && typeof columnName === 'string') {
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
      setIsLoadingMore(false);
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
      setData((prevData) =>
        prevData.map((row) => {
          const newRow = { ...row };
          delete newRow[name];
          return newRow;
        })
      );
      deleteColumnMutation.mutate({ tableId, columnName: name });
    },
    [tableId, deleteColumnMutation]
  );

  // Update the deleteRowMutation to track deleted rows
  const deleteRowMutation = api.table.deleteRow.useMutation({
    onSuccess: (_, variables) => {
      // Add the deleted row ID to our tracking set
      deletedRowIdsRef.current.add(variables.rowId);
      
      // Immediately update the UI by removing the deleted row
      setData((prevData) => prevData.filter((row) => row.id !== variables.rowId));
      
      // We don't need to refetch or invalidate the query
      // The deleted row will be filtered out in the useEffect above
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
  interface TableColumn {
    name: string;
    type: string;
  }

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
          <RowNumberCell
            index={row.index}
            onDeleteRow={() => handleDeleteRow(row.original.id ?? "")}
          />
        ),
      };

      const currentData = tableData.pages[0];
      const dataColumns = (currentData.columns ?? []).map(
        (col: TableColumn) => ({
          accessorKey: col.name,
          meta: { type: col.type as "text" | "number" }, // Explicitly set the meta property
          header: () => (
            <ColumnHeader
              name={col.name}
              onDelete={() => handleDeleteColumn(col.name)}
              type={col.type as "text" | "number"}
            />
          ),
          cell: (props: CellContext<RecordRow, ColumnValue>) => (
            <CellRenderer
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
            />
          ),
        })
      );
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
    ]);

  // -----------------------------------------------------------------------
  // Row & Column Creation Mutations
  // -----------------------------------------------------------------------
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
          prevData.map(row => ({
            ...row,
            [newColumn.name]: newColumn.type === "number" ? null : ""
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

  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number">("text");
  const [fieldError, setFieldError] = useState("");
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);

  const handleAddColumn = () => {
    if (!newFieldName.trim()) {
      setFieldError("Field name is required.");
      return;
    }
    if (!tableId) {
      setFieldError("No table found.");
      return;
    }
    const currentData = tableData?.pages[0];
    const exists = currentData?.columns?.some(
      (col: TableColumn) => col.name === newFieldName
    );
    if (exists) {
      setFieldError("A column with that name already exists.");
      return;
    }
    setIsAddingColumn(true);
    createColumnMutation.mutate({
      tableId,
      name: newFieldName,
      type: newFieldType,
    });
    setNewFieldName("");
    setNewFieldType("text");
    setFieldError("");
    setIsFieldModalOpen(false);
  };

  const createRowsMutation = api.table.createRows.useMutation();

  const createRowHandler = async () => {
    if (!tableId) return;
    if (isSaving) return;
    setIsSaving(true);
    const defaultData: Record<string, string | number | null> = {};
    
    // Get all columns except the rowNumber column
    const dataColumns = columns.filter(col => col.accessorKey && col.accessorKey !== "rowNumber");
    
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
      const newRow = await createRowMutation.mutateAsync({
        tableId,
        defaultData,
      });
      setData((prev) => {
        const exists = prev.some((row) => row.id === newRow.id);
        if (exists) return prev;
        return [
          {
            id: newRow.id,
            ...(newRow.data as Record<string, string | number | null>),
          },
          ...prev,
        ];
      });
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
    
    const batchSize = 30; // Number of rows per batch
    const batches = Math.ceil(count / batchSize);

    for (let i = 0; i < batches; i++) {
      // Check if we should cancel the operation
      if (shouldCancelBulkRowsRef.current) {
        console.log("Cancelling bulk row addition");
        break;
      }
      
      const batchCount = Math.min(batchSize, count - i * batchSize);
      const fakeRecords = Array.from({ length: batchCount }, () =>
        generateFakeRecord(columns)
      );

      try {
        const res = await createRowsMutation.mutateAsync({
          tableId,
          rows: fakeRecords,
        });

        const newFormattedRows = res.map((row) => ({
          id: row.id,
          ...(row.data as Record<string, string | number | null>),
        }));

        // Append new rows to data and show them on screen
        setData((prev) => [...prev, ...newFormattedRows]);
        
        // Update progress
        setBulkRowProgress(prev => ({
          current: prev.current + batchCount,
          total: count
        }));

        // Optional: Give time for UI to catch up (good for slower devices)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error("Failed to create batch:", err);
        break;
      }
    }

    setIsSaving(false);
    setIsAddingBulkRows(false);
    shouldCancelBulkRowsRef.current = false;
  };

  // Add a function to cancel the bulk row addition
  const cancelBulkRowAddition = () => {
    shouldCancelBulkRowsRef.current = true;
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id ?? faker.string.uuid(),
    columnResizeMode: "onChange",
  });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
    onChange: (virtualizer) => {
      const lastItem = virtualizer.getVirtualItems().slice(-1)[0];
      if (
        lastItem &&
        lastItem.index >= data.length - 1 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        setIsLoadingMore(true);
        void fetchNextPage();
      }
    },
  });

  // Add a function to save all pending changes before navigating away
  const saveAllPendingChanges = async () => {
    if (editedCellsRef.current.size === 0) return true;
    
    setIsSaving(true);
    
    try {
      // Create an array of promises for all pending edits
      const savePromises = Array.from(editedCellsRef.current.entries()).map(
        async ([key, value]) => {
          const [rowId, columnName] = key.split('|');
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

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <div
        style={{ backgroundColor: "#535965" }}
        className="flex items-center justify-between px-4 py-3 text-sm shadow-sm"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded">
              <Link 
                href="/" 
                onClick={async (e) => {
                  e.preventDefault();
                  const saved = await saveAllPendingChanges();
                  if (saved) {
                    window.location.href = "/";
                  } else {
                    alert("Failed to save some changes. Please try again.");
                  }
                }}
              >
                <Image
                  src="/airtable-svgrepo-com.svg"
                  alt="Airtable Logo"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </Link>
            </div>
            <h1 className="flex items-center gap-1 text-lg font-bold text-gray-100 hover:text-white">
              {isBaseLoading ? "Loading..." : base?.name ?? "Untitled Base 2"}
              <ChevronDown size={16} className="text-gray-100" />
            </h1>
          </div>
          <div className="flex gap-6">
            <button className="cursor-pointer font-light text-gray-100 hover:text-white">
              Data
            </button>
            <button className="cursor-pointer font-light text-gray-100 hover:text-white">
              Automations
            </button>
            <button className="cursor-pointer font-light text-gray-100 hover:text-white">
              Interfaces
            </button>
            <div className="mx-2 h-5 w-px bg-gray-500"></div>
            <button className="cursor-pointer font-light text-gray-100 hover:text-white">
              Forms
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="cursor-pointer rounded-full p-1">
            <History className="w-5 stroke-1 text-gray-100" />
          </button>
          <button className="flex cursor-pointer items-center gap-1 rounded-full p-1">
            <CircleHelp className="mr-1 h-5 stroke-1 text-gray-100" />
            <span className="cursor-pointer font-light text-gray-100 hover:text-white">
              Help
            </span>
          </button>
          <button className="flex cursor-pointer items-center gap-1 rounded-full bg-white px-4 py-1.5 font-light shadow-sm hover:bg-gray-50">
            <span>Share</span>
          </button>
          <button className="cursor-pointer rounded-full p-1 hover:bg-gray-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-100"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
            </svg>
          </button>
          <div className="flex h-8 w-8 items-center justify-center">
            <UserButton></UserButton>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex h-8 items-center justify-between bg-[#4c505b] px-4 text-sm">
        <div className="flex h-full items-center gap-2">
          <div className="h-full">
            <div className="flex h-full items-center rounded-t-md bg-white px-4">
              <span className="font-small mr-2 text-base text-sm">Table 1</span>
              <ChevronDown size={16} className="text-gray-500" />
            </div>
          </div>
          <div className="flex h-full items-center px-2">
            <ChevronDown size={16} className="text-white" />
          </div>
          <div className="flex h-full items-center">
            <Plus size={16} className="mr-1 text-white" />
            <span className="text-sm font-light text-gray-200">
              Add or import
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-light text-gray-100">Extensions</span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-light text-gray-100">Tools</span>
            <ChevronDown size={16} className="text-white" />
          </div>
        </div>
      </div>

      {/* Column Toolbar */}
      <div className="flex items-center border-b bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <Menu className="h-4 w-4" />
            <span>Views</span>
          </button>
          <div className="mx-1 h-4 w-px bg-gray-300" />
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <LayoutGrid className="h-4 w-4" />
            <span>Grid view</span>
            <SquareStack className="ml-1 h-3.5 w-3.5" />
            <ChevronDown className="h-3 w-3" />
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <Eye className="h-4 w-4" />
            <span>Hide fields</span>
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <FolderKanban className="h-4 w-4" />
            <span>Group</span>
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <ArrowUpDown className="h-4 w-4" />
            <span>Sort</span>
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <Palette className="h-4 w-4" />
            <span>Color</span>
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <AlignJustify className="h-4 w-4" />
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <Share2 className="h-4 w-4" />
            <span>Share and sync</span>
          </button>
        </div>
        <div className="relative ml-auto">
          <button
            className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100"
            onClick={() => setIsSearchModalOpen(!isSearchModalOpen)}
          >
            <Search className="h-4 w-4" />
          </button>
          {isSearchModalOpen && (
            <div className="absolute top-full right-0 z-50 mt-1 w-96 rounded-md border border-gray-200 bg-gray-50 shadow-md">
              <div className="flex items-center justify-between p-3">
                <div className="flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find in view"
                    className="w-full bg-transparent text-lg text-gray-700 outline-none"
                  />
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSearchModalOpen(false);
                    setSearchQuery("");
                  }}
                  className="cursor-pointer rounded-full p-1 text-gray-500 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </div>
              </div>
              <div className="bg-[#f2f2f2] p-3">
                <p className="text-sm text-gray-600">
                  Use advanced search options in the{" "}
                  <span className="inline-flex cursor-pointer items-center text-blue-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-1 text-blue-600"
                    >
                      <rect
                        width="18"
                        height="18"
                        x="3"
                        y="3"
                        rx="2"
                        ry="2"
                      ></rect>
                      <path d="M9 3v18"></path>
                      <path d="M3 9h18"></path>
                    </svg>
                    search extension
                  </span>
                </p>
                <p className="mt-2 text-gray-600">.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div
        className="flex-1 overflow-auto bg-white"
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
            className="h-full w-full overflow-auto"
            onClick={() => setSelectedCell(null)}
          >
            {/* Table Header Row */}
            <div className="font-small sticky top-0 z-10 flex bg-[#f4f4f4] text-sm text-gray-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id} className="flex w-full">
                  {headerGroup.headers.map((header) => (
                    <div
                      key={header.id}
                      style={{
                        width: `${header.getSize()}px`,
                        minWidth: `${header.getSize()}px`,
                        height: "30px", // Moderate height for header cells
                      }}
                      className="border-r border-b border-gray-200 px-3 py-1 text-left"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  ))}
                  {/* Extra header for "+ Add field" */}
                  <div
                    className="border-b border-gray-200 px-3 py-1 text-left"
                    style={{
                      width: "150px",
                      minWidth: "150px",
                      height: "30px",
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!isAddingColumn) {
                          setIsFieldModalOpen(!isFieldModalOpen);
                          setFieldError("");
                        }
                      }}
                      className="cursor-pointer px-2 py-0.5 text-sm hover:underline"
                      disabled={isAddingColumn}
                    >
                      {isAddingColumn ? "Adding..." : "+ Add field"}
                    </button>
                    {isFieldModalOpen && (
                      <div className="absolute z-10 mt-2 w-64 rounded border bg-white p-4 shadow-md">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          className="mb-2 w-full rounded border px-2 py-1 text-sm"
                        />
                        <select
                          value={newFieldType}
                          onChange={(e) =>
                            setNewFieldType(e.target.value as "text" | "number")
                          }
                          className="mb-2 w-full rounded border px-2 py-1 text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                        </select>
                        {fieldError && (
                          <p className="mb-2 text-xs text-red-600">
                            {fieldError}
                          </p>
                        )}
                        <button
                          onClick={handleAddColumn}
                          className="w-full rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
                          disabled={isAddingColumn}
                        >
                          {isAddingColumn ? "Adding..." : "Add Field"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Virtualized Table Body */}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
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
                      width: "100%",
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
                          height: "100%", // Match row height
                        }}
                        className="border-r border-gray-100"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    ))}
                    {/* Empty cell for the "+ Add field" column */}
                    <div
                      style={{ width: "150px", minWidth: "150px" }}
                      className="px-4 py-2"
                    />
                  </div>
                );
              })}
            </div>

            {/* Loading indicator for pagination */}
            {isLoadingMore && (
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

      {/* Footer with Add Record buttons */}
      <div className="flex items-center gap-6 border-t bg-white px-4 py-2 text-sm">
        <button
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={createRowHandler}
          disabled={isSaving}
        >
          + Add record
        </button>
        <button
          onClick={() => handleAddFakeRecords(100000)}
          className="text-blue-600 hover:underline"
          disabled={isSaving || isAddingBulkRows}
        >
          {isAddingBulkRows 
            ? `Adding rows... ${Math.round((bulkRowProgress.current / bulkRowProgress.total) * 100)}%` 
            : "Add 100000 rows"}
        </button>
        {isAddingBulkRows && (
          <div className="ml-2 flex items-center">
            <div className="h-2 w-32 rounded-full bg-gray-200">
              <div 
                className="h-2 rounded-full bg-blue-600" 
                style={{ width: `${Math.round((bulkRowProgress.current / bulkRowProgress.total) * 100)}%` }}
              ></div>
            </div>
            <span className="ml-2 text-xs text-gray-500">
              {bulkRowProgress.current.toLocaleString()} / {bulkRowProgress.total.toLocaleString()}
            </span>
            <button
              onClick={cancelBulkRowAddition}
              className="ml-2 rounded-full bg-red-100 p-1 text-red-600 hover:bg-red-200"
              title="Cancel adding rows"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}