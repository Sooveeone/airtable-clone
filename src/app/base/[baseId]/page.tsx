"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type AccessorKeyColumnDef,
} from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import { UserButton } from "@clerk/nextjs";
import { api } from "@/trpc/react";

import { ChevronDown } from "lucide-react";

// Define proper column meta type
interface ColumnMeta {
  type?: "text" | "number";
}

// Define the record type
type RecordRow = Record<string, string | number>;

const generateFakeRecord = (
  columns: AccessorKeyColumnDef<RecordRow, any>[],
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
        className="flex items-center gap-1"
      >
        <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-10 mt-1 w-28 rounded border bg-white shadow-md">
          <button
            className="block w-full px-3 py-2 text-left text-sm hover:bg-red-100"
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

let staticDeleteHandler: (key: string) => void = () => {};
const handleDeleteColumnStatic = (key: string) => staticDeleteHandler(key);

const defaultColumnsKeys = ["name", "notes", "assignee", "status"];

export default function BasePage() {
  const { baseId } = useParams();
  const [data, setData] = useState<RecordRow[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);

  const [columns, setColumns] = useState<
    AccessorKeyColumnDef<RecordRow, any>[]
  >(
    defaultColumnsKeys.map((key) => ({
      accessorKey: key,
      header: () => (
        <ColumnHeader
          name={key}
          onDelete={() => handleDeleteColumnStatic(key)}
        />
      ),
      cell: ({ row, column }) => {
        const value = row.original[key];
        const isSelected =
          selectedCell?.rowIndex === row.index &&
          selectedCell?.columnId === column.id;

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
              type={typeof value === "number" ? "number" : "text"}
              className="h-full w-full border-none bg-transparent outline-none"
              value={value === 0 && typeof value === "number" ? "" : value}
              onChange={(e) => {
                const newValue =
                  typeof value === "number"
                    ? e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                    : e.target.value;
                setData((prev) => {
                  const updated = [...prev];
                  updated[row.index] = {
                    ...updated[row.index],
                    [key]: newValue,
                  };
                  return updated;
                });
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      },
      meta: { type: "text" } as ColumnMeta,
    })),
  );
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number">("text");
  const [fieldError, setFieldError] = useState("");

  staticDeleteHandler = (name: string) => {
    setColumns((prev) =>
      prev.filter((col) => {
        // We're now using AccessorKeyColumnDef so accessorKey is guaranteed to exist
        return col.accessorKey !== name;
      }),
    );
    setData((prevData) =>
      prevData.map((row) => {
        const { [name]: _, ...rest } = row;
        return rest;
      }),
    );
  };

  const { data: base, isLoading } = api.base.getById.useQuery({
    baseId: baseId as string,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleAddColumn = () => {
    if (!newFieldName.trim()) {
      setFieldError("Field name is required.");
      return;
    }

    const exists = columns.some((col) => {
      // We're now using AccessorKeyColumnDef so accessorKey is guaranteed to exist
      return col.accessorKey === newFieldName;
    });

    if (exists) {
      setFieldError("A column with that name already exists.");
      return;
    }

    const columnDef: AccessorKeyColumnDef<RecordRow, any> = {
      accessorKey: newFieldName,
      header: () => (
        <ColumnHeader
          name={newFieldName}
          onDelete={() => handleDeleteColumnStatic(newFieldName)}
        />
      ),
      cell: ({ row, column }) => {
        const value = row.original[newFieldName];
        const isSelected =
          selectedCell?.rowIndex === row.index &&
          selectedCell?.columnId === column.id;

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
              type={newFieldType === "number" ? "number" : "text"}
              className="h-full w-full border-none bg-transparent outline-none"
              value={value === 0 && newFieldType === "number" ? "" : value}
              onChange={(e) => {
                const newValue =
                  newFieldType === "number"
                    ? e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                    : e.target.value;
                setData((prev) => {
                  const updated = [...prev];
                  updated[row.index] = {
                    ...updated[row.index],
                    [newFieldName]: newValue,
                  };
                  return updated;
                });
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      },
      meta: { type: newFieldType } as ColumnMeta,
    };

    setColumns((prev) => [...prev, columnDef]);
    setData((prevData) =>
      prevData.map((row) => ({
        ...row,
        [newFieldName]: newFieldType === "number" ? "" : "",
      })),
    );

    setNewFieldName("");
    setNewFieldType("text");
    setFieldError("");
    setIsFieldModalOpen(false);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-6 border-b bg-gray-700 px-4 py-2 text-sm text-white shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">
            {isLoading ? "Loading..." : (base?.name ?? "Untitled Base")}
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
        </div>
      </div>

      <div
        className="flex-1 overflow-auto bg-white"
        onClick={() => setSelectedCell(null)}
      >
        <table className="min-w-full table-auto border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-r border-gray-200 px-4 py-2 font-semibold text-gray-600"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
                <th className="relative border-r border-gray-200 px-4 py-2">
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
                    <div className="absolute right-0 z-10 mt-2 w-64 rounded border bg-white p-4 shadow-md">
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
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="relative border-r border-gray-200 px-4 py-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 border-t bg-white px-4 py-2 text-sm">
        <button
          className="text-blue-600 hover:underline"
          onClick={() =>
            setData((prev) => [...prev, generateFakeRecord(columns)])
          }
        >
          + Add record
        </button>
        <button
          onClick={() =>
            setData((prev) => [
              ...prev,
              ...Array.from({ length: 10000 }, () =>
                generateFakeRecord(columns),
              ),
            ])
          }
          className="text-blue-600 hover:underline"
        >
          Add 10000 rows
        </button>
      </div>
    </div>
  );
}
