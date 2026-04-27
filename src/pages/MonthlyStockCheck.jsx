import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, Eye, Calendar, ArrowRightLeft, X, ShoppingCart, MapPin, ClipboardList, History, Zap, Package, TrendingUp, TrendingDown, Layers, Save } from 'lucide-react';
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
    saveMonthlyStock,
    productionRecords
  } = useGlobalState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [weeklyLogProduct, setWeeklyLogProduct] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const getWeekStr = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const temp = new Date(d);
    temp.setDate(temp.getDate() + 1);
    const dateForCalc = temp;
    dateForCalc.setDate(dateForCalc.getDate() + 4 - (dateForCalc.getDay() || 7));
    const year = dateForCalc.getFullYear();
    const week = Math.ceil((((dateForCalc - new Date(year, 0, 1)) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isCarryingForward, setIsCarryingForward] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleCarryPhysicalForward = async () => {
    setIsSyncing(true);
    const toastId = toast.loading("Carrying forward Physical Stock as Opening Balance...");
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      
      const prevMonthData = monthlyStockData.filter(d => d.month === prevMonthStr);
      if (prevMonthData.length === 0) {
        toast.error(`No data found for previous month (${prevMonthStr})`, { id: toastId });
        return;
      }

      const prevMovements = getMovements(prevMonthStr);

      for (const item of stock) {
        if (item.isComposite) continue;
        const pData = prevMonthData.find(d => d.productId === item.id);
        if (pData) {
          // Priority: Physical Stock > Expected Stock
          const m = prevMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(pData.opening, pData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
          
          const valueToCarry = (pData.physical !== undefined && pData.physical !== '') ? Number(pData.physical) : expected;
          
          await saveMonthlyStock(selectedMonth, item.id, { opening: valueToCarry });
          // Also ensure previous month's expected is saved for consistency
          await saveMonthlyStock(prevMonthStr, item.id, { expected });
        }
      }
      toast.success(`Success! Carried forward balances from ${prevMonthStr}`, { id: toastId });
    } catch (error) {
      toast.error("Process failed: " + error.message, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const getMovements = (monthStr) => {
    const sums = {};
    stock.forEach(item => { if (!item.isComposite) sums[item.name] = { out: 0, packed: 0, returned: 0, damage: 0, purchased: 0, rejected: 0, replacement: 0, produced: 0, used: 0 }; });
    const isTargetMonth = (dateStr) => dateStr && dateStr.startsWith(monthStr);
    b2bShipments.filter(s => isTargetMonth(s.date)).forEach(s => { 
      s.products.forEach(p => { 
        const qty = (Number(p.quantity) || 0) * (Number(p.packSize) || 1); 
        if (sums[p.name]) { 
          if (s.status === 'Packed') sums[p.name].packed += qty;
          else sums[p.name].out += qty;
        } else { 
          const bundle = stock.find(item => item.name === p.name); 
          if (bundle?.isComposite && bundle.components) { 
            bundle.components.forEach(comp => { 
              const compQty = (Number(p.quantity) || 0) * (Number(comp.quantity) || 1); 
              if (sums[comp.name]) { 
                if (s.status === 'Packed') sums[comp.name].packed += compQty;
                else sums[comp.name].out += compQty;
              } 
            }); 
          } 
        } 
      }); 
    });
    b2cShipments.filter(s => isTargetMonth(s.date)).forEach(s => { s.products.forEach(p => { if (sums[p.name]) sums[p.name].out += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); else { const bundle = stock.find(item => item.name === p.name); if (bundle?.isComposite && bundle.components) { bundle.components.forEach(comp => { if (sums[comp.name]) sums[comp.name].out += (Number(p.quantity) || 0) * (Number(comp.quantity) || 1); }); } } }); });
    damageRecords.filter(r => isTargetMonth(r.date) && r.deducted !== false).forEach(r => { if (sums[r.productName]) sums[r.productName].damage += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    qcRecords.filter(r => isTargetMonth(r.date) && r.deducted).forEach(r => { if (sums[r.productName]) { sums[r.productName].damage += (Number(r.damaged) || 0) * (Number(r.packSize) || 1); sums[r.productName].rejected += (Number(r.rejected) || 0) * (Number(r.packSize) || 1); } });
    returnRecords.filter(r => isTargetMonth(r.date) && r.isReusable && r.deducted !== false).forEach(r => { if (sums[r.productName]) sums[r.productName].returned += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    purchaseRecords.filter(r => isTargetMonth(r.date)).forEach(r => { if (sums[r.productName]) sums[r.productName].purchased += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    replacementRecords.filter(r => isTargetMonth(r.date) && r.deducted).forEach(r => { const prods = r.products || [{ name: r.productName, quantity: r.quantity, packSize: r.packSize }]; prods.forEach(p => { if (sums[p.name]) sums[p.name].replacement += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); }); });
    (productionRecords || []).filter(r => isTargetMonth(r.date)).forEach(r => { if (sums[r.productName]) sums[r.productName].produced += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); (r.rawMaterials || []).forEach(rm => { if (sums[rm.name]) sums[rm.name].used += (Number(rm.quantity) || 0) * (Number(rm.packSize) || 1); }); });
    return sums;
  };

  const monthlyMovements = useMemo(() => getMovements(selectedMonth), [selectedMonth, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, stock]);

  const calculateExpected = (opening, otherIn, purchased, produced, returned, out, packed, replacement, damage, rejected, used) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(purchased || 0) + Number(produced || 0) + Number(returned || 0) - Number(out || 0) - Number(packed || 0) - Number(replacement || 0) - Number(damage || 0) - Number(rejected || 0) - Number(used || 0);

  // Automatic background sync for Expected Stock
  useEffect(() => {
    if (!monthlyMovements || stock.length === 0) return;
    const sync = async () => {
      stock.forEach(item => {
        if (item.isComposite) return;
        const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
        const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        if (mData.expected !== expected) {
          saveMonthlyStock(selectedMonth, item.id, { expected });
        }
      });
    };
    sync();
  }, [monthlyMovements, selectedMonth]);

  const handleCarryForward = async () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthData = monthlyStockData.filter(d => d.month === prevMonthStr);
    if (prevMonthData.length === 0) { toast.error(`No data found for previous month (${prevMonthStr})`); return; }
    setIsCarryingForward(true);
    try {
      const prevMovements = getMovements(prevMonthStr);
      for (const item of prevMonthData) {
        const product = stock.find(s => s.id === item.productId);
        if (!product) continue;
        const m = prevMovements[product.name] || { out: 0, packed: 0, returned: 0, damage: 0, purchased: 0, produced: 0, rejected: 0, replacement: 0, used: 0 };
        const expected = calculateExpected(item.opening, item.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        await saveMonthlyStock(selectedMonth, item.productId, { opening: expected });
        await saveMonthlyStock(prevMonthStr, item.productId, { expected });
      }
      toast.success('Balances carried forward & Expected stock saved!');
    } finally { setIsCarryingForward(false); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = stock.filter(item => !item.isComposite).map(item => {
        const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
        const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        return { SKU: item.sku, Name: item.name, Month: selectedMonth, Opening: mData.opening || 0, 'Stock In': (Number(mData.in) || 0) + m.purchased + m.produced, Returns: m.returned, Dispatch: m.out, Packed: m.packed || 0, Replacement: m.replacement, Damage: m.damage, Rejected: m.rejected, Expected: expected, Physical: mData.physical || 0, Difference: (Number(mData.physical) || 0) - expected };
      });
      exportFormattedStockCheck(dataToExport, selectedMonth, `Monthly_Stock_${selectedMonth}.xlsx`);
    } finally { setIsExporting(false); }
  };

  const filteredStock = stock.filter(item => !item.isComposite && (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))));

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div className="min-w-fit">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Monthly Stock Check</h2>
          <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-medium">Inventory Reconciliation & Weekly Audits</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap xl:flex-nowrap items-center gap-2 w-full xl:w-auto">
          <Button onClick={handleCarryPhysicalForward} variant="primary" loading={isSyncing} className="col-span-2 sm:col-auto bg-indigo-600 hover:bg-indigo-700 shadow-md whitespace-nowrap text-[10px] md:text-xs h-10 px-3 flex-shrink-0"><ArrowRightLeft size={16} className="mr-1" /> Use Prev Physical as Opening</Button>
          
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 md:px-3 h-10 shadow-sm flex-shrink-0">
            <Calendar size={14} className="text-slate-400" />
            <input type="month" className="text-[10px] md:text-xs font-bold text-slate-700 outline-none w-24 md:w-28 bg-transparent" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>

          <div className="relative flex-1 sm:min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Search SKU..." className="pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs outline-none w-full focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <Button onClick={handleCarryForward} variant="secondary" loading={isCarryingForward} className="whitespace-nowrap text-[10px] md:text-xs h-10 px-2 md:px-3 flex-shrink-0"><ArrowRightLeft size={16} className="mr-1" /> Carry</Button>
          <Button onClick={handleExport} variant="success" loading={isExporting} className="whitespace-nowrap text-[10px] md:text-xs h-10 px-2 md:px-3 flex-shrink-0"><DownloadCloud size={16} className="mr-1" /> Export</Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh] scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="py-4 px-4 min-w-[180px] bg-slate-50 sticky left-0 z-30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">SKU Name</th>
                <th className="py-4 px-2 text-center bg-slate-50">Opening</th>
                <th className="py-4 px-2 text-center text-indigo-600 bg-slate-50">Stock In</th>
                <th className="py-4 px-2 text-center text-emerald-600 bg-slate-50">Returns</th>
                <th className="py-4 px-2 text-center text-amber-600 bg-slate-50">Out</th>
                <th className="py-4 px-2 text-center text-orange-500 bg-slate-50">Packed</th>
                <th className="py-4 px-2 text-center text-orange-500 bg-slate-50">Repl</th>
                <th className="py-4 px-2 text-center text-red-600 bg-slate-50">Damage</th>
                <th className="py-4 px-2 text-center text-rose-500 bg-slate-50">Rejected</th>
                <th className="py-4 px-2 text-center text-rose-600 bg-slate-50">Used</th>
                <th className="py-4 px-2 text-center bg-slate-100/80 sticky right-[250px] z-20 border-l border-slate-200">Expected</th>
                <th className="py-4 px-2 text-center bg-indigo-50/80 sticky right-[160px] z-20 border-l border-slate-200">Physical</th>
                <th className="py-4 px-2 text-center text-indigo-600 bg-slate-50">Weekly Log</th>
                <th className="py-4 px-4 text-center bg-slate-50">Diff</th>
                <th className="py-4 px-4 text-center bg-slate-50 sticky right-0 z-20 border-l border-slate-200">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.map((item) => {
                const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
                const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
                const diff = physical !== null ? physical - expected : null;
                const [y, mNum] = selectedMonth.split('-').map(Number);
                const monthWeeks = [1, 2, 3, 4, 5].map(wNum => {
                   const d = new Date(y, mNum - 1, (wNum - 1) * 7 + 1);
                   return d.getMonth() + 1 === mNum ? getWeekStr(d) : null;
                }).filter(Boolean);
                const weeklyLogsCount = monthlyStockData.filter(d => d.productId === item.id && monthWeeks.includes(d.month) && (d.physical !== undefined && d.physical !== '')).length;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-4 text-sm border-r border-slate-100 font-semibold text-slate-900 bg-white sticky left-0 z-10 group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col"><span className="text-[9px] text-indigo-500 font-mono font-bold uppercase tracking-tighter">{item.sku || '-'}</span>{item.name}</div>
                    </td>
                    <td className="py-3 px-1 text-center">
                      <input type="number" className="w-14 mx-auto block px-1 py-1 text-center text-xs border border-slate-200 rounded outline-none" value={mData.opening || ''} onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                        const expected = calculateExpected(val, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                        saveMonthlyStock(selectedMonth, item.id, { opening: val, expected });
                      }} />
                    </td>
                    <td className="py-4 px-2 text-center text-indigo-600 text-xs font-bold">{(Number(mData.in) || 0) + m.purchased + m.produced}</td>
                    <td className="py-4 px-2 text-xs text-center text-emerald-600 font-bold">{m.returned || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-amber-600 font-bold">{m.out || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold">{m.packed || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold">{m.replacement || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-red-600 font-bold">{m.damage || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-rose-500 font-bold">{m.rejected || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-rose-600 font-black">{m.used || 0}</td>
                    <td className="py-4 px-2 text-sm text-center font-bold bg-slate-50/50 border-x border-slate-100 sticky right-[250px] z-10 group-hover:bg-slate-100/50">{expected}</td>
                    <td className="py-3 px-2 bg-indigo-50/20 sticky right-[160px] z-10 group-hover:bg-indigo-50/30">
                      <div className="flex items-center gap-1">
                        <input type="number" className="w-16 mx-auto block px-2 py-1 text-center text-sm border border-slate-300 rounded outline-none font-bold bg-white focus:border-indigo-500" value={mData.physical || ''} onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                          saveMonthlyStock(selectedMonth, item.id, { physical: val, expected });
                        }} placeholder="--" />
                        {(mData.physical !== undefined && mData.physical !== '') && <button onClick={() => saveMonthlyStock(selectedMonth, item.id, { physical: '' })} className="p-0.5 text-slate-400 hover:text-red-500"><X size={12} /></button>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                       <button onClick={() => setWeeklyLogProduct(item)} className={`flex items-center gap-1.5 mx-auto px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${weeklyLogsCount > 0 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                         <History size={12} /> {weeklyLogsCount > 0 ? `${weeklyLogsCount} Logs` : 'Add Log'}
                       </button>
                    </td>
                    <td className="py-4 px-4 text-sm text-center">
                      {diff !== null && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diff < 0 ? 'bg-red-100 text-red-800' : diff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{diff > 0 ? `+${diff}` : diff}</span>}
                    </td>
                    <td className="py-4 px-4 text-center sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-l border-slate-100">
                      <button onClick={() => setSelectedProductDetails(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition-all"><Eye size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile & Tablet Card List View */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 lg:pb-6">
        {filteredStock.map((item) => {
          const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
          const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
          const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
          const diff = physical !== null ? physical - expected : null;
          const [y, mNum] = selectedMonth.split('-').map(Number);
          const monthWeeks = [1, 2, 3, 4, 5].map(wNum => {
             const d = new Date(y, mNum - 1, (wNum - 1) * 7 + 1);
             return d.getMonth() + 1 === mNum ? getWeekStr(d) : null;
          }).filter(Boolean);
          const weeklyLogsCount = monthlyStockData.filter(d => d.productId === item.id && monthWeeks.includes(d.month) && (d.physical !== undefined && d.physical !== '')).length;

          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
               {/* Card Header */}
               <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase block tracking-tighter">{item.sku || 'No SKU'}</span>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{item.name}</h3>
                  </div>
                  <button onClick={() => setSelectedProductDetails(item)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><Eye size={18}/></button>
               </div>

               {/* Stats Grid - Prioritizing Expected vs Physical */}
               <div className="p-4 grid grid-cols-2 gap-4 border-b border-slate-50">
                  <div className="space-y-1 bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block">Expected Stock</span>
                    <p className="text-lg font-black text-slate-900 leading-none">{expected}</p>
                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-200/50">
                       <span className="text-[8px] text-slate-400 font-bold uppercase">Opening:</span>
                       <input type="number" className="bg-transparent text-[10px] font-bold text-slate-600 outline-none w-12" value={mData.opening || ''} onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                          const expected = calculateExpected(val, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                          saveMonthlyStock(selectedMonth, item.id, { opening: val, expected });
                       }} placeholder="0" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-indigo-500 uppercase font-bold tracking-widest block">Physical Stock</span>
                    <div className="relative">
                      <input type="number" className="w-full px-3 py-2 text-base font-black bg-indigo-50/30 border-2 border-indigo-200 rounded-lg outline-none text-indigo-700 focus:border-indigo-500" value={mData.physical || ''} onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                        saveMonthlyStock(selectedMonth, item.id, { physical: val, expected });
                      }} placeholder="Enter Count" />
                      {(mData.physical !== undefined && mData.physical !== '') && <button onClick={() => saveMonthlyStock(selectedMonth, item.id, { physical: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300"><X size={14}/></button>}
                    </div>
                  </div>
               </div>

               {/* Movements Row */}
               <div className="px-4 py-3 bg-white grid grid-cols-5 gap-1">
                  <div className="text-center"><span className="text-[8px] text-slate-400 uppercase block">In</span><span className="text-xs font-bold text-indigo-600">{(Number(mData.in) || 0) + m.purchased + m.produced}</span></div>
                  <div className="text-center">
                    <span className="text-[8px] text-slate-400 uppercase block">Out</span>
                    <span className="text-xs font-bold text-amber-600">{m.out}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[8px] text-slate-400 uppercase block font-bold text-orange-500">Packed</span>
                    <span className="text-xs font-bold text-orange-500">{m.packed}</span>
                  </div>
                  <div className="text-center"><span className="text-[8px] text-slate-400 uppercase block">Damage</span><span className="text-xs font-bold text-red-500">{m.damage + m.rejected}</span></div>
                  <div className="text-center"><span className="text-[8px] text-slate-400 uppercase block">Used</span><span className="text-xs font-bold text-rose-600">{m.used}</span></div>
               </div>

               {/* Footer / Status */}
               <div className="p-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                  <div className="flex gap-4">
                     <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold block">Expected</span><span className="text-sm font-black text-slate-900">{expected}</span></div>
                     {diff !== null && <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold block">Diff</span><span className={`text-sm font-black ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{diff > 0 ? `+${diff}` : diff}</span></div>}
                  </div>
                  <button onClick={() => setWeeklyLogProduct(item)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${weeklyLogsCount > 0 ? 'bg-indigo-600 text-white shadow-indigo-100 shadow-lg' : 'bg-white border border-slate-200 text-slate-600'}`}><History size={14} /> {weeklyLogsCount > 0 ? `${weeklyLogsCount} Logs` : 'Add Log'}</button>
               </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Physical Log Modal */}
      {weeklyLogProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <ClipboardList size={20} />
                    <div><h3 className="text-lg font-bold">Weekly Physical Stock</h3><p className="text-[10px] text-indigo-100 font-medium uppercase tracking-widest">{weeklyLogProduct.name}</p></div>
                 </div>
                 <button onClick={() => setWeeklyLogProduct(null)} className="hover:bg-white/10 p-1.5 rounded-lg"><X size={20}/></button>
              </div>
              <div className="p-4 md:p-6 bg-slate-50 space-y-4">
                 <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(wNum => {
                       const [y, m] = selectedMonth.split('-').map(Number);
                       const weekDate = new Date(y, m - 1, (wNum - 1) * 7 + 1);
                       if (weekDate.getMonth() + 1 !== m) return null;
                       const weekStr = getWeekStr(weekDate);
                       const weekRange = getWeekRange(weekDate);
                       const wData = monthlyStockData.find(d => d.month === weekStr && d.productId === weeklyLogProduct.id) || {};
                       return (
                          <div key={wNum} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">Week {wNum}</span>
                                <span className="text-xs font-bold text-slate-800">{weekRange}</span>
                             </div>
                             <input type="number" className="w-24 px-3 py-2 text-right text-sm font-bold border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="0" value={wData.physical || ''} onChange={(e) => saveMonthlyStock(weekStr, weeklyLogProduct.id, { physical: e.target.value === '' ? '' : Number(e.target.value) })} />
                          </div>
                       );
                    })}
                 </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                 <Button onClick={() => setWeeklyLogProduct(null)} variant="primary" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">Save Weekly Audit</Button>
              </div>
           </div>
        </div>
      )}
      
      {/* Transaction Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
               <div className="flex items-center gap-3"><Layers className="text-indigo-400" size={24}/><div><h3 className="text-lg font-bold">Transaction History</h3><p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedProductDetails.name} • {selectedMonth}</p></div></div>
               <button onClick={() => setSelectedProductDetails(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-emerald-600"><TrendingUp size={20}/><h4 className="font-bold">Inventory In</h4></div>
                    <ul className="space-y-2">
                      {purchaseRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name).map(r => <li key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">Purchase Order</span><span className="font-bold text-emerald-600">+{r.quantity}</span></li>)}
                      {productionRecords.filter(r => r.date.startsWith(selectedMonth) && r.productName === selectedProductDetails.name).map(r => <li key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">Manufacturing</span><span className="font-bold text-indigo-600">+{r.quantity}</span></li>)}
                      {filteredStock.length > 0 && <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs"><span>Total Additions</span><span>+{(Number(monthlyStockData.find(d => d.month === selectedMonth && d.productId === selectedProductDetails.id)?.in) || 0) + (monthlyMovements[selectedProductDetails.name]?.purchased || 0) + (monthlyMovements[selectedProductDetails.name]?.produced || 0)}</span></li>}
                    </ul>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-amber-600"><TrendingDown size={20}/><h4 className="font-bold">Inventory Out</h4></div>
                    <ul className="space-y-2">
                      {b2bShipments.filter(s => s.date.startsWith(selectedMonth) && s.products.some(p => p.name === selectedProductDetails.name)).map(s => <li key={s.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">B2B Dispatch</span><span className="font-bold text-amber-600">-{s.products.find(p => p.name === selectedProductDetails.name).quantity}</span></li>)}
                      {b2cShipments.filter(s => s.date.startsWith(selectedMonth) && s.products.some(p => p.name === selectedProductDetails.name)).map(s => <li key={s.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">B2C Dispatch</span><span className="font-bold text-orange-600">-{s.products.find(p => p.name === selectedProductDetails.name).quantity}</span></li>)}
                      <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs text-slate-900"><span>Total Movement</span><span>-{monthlyMovements[selectedProductDetails.name]?.out || 0}</span></li>
                    </ul>
                  </div>
               </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end"><Button onClick={() => setSelectedProductDetails(null)} variant="secondary" className="w-full md:w-auto">Close History</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyStockCheck;
