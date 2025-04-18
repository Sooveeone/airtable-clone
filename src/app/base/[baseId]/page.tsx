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
import { FilterPopover } from "./FilterPopover";
import { SortPopover } from "./SortPopover";
import { HideFieldsPopover } from "./HideFieldsPopover";
import { ViewsSidebar } from "./ViewsSidebar";

// Client-side only UserButton wrapper
import dynamic from "next/dynamic";

const ClientUserButton = dynamic(
  () => Promise.resolve(() => <UserButton />),
  { ssr: false }
);

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
    if (key && key !== "rowNumber") {
      // Skip the rowNumber column
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
  activeFilter,
  activeSort,
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
  editedCellsRef: React.MutableRefObject<
    Map<string, { value: string | number | null }>
  >;
  activeFilter?: {
    columnName: string;
    operator: string;
    value?: string | number | null;
  };
  activeSort?: {
    columnName: string;
    direction: "asc" | "desc";
  };
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

  // Check if this cell matches the filter criteria
  const matchesFilter =
    activeFilter &&
    keyName === activeFilter.columnName &&
    (() => {
      if (!activeFilter) return false;
      const cellValue = value;

      switch (activeFilter.operator) {
        case "isEmpty":
          return cellValue === null || cellValue === "";
        case "isNotEmpty":
          return cellValue !== null && cellValue !== "";
        case "contains":
          return (
            typeof cellValue === "string" &&
            cellValue
              .toLowerCase()
              .includes((activeFilter.value as string).toLowerCase())
          );
        case "notContains":
          return (
            typeof cellValue === "string" &&
            !cellValue
              .toLowerCase()
              .includes((activeFilter.value as string).toLowerCase())
          );
        case "equals":
          return cellValue === activeFilter.value;
        case "greaterThan":
          return (
            typeof cellValue === "number" &&
            cellValue > (activeFilter.value as number)
          );
        case "lessThan":
          return (
            typeof cellValue === "number" &&
            cellValue < (activeFilter.value as number)
          );
        default:
          return false;
      }
    })();

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
        editedCellsRef.current.set(`${row.original.id}|${keyName}`, {
          value: newValue,
        });
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
          matchesQuery
            ? "bg-yellow-100"
            : matchesFilter
            ? "bg-green-100"
            : activeSort?.columnName === keyName
            ? "bg-[#fff2ea]"
            : "bg-transparent"
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
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top, left: rect.left });
    }
    setOpen(!open);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

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
            ref={menuRef}
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
  const [fieldError, setFieldError] = useState("");

  // All refs
  const addTableButtonRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const initialTableCreationAttempted = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editedCellsRef = useRef<Map<string, { value: string | number | null }>>(new Map());
  const shouldCancelBulkRowsRef = useRef(false);
  const lastUpdateRef = useRef<string | null>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const addFieldModalRef = useRef<HTMLDivElement>(null);

  // Handle click outside for each popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchModalRef.current && !searchModalRef.current.contains(e.target as Node)) {
        setIsSearchModalOpen(false);
      }
    };
    if (isSearchModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSearchModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setIsFilterModalOpen(false);
      }
    };
    if (isFilterModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFilterModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (sortPopoverRef.current && !sortPopoverRef.current.contains(e.target as Node)) {
        setIsSortModalOpen(false);
      }
    };
    if (isSortModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSortModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (hideFieldsRef.current && !hideFieldsRef.current.contains(e.target as Node)) {
        setIsHideFieldsOpen(false);
      }
    };
    if (isHideFieldsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isHideFieldsOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (addFieldModalRef.current && !addFieldModalRef.current.contains(e.target as Node)) {
        setIsFieldModalOpen(false);
      }
    };
    if (isFieldModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isFieldModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (addTableButtonRef.current && !addTableButtonRef.current.contains(e.target as Node)) {
        setIsAddTableMenuOpen(false);
      }
    };
    if (isAddTableMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isAddTableMenuOpen]);

  // Close search modal and clear search query when switching tables or views
  useEffect(() => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
  }, [tableId, activeViewId]);

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

  // Add type definitions for view settings
  type FilterType = {
    columnName: string;
    operator:
      | "isEmpty"
      | "isNotEmpty"
      | "contains"
      | "notContains"
      | "equals"
      | "greaterThan"
      | "lessThan";
    value?: string | number | null;
  };

  type SortType = {
    columnName: string;
    direction: "asc" | "desc";
  };

  // Add state definitions with proper types
  const [activeFilter, setActiveFilter] = useState<FilterType | undefined>(
    undefined
  );
  const [activeSort, setActiveSort] = useState<SortType | undefined>();

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

  // Add click outside handler for table menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        addTableButtonRef.current &&
        !addTableButtonRef.current.contains(event.target as Node)
      ) {
        setIsAddTableMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

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
      const dataColumns = (currentData.columns ?? [])
        .filter((col: TableColumn) => !hiddenColumns.has(col.name)) // Filter out hidden columns
        .map((col: TableColumn) => ({
          accessorKey: col.name,
          meta: { type: col.type as "text" | "number" },
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
    }, {
      onSuccess: () => {
        void refetch();
        setIsAddingColumn(false);
        setNewFieldName("");
        setNewFieldType("text");
        setFieldError("");
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
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isFetchingNextPage) {
      timeout = setTimeout(() => {
        setShowLoading(true);
      }, 500);
    } else {
      setShowLoading(false);
    }
    return () => clearTimeout(timeout);
  }, [isFetchingNextPage]);

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
            <ClientUserButton />
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex h-8 items-center justify-between bg-[#4c505b] px-4 text-sm">
        <div className="flex h-full items-center gap-2">
          <div className="flex h-full items-center gap-1">
            {tables?.map((table) => (
              <div key={table.id} className="h-full">
                <div
                  className={`flex h-full items-center rounded-t-md px-4 cursor-pointer ${
                    tableId === table.id
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                  onClick={() => setTableId(table.id)}
                >
                  <span className="font-small mr-2 text-base text-sm">
                    {table.name}
                  </span>
                  <ChevronDown
                    size={16}
                    className={
                      tableId === table.id ? "text-gray-500" : "text-gray-300"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex h-full items-center px-2">
            <ChevronDown size={16} className="text-white" />
          </div>
          <div
            ref={addTableButtonRef}
            className="relative flex h-full cursor-pointer items-center hover:bg-gray-700"
            onClick={() => setIsAddTableMenuOpen(!isAddTableMenuOpen)}
          >
            <Plus size={16} className="mr-1 text-white" />
            <span className="text-sm font-light text-gray-100">
              Add or import
            </span>
            {isAddTableMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-2">
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    onClick={handleCreateNewTable}
                    disabled={isCreatingTable}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded border border-gray-300">
                      {isCreatingTable ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {isCreatingTable
                          ? "Creating table..."
                          : "Add a blank table"}
                      </span>
                      <span className="text-xs text-gray-500">
                        Start from scratch
                      </span>
                    </div>
                  </button>
                  {tableError && (
                    <p className="mt-2 text-xs text-red-600">{tableError}</p>
                  )}
                </div>
              </div>
            )}
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
      <div className="flex items-center border-b border-gray-300 bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100"
            onClick={() => setIsViewsSidebarOpen(!isViewsSidebarOpen)}
          >
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
          <div className="relative">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100"
              onClick={() => setIsHideFieldsOpen(!isHideFieldsOpen)}
            >
              <Eye className="h-4 w-4" />
              <span>
                Hide fields
                {hiddenColumns.size > 0 && (
                  <span className="ml-1 text-xs text-gray-500">
                    ({hiddenColumns.size})
                  </span>
                )}
              </span>
            </button>
            {isHideFieldsOpen && tableData?.pages[0]?.columns && (
              <div ref={hideFieldsRef}>
                <HideFieldsPopover
                  columns={tableData.pages[0].columns}
                  hiddenColumns={hiddenColumns}
                  onToggleColumn={handleToggleColumn}
                  onClose={() => setIsHideFieldsOpen(false)}
                />
              </div>
            )}
          </div>
          <div className="relative">
            <button
              className={`flex items-center gap-1.5 rounded px-2 py-1 ${
                activeFilter
                  ? "bg-green-100 hover:bg-green-200"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
            >
              <Filter className="h-4 w-4" />
              <span>
                {activeFilter
                  ? `Filtered by ${activeFilter.columnName}`
                  : "Filter"}
              </span>
            </button>
            {isFilterModalOpen && tableData?.pages[0]?.columns && (
              <div ref={filterPopoverRef}>
                <FilterPopover
                  columns={tableData.pages[0].columns}
                  onApplyFilter={(filter) => {
                    setActiveFilter(filter);
                    setIsFilterModalOpen(false);
                  }}
                  onClose={() => setIsFilterModalOpen(false)}
                  activeFilter={activeFilter}
                  onClearFilter={() => {
                    setActiveFilter(undefined);
                    setIsFilterModalOpen(false);
                  }}
                />
              </div>
            )}
          </div>
          <div className="relative">
            <button
              className={`flex items-center gap-1.5 rounded px-2 py-1 ${
                activeSort
                  ? "bg-[#fff2ea] hover:bg-orange-100"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setIsSortModalOpen(!isSortModalOpen)}
            >
              <ArrowUpDown className="h-4 w-4" />
              <span>
                {activeSort ? `Sorted by ${activeSort.columnName}` : "Sort"}
              </span>
            </button>
            {isSortModalOpen && tableData?.pages[0]?.columns && (
              <div ref={sortPopoverRef}>
                <SortPopover
                  columns={tableData.pages[0].columns}
                  onApplySort={(sort) => {
                    setActiveSort(sort);
                    setIsSortModalOpen(false);
                  }}
                  onClose={() => setIsSortModalOpen(false)}
                  activeSort={activeSort}
                  onClearSort={() => {
                    setActiveSort(undefined);
                    setIsSortModalOpen(false);
                  }}
                />
              </div>
            )}
          </div>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 hover:bg-gray-100">
            <FolderKanban className="h-4 w-4" />
            <span>Group</span>
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
            <div ref={searchModalRef} className="absolute top-full right-0 z-50 mt-1 w-96 rounded-md border border-gray-200 bg-gray-50 shadow-md">
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
                            setFieldError("");
                          }
                        }}
                        className="flex h-full w-full items-center justify-center text-lg font-medium text-gray-600 hover:text-gray-900"
                        disabled={isAddingColumn}
                      >
                        {isAddingColumn ? "..." : "+"}
                      </button>
                      {isFieldModalOpen && (
                        <div ref={addFieldModalRef} className="absolute z-10 mt-2 w-64 rounded border bg-white p-4 shadow-md">
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
                              setNewFieldType(
                                e.target.value as "text" | "number"
                              )
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
      <div className="flex items-center justify-between border-t border-gray-300 bg-white px-4 py-2 text-sm">
        <div className="flex items-center gap-6">
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
              ? `Adding rows... ${Math.round(
                  (bulkRowProgress.current / bulkRowProgress.total) * 100
                )}%`
              : "Add 100000 rows"}
          </button>
          {isAddingBulkRows && (
            <div className="ml-2 flex items-center">
              <div className="h-2 w-32 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{
                    width: `${Math.round(
                      (bulkRowProgress.current / bulkRowProgress.total) * 100
                    )}%`,
                  }}
                ></div>
              </div>
              <span className="ml-2 text-xs text-gray-500">
                {bulkRowProgress.current.toLocaleString()} /{" "}
                {bulkRowProgress.total.toLocaleString()}
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
        <span className="">
          {tableData?.pages[0]?.totalCount?.toLocaleString() ?? 0} record{tableData?.pages[0]?.totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}