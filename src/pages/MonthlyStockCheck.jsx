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
  const [isSyncing, setIsSyncing] = useState(false);

  const getWeekStr = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    // ISO Week Calculation: Thursday Rule
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const year = d.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

  const [selectedWeek, setSelectedWeek] = useState(() => getWeekStr(new Date()));
  const [isCarryingForward, setIsCarryingForward] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const activePeriod = selectedWeek;

  const handleCarryPhysicalForward = async () => {
    setIsSyncing(true);
    const toastId = toast.loading(`Carrying forward Physical Stock to ${activePeriod}...`);
    try {
      // Simple prev week calc: go back 7 days from middle of current week
      const [year, wNum] = selectedWeek.split('-W').map(Number);
      const d = new Date(year, 0, 1 + (wNum - 1) * 7);
      d.setDate(d.getDate() - 7);
      const prevPeriodStr = getWeekStr(d);
      
      const prevData = monthlyStockData.filter(d => d.month === prevPeriodStr);
      if (prevData.length === 0) {
        toast.error(`No data found for previous week (${prevPeriodStr})`, { id: toastId });
        return;
      }

      const prevMovements = getMovements(prevPeriodStr);

      for (const item of stock) {
        if (item.isComposite) continue;
        const pData = prevData.find(d => d.productId === item.id);
        if (pData) {
          const m = prevMovements[item.id] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(pData.opening, pData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
          
          const valueToCarry = (pData.physical !== undefined && pData.physical !== '') ? Number(pData.physical) : expected;
          
          await saveMonthlyStock(activePeriod, item.id, { opening: valueToCarry });
          await saveMonthlyStock(prevPeriodStr, item.id, { expected });
        }
      }
      toast.success(`Success! Carried forward balances from ${prevPeriodStr}`, { id: toastId });
    } catch (error) {
      toast.error("Process failed: " + error.message, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const getMovements = (periodStr) => {
    const sums = {};
    const nameToId = {};
    
    // Initialize for all products
    stock.forEach(item => { 
      sums[item.id] = { 
        out: 0, directOut: 0, compOut: 0,
        packed: 0, directPacked: 0, compPacked: 0,
        dispatched: 0, dispatchedDeduct: 0, 
        returned: 0, damage: 0, purchased: 0, rejected: 0, 
        replacement: 0, produced: 0, used: 0 
      }; 
      nameToId[item.name] = item.id;
    });
    
    const isTarget = (dateStr) => {
      if (!dateStr || !periodStr) return false;
      return getWeekStr(dateStr) === periodStr;
    };

    b2bShipments.forEach(s => { 
      s.products.forEach(p => { 
        const packedDate  = p.packedDate || s.date;
        const dispatchDate = s.dispatchDate || s.date;
        const noPacking   = p.isPacked === false;

        const packedThisWeek     = !noPacking && isTarget(packedDate);
        const dispatchedThisWeek = s.status === 'Dispatched' && isTarget(dispatchDate);
        const packedPrevWeek     = !noPacking && !isTarget(packedDate);

        if (!packedThisWeek && !dispatchedThisWeek) return;

        const qty = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        const masterId = nameToId[p.name];
        const master = stock.find(item => item.id === masterId);

        const applyMovements = (targetId, amount, isComponentUsage = false) => {
          if (!sums[targetId]) return;
          const target = sums[targetId];
          if (noPacking && dispatchedThisWeek) {
            target.out += amount;
            if (isComponentUsage) target.compOut += amount; else target.directOut += amount;
            target.dispatchedDeduct += amount;
            target.dispatched += amount;
          } else if (packedThisWeek && dispatchedThisWeek) {
            target.out += amount;
            if (isComponentUsage) target.compOut += amount; else target.directOut += amount;
            target.dispatchedDeduct += amount;
            target.dispatched += amount;
          } else if (packedThisWeek && !dispatchedThisWeek) {
            target.packed += amount;
            if (isComponentUsage) target.compPacked += amount; else target.directPacked += amount;
          } else if (packedPrevWeek && dispatchedThisWeek) {
            target.dispatched += amount;
          }
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compId = nameToId[comp.name];
            if (compId) {
              const compQty = qty * (Number(comp.quantity) || 1);
              applyMovements(compId, compQty, true);
            }
          });
        }
        
        if (masterId) {
          applyMovements(masterId, qty, false);
        }
      }); 
    });

    b2cShipments.filter(s => isTarget(s.date)).forEach(s => { 
      s.products.forEach(p => { 
        const qty = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        const masterId = nameToId[p.name];
        const master = stock.find(item => item.id === masterId);

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compId = nameToId[comp.name];
            if (compId && sums[compId]) {
              const compQty = qty * (Number(comp.quantity) || 1);
              sums[compId].out += compQty;
              sums[compId].compOut += compQty;
            }
          });
        }
        
        if (masterId && sums[masterId]) {
          sums[masterId].out += qty;
          sums[masterId].directOut += qty;
        }
      }); 
    });
    damageRecords.filter(r => isTarget(r.date) && r.deducted !== false).forEach(r => { if (sums[r.productName]) sums[r.productName].damage += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    qcRecords.filter(r => isTarget(r.date) && r.deducted).forEach(r => { if (sums[r.productName]) { sums[r.productName].damage += (Number(r.damaged) || 0) * (Number(r.packSize) || 1); sums[r.productName].rejected += (Number(r.rejected) || 0) * (Number(r.packSize) || 1); } });
    returnRecords.filter(r => isTarget(r.date) && r.isReusable && r.deducted !== false).forEach(r => { if (sums[r.productName]) sums[r.productName].returned += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    purchaseRecords.filter(r => isTarget(r.date)).forEach(r => { if (sums[r.productName]) sums[r.productName].purchased += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); });
    replacementRecords.filter(r => isTarget(r.date) && r.deducted).forEach(r => { const prods = r.products || [{ name: r.productName, quantity: r.quantity, packSize: r.packSize }]; prods.forEach(p => { if (sums[p.name]) sums[p.name].replacement += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); }); });
    (productionRecords || []).filter(r => isTarget(r.date)).forEach(r => { if (sums[r.productName]) sums[r.productName].produced += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); (r.rawMaterials || []).forEach(rm => { if (sums[rm.name]) sums[rm.name].used += (Number(rm.quantity) || 0) * (Number(rm.packSize) || 1); }); });
    return sums;
  };

  const monthlyMovements = useMemo(() => getMovements(activePeriod), [activePeriod, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, stock]);

  const calculateExpected = (opening, otherIn, purchased, produced, returned, out, packed, replacement, damage, rejected, used) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(purchased || 0) + Number(produced || 0) + Number(returned || 0) - Number(out || 0) - Number(packed || 0) - Number(replacement || 0) - Number(damage || 0) - Number(rejected || 0) - Number(used || 0);

  useEffect(() => {
    if (!monthlyMovements || stock.length === 0) return;
    const sync = async () => {
      stock.forEach(item => {
        if (item.isComposite) return;
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const m = monthlyMovements[item.name] || { out: 0, packed: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        if (mData.expected !== expected) {
          saveMonthlyStock(activePeriod, item.id, { expected });
        }
      });
    };
    sync();
  }, [monthlyMovements, activePeriod]);

  const handleCarryForward = async () => {
    setIsCarryingForward(true);
    try {
      const [year, wNum] = selectedWeek.split('-W').map(Number);
      const d = new Date(year, 0, 1 + (wNum - 1) * 7);
      d.setDate(d.getDate() - 7);
      const prevPeriodStr = getWeekStr(d);

      const prevData = monthlyStockData.filter(d => d.month === prevPeriodStr);
      if (prevData.length === 0) { toast.error(`No data found for previous week (${prevPeriodStr})`); return; }
      
      const prevMovements = getMovements(prevPeriodStr);
      for (const item of prevData) {
        const product = stock.find(s => s.id === item.productId);
        if (!product) continue;
        const m = prevMovements[product.name] || { out: 0, packed: 0, returned: 0, damage: 0, purchased: 0, produced: 0, rejected: 0, replacement: 0, used: 0 };
        const expected = calculateExpected(item.opening, item.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        await saveMonthlyStock(activePeriod, item.productId, { opening: expected });
        await saveMonthlyStock(prevPeriodStr, item.productId, { expected });
      }
      toast.success('Balances carried forward successfully!');
    } finally { setIsCarryingForward(false); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = stock.filter(item => !item.isComposite).map(item => {
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const m = monthlyMovements[item.name] || { out: 0, packed: 0, dispatched: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
        return { 
          SKU: item.sku, 
          Name: item.name, 
          Period: activePeriod, 
          Opening: mData.opening || 0, 
          'Stock In': (Number(mData.in) || 0) + m.purchased + m.produced, 
          Returns: m.returned, 
          Dispatch: m.out, 
          Packed: m.packed || 0, 
          Dispatched: m.dispatched || 0,
          Replacement: m.replacement, 
          Damage: m.damage, 
          Rejected: m.rejected, 
          Used: m.used || 0,
          Expected: expected, 
          Physical: mData.physical || 0, 
          Difference: (Number(mData.physical) || 0) - expected 
        };
      });
      exportFormattedStockCheck(dataToExport, activePeriod, `Stock_Check_${activePeriod}.xlsx`);
    } finally { setIsExporting(false); }
  };

  const filteredStock = stock.filter(item => !item.isComposite && (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))));

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Calendar size={20} className="md:w-6 md:h-6"/></div>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-slate-800">Weekly Stock Audit</h2>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium">Reconcile physical inventory</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 md:px-3 h-10 flex-shrink-0">
            <Calendar size={14} className="text-slate-400" />
            <input type="week" className="text-[10px] md:text-xs font-bold text-slate-700 outline-none w-32 bg-transparent" value={activePeriod} onChange={(e) => setSelectedWeek(e.target.value)} />
          </div>

          <div className="relative flex-1 sm:min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Search SKU..." className="pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs outline-none w-full focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <Button onClick={handleCarryPhysicalForward} variant="primary" loading={isSyncing} className="bg-indigo-600 hover:bg-indigo-700 shadow-md whitespace-nowrap text-[10px] md:text-xs h-10 px-3 flex-shrink-0">
            <ArrowRightLeft size={16} className="mr-1" /> Carry Physical
          </Button>

          <Button onClick={handleCarryForward} variant="secondary" loading={isCarryingForward} className="whitespace-nowrap text-[10px] md:text-xs h-10 px-2 md:px-3 flex-shrink-0"><ArrowRightLeft size={16} className="mr-1" /> Carry Expected</Button>
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
                <th className="py-4 px-2 text-center text-blue-500 bg-slate-50">Dispatched</th>
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
                const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
                const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatched: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
                const diff = physical !== null ? physical - expected : null;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-4 text-sm border-r border-slate-100 font-semibold text-slate-900 bg-white sticky left-0 z-10 group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col"><span className="text-[9px] text-indigo-500 font-mono font-bold uppercase tracking-tighter">{item.sku || '-'}</span>{item.name}</div>
                    </td>
                    <td className="py-3 px-1 text-center">
                      <input type="number" className="w-14 mx-auto block px-1 py-1 text-center text-xs border border-slate-200 rounded outline-none" value={mData.opening || ''} onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                        const expected = calculateExpected(val, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                        saveMonthlyStock(activePeriod, item.id, { opening: val, expected });
                      }} />
                    </td>
                    <td className="py-4 px-2 text-center text-indigo-600 text-xs font-bold">{(Number(mData.in) || 0) + m.purchased + m.produced}</td>
                    <td className="py-4 px-2 text-xs text-center text-emerald-600 font-bold">{m.returned || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-amber-600 font-bold">{m.out || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold">{m.packed || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-blue-500 font-bold cursor-pointer hover:bg-blue-50" onClick={() => setSelectedProductDetails(item)}>{m.dispatched || 0} <Eye className="inline ml-1 opacity-50" size={10} /></td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold">{m.replacement || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-red-600 font-bold">{m.damage || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-rose-500 font-bold">{m.rejected || 0}</td>
                    <td className="py-4 px-2 text-xs text-center text-rose-600 font-black">{m.used || 0}</td>
                    <td className="py-4 px-2 text-sm text-center font-bold bg-slate-50/50 border-x border-slate-100 sticky right-[250px] z-10 group-hover:bg-slate-100/50">{expected}</td>
                    <td className="py-3 px-2 bg-indigo-50/20 sticky right-[160px] z-10 group-hover:bg-indigo-50/30">
                      <div className="flex items-center gap-1">
                        <input type="number" className="w-16 mx-auto block px-2 py-1 text-center text-sm border border-slate-300 rounded outline-none font-bold bg-white focus:border-indigo-500" value={mData.physical || ''} onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                          saveMonthlyStock(activePeriod, item.id, { physical: val, expected });
                        }} placeholder="--" />
                        {(mData.physical !== undefined && mData.physical !== '') && <button onClick={() => saveMonthlyStock(activePeriod, item.id, { physical: '' })} className="p-0.5 text-slate-400 hover:text-red-500"><X size={12} /></button>}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                       <span className={`px-2 py-1 rounded text-[10px] font-bold ${mData.physical ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                         {mData.physical ? 'Audited' : 'Pending'}
                       </span>
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
          const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
          const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatched: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
          const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
          const diff = physical !== null ? physical - expected : null;

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
               <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
                  <div className="pr-4">
                    <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-tighter mb-1 block">{item.sku || '-'}</span>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h3>
                  </div>
                  <button onClick={() => setSelectedProductDetails(item)} className="p-1.5 text-indigo-600 bg-indigo-100 rounded-lg shrink-0"><Eye size={16} /></button>
               </div>

               {/* Grid Inputs for Mobile */}
               <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                  <div className="p-3">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Opening Stock</span>
                    <input type="number" className="w-full px-2 py-1.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded outline-none focus:border-indigo-500" value={mData.opening || ''} onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                      const expected = calculateExpected(val, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                      saveMonthlyStock(activePeriod, item.id, { opening: val, expected });
                    }} />
                  </div>
                  <div className="p-3 bg-indigo-50/10">
                    <span className="text-[9px] text-indigo-400 uppercase font-bold block mb-1">Physical Count</span>
                    <div className="relative">
                      <input type="number" className="w-full px-3 py-2 text-base font-black bg-indigo-50/30 border-2 border-indigo-200 rounded-lg outline-none text-indigo-700 focus:border-indigo-500" value={mData.physical || ''} onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        const m = monthlyMovements[item.id] || { out: 0, packed: 0, dispatchedDeduct: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.out, m.packed, m.replacement, m.damage, m.rejected, m.used);
                        saveMonthlyStock(activePeriod, item.id, { physical: val, expected });
                      }} placeholder="Enter Count" />
                      {(mData.physical !== undefined && mData.physical !== '') && <button onClick={() => saveMonthlyStock(activePeriod, item.id, { physical: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300"><X size={14}/></button>}
                    </div>
                  </div>
               </div>

               {/* Footer / Status */}
               <div className="p-4 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex gap-4">
                     <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold block">Expected</span><span className="text-sm font-black text-slate-900">{expected}</span></div>
                     {diff !== null && <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold block">Diff</span><span className={`text-sm font-black ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{diff > 0 ? `+${diff}` : diff}</span></div>}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${mData.physical ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {mData.physical ? 'Audit Done' : 'Pending Audit'}
                  </div>
               </div>
            </div>
          );
        })}
      </div>
          
      {/* Transaction Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
               <div className="flex items-center gap-3"><Layers className="text-indigo-400" size={24}/><div><h3 className="text-lg font-bold">Transaction History</h3><p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedProductDetails.name} • {activePeriod}</p></div></div>
               <button onClick={() => setSelectedProductDetails(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-emerald-600"><TrendingUp size={20}/><h4 className="font-bold">Inventory In</h4></div>
                    <ul className="space-y-2">
                      {purchaseRecords.filter(r => getWeekStr(r.date) === activePeriod && r.productName === selectedProductDetails.name).map(r => <li key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">Purchase Order</span><span className="font-bold text-emerald-600">+{r.quantity}</span></li>)}
                      {productionRecords.filter(r => getWeekStr(r.date) === activePeriod && r.productName === selectedProductDetails.name).map(r => <li key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">Manufacturing</span><span className="font-bold text-indigo-600">+{r.quantity}</span></li>)}
                      <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs"><span>Total Additions</span><span>+{(Number(monthlyStockData.find(d => d.month === activePeriod && d.productId === selectedProductDetails.id)?.in) || 0) + (monthlyMovements[selectedProductDetails.id]?.purchased || 0) + (monthlyMovements[selectedProductDetails.id]?.produced || 0)}</span></li>
                    </ul>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 text-amber-600"><TrendingDown size={20}/><h4 className="font-bold">Inventory Out / Deductions</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ul className="space-y-2">
                        {b2cShipments.filter(s => getWeekStr(s.date) === activePeriod && s.products.some(p => {
                          if (p.name === selectedProductDetails.name) return true;
                          const bundle = stock.find(item => item.name === p.name);
                          return bundle?.isComposite && bundle.components?.some(c => c.name === selectedProductDetails.name);
                        })).map(s => {
                          const directP = s.products.find(p => p.name === selectedProductDetails.name);
                          let directQty = directP ? (Number(directP.quantity) || 0) * (Number(directP.packSize) || 1) : 0;
                          let bundleQty = 0;
                          let bundleNames = [];
                          
                          s.products.forEach(sp => {
                            if (sp.name === selectedProductDetails.name) return;
                            const bundle = stock.find(item => item.name === sp.name);
                            if (bundle?.isComposite) {
                              const comp = bundle.components.find(c => c.name === selectedProductDetails.name);
                              if (comp) {
                                const bQty = (Number(sp.quantity) || 0) * (Number(sp.packSize) || 1) * (Number(comp.quantity) || 1);
                                bundleQty += bQty;
                                bundleNames.push(`${sp.name} (-${bQty})`);
                              }
                            }
                          });

                          return (
                            <li key={s.id} className="text-xs p-2 bg-slate-50 rounded-lg space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-slate-500">{s.channel || 'B2C'} Order ({s.date.split('T')[0]})</span>
                                <span className="font-bold text-orange-600">-{directQty + bundleQty}</span>
                              </div>
                              {(directQty > 0 || bundleQty > 0) && (
                                <div className="text-[9px] text-slate-400">
                                  {directQty > 0 && <span>Direct Sale: -{directQty} </span>}
                                  {bundleNames.length > 0 && <span>| In Bundle: {bundleNames.join(', ')}</span>}
                                </div>
                              )}
                            </li>
                          );
                        })}
                        <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs text-slate-900">
                          <span>Total Out</span>
                          <span>-{monthlyMovements[selectedProductDetails.id]?.out || 0}</span>
                        </li>
                      </ul>
                      <ul className="space-y-2">
                        <li className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">B2B Packed (Pending Dispatch)</li>
                        {b2bShipments.filter(s => {
                          const p = s.products.find(prod => prod.name === selectedProductDetails.name);
                          if (!p || p.isPacked === false) return false;
                          const isPackedThisWeek = getWeekStr(p.packedDate || s.date) === activePeriod;
                          const isDispatchedThisWeek = s.status === 'Dispatched' && getWeekStr(s.dispatchDate || s.date) === activePeriod;
                          return isPackedThisWeek && !isDispatchedThisWeek;
                        }).map(s => <li key={s.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg"><span className="font-medium text-slate-500">{s.clientName} (Packed)</span><span className="font-bold text-orange-500">-{s.products.find(p => p.name === selectedProductDetails.name).quantity}</span></li>)}
                        <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs text-slate-900"><span>Total Packed</span><span>-{monthlyMovements[selectedProductDetails.id]?.packed || 0}</span></li>
                      </ul>
                      <ul className="space-y-2 md:col-span-2">
                        <li className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2">B2B Dispatched (Deducted This Week)</li>
                        {b2bShipments.filter(s => {
                          const p = s.products.find(prod => prod.name === selectedProductDetails.name);
                          if (!p || s.status !== 'Dispatched') return false;
                          const isPackedPrevWeek = getWeekStr(p.packedDate || s.date) !== activePeriod;
                          const isDispatchedThisWeek = getWeekStr(s.dispatchDate || s.date) === activePeriod;
                          return isPackedPrevWeek && isDispatchedThisWeek;
                        }).map(s => <li key={s.id} className="flex justify-between items-center text-xs p-2 bg-blue-50 rounded-lg"><span className="font-medium text-blue-600">{s.clientName} (Dispatch)</span><span className="font-bold text-blue-700">-{s.products.find(p => p.name === selectedProductDetails.name).quantity}</span></li>)}
                        <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs text-slate-900">
                          <span>Weekly Impact</span>
                          <span>-{(monthlyMovements[selectedProductDetails.id]?.out || 0) + (monthlyMovements[selectedProductDetails.id]?.packed || 0)}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-4 text-blue-500"><TrendingUp size={20} className="rotate-90"/><h4 className="font-bold">Dispatched (Packed Previous Weeks)</h4></div>
                    <ul className="space-y-2">
                      {b2bShipments.filter(s => {
                        const p = s.products.find(prod => prod.name === selectedProductDetails.name);
                        if (!p || s.status !== 'Dispatched') return false;
                        const isPackedThisWeek = p.isPacked !== false && getWeekStr(p.packedDate || s.date) === activePeriod;
                        const isDispatchedThisWeek = getWeekStr(s.dispatchDate || s.date) === activePeriod;
                        return !isPackedThisWeek && isDispatchedThisWeek;
                      }).map(s => <li key={s.id} className="flex justify-between items-center text-xs p-2 bg-blue-50 rounded-lg"><span className="font-medium text-slate-600">{s.clientName} (Dispatched)</span><span className="font-bold text-blue-600">{s.products.find(p => p.name === selectedProductDetails.name).quantity} Units</span></li>)}
                      <li className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs text-slate-900"><span>Total Past Dispatches</span><span>{(monthlyMovements[selectedProductDetails.id]?.dispatched || 0) - (monthlyMovements[selectedProductDetails.id]?.dispatchedDeduct || 0)}</span></li>
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
