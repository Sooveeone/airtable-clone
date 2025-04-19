import { X } from "lucide-react";

interface TableFooterProps {
  createRowHandler: () => void;
  handleAddFakeRecords: (count: number) => void;
  isSaving: boolean;
  isAddingBulkRows: boolean;
  bulkRowProgress: {
    current: number;
    total: number;
  };
  cancelBulkRowAddition: () => void;
  totalCount?: number;
}

export function TableFooter({
  createRowHandler,
  handleAddFakeRecords,
  isSaving,
  isAddingBulkRows,
  bulkRowProgress,
  cancelBulkRowAddition,
  totalCount = 0,
}: TableFooterProps) {
  return (
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
        {totalCount?.toLocaleString() ?? 0} record{totalCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
} 