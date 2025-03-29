"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { faker } from "@faker-js/faker";
import { UserButton } from "@clerk/nextjs";

const defaultColumns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "notes", header: "Notes" },
  { accessorKey: "assignee", header: "Assignee" },
  { accessorKey: "status", header: "Status" },
];

const generateFakeRecord = () => ({
  name: faker.person.fullName(),
  notes: faker.lorem.sentence(),
  assignee: faker.person.firstName(),
  status: faker.helpers.arrayElement(["Todo", "In Progress", "Done"]),
});

export default function BasePage() {
  const { baseId } = useParams();
  const [data, setData] = useState<any[]>([]);
  const [columns] = useState(() => defaultColumns);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex h-screen flex-col">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-6 border-b bg-gray-700 px-4 py-2 text-sm text-white shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">Untitled Base</h1>
          <div className="flex gap-4">
            <button className="hover:underline">Data</button>
            <button className="hover:underline">Automations</button>
            <button className="hover:underline">Interfaces</button>
            <button className="hover:underline">Forms</button>
          </div>
        </div>
        <UserButton />
      </div>

      {/* Table selector and add table */}
      <div className="flex items-center gap-2 border-b bg-white px-4 py-2 text-sm shadow-sm">
        <select className="rounded border px-2 py-1 text-sm">
          <option>Table 1</option>
        </select>
        <button className="text-xl leading-none">+</button>
      </div>

      {/* Table controls */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Views
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Hide fields
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Filter
          </button>
          <button className="rounded border px-3 py-1 hover:bg-gray-100">
            Group
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

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="min-w-full table-auto text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2 font-semibold text-gray-600"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
                <th className="px-4 py-2">
                  <button className="rounded border px-2 py-1 text-sm hover:bg-gray-100">
                    + Add field
                  </button>
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-6 border-t bg-white px-4 py-2 text-sm">
        <button
          className="text-blue-600 hover:underline"
          onClick={() => setData((prev) => [...prev, generateFakeRecord()])}
        >
          + Add record
        </button>
        <button
          onClick={() =>
            setData((prev) => [
              ...prev,
              ...Array.from({ length: 15000 }, () => generateFakeRecord()),
            ])
          }
          className="text-blue-600 hover:underline"
        >
          Add 15000 rows
        </button>
      </div>
    </div>
  );
}
