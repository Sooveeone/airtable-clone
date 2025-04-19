import { useState } from "react";
import { ChevronDown, Hash, TextIcon as LetterText } from "lucide-react";

interface ColumnHeaderProps {
  name: string;
  onDelete: () => void;
  type?: "text" | "number";
}

export function ColumnHeader({
  name,
  onDelete,
  type = "text",
}: ColumnHeaderProps) {
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