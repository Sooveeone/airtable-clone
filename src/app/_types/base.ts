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
  data: Record<string, any>;
}
