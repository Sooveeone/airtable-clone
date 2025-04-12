import { useState, useEffect } from "react";
import type { Column } from "@/app/_types/base";
import { X } from "lucide-react";

type FilterOperator =
  | "isEmpty"
  | "isNotEmpty"
  | "contains"
  | "notContains"
  | "equals"
  | "greaterThan"
  | "lessThan";

interface FilterPopoverProps {
  columns: Column[];
  onApplyFilter: (filter: {
    columnName: string;
    operator: FilterOperator;
    value?: string | number | null;
  }) => void;
  onClose: () => void;
  activeFilter?: {
    columnName: string;
    operator: FilterOperator;
    value?: string | number | null;
  };
  onClearFilter: () => void;
}

export function FilterPopover({
  columns,
  onApplyFilter,
  onClose,
  activeFilter,
  onClearFilter,
}: FilterPopoverProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>(
    activeFilter?.columnName ?? ""
  );
  const [selectedOperator, setSelectedOperator] = useState<FilterOperator | "">(
    activeFilter?.operator ?? ""
  );
  const [filterValue, setFilterValue] = useState<string>(
    activeFilter?.value?.toString() ?? ""
  );

  // Get the type of the selected column
  const selectedColumnType =
    columns.find((col) => col.name === selectedColumn)?.type ?? "text";

  // Define operators based on column type
  const operators: { value: FilterOperator; label: string }[] =
    selectedColumnType === "number"
      ? [
          { value: "greaterThan", label: "greater than" },
          { value: "lessThan", label: "less than" },
        ]
      : [
          { value: "isEmpty", label: "is empty" },
          { value: "isNotEmpty", label: "is not empty" },
          { value: "contains", label: "contains" },
          { value: "notContains", label: "does not contain" },
          { value: "equals", label: "is equal to" },
        ];

  // Reset operator when column changes
  useEffect(() => {
    setSelectedOperator("");
    setFilterValue("");
  }, [selectedColumn]);

  const handleApply = () => {
    if (!selectedColumn || !selectedOperator) return;

    // Only include value for operators that need it
    const needsValue = !["isEmpty", "isNotEmpty"].includes(selectedOperator);
    if (needsValue && !filterValue) return;

    onApplyFilter({
      columnName: selectedColumn,
      operator: selectedOperator,
      value: needsValue
        ? selectedColumnType === "number"
          ? Number(filterValue)
          : filterValue
        : null,
    });
  };

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            In this view, show records where
          </h3>
          {activeFilter && (
            <button
              onClick={onClearFilter}
              className="flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-sm text-green-800 hover:bg-green-200"
            >
              Clear filter
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

          {/* Operator Select */}
          {selectedColumn && (
            <select
              value={selectedOperator}
              onChange={(e) =>
                setSelectedOperator(e.target.value as FilterOperator)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select an operator</option>
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          )}

          {/* Value Input */}
          {selectedOperator &&
            !["isEmpty", "isNotEmpty"].includes(selectedOperator) && (
              <input
                type={selectedColumnType === "number" ? "number" : "text"}
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Enter a value"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
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
            !selectedColumn ||
            !selectedOperator ||
            (!filterValue &&
              !["isEmpty", "isNotEmpty"].includes(selectedOperator))
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
