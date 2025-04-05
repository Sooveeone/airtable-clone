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
} from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import { api } from "@/trpc/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";

// Define proper column meta type
interface ColumnMeta {
  type?: "text" | "number";
}

// Define the record type
type RecordRow = Record<string, string | number | null> & { id?: string };
type ColumnValue = string | number | null;

const defaultColumnsKeys = ["name", "notes", "assignee", "status"];

// Generate a fake record based on given columns
const generateFakeRecord = (
  columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[],
): RecordRow => {
  const record: RecordRow = {};
  for (const col of columns) {
    const key = col.accessorKey || "";
    if (key) {
      const meta = col.meta as ColumnMeta | undefined;
      record[key] =
        meta?.type === "number"
          ? faker.number.int({ min: 0, max: 100 })
          : faker.word.words(2);
    }
  }
  return record;
};

function ColumnHeader({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors duration-150 hover:bg-gray-100"
        title="Click to open options"
      >
        <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
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

// -------------------------------------------------------------------------
// Top‑level CellRenderer component
// -------------------------------------------------------------------------
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
  updateCellMutation: {
    mutate: (input: UpdateCellInput) => void;
  };
}) {
  const value = row.original[keyName];
  const isSelected =
    selectedCell?.rowIndex === row.index &&
    selectedCell?.columnId === column.id;

  // Local state for cell editing
  const [localValue, setLocalValue] = useState<string | number | null>(
    value === 0 && fieldType === "number" ? 0 : (value ?? ""),
  );
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local state when external value changes
  useEffect(() => {
    setLocalValue(value === 0 && fieldType === "number" ? 0 : (value ?? ""));
  }, [value, fieldType]);

  // Auto-focus the input if this cell is selected
  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  // Handle saving the cell data
  const saveCell = () => {
    if (!isEditing) return;
    const newValue =
      fieldType === "number"
        ? localValue === ""
          ? null
          : Number(localValue)
        : localValue;
    if (newValue !== value) {
      // Optimistically update the row data
      setData((prev) =>
        prev.map((item) =>
          item.id === row.original.id ? { ...item, [keyName]: newValue } : item,
        ),
      );
      // Persist the update if possible
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
      setLocalValue(value === 0 && fieldType === "number" ? 0 : (value ?? ""));
      setIsEditing(false);
      setSelectedCell(null);
    } else if (!isEditing) {
      setIsEditing(true);
    }
  };

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
        className="h-full w-full border-none bg-transparent outline-none"
        value={
          isEditing
            ? localValue === 0
              ? "0"
              : (localValue ?? "")
            : value === 0
              ? "0"
              : (value ?? "")
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // New state for tracking column addition progress
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const initialTableCreationAttempted = useRef(false);

  // Fetch base info
  const { data: base, isLoading: isBaseLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });

  // Fetch tables for this base
  const { data: tables, isLoading: isTablesLoading } =
    api.table.getTablesForBase.useQuery(
      { baseId: baseId as string },
      { enabled: !!baseId },
    );

  // Create a default table if none exists
  const createTableMutation = api.table.createTable.useMutation({
    onSuccess: (newTable) => {
      setTableId(newTable.id);
    },
  });

  // Mutation for updating cell values (types inferred from router)
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

  // When tables data arrives, choose an existing table or create a new one
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
        },
      );
    }
  }, [tables, isTablesLoading, baseId, createTableMutation]);

  // Fetch table data once a table is selected
  const {
    data: tableData,
    isLoading: isTableDataLoading,
    refetch: refetchTableData,
  } = api.table.getTableData.useQuery(
    { tableId: tableId! },
    { enabled: !!tableId },
  );

  // When tableData is available, format and set the rows
  useEffect(() => {
    if (tableData) {
      const formattedData = tableData.rows.map((row) => ({
        id: row.id,
        ...(row.data as Record<string, string | number | null>),
      }));
      setData(formattedData);
      setIsLoading(false);
    }
  }, [tableData]);

  // Wrap the delete column function in useCallback
  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onSuccess: () => {
      void refetchTableData();
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
        }),
      );
      deleteColumnMutation.mutate({ tableId, columnName: name });
    },
    [tableId, deleteColumnMutation],
  );

  // Compute column definitions using useMemo.
  const columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[] =
    useMemo(() => {
      if (!tableData) return [];
      return tableData.columns.map((col) => ({
        accessorKey: col.name,
        header: () => (
          <ColumnHeader
            name={col.name}
            onDelete={() => handleDeleteColumn(col.name)}
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
          />
        ),
        meta: { type: col.type } as ColumnMeta,
      }));
    }, [
      tableData,
      tableId,
      updateCellMutation,
      selectedCell,
      handleDeleteColumn,
    ]);

  // Mutation to add a new row
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

  // Mutation to add a new column
  const createColumnMutation = api.table.createColumn.useMutation({
    onSuccess: () => {
      if (tableId) {
        void refetchTableData();
      }
      // When finished adding the column, stop the loading state.
      setIsAddingColumn(false);
    },
    onError: (error) => {
      console.error("Failed to add column:", error);
      setIsAddingColumn(false);
    },
  });

  // State and handler for the "add field" modal
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
    const exists = tableData?.columns.some((col) => col.name === newFieldName);
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
    // Optionally, you can also update local data optimistically here.
    setNewFieldName("");
    setNewFieldType("text");
    setFieldError("");
    setIsFieldModalOpen(false);
  };

  // Mutation to create multiple rows at once
  const createRowsMutation = api.table.createRows.useMutation();

  const createRowHandler = async () => {
    if (!tableId) return;
    if (isSaving) return; // Prevent multiple concurrent requests
    setIsSaving(true);
    const defaultData: Record<string, string | number | null> = {};
    columns.forEach((col) => {
      const key = col.accessorKey;
      const meta = col.meta as ColumnMeta | undefined;
      defaultData[key] =
        meta?.type === "number"
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

  const handleAddFakeRecords = (count: number) => {
    if (!tableId) return;
    setIsSaving(true);
    const batchSize = 100;
    const batches = Math.ceil(count / batchSize);
    const processBatch = async (batchIndex: number) => {
      if (batchIndex >= batches) {
        setIsSaving(false);
        void refetchTableData();
        return;
      }
      const batchCount = Math.min(batchSize, count - batchIndex * batchSize);
      const fakeRecords = Array.from({ length: batchCount }, () =>
        generateFakeRecord(columns),
      );
      try {
        if (batchCount > 1) {
          await createRowsMutation.mutateAsync({
            tableId,
            rows: fakeRecords,
          });
        } else {
          for (const record of fakeRecords) {
            await createRowMutation.mutateAsync({
              tableId,
              defaultData: record,
            });
          }
        }
        void processBatch(batchIndex + 1);
      } catch (err) {
        console.error("Failed to create rows:", err);
        setIsSaving(false);
      }
    };
    void processBatch(0);
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
  });

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
              <Image
                src="/airtable-svgrepo-com.svg"
                alt="Airtable Logo"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <h1 className="flex items-center gap-1 text-xl font-medium text-gray-100 hover:text-white">
              {isBaseLoading ? "Loading..." : (base?.name ?? "Untitled Base 2")}
              <ChevronDown size={16} className="text-gray-500" />
            </h1>
          </div>
          <div className="flex gap-6">
            <button className="font-light text-gray-100 hover:text-white">
              Data
            </button>
            <button className="font-light text-gray-100 hover:text-white">
              Automations
            </button>
            <button className="font-light text-gray-100 hover:text-white">
              Interfaces
            </button>
            <div className="mx-2 h-5 w-px bg-gray-500"></div>
            <button className="font-light text-gray-100 hover:text-white">
              Forms
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full p-1 hover:bg-gray-200">
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
            >
              <path d="M3 12h18"></path>
              <path d="M3 6h18"></path>
              <path d="M3 18h18"></path>
            </svg>
          </button>
          <button className="rounded-full p-1 hover:bg-gray-200">
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
            >
              <path d="M1 4v6h6"></path>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
          <button className="flex items-center gap-1 rounded-full p-1 hover:bg-gray-200">
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
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
            <span className="font-medium text-gray-100 hover:text-white">
              Help
            </span>
          </button>
          <button className="flex items-center gap-1 rounded-full bg-white px-4 py-1.5 font-medium shadow-sm hover:bg-gray-50">
            <span>Share</span>
          </button>
          <button className="rounded-full p-1 hover:bg-gray-200">
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
      <div className="flex items-center border-b bg-gray-100 px-4 py-2 text-sm shadow-sm">
        <div className="flex items-center">
          <button className="flex items-center gap-1 rounded-md bg-white px-3 py-1.5 font-medium shadow-sm">
            <span>Table 1</span>
            <ChevronDown size={16} className="text-gray-500" />
          </button>
          <button className="ml-2 flex h-8 w-8 items-center justify-center rounded-md bg-white text-xl font-medium shadow-sm">
            +
          </button>
        </div>
        {isSaving && (
          <div className="ml-2 flex items-center text-gray-600">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-medium text-gray-500">Extensions</span>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-500">Tools</span>
            <ChevronDown size={16} className="text-gray-500" />
          </div>
        </div>
      </div>

      {/* No column toolbar in the screenshot */}

      {/* Table Body */}
      <div
        className="flex-1 overflow-auto bg-white"
        onClick={() => setSelectedCell(null)}
      >
        {isLoading || isBaseLoading || isTablesLoading || isTableDataLoading ? (
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
            <div className="sticky top-0 z-10 flex bg-gray-200 font-semibold text-gray-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id} className="flex w-full">
                  {headerGroup.headers.map((header) => (
                    <div
                      key={header.id}
                      style={{
                        width: `${header.getSize()}px`,
                        minWidth: `${header.getSize()}px`,
                      }}
                      className="border-r border-b border-gray-200 px-4 py-2 text-left"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </div>
                  ))}
                  {/* Extra header for "+ Add field" */}
                  <div
                    className="border-b border-gray-200 px-4 py-2 text-left"
                    style={{ width: "150px", minWidth: "150px" }}
                  >
                    <button
                      onClick={() => {
                        if (!isAddingColumn) {
                          setIsFieldModalOpen(!isFieldModalOpen);
                          setFieldError("");
                        }
                      }}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-100"
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
                        }}
                        className="border-r border-gray-100 px-4 py-2"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
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
          </div>
        )}
      </div>

      {/* Footer with Add Record buttons */}
      <div className="flex items-center gap-6 border-t bg-white px-4 py-2 text-sm">
        <button
          className="text-blue-600 hover:underline"
          onClick={createRowHandler}
          disabled={isSaving}
        >
          + Add record
        </button>
        <button
          onClick={() => handleAddFakeRecords(10000)}
          className="text-blue-600 hover:underline"
        >
          Add 10000 rows
        </button>
      </div>
    </div>
  );
}
