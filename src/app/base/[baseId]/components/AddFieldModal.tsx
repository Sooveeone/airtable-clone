import { useState } from "react";
import type { FormEvent } from "react";

interface AddFieldModalProps {
  onAddField: (name: string, type: "text" | "number") => void;
  isAdding: boolean;
  onClose: () => void;
  existingColumns?: string[];
}

export function AddFieldModal({ 
  onAddField, 
  isAdding, 
  onClose,
  existingColumns = []
}: AddFieldModalProps) {
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number">("text");
  const [error, setError] = useState("");

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    
    // Clear previous errors
    setError("");
    
    // Validate field name
    if (!fieldName.trim()) {
      setError("Field name is required.");
      return;
    }
    
    // Check for duplicate column names
    if (existingColumns.some(col => col.toLowerCase() === fieldName.trim().toLowerCase())) {
      setError("A column with this name already exists.");
      return;
    }
    
    // Submit if valid
    onAddField(fieldName.trim(), fieldType);
  };

  return (
    <div className="absolute z-10 mt-2 w-64 rounded border bg-white p-4 shadow-md">
      <div className="flex justify-between mb-2">
        <h3 className="text-sm font-medium">Add new field</h3>
        <button 
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-700 cursor-pointer"
          type="button"
        >
          &times;
        </button>
      </div>
      <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Field name"
        value={fieldName}
        onChange={(e) => setFieldName(e.target.value)}
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
          autoFocus
      />
      <select
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value as "text" | "number")}
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
      >
        <option value="text">Text</option>
        <option value="number">Number</option>
      </select>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <button
          type="submit"
          className="w-full rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 cursor-pointer"
        disabled={isAdding}
      >
        {isAdding ? "Adding..." : "Add Field"}
      </button>
      </form>
    </div>
  );
} 