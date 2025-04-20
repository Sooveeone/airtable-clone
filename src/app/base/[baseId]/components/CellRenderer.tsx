import { useState, useEffect, useRef } from "react";
import { type RecordRow, type UpdateCellInput } from "../types";

interface CellRendererProps {
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
  updateCellMutation: { mutate: (input: UpdateCellInput) => void };
  searchQuery?: string;
  editedCellsRef: React.MutableRefObject<
    Map<string, { value: string | number | null }>
  >;
  activeFilter?: {
    columnName: string;
    operator: string;
    value?: string | number | null;
  };
  activeSort?: {
    columnName: string;
    direction: "asc" | "desc";
  };
}

export function CellRenderer({
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
  searchQuery,
  editedCellsRef,
  activeFilter,
  activeSort,
}: CellRendererProps) {
  const value = row.original[keyName];
  const isSelected =
    selectedCell?.rowIndex === row.index &&
    selectedCell?.columnId === column.id;
  const [localValue, setLocalValue] = useState<string | number | null>(
    value === 0 && fieldType === "number" ? 0 : value ?? ""
  );
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if this cell matches the filter criteria
  const matchesFilter =
    activeFilter &&
    keyName === activeFilter.columnName &&
    (() => {
      if (!activeFilter) return false;
      const cellValue = value;

      switch (activeFilter.operator) {
        case "isEmpty":
          return cellValue === null || cellValue === "";
        case "isNotEmpty":
          return cellValue !== null && cellValue !== "";
        case "contains":
          return (
            typeof cellValue === "string" &&
            cellValue
              .toLowerCase()
              .includes((activeFilter.value as string).toLowerCase())
          );
        case "notContains":
          return (
            typeof cellValue === "string" &&
            !cellValue
              .toLowerCase()
              .includes((activeFilter.value as string).toLowerCase())
          );
        case "equals":
          return cellValue === activeFilter.value;
        case "greaterThan":
          return (
            typeof cellValue === "number" &&
            cellValue > (activeFilter.value as number)
          );
        case "lessThan":
          return (
            typeof cellValue === "number" &&
            cellValue < (activeFilter.value as number)
          );
        default:
          return false;
      }
    })();

  useEffect(() => {
    setLocalValue(value === 0 && fieldType === "number" ? 0 : value ?? "");
  }, [value, fieldType]);

  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  const saveCell = () => {
    if (!isEditing) return;
    const newValue =
      fieldType === "number"
        ? localValue === ""
          ? null
          : Number(localValue)
        : localValue;
    if (newValue !== value) {
      // Store the edited value in our ref
      if (row.original.id) {
        editedCellsRef.current.set(`${row.original.id}|${keyName}`, {
          value: newValue,
        });
      }

      setData((prev) =>
        prev.map((item) =>
          item.id === row.original.id ? { ...item, [keyName]: newValue } : item
        )
      );
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
    // Explicitly blur the input to remove the caret
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCell();
      setSelectedCell(null);
      // Ensure the input is blurred
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLocalValue(value === 0 && fieldType === "number" ? 0 : value ?? "");
      setIsEditing(false);
      setSelectedCell(null);
      // Ensure the input is blurred
      inputRef.current?.blur();
    } else if (!isEditing) {
      setIsEditing(true);
    }
  };

  const matchesQuery =
    searchQuery &&
    ((typeof value === "string" &&
      value.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (typeof value === "number" && value.toString().includes(searchQuery)));

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
        className={`h-full w-full border-none px-2 outline-none ${
          matchesQuery
            ? "bg-yellow-100"
            : matchesFilter
            ? "bg-green-100"
            : activeSort?.columnName === keyName
            ? "bg-[#fff2ea]"
            : "bg-transparent"
        }`}
        style={{ 
          caretColor: isEditing ? 'auto' : 'transparent',
          WebkitAppearance: 'none'
        }}
        value={
          isEditing
            ? localValue === 0
              ? "0"
              : localValue ?? ""
            : value === 0
            ? "0"
            : value ?? ""
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
          // Additional safeguard: remove selection to prevent any visible caret
          window.getSelection()?.removeAllRanges();
        }}
        onKeyDown={handleKeyDown}
        readOnly={!isEditing}
      />
    </div>
  );
} 