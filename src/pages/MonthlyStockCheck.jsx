import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, Eye, Calendar, ArrowRightLeft, X, ShoppingCart, MapPin, ClipboardList, History, Zap, Package, TrendingUp, TrendingDown, Layers, Save, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
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
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

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

  const isTarget = (dateStr, targetPeriod = activePeriod) => {
    if (!dateStr || !targetPeriod) return false;
    return getWeekStr(dateStr) === targetPeriod;
  };

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
          const m = prevMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(pData.opening, pData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
          
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
    const compareNames = (n1, n2) => {
      if (!n1 || !n2) return false;
      const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return clean(n1) === clean(n2);
    };

    stock.forEach(item => { 
      sums[item.id] = { out: 0, b2cOut: 0, b2bOut: 0, packed: 0, stockDeduction: 0, returned: 0, damage: 0, purchased: 0, rejected: 0, replacement: 0, produced: 0, used: 0 }; 
    });
    
    b2bShipments.forEach(s => { 
      if (!s.products) return;
      s.products.forEach(p => { 
        const pName = p.name || p.productName;
        const packedDate = p.packedDate || s.packedDate || s.date;
        const dispatchDate = s.dispatchDate || (s.status === 'Dispatched' ? s.date : null);
        const noPacking = s.isPacked === false;

        const packedThisWeek = !noPacking && isTarget(packedDate, periodStr);
        const dispatchedThisWeek = isTarget(dispatchDate, periodStr);
        const packedPrevWeek = !noPacking && packedDate && !isTarget(packedDate, periodStr) && getWeekStr(packedDate) < periodStr;

        const dispatchedPrevWeek = dispatchDate && !isTarget(dispatchDate, periodStr) && getWeekStr(dispatchDate) < periodStr;
        const qty = (Number(p.quantity) || 0);
        const master = stock.find(item => compareNames(item.name, pName));

        const applyB2B = (id, amount) => {
          if (!sums[id]) return;
          const t = sums[id];
          
          // 1. UI Columns: Show what physically happened this week
          if (dispatchedThisWeek) {
            if (packedPrevWeek) {
              t.dispatched = (t.dispatched || 0) + amount; // Last week packed, this week dispatched
            } else {
              t.b2bOut += amount; // Packed and dispatched this week
            }
          }
          // Only show as packed if it hasn't been dispatched at all (not this week, not previous weeks)
          if (packedThisWeek && !dispatchedThisWeek && !dispatchedPrevWeek) {
            t.packed += amount;
          }

          // 2. Math: Deduct exactly once
          if (dispatchedThisWeek && (noPacking || packedThisWeek)) {
            t.stockDeduction += amount;
          } else if (packedThisWeek && !dispatchedThisWeek && !dispatchedPrevWeek) {
            t.stockDeduction += amount;
          }
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
            if (compMaster) { applyB2B(compMaster.id, qty * (Number(comp.quantity) || 1)); }
          });
        }
        if (master) { applyB2B(master.id, qty); }
      }); 
    });

    b2cShipments.filter(s => isTarget(s.date, periodStr)).forEach(s => { 
      s.products.forEach(p => { 
        const pName = p.name || p.productName;
        const master = stock.find(item => compareNames(item.name, pName));
        
        let effectivePackSize = Number(p.packSize) || 1;
        
        const qty = (Number(p.quantity) || 0) * effectivePackSize;

        const applyB2C = (id, amount) => {
          if (!sums[id]) return;
          sums[id].b2cOut += amount;
          sums[id].stockDeduction += amount; // B2C is always immediate deduction
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
            let multiplier = Number(comp.quantity) || 1;
            if (effectivePackSize > 1 && multiplier > 1 && effectivePackSize === multiplier) {
               multiplier = 1; 
            }
            if (compMaster) { applyB2C(compMaster.id, qty * multiplier); }
          });
        }
        if (master) { applyB2C(master.id, qty); }
      }); 
    });

    damageRecords.filter(r => isTarget(r.date)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].damage += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); }
    });
    qcRecords.filter(r => isTarget(r.date) && r.deducted).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { 
        sums[master.id].damage += (Number(r.damaged) || 0) * (Number(r.packSize) || 1); 
        sums[master.id].rejected += (Number(r.rejected) || 0) * (Number(r.packSize) || 1); 
      } 
    });
    returnRecords.filter(r => isTarget(r.date) && r.isReusable && r.deducted !== false).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].returned += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); }
    });
    purchaseRecords.filter(r => isTarget(r.date)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].purchased += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); }
    });
    replacementRecords.filter(r => isTarget(r.date) && r.deducted).forEach(r => { 
      const prods = r.products || [{ name: r.productName, quantity: r.quantity, packSize: r.packSize }]; 
      prods.forEach(p => { 
        const master = stock.find(s => compareNames(s.name, p.name));
        if (master && sums[master.id]) { sums[master.id].replacement += (Number(p.quantity) || 0) * (Number(p.packSize) || 1); }
      }); 
    });
    (productionRecords || []).filter(r => isTarget(r.date)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].produced += (Number(r.quantity) || 0) * (Number(r.packSize) || 1); }
      (r.rawMaterials || []).forEach(rm => { 
        const rmMaster = stock.find(s => compareNames(s.name, rm.name));
        if (rmMaster && sums[rmMaster.id]) { sums[rmMaster.id].used += (Number(rm.quantity) || 0) * (Number(rm.packSize) || 1); }
      }); 
    });

    // Final UI cleanup: Out = B2C + B2B Dispatched
    Object.keys(sums).forEach(id => {
      sums[id].out = sums[id].b2cOut + sums[id].b2bOut;
    });

    return sums;
  };

  const getProductMovements = (product, period) => {
    const results = { in: [], b2bOut: [], b2cOut: [], packed: [], sent: [], onHold: [], adjustments: [] };
    if (!product) return results;

    const compareNames = (n1, n2) => {
      if (!n1 || !n2) return false;
      const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return clean(n1) === clean(n2);
    };

    // B2B Shipments
    b2bShipments.forEach(s => {
      if (!s.products || !Array.isArray(s.products)) return;

      const dDate = s.dispatchDate || (s.status === 'Dispatched' ? s.date : null);
      const noPacking = s.isPacked === false;

      s.products.forEach(p => {
        const pDate = p.packedDate || s.packedDate || s.date;
        const dispatchedThisWeek = isTarget(dDate, period);
        const packedThisWeek = !noPacking && isTarget(pDate, period);
        const packedPrevWeek = !noPacking && pDate && !isTarget(pDate, period) && getWeekStr(pDate) < (period || activePeriod);
        let matchQty = 0;
        const pName = p.name || p.productName;
        
        if (compareNames(product.name, pName)) {
          matchQty = Number(p.quantity) || 0;
        } else {
          const parentProduct = stock.find(st => compareNames(st.name, pName) && st.isComposite);
          if (parentProduct) {
            const component = (parentProduct.components || []).find(c => {
              return compareNames(c.name, product.name) || c.productId === product.id;
            });
            if (component) matchQty = (Number(p.quantity) || 0) * (Number(component.quantity) || 1);
          }
        }

        if (matchQty > 0) {
          const viaText = `VIA: ${pName} (QTY: ${p.quantity || 0}, PACK: ${p.packSize || 1})`.toUpperCase();
          const item = { 
            id: `${s.id}-${pName}`, 
            label: s.clientName || s.customerName || 'B2B Order', 
            impact: matchQty, 
            sublabel: `${s.date}${pName !== product.name ? ` (via ${pName})` : ''}`,
            detail: viaText
          };
          
          const dispatchedPrevWeek = dDate && !isTarget(dDate, period) && getWeekStr(dDate) < (period || activePeriod);

          if (dispatchedThisWeek) {
            if (noPacking || packedThisWeek) results.b2bOut.push(item);
            else results.sent.push(item);
          } else if (packedThisWeek && !dispatchedPrevWeek) {
             results.packed.push(item);
          }
        }
      });
    });

    // B2C Shipments
    b2cShipments.filter(s => isTarget(s.date, period)).forEach(s => {
      s.products.forEach(p => {
        const master = stock.find(item => compareNames(item.name, p.name));
        
        let effectivePackSize = Number(p.packSize) || 1;
        const qty = (Number(p.quantity) || 0) * effectivePackSize;
        
        let impact = 0;
        if (compareNames(p.name, product.name)) impact = qty;
        else if (master?.isComposite) {
          const comp = master.components?.find(c => compareNames(c.name, product.name));
          if (comp) {
            let multiplier = Number(comp.quantity) || 1;
            if (effectivePackSize > 1 && multiplier > 1 && effectivePackSize === multiplier) {
               multiplier = 1; 
            }
            impact = qty * multiplier;
          }
        }

        if (impact > 0) {
          const viaText = `VIA: ${p.name} (QTY: ${p.quantity || 0}, PACK: ${p.packSize || 1})`.toUpperCase();
          results.b2cOut.push({
            id: `${s.id}-${p.name}`,
            label: s.channel || 'B2C Order',
            sublabel: s.date,
            detail: viaText,
            impact
          });
        }
      });
    });

    // Other Records
    purchaseRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      results.in.push({ id: r.id, label: `Purchase: ${r.vendorName}`, impact: r.quantity * (r.packSize || 1), color: 'emerald' });
    });
    productionRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      results.in.push({ id: r.id, label: `Mfg: ${r.location}`, impact: r.quantity * (r.packSize || 1), color: 'indigo' });
    });
    returnRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name) && r.isReusable && r.deducted !== false).forEach(r => {
      results.in.push({ id: r.id, label: `Return: ${r.channel}`, impact: r.quantity * (r.packSize || 1), color: 'blue' });
    });
    damageRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      results.adjustments.push({ id: r.id, label: 'Damage/Loss', impact: r.quantity * (r.packSize || 1), color: 'red' });
    });
    qcRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      if (r.rejected) results.adjustments.push({ id: `${r.id}-rej`, label: 'QC Rejected', impact: r.rejected * (r.packSize || 1), color: 'rose' });
      if (r.damaged) results.adjustments.push({ id: `${r.id}-dmg`, label: 'QC Damaged', impact: r.damaged * (r.packSize || 1), color: 'rose' });
    });

    return results;
  };

  const monthlyMovements = useMemo(() => getMovements(activePeriod), [activePeriod, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, stock]);

  const productMovements = useMemo(() => getProductMovements(selectedProductDetails, activePeriod), [selectedProductDetails, activePeriod, b2bShipments, b2cShipments, purchaseRecords, productionRecords, returnRecords, damageRecords, qcRecords, stock]);

  const calculateExpected = (opening, otherIn, purchased, produced, returned, stockDeduction, replacement, damage, rejected, used) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(purchased || 0) + Number(produced || 0) + Number(returned || 0) - Number(stockDeduction || 0) - Number(replacement || 0) - Number(damage || 0) - Number(rejected || 0) - Number(used || 0);

  useEffect(() => {
    if (!monthlyMovements || stock.length === 0) return;
    const sync = async () => {
      stock.forEach(item => {
        if (item.isComposite) return;
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
        const m = prevMovements[product.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, purchased: 0, produced: 0, rejected: 0, replacement: 0, used: 0 };
        const expected = calculateExpected(item.opening, item.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
        const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, dispatched: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
        const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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

  const filteredStock = useMemo(() => {
    return stock
      .filter(item => !item.isComposite && (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))))
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [stock, searchTerm, sortOrder]);

  const analyticsData = useMemo(() => {
    let perfectMatch = [];
    let highDifference = [];
    let notAudited = [];
    
    filteredStock.forEach(item => {
      const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
      const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
      const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
      
      const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
      
      if (physical === null) {
        notAudited.push(item);
      } else {
        const diff = Math.abs(physical - expected);
        if (diff === 0) {
          perfectMatch.push(item);
        } else {
          highDifference.push({ item, diff: physical - expected, absDiff: diff });
        }
      }
    });

    highDifference.sort((a, b) => b.absDiff - a.absDiff);

    return { perfectMatch, highDifference: highDifference.slice(0, 10), notAudited };
  }, [filteredStock, monthlyStockData, activePeriod, monthlyMovements]);

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {/* Accurate Stock */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-64">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-emerald-600">
               <CheckCircle2 size={20} />
               <h3 className="font-bold">Accurate Stock</h3>
             </div>
             <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full">{analyticsData.perfectMatch.length} Items</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-wider font-bold">No Difference (Phys. = Exp.)</p>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-2">
            {analyticsData.perfectMatch.length > 0 ? analyticsData.perfectMatch.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                <span className="font-medium text-slate-700 truncate mr-2">{item.name}</span>
                <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{item.sku || '-'}</span>
              </div>
            )) : <div className="text-center text-slate-400 text-xs py-4">No perfect matches yet</div>}
          </div>
        </div>

        {/* High Discrepancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-64">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-rose-600">
               <AlertTriangle size={20} />
               <h3 className="font-bold">High Discrepancy</h3>
             </div>
             <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-full">{analyticsData.highDifference.length} Items</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-wider font-bold">Largest stock differences</p>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-2">
            {analyticsData.highDifference.length > 0 ? analyticsData.highDifference.map(({item, diff}) => (
              <div key={item.id} className="flex justify-between items-center bg-rose-50/50 p-2 rounded-lg text-xs border border-rose-100">
                <span className="font-medium text-slate-700 truncate mr-2">{item.name}</span>
                <span className={`font-black ${diff < 0 ? 'text-rose-600' : 'text-amber-600'} shrink-0`}>{diff > 0 ? `+${diff}` : diff}</span>
              </div>
            )) : <div className="text-center text-slate-400 text-xs py-4">No discrepancies found</div>}
          </div>
        </div>

        {/* Pending Audit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-64">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-amber-500">
               <Clock size={20} />
               <h3 className="font-bold">Pending Audit</h3>
             </div>
             <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full">{analyticsData.notAudited.length} Items</span>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-wider font-bold">Missing physical count</p>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-2">
            {analyticsData.notAudited.length > 0 ? analyticsData.notAudited.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                <span className="font-medium text-slate-700 truncate mr-2">{item.name}</span>
                <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{item.sku || '-'}</span>
              </div>
            )) : <div className="text-center text-slate-400 text-xs py-4">All items audited</div>}
          </div>
        </div>
      </div>
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

          <div className="flex items-center gap-2 flex-1 sm:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Search SKU..." className="pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-lg text-[10px] md:text-xs outline-none w-full focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0"
              title={sortOrder === 'asc' ? 'Sort Z-A' : 'Sort A-Z'}
            >
              <ArrowRightLeft size={14} className={sortOrder === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
              <span className="text-[10px] font-bold uppercase">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
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
                const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
                      const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                      const expected = calculateExpected(val, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
                          const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
          const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
                      const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
                      const expected = calculateExpected(mData.opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
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
               <div className="flex items-center gap-3">
                 <Layers className="text-indigo-400" size={24}/>
                 <div>
                   <h3 className="text-lg font-bold">Transaction History</h3>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedProductDetails.name} • {activePeriod}</p>
                 </div>
               </div>
               <button onClick={() => setSelectedProductDetails(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Inventory In */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <TrendingUp size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">Inventory In</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.in.map(item => (
                      <li key={item.id} className={`flex justify-between items-center text-xs p-2 bg-${item.color}-50/50 rounded border-l-2 border-${item.color}-400`}>
                        <span className="font-medium text-slate-600">{item.label}</span>
                        <span className={`font-black text-${item.color}-600`}>+{item.impact}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <span>Total In</span>
                    <span className="text-emerald-600">
                      +{ (Number(monthlyStockData.find(d => d.month === activePeriod && d.productId === selectedProductDetails.id)?.in) || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.purchased || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.produced || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.returned || 0) }
                    </span>
                  </div>
                </div>

                {/* Card 2: B2C Out */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-amber-600">
                    <ShoppingCart size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">B2C Shipments</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.b2cOut.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-amber-50/50 rounded border-l-2 border-amber-400">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-black text-amber-600">-{item.impact}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <span>B2C Total</span>
                    <span className="text-amber-600">-{monthlyMovements[selectedProductDetails.id]?.b2cOut || 0}</span>
                  </div>
                </div>

                {/* Card 3: B2B Activity */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-orange-600">
                    <Package size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">B2B Activity (Dispatched)</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.b2bOut.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-orange-50/50 rounded border-l-2 border-orange-400">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-black text-orange-600">-{item.impact}</span>
                      </li>
                    ))}
                    {productMovements.sent.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border-l-2 border-slate-200 opacity-80">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-500">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel} (Prev. Packed)</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-bold text-slate-400">{item.impact}*</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <div className="flex flex-col">
                      <span>B2B Total Deducted</span>
                      <span className="text-[9px] text-slate-400 font-normal">*Prev. packed items not deducted again</span>
                    </div>
                    <span className="text-orange-600">-{monthlyMovements[selectedProductDetails.id]?.b2bOut || 0}</span>
                  </div>
                </div>

                {/* Bottom Row Grid */}
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Packed & Pending */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Packed & Pending</h4>
                    <div className="space-y-4 flex-1">
                      {productMovements.packed.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-amber-50/50 rounded border-l-2 border-amber-300 list-none">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-600">{item.label}</span>
                            <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                            {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                          </div>
                          <span className="font-bold text-amber-600">-{item.impact}</span>
                        </li>
                      ))}
                      {productMovements.onHold.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border-l-2 border-slate-200 opacity-60 list-none">
                          <span className="font-medium text-slate-400">{item.label}</span>
                          <span className="font-bold text-slate-400">-{item.impact}*</span>
                        </li>
                      ))}
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs">
                      <span className="text-slate-400">Reserved (This Week)</span>
                      <span className="text-slate-600">-{monthlyMovements[selectedProductDetails.id]?.packed || 0}</span>
                    </div>
                  </div>

                  {/* Adjustments */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Other Adjustments</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ul className="space-y-2">
                        {productMovements.adjustments.map(item => (
                          <li key={item.id} className={`flex justify-between items-center text-xs p-2 bg-${item.color}-50/50 rounded border-l-2 border-${item.color}-400`}>
                            <span className="font-medium text-slate-600">{item.label}</span>
                            <span className={`font-bold text-${item.color}-600`}>-{item.impact}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Weekly Summary</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span>Total Dispatch</span><span className="font-bold text-slate-700">-{monthlyMovements[selectedProductDetails.id]?.out || 0}</span></div>
                          <div className="flex justify-between"><span>Damage/Other</span><span className="font-bold text-slate-700">-{Number(monthlyMovements[selectedProductDetails.id]?.damage || 0) + Number(monthlyMovements[selectedProductDetails.id]?.rejected || 0) + Number(monthlyMovements[selectedProductDetails.id]?.replacement || 0)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <Button onClick={() => setSelectedProductDetails(null)} variant="secondary" className="w-full md:w-auto">Close History</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyStockCheck;
