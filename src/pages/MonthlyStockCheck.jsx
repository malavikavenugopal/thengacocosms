import React, { useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, CheckCircle2, Calendar, ArrowRightLeft, Eye, Info, X, MapPin, Truck, AlertTriangle, RotateCcw, ShoppingCart } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportFormattedStockCheck } from '../utils/exportUtils';
import toast from 'react-hot-toast';

const MonthlyStockCheck = () => {
  const { 
    stock, 
    b2bShipments, 
    b2cShipments, 
    damageRecords, 
    returnRecords, 
    qcRecords,
    purchaseRecords,
    replacementRecords,
    monthlyStockData,
    saveMonthlyStock
  } = useGlobalState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCarryingForward, setIsCarryingForward] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getMovementsForMonth = (monthStr) => {
    const sums = {};
    stock.forEach(item => {
      if (!item.isComposite) sums[item.name] = { out: 0, returned: 0, damage: 0, purchased: 0, rejected: 0 };
    });

    const isTargetMonth = (dateStr) => dateStr && dateStr.startsWith(monthStr);

    // B2B
    b2bShipments.filter(s => isTargetMonth(s.date)).forEach(s => {
      s.products.forEach(p => { 
        if (sums[p.name]) {
          sums[p.name].out += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); 
        } else {
          // Check if p is a bundle and update components
          const bundle = stock.find(item => item.name === p.name);
          if (bundle?.isComposite && bundle.components) {
            bundle.components.forEach(comp => {
              if (sums[comp.name]) {
                const bundleQty = Number(p.quantity) || 0;
                const compQtyPerBundle = Number(comp.quantity) || 1;
                sums[comp.name].out += bundleQty * compQtyPerBundle;
              }
            });
          }
        }
      });
    });

    // B2C
    b2cShipments.filter(s => isTargetMonth(s.date)).forEach(s => {
      s.products.forEach(p => { 
        if (sums[p.name]) {
          sums[p.name].out += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); 
        } else {
          // Check if p is a bundle and update components
          const bundle = stock.find(item => item.name === p.name);
          if (bundle?.isComposite && bundle.components) {
            bundle.components.forEach(comp => {
              if (sums[comp.name]) {
                const bundleQty = Number(p.quantity) || 0;
                const compQtyPerBundle = Number(comp.quantity) || 1;
                sums[comp.name].out += bundleQty * compQtyPerBundle;
              }
            });
          }
        }
      });
    });

    // Manual Damage
    damageRecords.filter(r => isTargetMonth(r.date) && r.deducted !== false).forEach(r => {
      if (sums[r.productName]) sums[r.productName].damage += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    // QC Damage & Rejection
    qcRecords.filter(r => isTargetMonth(r.date) && r.deducted).forEach(r => {
      if (sums[r.productName]) {
        sums[r.productName].damage += (Number(r.damaged) || 0) * (Number(r.packSize) || 1);
        sums[r.productName].rejected += (Number(r.rejected) || 0) * (Number(r.packSize) || 1);
      }
    });

    // Returns
    returnRecords.filter(r => isTargetMonth(r.date) && r.isReusable && r.deducted !== false).forEach(r => {
      if (sums[r.productName]) sums[r.productName].returned += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    // Purchases
    purchaseRecords.filter(r => isTargetMonth(r.date)).forEach(r => {
      if (sums[r.productName]) sums[r.productName].purchased += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    // Replacements
    replacementRecords.filter(r => isTargetMonth(r.date) && r.deducted).forEach(r => {
      if (sums[r.productName]) sums[r.productName].out += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    return sums;
  };

  const monthlyMovements = useMemo(() => {
    return getMovementsForMonth(selectedMonth);
  }, [selectedMonth, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, stock]);

  const calculateExpected = (opening, production, returned, out, damage, rejected) => 
    Number(opening || 0) + Number(production || 0) + Number(returned || 0) - Number(out || 0) - Number(damage || 0) - Number(rejected || 0);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      // Logic for finalizing could go here (e.g. locking the month)
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate async
      toast.success(`Inventory state for ${selectedMonth} finalized!`);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCarryForward = async () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    // Calculate previous month
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevMonthData = monthlyStockData.filter(d => d.month === prevMonthStr);
    
    if (prevMonthData.length === 0) {
      toast.error(`No data found for previous month (${prevMonthStr}) to carry forward.`);
      return;
    }

    setIsCarryingForward(true);
    const toastId = toast.loading(`Calculating and carrying forward Expected balances from ${prevMonthStr}...`);
    let count = 0;

    // Get movements for the previous month
    const prevMovements = getMovementsForMonth(prevMonthStr);

    try {
      for (const item of prevMonthData) {
        const product = stock.find(s => s.id === item.productId);
        if (!product) continue;

        const movements = prevMovements[product.name] || { out: 0, returned: 0, damage: 0, purchased: 0 };
        
        // Calculate the Expected closing balance of last month
        const expectedLastMonth = calculateExpected(
          item.opening,
          (Number(item.in) || 0) + movements.purchased,
          movements.returned,
          movements.out,
          movements.damage,
          movements.rejected
        );

        // Save it as the Opening balance of the current selected month
        await saveMonthlyStock(selectedMonth, item.productId, { 
          opening: expectedLastMonth
        });
        count++;
      }
      toast.success(`Carried forward ${count} expected balances!`, { id: toastId });
    } catch (err) {
      toast.error('Failed to carry forward data', { id: toastId });
    } finally {
      setIsCarryingForward(false);
    }
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = stock
        .filter(item => !item.isComposite)
        .map(item => {
          const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
          const movements = monthlyMovements[item.name] || { out: 0, returned: 0, damage: 0, purchased: 0, rejected: 0 };
          
          const expected = calculateExpected(
            mData.opening, 
            (Number(mData.in) || 0) + movements.purchased, 
            movements.returned, 
            movements.out, 
            movements.damage,
            movements.rejected
          );
          const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : 0;
          
          return {
            SKU_Code: item.sku,
            SKU_Name: item.name,
            Month: selectedMonth,
            Opening: mData.opening || 0,
            Production: (Number(mData.in) || 0) + movements.purchased, 
            'Returned Items': movements.returned,
            Dispatch: movements.out,
            Damage: movements.damage,
            Rejected: movements.rejected,
            Expected: expected,
            Physical: physical,
            Difference: physical - expected
          };
        });
      
      exportFormattedStockCheck(dataToExport, selectedMonth, `Stock_Check_${selectedMonth}.xlsx`);
      toast.success('Exporting Stock Check...');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Stock Check</h2>
          <p className="text-sm text-slate-500 mt-1">Reconcile physical inventory for specific months</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="month" 
              className="text-sm font-semibold text-slate-700 outline-none bg-transparent"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search SKU..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full sm:w-48 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={handleCarryForward} variant="secondary" className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 shadow-sm flex-1 sm:flex-none" title="Carry forward last month's closing as this month's opening" loading={isCarryingForward}>
              <ArrowRightLeft size={18} /> Carry Forward
            </Button>
            <Button onClick={handleExport} variant="success" className="shadow-lg shadow-emerald-50 flex-1 sm:flex-none" loading={isExporting}>
              <DownloadCloud size={18} /> Export
            </Button>
            <Button onClick={handleFinalize} variant="primary" className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-lg shadow-emerald-100 flex-1 sm:flex-none" loading={isFinalizing}>
              <CheckCircle2 size={18} /> Finalize
            </Button>
          </div>
        </div>
      </div>

      <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200 shadow-sm sticky top-0 z-10">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold backdrop-blur-sm">
                <th className="py-4 px-4 min-w-[200px]">SKU Name</th>
                <th className="py-4 px-2 text-center">Opening</th>
                <th className="py-4 px-2 text-center text-indigo-600">Stock In</th>
                <th className="py-4 px-2 text-center text-emerald-600">Returns</th>
                <th className="py-4 px-2 text-center text-amber-600">Out</th>
                <th className="py-4 px-2 text-center text-red-600">Damage</th>
                <th className="py-4 px-2 text-center text-rose-400">Rejected</th>
                <th className="py-4 px-2 text-center bg-slate-100/50">Expected</th>
                <th className="py-4 px-2 text-center bg-indigo-50/50">Physical</th>
                <th className="py-4 px-4 text-center">Diff</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stock
                .filter(item => !item.isComposite)
                .filter(item => 
                  item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map((item) => {
                  const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
                  const movements = monthlyMovements[item.name] || { out: 0, returned: 0, damage: 0, rejected: 0 };
                  
                  const expected = calculateExpected(
                    mData.opening, 
                    (Number(mData.in) || 0) + (movements.purchased || 0), 
                    movements.returned, 
                    movements.out, 
                    movements.damage,
                    movements.rejected
                  );
                  
                  const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
                  const diff = physical !== null ? physical - expected : null;
                  
                  let rowBg = "hover:bg-slate-50/50";
                  if (diff !== null) {
                    if (diff < 0) rowBg = "bg-red-50/40 hover:bg-red-50/60";
                    else if (diff > 0) rowBg = "bg-amber-50/40 hover:bg-amber-50/60";
                    else rowBg = "bg-emerald-50/40 hover:bg-emerald-50/60";
                  }

                  const currentMonthNum = Number(selectedMonth.split('-')[1]);
                  const isROPFirstHalf = currentMonthNum <= 6;
                  const activeROP = isROPFirstHalf ? (item.ropJanJun || 0) : (item.ropJulDec || 0);
                  const isLowStock = expected < activeROP;

                  return (
                    <tr key={item.id} className={`transition-colors duration-200 ${rowBg} ${isLowStock ? 'ring-1 ring-inset ring-rose-200' : ''}`}>
                      <td className="py-4 px-4 text-sm border-r border-slate-100 leading-tight">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-tighter">{item.sku || '-'}</span>
                            {isLowStock && (
                              <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[8px] font-black rounded flex items-center gap-0.5 animate-pulse shadow-sm shadow-rose-200">
                                <AlertTriangle size={8} /> ROP ALERT
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          {isLowStock && (
                            <span className="text-[10px] text-rose-500 font-bold mt-0.5 italic">
                              Target: {activeROP} (Short: {activeROP - expected})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-1 text-center">
                        <input 
                          type="number" 
                          className="w-16 mx-auto block px-1 py-1 text-center text-sm border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all bg-white font-medium"
                          value={mData.opening || ''}
                          onChange={(e) => saveMonthlyStock(selectedMonth, item.id, { opening: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="0"
                        />
                      </td>
                      <td className="py-4 px-2 text-center text-indigo-600">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold">
                            {(Number(mData.in) || 0) + movements.purchased}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <input 
                              type="number" 
                              className="w-12 text-[10px] p-0.5 text-center border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all bg-white text-slate-500"
                              value={mData.in || ''}
                              onChange={(e) => saveMonthlyStock(selectedMonth, item.id, { in: e.target.value === '' ? '' : Number(e.target.value) })}
                              placeholder="Other"
                              title="Manual Adjustment (e.g. Production)"
                            />
                            {movements.purchased > 0 && (
                              <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1 rounded" title="Automatically added from Purchases">
                                P: {movements.purchased}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-sm text-center text-emerald-600 font-bold">
                        {movements.returned || 0}
                      </td>
                      <td className="py-4 px-2 text-sm text-center text-amber-600 font-medium">
                        {movements.out || 0}
                      </td>
                      <td className="py-4 px-2 text-sm text-center text-red-600 font-bold">
                        {movements.damage || 0}
                      </td>
                      <td className="py-4 px-2 text-sm text-center text-rose-400 font-medium">
                        {movements.rejected || 0}
                      </td>
                      <td className="py-4 px-2 text-sm text-center font-bold bg-slate-50/50 border-x border-slate-100">
                        {expected}
                      </td>
                      <td className="py-3 px-2 bg-indigo-50/5 border-r border-slate-100">
                        <input
                          type="number"
                          className="w-20 mx-auto block px-2 py-1.5 text-center text-sm border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all bg-white font-bold"
                          value={mData.physical || ''}
                          onChange={(e) => saveMonthlyStock(selectedMonth, item.id, { physical: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="--"
                        />
                      </td>
                      <td className="py-4 px-4 text-sm text-center">
                        {diff !== null ? (
                          <span className={`inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                            diff < 0 ? 'bg-red-100 text-red-800 shadow-sm shadow-red-100/50' : 
                            diff > 0 ? 'bg-amber-100 text-amber-800 shadow-sm shadow-amber-100/50' : 
                            'bg-emerald-100 text-emerald-800 shadow-sm shadow-emerald-100/50'
                          }`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs italic">Pending</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center border-l border-slate-100">
                        <button 
                          onClick={() => setSelectedProductDetails(item)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                          title="View detailed transactions for this month"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
      
      
      <div className="flex flex-wrap gap-6 text-xs font-medium text-gray-500 justify-center sm:justify-start px-2">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-red-500 shadow-sm transition-all"></div> Missing SKU</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-yellow-400 shadow-sm transition-all"></div> Excess Stock</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-green-500 shadow-sm transition-all"></div> Perfect Match</div>
        <div className="ml-auto text-[10px] text-slate-400 italic font-medium">* Formula: Expected = Opening + Stock In + Returns - Out - Damage - Rejected</div>
      </div>

      {/* Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Info size={20} className="text-indigo-400" />
                </div>
                <div>
                   <h3 className="text-lg font-bold">Monthly Transactions</h3>
                   <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{selectedProductDetails.name} • {selectedMonth}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProductDetails(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
              {/* Purchases Section */}
              <section>
                 <div className="flex items-center gap-2 mb-4 text-indigo-600">
                    <ShoppingCart size={18} className="shrink-0" />
                    <h4 className="font-bold text-sm">Stock In (Purchases & Arrivals)</h4>
                 </div>
                 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-slate-500 font-bold uppercase tracking-tighter">
                             <th className="py-2.5 px-4">Date</th>
                             <th className="py-2.5 px-4">Vendor</th>
                             <th className="py-2.5 px-4">Place</th>
                             <th className="py-2.5 px-4 text-right">Qty</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {purchaseRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name).length === 0 ? (
                            <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic">No purchase records for this month.</td></tr>
                          ) : (
                            purchaseRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name).map(r => (
                              <tr key={r.id}>
                                <td className="py-3 px-4 font-medium">{r.date}</td>
                                <td className="py-3 px-4 text-slate-900 font-bold">{r.vendorName}</td>
                                <td className="py-3 px-4 text-slate-500 flex items-center gap-1"><MapPin size={12}/>{r.place}</td>
                                <td className="py-3 px-4 text-right font-black text-indigo-600">+{r.quantity}</td>
                              </tr>
                            ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>

              {/* Returns Section */}
              <section>
                 <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <RotateCcw size={18} className="shrink-0" />
                    <h4 className="font-bold text-sm">Returns (Reusable Stock)</h4>
                 </div>
                 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-slate-500 font-bold uppercase tracking-tighter">
                             <th className="py-2.5 px-4">Date</th>
                             <th className="py-2.5 px-4">Channel</th>
                             <th className="py-2.5 px-4">Reason</th>
                             <th className="py-2.5 px-4 text-right">Qty</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {returnRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.isReusable && r.deducted !== false).length === 0 ? (
                            <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic">No returns for this month.</td></tr>
                          ) : (
                            returnRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.isReusable && r.deducted !== false).map(r => (
                              <tr key={r.id}>
                                <td className="py-3 px-4">{r.date}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{r.channel}</td>
                                <td className="py-3 px-4 text-slate-500 italic">"{r.reason}"</td>
                                <td className="py-3 px-4 text-right font-black text-emerald-600">+{r.quantity}</td>
                              </tr>
                            ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>

              {/* Combined Damages Section */}
              <section>
                 <div className="flex items-center gap-2 mb-4 text-rose-600">
                    <AlertTriangle size={18} className="shrink-0" />
                    <h4 className="font-bold text-sm">Damage Deductions (QC & Manual)</h4>
                 </div>
                 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                       <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-slate-500 font-bold uppercase tracking-tighter">
                             <th className="py-2.5 px-4">Date</th>
                             <th className="py-2.5 px-4">Type</th>
                             <th className="py-2.5 px-4">Note / Reason</th>
                             <th className="py-2.5 px-4 text-right">Qty</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {[
                            ...damageRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.deducted !== false).map(r => ({...r, type: 'Manual'})),
                            ...qcRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.deducted).map(r => ({...r, type: 'QC Check', quantity: r.damaged, reason: 'Found in QC'}))
                          ].length === 0 ? (
                            <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic">No damages for this month.</td></tr>
                          ) : (
                            [
                              ...damageRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.deducted !== false).map(r => ({...r, type: 'Manual'})),
                              ...qcRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name && r.deducted).map(r => ({...r, type: 'QC Check', quantity: r.damaged, reason: 'Found in QC'}))
                            ].sort((a,b) => b.date.localeCompare(a.date)).map((r, idx) => (
                              <tr key={idx}>
                                <td className="py-3 px-4">{r.date}</td>
                                <td className="py-3 px-4">
                                   <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.type === 'QC Check' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {r.type}
                                   </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 italic">"{r.reason}"</td>
                                <td className="py-3 px-4 text-right font-black text-rose-600">-{r.quantity}</td>
                              </tr>
                            ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </section>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
               <Button onClick={() => setSelectedProductDetails(null)} variant="secondary">Close Details</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyStockCheck;
