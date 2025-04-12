export interface Base {
  id: string;
  name: string;
  userId: string;
}

export interface Table {
  id: string;
  name: string;
  baseId: string;
}

export interface Column {
  id: string;
  name: string;
  type: string;
  tableId: string;
}

export interface Row {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
}

export interface View {
  id: string;
  name: string;
  type: string;
  tableId: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filterColumn?: string;
  filterOperator?: string;
  filterValue?: unknown;
  hiddenColumns: string[];
  createdAt: Date;
  updatedAt: Date;
}
