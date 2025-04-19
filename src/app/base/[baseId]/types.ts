export interface ColumnMeta {
  type?: "text" | "number";
}

export type RecordRow = Record<string, string | number | null> & { id?: string; order?: number };
export type ColumnValue = string | number | null;

export interface TableColumn {
  name: string;
  type: string;
}

export type FilterType = {
  columnName: string;
  operator:
    | "isEmpty"
    | "isNotEmpty"
    | "contains"
    | "notContains"
    | "equals"
    | "greaterThan"
    | "lessThan";
  value?: string | number | null;
};

export type SortType = {
  columnName: string;
  direction: "asc" | "desc";
};

export type UpdateCellInput = {
  tableId: string;
  rowId: string;
  columnName: string;
  value: string | number | null;
}; 