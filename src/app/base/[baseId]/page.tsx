"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type AccessorKeyColumnDef,
} from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import { UserButton } from "@clerk/nextjs";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";
import { useVirtualizer } from "@tanstack/react-virtual";

import { ChevronDown, Loader2 } from "lucide-react";

// Define proper column meta type
interface ColumnMeta {
  type?: "text" | "number";
}

// Define the record type
type RecordRow = Record<string, string | number | null> & { id?: string };
type ColumnValue = string | number | null;

// Define types for database entities
type TableRow = RouterOutputs["table"]["getTableData"]["rows"][number];
type TableColumn = RouterOutputs["table"]["getTableData"]["columns"][number];

const generateFakeRecord = (
  columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[],
): RecordRow => {
  const record: RecordRow = {};

  for (const col of columns) {
    // We're now using AccessorKeyColumnDef so accessorKey is guaranteed to exist
    const key = col.accessorKey || "";

    if (key) {
      // Type assertion for meta property
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

const defaultColumnsKeys = ["name", "notes", "assignee", "status"];

export default function BasePage() {
  const router = useRouter();
  const { baseId } = useParams();
  const [data, setData] = useState<RecordRow[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch base info
  const { data: base, isLoading: isBaseLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });

  // Fetch tables for this base
  const { data: tables, isLoading: isTablesLoading } =
    api.table.getTablesForBase.useQuery(
      { baseId: baseId as string },
      {
        enabled: !!baseId,
      },
    );

  // Effect to handle tables response
  useEffect(() => {
    // Only proceed if tables is defined
    if (!tables) return;

    // Check explicitly that the first item exists
    if (tables.length > 0 && tables[0]?.id) {
      setTableId(tables[0].id);
    } else if (tables.length === 0 && baseId) {
      // Handle case where no tables exist
      createDefaultTable();
    }
  }, [tables, baseId]);

  // Create a default table if none exists
  const createTableMutation = api.table.createTable.useMutation({
    onSuccess: (newTable) => {
      setTableId(newTable.id);
    },
  });

  const handleDeleteColumn = (name: string) => {
    if (!tableId) return;

    // Optimistically update UI
    setColumns((prev) => prev.filter((col) => col.accessorKey !== name));
    setData((prevData) =>
      prevData.map((row) => {
        const { [name]: _, ...rest } = row;
        return rest;
      }),
    );

    deleteColumnMutation.mutate({
      tableId,
      columnName: name,
    });
  };

  const createDefaultTable = () => {
    if (!baseId) return;

    createTableMutation.mutate({
      baseId: baseId as string,
      name: "Table 1",
      columns: defaultColumnsKeys.map((name) => ({
        name,
        type: "text",
      })),
    });
  };

  // Fetch table data when tableId is set
  const {
    data: tableData,
    isLoading: isTableDataLoading,
    refetch: refetchTableData,
  } = api.table.getTableData.useQuery(
    { tableId: tableId as string },
    {
      enabled: !!tableId,
    },
  );

  // Effect to process table data when it changes
  useEffect(() => {
    if (tableData) {
      // Format data for the table
      const formattedData = tableData.rows.map((row) => ({
        id: row.id,
        ...(row.data as Record<string, string | number | null>),
      }));
      setData(formattedData);

      // Create columns based on the column definitions
      const dbColumns = tableData.columns.map((col) => ({
        accessorKey: col.name,
        header: () => (
          <ColumnHeader
            name={col.name}
            onDelete={() => handleDeleteColumn(col.name)}
          />
        ),
        cell: createCellRenderer(col.name, col.type as "text" | "number"),
        meta: { type: col.type } as ColumnMeta,
      }));

      setColumns(dbColumns);
      setIsLoading(false);
    }
  }, [tableData]);

  // Update cell mutation
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      console.error("Failed to update cell:", error);
      setIsSaving(false);
    },
  });

  // Create row mutation
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

  // Create column mutation
  const createColumnMutation = api.table.createColumn.useMutation({
    onSuccess: () => {
      // Refresh table data after adding column
      if (tableId) {
        void refetchTableData();
      }
    },
  });

  // Updated createCellRenderer function to highlight cell on click

  const createCellRenderer = (key: string, fieldType: "text" | "number") => {
    return ({
      row,
      column,
    }: {
      row: { index: number; original: RecordRow };
      column: { id: string };
    }) => {
      const value = row.original[key];
      const isSelected =
        selectedCell?.rowIndex === row.index &&
        selectedCell?.columnId === column.id;

      // Local state for cell editing
      const [localValue, setLocalValue] = useState<string | number | null>(
        value === 0 && fieldType === "number" ? 0 : (value ?? ""),
      );
      const [isEditing, setIsEditing] = useState(false);
      const inputRef = useRef<HTMLInputElement>(null);

      // Update local value when the row value changes
      useEffect(() => {
        setLocalValue(
          value === 0 && fieldType === "number" ? 0 : (value ?? ""),
        );
      }, [value]);

      // Focus on the input when selected
      useEffect(() => {
        if (isSelected && inputRef.current) {
          inputRef.current.focus();
        }
      }, [isSelected]);

      // Handle saving the cell data
      const saveCell = () => {
        if (!isEditing) return;

        // Convert value based on field type
        const newValue =
          fieldType === "number"
            ? localValue === ""
              ? null
              : Number(localValue)
            : localValue;

        // Only update if the value has changed
        if (newValue !== value) {
          // Update local state optimistically, but use ID for lookup
          setData((prev) =>
            prev.map((item) => {
              if (item.id === row.original.id) {
                return {
                  ...item,
                  [key]: newValue,
                };
              }
              return item;
            }),
          );

          // Save to database using the row ID
          if (tableId && row.original.id) {
            setIsSaving(true);
            updateCellMutation.mutate({
              tableId,
              rowId: row.original.id,
              columnName: key,
              value: newValue,
            });
          }
        }

        setIsEditing(false);
      };

      // Handle key press events
      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveCell();
          setSelectedCell(null);
        } else if (e.key === "Escape") {
          e.preventDefault();
          // Reset to original value
          setLocalValue(
            value === 0 && fieldType === "number" ? 0 : (value ?? ""),
          );
          setIsEditing(false);
          setSelectedCell(null);
        } else {
          // Start editing on any other key press
          if (!isEditing) {
            setIsEditing(true);
          }
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
            onBlur={() => {
              saveCell();
            }}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditing) {
                // Only set editing mode when user starts typing
                // not on initial click
              }
            }}
          />
        </div>
      );
    };
  };
  const [columns, setColumns] = useState<
    AccessorKeyColumnDef<RecordRow, ColumnValue>[]
  >([]);

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number">("text");
  const [fieldError, setFieldError] = useState("");

  const deleteColumnMutation = api.table.deleteColumn.useMutation({
    onSuccess: () => {
      void refetchTableData();
    },
    onError: (err) => {
      console.error("Failed to delete column:", err);
    },
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id ?? faker.string.uuid(),
    columnResizeMode: "onChange", // Optional for resizing later
  });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // approx height of each row in px
    overscan: 10,
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

    const exists = columns.some((col) => {
      return col.accessorKey === newFieldName;
    });

    if (exists) {
      setFieldError("A column with that name already exists.");
      return;
    }

    // Create column in database
    createColumnMutation.mutate({
      tableId,
      name: newFieldName,
      type: newFieldType,
    });

    // Add column to UI optimistically
    const columnDef: AccessorKeyColumnDef<RecordRow, ColumnValue> = {
      accessorKey: newFieldName,
      header: () => (
        <ColumnHeader
          name={newFieldName}
          onDelete={() => handleDeleteColumn(newFieldName)}
        />
      ),
      cell: createCellRenderer(newFieldName, newFieldType),
      meta: { type: newFieldType } as ColumnMeta,
    };

    setColumns((prev) => [...prev, columnDef]);

    // Update existing row data to include the new column
    setData((prevData) =>
      prevData.map((row) => ({
        ...row,
        [newFieldName]: newFieldType === "number" ? null : "",
      })),
    );

    // Also update database rows to include the new column with default value
    if (tableId) {
      for (const row of data) {
        if (row.id) {
          updateCellMutation.mutate({
            tableId,
            rowId: row.id,
            columnName: newFieldName,
            value: newFieldType === "number" ? null : "",
          });
        }
      }
    }

    setNewFieldName("");
    setNewFieldType("text");
    setFieldError("");
    setIsFieldModalOpen(false);
  };

  // Add a new record to the database
  const handleAddRecord = () => {
    if (!tableId) return;

    setIsSaving(true);

    // Generate a record with random values based on column type
    const defaultData: Record<string, string | number | null> = {};

    columns.forEach((col) => {
      const key = col.accessorKey;
      const meta = col.meta as ColumnMeta | undefined;

      // Generate random data based on column type
      defaultData[key] =
        meta?.type === "number"
          ? faker.number.int({ min: 0, max: 100 })
          : faker.word.words({ count: faker.number.int({ min: 1, max: 3 }) }); // Generate 1-3 random words for text fields
    });

    createRowMutation.mutate(
      {
        tableId,
        defaultData,
      },
      {
        onSuccess: (newRow) => {
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
          setIsSaving(false);
        },

        onError: (error) => {
          console.error("Failed to create row:", error);
          setIsSaving(false);
        },
      },
    );
  };
  // Add multiple fake records
  // Add multiple fake records
  const handleAddFakeRecords = (count: number) => {
    if (!tableId) return;

    setIsSaving(true);

    // Create in batches to avoid overwhelming the API
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

        // Process next batch
        void processBatch(batchIndex + 1);
      } catch (err) {
        console.error("Failed to create rows:", err);
        setIsSaving(false);
      }
    };

    // Start processing batches
    void processBatch(0);
  };

  // Create rows mutation for batch operations
  const createRowsMutation = api.table.createRows.useMutation();

  return (
    <div className="flex h-screen flex-col">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-6 border-b bg-gray-700 px-4 py-2 text-sm text-white shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">
            {isBaseLoading ? "Loading..." : (base?.name ?? "Untitled Base")}
          </h1>
          <div className="flex gap-4">
            <button className="hover:underline">Data</button>
            <button className="hover:underline">Automations</button>
            <button className="hover:underline">Interfaces</button>
            <button className="hover:underline">Forms</button>
          </div>
        </div>
        <UserButton />
      </div>

      <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-sm shadow-sm">
        <select className="rounded border px-2 py-1 text-sm">
          <option>Table 1</option>
        </select>
        <button className="text-xl leading-none">+</button>
        {isSaving && (
          <div className="ml-2 flex items-center text-gray-600">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Views
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Filter
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Sort
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Color
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Share and sync
          </button>
        </div>
      </div>

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
            {/* Header row - fixed at the top */}
            <div className="sticky top-0 z-10 flex bg-gray-50 font-semibold text-gray-600">
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

                  {/* Extra header column for "+ Add field" */}
                  <div
                    className="border-b border-gray-200 px-4 py-2 text-left"
                    style={{
                      width: "150px",
                      minWidth: "150px",
                    }}
                  >
                    <button
                      onClick={() => {
                        setIsFieldModalOpen(!isFieldModalOpen);
                        setFieldError("");
                      }}
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-100"
                    >
                      + Add field
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
                        >
                          Add Field
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Table body with virtualization */}
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

                    {/* Empty cell to match the "+ Add field" column */}
                    <div
                      style={{
                        width: "150px",
                        minWidth: "150px",
                      }}
                      className="px-4 py-2"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 border-t bg-white px-4 py-2 text-sm">
        <button
          className="text-blue-600 hover:underline"
          onClick={handleAddRecord}
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
