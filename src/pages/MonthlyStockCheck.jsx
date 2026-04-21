import React, { useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, CheckCircle2, Calendar, ArrowRightLeft } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportToCSV } from '../utils/exportUtils';
import toast from 'react-hot-toast';

const MonthlyStockCheck = () => {
  const { 
    stock, 
    b2bShipments, 
    b2cShipments, 
    damageRecords, 
    returnRecords, 
    monthlyStockData,
    saveMonthlyStock 
  } = useGlobalState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate dynamic sums for the selected month
  const monthlyMovements = useMemo(() => {
    const sums = {};
    
    // Initialize sums for all active products
    stock.forEach(item => {
      if (!item.isComposite) {
        sums[item.name] = { out: 0, returned: 0, damage: 0 };
      }
    });

    // Helper to check if a date string matches the selected month
    const isThisMonth = (dateStr) => dateStr && dateStr.startsWith(selectedMonth);

    // Sum Out (B2B)
    b2bShipments.filter(s => isThisMonth(s.date)).forEach(s => {
      s.products.forEach(p => {
        if (sums[p.name]) sums[p.name].out += (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      });
    });

    // Sum Out (B2C)
    b2cShipments.filter(s => isThisMonth(s.date)).forEach(s => {
      s.products.forEach(p => {
        if (sums[p.name]) sums[p.name].out += (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      });
    });

    // Sum Damage
    damageRecords.filter(r => isThisMonth(r.date)).forEach(r => {
      if (sums[r.productName]) sums[r.productName].damage += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    // Sum Returns (Only if reusable/sellable as per context)
    returnRecords.filter(r => isThisMonth(r.date) && r.isReusable).forEach(r => {
      if (sums[r.productName]) sums[r.productName].returned += (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
    });

    return sums;
  }, [selectedMonth, b2bShipments, b2cShipments, damageRecords, returnRecords, stock]);

  const calculateExpected = (opening, production, returned, out, damage) => 
    Number(opening || 0) + Number(production || 0) + Number(returned || 0) - Number(out || 0) - Number(damage || 0);

  const handleFinalize = () => {
    toast.success(`Inventory state for ${selectedMonth} finalized!`);
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

    const toastId = toast.loading(`Carrying forward closing balances from ${prevMonthStr}...`);
    let count = 0;

    try {
      for (const item of prevMonthData) {
        // Carry forward "Physical" count from last month to "Opening" of this month
        if (item.physical !== undefined && item.physical !== '') {
          await saveMonthlyStock(selectedMonth, item.productId, { 
            opening: Number(item.physical) 
          });
          count++;
        }
      }
      toast.success(`Successfully carried forward ${count} opening balances!`, { id: toastId });
    } catch (err) {
      toast.error('Failed to carry forward data', { id: toastId });
    }
  };
  
  const handleExport = () => {
    const dataToExport = stock
      .filter(item => !item.isComposite)
      .map(item => {
        const mData = monthlyStockData.find(d => d.month === selectedMonth && d.productId === item.id) || {};
        const movements = monthlyMovements[item.name] || { out: 0, returned: 0, damage: 0 };
        
        const expected = calculateExpected(
          mData.opening, 
          mData.in, 
          movements.returned, 
          movements.out, 
          movements.damage
        );
        const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : 0;
        
        return {
          SKU_Code: item.sku,
          SKU_Name: item.name,
          Month: selectedMonth,
          Opening: mData.opening || 0,
          Production: mData.in || 0,
          'Returned Items': movements.returned,
          Dispatch: movements.out,
          Damage: movements.damage,
          Expected: expected,
          Physical: physical,
          Difference: physical - expected
        };
      });
    
    exportToCSV(dataToExport, `stock_check_${selectedMonth}.csv`);
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
            <Button onClick={handleCarryForward} variant="secondary" className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex-1 sm:flex-none" title="Carry forward last month's closing as this month's opening">
              <ArrowRightLeft size={18} /> Carry Forward
            </Button>
            <Button onClick={handleExport} variant="secondary" className="text-slate-600 flex-1 sm:flex-none">
              <DownloadCloud size={18} /> Export
            </Button>
            <Button onClick={handleFinalize} variant="primary" className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/30 flex-1 sm:flex-none">
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
                <th className="py-4 px-2 text-center bg-slate-100/50">Expected</th>
                <th className="py-4 px-2 text-center bg-indigo-50/50">Physical</th>
                <th className="py-4 px-4 text-center">Diff</th>
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
                  const movements = monthlyMovements[item.name] || { out: 0, returned: 0, damage: 0 };
                  
                  const expected = calculateExpected(
                    mData.opening, 
                    mData.in, 
                    movements.returned, 
                    movements.out, 
                    movements.damage
                  );
                  
                  const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
                  const diff = physical !== null ? physical - expected : null;
                  
                  let rowBg = "hover:bg-slate-50/50";
                  if (diff !== null) {
                    if (diff < 0) rowBg = "bg-red-50/40 hover:bg-red-50/60";
                    else if (diff > 0) rowBg = "bg-amber-50/40 hover:bg-amber-50/60";
                    else rowBg = "bg-emerald-50/40 hover:bg-emerald-50/60";
                  }

                  return (
                    <tr key={item.id} className={`transition-colors duration-200 ${rowBg}`}>
                      <td className="py-4 px-4 text-sm border-r border-slate-100 leading-tight">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-tighter">{item.sku || '-'}</span>
                          <span className="font-semibold text-slate-900">{item.name}</span>
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
                      <td className="py-3 px-1 text-center">
                        <input 
                          type="number" 
                          className="w-16 mx-auto block px-1 py-1 text-center text-sm border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all bg-white"
                          value={mData.in || ''}
                          onChange={(e) => saveMonthlyStock(selectedMonth, item.id, { in: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="0"
                        />
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
        <div className="ml-auto text-[10px] text-slate-400 italic font-medium">* Formula: Expected = Opening + Stock In + Returns - Out - Damage</div>
      </div>
    </div>
  );
};

export default MonthlyStockCheck;
