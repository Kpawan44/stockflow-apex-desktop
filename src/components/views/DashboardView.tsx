import React from 'react';
import { Warehouse, Package, Layers, IndianRupee, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, AlertTriangle, AlertOctagon, TrendingUp, RefreshCw, BarChart2, Truck, CheckCircle, Trash2 } from 'lucide-react';
import { Warehouse as WHType, Product, Stock, Transfer, StockMovement, isDerabassi, isPrimaryWarehouse, getLiveAvailableQty } from '../../types';

interface DashboardViewProps {
  warehouses: WHType[];
  products: Product[];
  stocks: Stock[];
  transfers: Transfer[];
  onNavigateToView: (view: string) => void;
  currentUserRole?: string;
  currentWarehouseId?: string;
  onDeleteProduct?: (id: string) => Promise<void>;
  onDeleteMovement?: (id: string) => Promise<void>;
  onReconcileStock?: () => Promise<{ deletedMovementsCount: number; correctedStocksCount: number }>;
  movements?: StockMovement[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  warehouses,
  products,
  stocks,
  transfers,
  onNavigateToView,
  currentUserRole,
  currentWarehouseId,
  onDeleteProduct,
  onDeleteMovement,
  onReconcileStock,
  movements,
}) => {
  // Delete action handler for items on Urgent Reorder Status list
  const handleDeleteItem = async (itemCode: string) => {
    const targetProd = products.find(p => p.itemCode === itemCode);
    const label = targetProd?.name || itemCode;
    
    if (window.confirm(`Are you sure you want to completely delete item "${label}" (SKU: ${itemCode}) from the system?\n\nThis will permanently delete all of its historical ledger/movement logs, and if it exists, its entry in the active Product Catalog.`)) {
      try {
        if (onDeleteMovement && movements) {
          // Find and delete all movements for this item code
          const movementsToDelete = movements.filter(m => m.itemCode === itemCode);
          for (const m of movementsToDelete) {
            await onDeleteMovement(m.id);
          }
        }

        // If exists in product catalog, delete it
        if (onDeleteProduct && targetProd && targetProd.id) {
          await onDeleteProduct(targetProd.id);
        }

        // Run stock reconciliation
        if (onReconcileStock) {
          await onReconcileStock();
        }

        alert(`Successfully deleted SKU "${itemCode}" entirely.`);
      } catch (err: any) {
        alert(`Failed to delete SKU: ${err.message || err}`);
      }
    }
  };

  // Calculations
  const totalWarehouses = warehouses.length;
  const totalProducts = products.length;
  
  const totalStockQuantity = stocks.reduce((sum, s) => sum + s.availableQty, 0);
  
  // Inventory Value calculation: sum of (availableQty * purchaseRate) per product
  const totalInventoryValue = stocks.reduce((sum, s) => {
    const prod = products.find(p => p.itemCode === s.itemCode);
    const rate = prod ? prod.purchaseRate : 0;
    return sum + (s.availableQty * rate);
  }, 0);

  // Today's Date representation (matching simulated local time)
  const todayStr = "2026-07-07";

  // Today's Inward / Outward (simulated aggregates based on current movements)
  const todaysInward = 125; // mock or calculated
  const todaysOutward = 60; // mock or calculated

  // Pending Transfers count
  const pendingTransfers = transfers.filter(t => t.status === 'Pending Approval' || t.status === 'Approved' || t.status === 'In Transit').length;

  // Low Stock & Out of Stock Items calculation based on active warehouse context or global live stock
  const { lowStockItems, outOfStockItems } = React.useMemo(() => {
    const low: Stock[] = [];
    const out: Stock[] = [];

    if (currentWarehouseId) {
      // Warehouse-specific context
      const whStocks = stocks.filter(s => s.warehouseId === currentWarehouseId);
      whStocks.forEach(s => {
        if (isDerabassi(s.warehouseName, s.warehouseId)) return;
        const prod = products.find(p => p.itemCode === s.itemCode);
        const liveAvailable = getLiveAvailableQty(s, warehouses);
        if (liveAvailable === 0) {
          out.push(s);
        } else if (prod && liveAvailable <= prod.minStock) {
          low.push(s);
        }
      });
    } else {
      // Global context: evaluate if item is out of stock / low stock across all non-Derabassi locations
      products.forEach(p => {
        const prodStocks = stocks.filter(s => s.itemCode === p.itemCode && !isDerabassi(s.warehouseName, s.warehouseId));
        if (prodStocks.length === 0) return;

        const totalLiveAvailable = prodStocks.reduce((sum, s) => sum + getLiveAvailableQty(s, warehouses), 0);
        if (totalLiveAvailable === 0) {
          // Completely out of stock everywhere
          const representativeStock = prodStocks[0];
          if (representativeStock) {
            out.push({ ...representativeStock, warehouseName: 'All Warehouses (Global)' });
          }
        } else if (totalLiveAvailable <= p.minStock) {
          // Low safety stock globally
          const representativeStock = prodStocks[0];
          if (representativeStock) {
            low.push({ ...representativeStock, availableQty: totalLiveAvailable, warehouseName: 'Global Stock' });
          }
        }
      });
    }

    return { lowStockItems: low, outOfStockItems: out };
  }, [currentWarehouseId, stocks, products, warehouses]);

  // Recently Transferred Items
  const recentTransfers = transfers.slice(-3).reverse();

  // Graph Data 1: Warehouse-wise stock levels
  const warehouseStockData = warehouses.map(wh => {
    const whStocks = stocks.filter(s => s.warehouseId === wh.code);
    const qty = whStocks.reduce((sum, s) => sum + getLiveAvailableQty(s, warehouses), 0);
    const isDera = isDerabassi(wh.name, wh.code);
    return { name: wh.name.replace(' Warehouse', '').replace(' Depot', '').replace(' Hub', ''), quantity: qty, isInfinite: isDera, code: wh.code };
  });

  // Graph Data 2: Monthly Inward vs Outward (mock data for charting)
  const monthlyInwardOutwardData = [
    { month: 'Jan', Inward: 1200, Outward: 950 },
    { month: 'Feb', Inward: 1400, Outward: 1100 },
    { month: 'Mar', Inward: 1100, Outward: 1200 },
    { month: 'Apr', Inward: 1500, Outward: 1300 },
    { month: 'May', Inward: 1800, Outward: 1400 },
    { month: 'Jun', Inward: 2200, Outward: 1700 },
    { month: 'Jul (YTD)', Inward: 850, Outward: 620 },
  ];

  // Graph Data 3: Top Moving Items (Calculated from stock totals)
  const topMovingData = products.map(p => {
    const totalAssigned = stocks.filter(s => s.itemCode === p.itemCode).reduce((sum, s) => sum + s.totalQty, 0);
    return { name: p.name, stock: totalAssigned };
  }).sort((a, b) => b.stock - a.stock).slice(0, 4);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div id="dashboard-view" className="space-y-6 animate-fade-in">
      {/* Alert Header if any Low/Out of Stock exists */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg text-red-700">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-red-900">Critical Stock Alerts</h4>
              <p className="text-[10px] text-red-700 leading-normal">
                There are currently <strong className="font-semibold">{outOfStockItems.length} items completely out of stock</strong> and <strong className="font-semibold">{lowStockItems.length} items below minimum safety levels</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToView('stocks')}
            className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Review Stocks
          </button>
        </div>
      )}

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Warehouses */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 hover:shadow transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Warehouses</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-850">{totalWarehouses}</h3>
            <p className="text-[9px] text-slate-500 mt-1">Active fulfillment hubs</p>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 hover:shadow transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKU Catalog</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-850">{totalProducts}</h3>
            <p className="text-[9px] text-slate-500 mt-1">Unique products managed</p>
          </div>
        </div>

        {/* Total Stock Qty */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 hover:shadow transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Units</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-850">{totalStockQuantity.toLocaleString()}</h3>
            <p className="text-[9px] text-slate-500 mt-1">Pcs/Boxes on hand</p>
          </div>
        </div>

        {/* Total Valuation */}
        <div className="bg-white rounded border border-slate-200 shadow-sm p-4 hover:shadow transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inventory Value</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-slate-850">₹{totalInventoryValue.toLocaleString()}</h3>
            <p className="text-[9px] text-slate-500 mt-1">Asset cost valuation</p>
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Approval Transfers */}
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded">
            <ArrowLeftRight className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Approval</span>
            <h4 className="text-sm font-bold text-slate-800">{transfers.filter(t => t.status === 'Pending Approval').length} active</h4>
            <span className="text-[9px] text-amber-600 font-semibold flex items-center gap-0.5 mt-0.5">
              Awaiting manager consent
            </span>
          </div>
        </div>

        {/* In-Transit / Approved Transfers */}
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded">
            <Truck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In-Transit Shipments</span>
            <h4 className="text-sm font-bold text-slate-800">
              {transfers.filter(t => t.status === 'In Transit' || t.status === 'Approved').length} on route
            </h4>
            <span className="text-[9px] text-indigo-600 font-semibold flex items-center gap-0.5 mt-0.5">
              Dispatched from Primary Hub
            </span>
          </div>
        </div>

        {/* Completed Transfers */}
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed & Received</span>
            <h4 className="text-sm font-bold text-slate-800">{transfers.filter(t => t.status === 'Closed').length} orders</h4>
            <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
              Stock safely delivered
            </span>
          </div>
        </div>
      </div>

      {/* Lower Row Grid (Non-Graphical summaries) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warehouse-wise Stock Volume (Text list) */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm h-[320px] flex flex-col">
          <h3 className="text-xs font-bold text-slate-850 mb-1 font-display flex items-center gap-1.5">
            <Warehouse className="w-4 h-4 text-indigo-500" />
            Warehouse Storage Levels
          </h3>
          <p className="text-[10px] text-gray-500 mb-3">Live storage volume across warehouses</p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {warehouseStockData.map((wh) => (
              <div key={wh.name} className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">{wh.name}</span>
                <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                  {wh.isInfinite ? '∞ (Infinite)' : `${wh.quantity.toLocaleString()} Pcs`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low / Critical Stock Items list */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm h-[320px] flex flex-col">
          <h3 className="text-xs font-bold text-slate-850 mb-1 font-display flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Urgent Reorder Status
          </h3>
          <p className="text-[10px] text-gray-500 mb-3">Items running below safety stock levels</p>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs font-medium">All item storage pools healthy!</div>
            ) : (
              <>
                {outOfStockItems.map((st, idx) => {
                  const prod = products.find(p => p.itemCode === st.itemCode);
                  const wh = warehouses.find(w => w.code === st.warehouseId);
                  return (
                    <div key={`out-${idx}`} className="flex items-center justify-between p-2.5 rounded bg-rose-50/50 border border-rose-100 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-extrabold text-rose-900 block truncate">
                          {prod?.name || st.itemCode}
                          {!prod && <span className="text-[9px] text-rose-500 font-bold ml-1">(Deleted Catalog Entry)</span>}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono block truncate">{wh?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded text-[10px] uppercase">
                          Out of Stock
                        </span>
                        {currentUserRole === 'Super Admin' && (
                          <button
                            onClick={() => handleDeleteItem(st.itemCode)}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                            title="Permanently Delete Item and all transactions"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {lowStockItems.map((st, idx) => {
                  const prod = products.find(p => p.itemCode === st.itemCode);
                  const wh = warehouses.find(w => w.code === st.warehouseId);
                  return (
                    <div key={`low-${idx}`} className="flex items-center justify-between p-2.5 rounded bg-amber-50/50 border border-amber-150 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-extrabold text-amber-950 block truncate">
                          {prod?.name || st.itemCode}
                          {!prod && <span className="text-[9px] text-rose-500 font-bold ml-1">(Deleted Catalog Entry)</span>}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono block truncate">{wh?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded text-[10px]">
                          {st.availableQty} left
                        </span>
                        {currentUserRole === 'Super Admin' && (
                          <button
                            onClick={() => handleDeleteItem(st.itemCode)}
                            className="p-1 hover:bg-amber-100 text-amber-700 rounded transition-colors cursor-pointer"
                            title="Permanently Delete Item and all transactions"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Recently Transferred Items */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-850 font-display flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
              Recent Stock Transfers
            </h3>
            <button
              onClick={() => onNavigateToView('transfers')}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              View All
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mb-3">Last tracked inter-depot movements</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {recentTransfers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs">No transfers found.</div>
            ) : (
              recentTransfers.map((tr) => (
                <div key={tr.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-gray-800">{tr.transferNumber}</span>
                    <span className={`text-[8px] px-1 rounded-full font-extrabold ${
                      tr.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' :
                      tr.status === 'In Transit' ? 'bg-sky-100 text-sky-800' :
                      tr.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {tr.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {tr.sourceWarehouseName.split(' (')[0]} → {tr.destWarehouseName.split(' (')[0]}
                  </div>
                  <div className="font-bold text-indigo-950 mt-0.5 truncate">
                    {tr.itemName} ({tr.qty} Pcs)
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
