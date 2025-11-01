export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  [key: string]: unknown;
}

export interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  price: number | string;
  minStock: number;
  totalStock: number;
}

export interface WorkOrder {
  id: string;
  code: string;
  status: string;
  description?: string;
  vehicle: Vehicle;
  customer: Customer;
}

export interface Customer {
  id: string;
  user: User;
}

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year?: number;
}

export interface DashboardSummary {
  salesToday: number;
  salesMonth: number;
  workOrders: { status: string; _count: { status: number } }[];
  topProducts: { product?: InventoryProduct; quantity: number }[];
}
