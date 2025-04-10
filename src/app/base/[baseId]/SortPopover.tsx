import { useState } from "react";
import type { Column } from "@/app/_types/base";
import { X } from "lucide-react";

interface SortPopoverProps {
  columns: Column[];
  onApplySort: (sort: {
    columnName: string;
    direction: "asc" | "desc";
  }) => void;
  onClose: () => void;
  activeSort?: {
    columnName: string;
    direction: "asc" | "desc";
  };
  onClearSort: () => void;
}

export function SortPopover({ columns, onApplySort, onClose, activeSort, onClearSort }: SortPopoverProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>(activeSort?.columnName ?? "");
  const [selectedDirection, setSelectedDirection] = useState<"asc" | "desc">(activeSort?.direction ?? "asc");

  // Get the type of the selected column
  const selectedColumnType = columns.find(col => col.name === selectedColumn)?.type ?? "text";

  const handleApply = () => {
    if (!selectedColumn) return;

    onApplySort({
      columnName: selectedColumn,
      direction: selectedDirection,
    });
  };

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Sort records by
          </h3>
          {activeSort && (
            <button
              onClick={onClearSort}
              className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 hover:bg-blue-200"
            >
              Clear sort
              <X size={14} />
            </button>
          )}
        </div>
        <div className="space-y-3">
          {/* Column Select */}
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select a field</option>
            {columns.map((column) => (
              <option key={column.id} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>

          {/* Direction Select */}
          {selectedColumn && (
            <select
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value as "asc" | "desc")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="asc">
                {selectedColumnType === "number" ? "Smallest to largest" : "A → Z"}
              </option>
              <option value="desc">
                {selectedColumnType === "number" ? "Largest to smallest" : "Z → A"}
              </option>
            </select>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-2">
        <div
          onClick={onClose}
          className="cursor-pointer rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </div>
        <div
          onClick={handleApply}
          className={`cursor-pointer rounded-md px-4 py-2 text-sm text-white ${
            !selectedColumn
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          Apply
        </div>
      </div>
    </div>
  );
} 