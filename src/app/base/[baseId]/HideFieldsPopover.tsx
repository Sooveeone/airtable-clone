import { useState } from "react";
import type { Column } from "@/app/_types/base";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

interface HideFieldsPopoverProps {
  columns: Column[];
  hiddenColumns: Set<string>;
  onToggleColumn: (columnName: string) => void;
  onClose: () => void;
}

export function HideFieldsPopover({
  columns,
  hiddenColumns,
  onToggleColumn,
  onClose,
}: HideFieldsPopoverProps) {
  const hiddenCount = hiddenColumns.size;

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Hide fields</h3>
          {hiddenCount > 0 && (
            <p className="text-xs text-gray-500">
              {hiddenCount === 1
                ? "1 Hidden field"
                : `${hiddenCount} Hidden fields`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-50"
          >
            <span className="text-sm text-gray-700">{column.name}</span>
            <Switch
              checked={!hiddenColumns.has(column.name)}
              onCheckedChange={() => onToggleColumn(column.name)}
            />
          </div>
        ))}
      </div>
    </div>
  );
} 