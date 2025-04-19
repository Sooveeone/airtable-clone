import { faker } from "@faker-js/faker";
import { type AccessorKeyColumnDef } from "@tanstack/react-table";
import { type ColumnMeta, type RecordRow, type ColumnValue } from "./types";

export const defaultColumnsKeys = ["name", "notes", "assignee", "status"];

export const generateFakeRecord = (
  columns: AccessorKeyColumnDef<RecordRow, ColumnValue>[]
): RecordRow => {
  const record: RecordRow = {};
  for (const col of columns) {
    const key = col.accessorKey ?? "";
    if (key && key !== "rowNumber") {
      // Skip the rowNumber column
      // Get the column type from the meta property
      const meta = col.meta as ColumnMeta | undefined;
      const columnType = meta?.type ?? "text"; // Default to text if not specified

      record[key] =
        columnType === "number"
          ? faker.number.int({ min: 0, max: 100 })
          : faker.word.words(2);
    }
  }
  return record;
}; 