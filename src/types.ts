export type UserRole = 'Super Admin' | 'Store Operator' | 'Viewer';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  warehouseId?: string; // Assigned warehouse if Manager or Operator
  phone?: string; // Contact phone number for notifications
}

export interface Warehouse {
  id?: string; // firestore doc id
  code: string; // unique, e.g., WH-001
  name: string;
  address: string;
  city: string;
  state: string;
  contactPerson: string;
  phone: string;
  status: 'Active' | 'Inactive';
  isPrimary?: boolean;
}

export interface Product {
  id?: string;
  itemCode: string; // e.g., PROD-001
  barcode: string; // e.g., 890123456789
  qrCode: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string; // e.g., Box, Pcs, Kg
  hsnCode: string;
  gst: number; // percentage, e.g., 18
  purchaseRate: number;
  sellingRate: number;
  minStock: number;
  maxStock: number;
  weight: number; // in kg
  image?: string;
  barcodeStatus?: 'Active' | 'Inactive';
  qrCodeStatus?: 'Active' | 'Inactive';
}

export interface Supplier {
  id?: string;
  name: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export interface Customer {
  id?: string;
  name: string;
  gstNumber: string;
  address: string;
  phone: string;
  email: string;
}

export interface Stock {
  id?: string; // warehouseId_itemCode
  itemCode: string;
  barcode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  availableQty: number;
  reservedQty: number; // stock requested for transfer
  inTransitQty: number; // stock dispatched and in-transit
  damagedQty: number;
  totalQty: number; // available + reserved + inTransit + damaged
}

export interface StockMovement {
  id?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  fromWarehouseId?: string; // for transfers
  fromWarehouseName?: string;
  toWarehouseId?: string; // for transfers
  toWarehouseName?: string;
  qty: number; // negative for outward, positive for inward
  user: string;
  transactionType: 'Inward (GRN)' | 'Outward (Dispatch)' | 'Transfer Out' | 'Transfer In' | 'Transfer Shortage' | 'Adjustment (Add)' | 'Adjustment (Sub)' | 'Adjustment (Damage)' | 'Adjustment (Reversal)';
  referenceNumber: string; // GRN, Dispatch, or Transfer Number
  remarks: string;
  isReverted?: boolean;
  revertedAt?: string;
  revertedBy?: string;
  reversalReason?: string;
  adjustmentType?: string;
}

export interface TransferItem {
  itemCode: string;
  itemName: string;
  qty: number; // dispatched quantity
  receivedQty?: number; // actual quantity received by warehouse
  shortQty?: number; // quantity short received (qty - receivedQty)
  shortReason?: string; // shortage note / reason
  rate?: number;
  taxableValue?: number;
  gstPercent?: number;
  gstAmount?: number;
  totalValue?: number;
}

export interface Transfer {
  id?: string;
  transferNumber: string; // unique, e.g., TRF-1001
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destWarehouseId: string;
  destWarehouseName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  items?: TransferItem[]; // supporting multi-item transfers
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Dispatched' | 'In Transit' | 'Received' | 'Closed';
  createdBy: string;
  createdAt: string; // ISO date or date string
  approvedBy?: string;
  approvedAt?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  hasShortage?: boolean;
  totalShortQty?: number;
  receivingRemarks?: string;
  updatedAt?: string;
  updatedBy?: string;
  remarks: string;
  invoiceNumber?: string; // e.g. INV-2026-001
  invoiceDate?: string;
  taxableValue?: number;
  gstAmount?: number;
  invoiceTotal?: number;
}

export interface Inward {
  id?: string;
  grnNumber: string; // unique, e.g., GRN-1001
  date: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  warehouseId: string;
  warehouseName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  batchNumber: string;
  expiryDate?: string;
  rate: number;
  gst: number;
  remarks: string;
  invoiceUrl?: string; // simulated
}

export interface Outward {
  id?: string;
  dispatchNumber: string; // unique, e.g., DSP-1001
  date: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  itemCode: string;
  itemName: string;
  qty: number;
  vehicleNumber: string;
  driverName: string;
  transportName: string;
  remarks: string;
  invoiceNumber?: string; // Associated invoice number for client dispatch
}

export interface Adjustment {
  id?: string;
  date: string;
  time: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  type: 'Increase' | 'Decrease' | 'Damage' | 'Shortage' | 'Excess';
  qty: number;
  reason: string;
  user: string;
  remarks: string;
}

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: 'low_stock' | 'out_of_stock' | 'pending_transfer' | 'approval_required' | 'received' | 'adjustment' | 'transaction';
  status: 'unread' | 'read';
  createdAt: string;
  phone?: string;          // Respective contact phone number
  contactPerson?: string;  // Respective contact person name
  roleName?: string;       // e.g. "Supplier", "Customer", "Operator", "Warehouse Manager"
}

export interface AuditLog {
  id?: string;
  date: string;
  time: string;
  user: string;
  action: string;
  module: string;
  details: string;
}

export interface OfflineTransaction {
  id: string;
  type: 'ADD_INWARD' | 'ADD_OUTWARD' | 'ADD_TRANSFER' | 'UPDATE_TRANSFER_STATUS' | 'POST_ADJUSTMENT' | 'REVERT_ADJUSTMENT' | 'ADD_PRODUCT' | 'ADD_WAREHOUSE' | 'ADD_CUSTOMER' | 'ADD_SUPPLIER';
  payload: any;
  timestamp: number;
}

export const isDerabassi = (warehouseName?: string, warehouseId?: string): boolean => {
  const name = (warehouseName || '').toLowerCase();
  const id = (warehouseId || '').toLowerCase();
  return name.includes('derabassi') || id.includes('derabassi') || name.includes('dera bassi') || id === 'wh-der' || id === 'derabassi';
};

export const isPrimaryWarehouse = (warehouseId?: string, warehouseName?: string, warehouses?: Warehouse[]): boolean => {
  if (warehouses && warehouses.length > 0) {
    const wh = warehouses.find(w => w.code === warehouseId || w.id === warehouseId || w.name === warehouseName);
    if (wh) return !!wh.isPrimary;
  }
  const name = (warehouseName || '').toLowerCase();
  const id = (warehouseId || '').toLowerCase();
  return id === 'wh-mum' || name.includes('mumbai') || name.includes('primary') || name.includes('central');
};

export const getLiveAvailableQty = (stock: Stock, warehouses?: Warehouse[]): number => {
  const isPrimary = isPrimaryWarehouse(stock.warehouseId, stock.warehouseName, warehouses);
  if (isPrimary) {
    return (stock.availableQty || 0) + (stock.inTransitQty || 0);
  }
  return stock.availableQty || 0;
};

