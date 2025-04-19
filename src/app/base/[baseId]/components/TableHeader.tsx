import { useRef } from "react";
import { Plus, Loader2, ChevronDown } from "lucide-react";

interface TableHeaderProps {
  tables: Array<{ id: string; name: string }> | undefined;
  tableId: string | null;
  setTableId: (id: string) => void;
  isAddTableMenuOpen: boolean;
  setIsAddTableMenuOpen: (isOpen: boolean) => void;
  handleCreateNewTable: () => void;
  isCreatingTable: boolean;
  tableError: string | null;
}

export function TableHeader({
  tables,
  tableId,
  setTableId,
  isAddTableMenuOpen,
  setIsAddTableMenuOpen,
  handleCreateNewTable,
  isCreatingTable,
  tableError,
}: TableHeaderProps) {
  const addTableButtonRef = useRef<HTMLDivElement>(null);

  return (
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
  );
} 