import React from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportToCSV } from '../utils/exportUtils';
import toast from 'react-hot-toast';
import { useState } from 'react';

const MonthlyStockCheck = () => {
  const { stock, updateSKU } = useGlobalState();
  const [searchTerm, setSearchTerm] = useState('');

  const calculateExpected = (item) => 
    Number(item.opening || 0) + 
    Number(item.in || 0) + 
    Number(item.returned || 0) - 
    Number(item.out || 0) - 
    Number(item.damage || 0);

  const handleFinalize = () => {
    toast.success('Inventory state finalized and saved!');
  };
  
  const handleExport = () => {
    const dataToExport = stock.map(item => {
      const expected = calculateExpected(item);
      const physical = item.physical !== undefined && item.physical !== '' ? Number(item.physical) : 0;
      const diff = physical - expected;
      
      return {
        SKU: item.name,
        Opening: item.opening,
        Production: item.in,
        'Returned Items': item.returned || 0,
        Dispatch: item.out,
        Damage: item.damage,
        Expected: expected,
        Physical: physical,
        Difference: diff
      };
    });
    
    exportToCSV(dataToExport, `stock_check_${new Date().toISOString().split('T')[0]}.csv`);
  };
  
  const handlePhysicalChange = async (id, value) => {
    await updateSKU(id, { physical: value });
  };

  const handleStockEdit = async (id, field, value) => {
    await updateSKU(id, { [field]: value === '' ? 0 : Number(value) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Stock Check</h2>
          <p className="text-sm text-slate-500 mt-1">Reconcile physical inventory against system records</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search SKU or name..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-full sm:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
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
        <div className="w-full">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 shadow-sm sticky top-0 z-10">
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold backdrop-blur-sm">
                <th className="py-4 px-4 w-1/4">SKU Name</th>
                <th className="py-4 px-2 text-center">Opening</th>
                <th className="py-4 px-2 text-center text-indigo-600">Stock In</th>
                <th className="py-4 px-2 text-center text-emerald-600">Returns</th>
                <th className="py-4 px-2 text-center text-amber-600">Out</th>
                <th className="py-4 px-2 text-center text-red-600">Damage</th>
                <th className="py-4 px-2 text-center bg-slate-100">Expected</th>
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
                const expected = calculateExpected(item);
                const physical = item.physical !== undefined && item.physical !== '' ? Number(item.physical) : null;
                const diff = physical !== null ? physical - expected : null;
                
                let rowBg = "hover:bg-slate-50";
                
                if (diff !== null) {
                  if (diff < 0) {
                    rowBg = "bg-red-50 hover:bg-red-100/80";
                  } else if (diff > 0) {
                    rowBg = "bg-amber-50 hover:bg-amber-100/80";
                  } else {
                    rowBg = "bg-emerald-50 hover:bg-emerald-100/80";
                  }
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
                        className="w-16 mx-auto block px-1 py-1 text-center text-sm border-slate-200 rounded focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                        value={item.opening}
                        onChange={(e) => handleStockEdit(item.id, 'opening', e.target.value)}
                      />
                    </td>
                    <td className="py-3 px-1 text-center">
                      <input 
                        type="number" 
                        className="w-16 mx-auto block px-1 py-1 text-center text-sm border-slate-200 rounded focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                        value={item.in}
                        onChange={(e) => handleStockEdit(item.id, 'in', e.target.value)}
                      />
                    </td>
                    <td className="py-4 px-2 text-sm text-center text-emerald-600 font-bold">
                      {item.returned || 0}
                    </td>
                    <td className="py-4 px-2 text-sm text-center text-amber-600 font-medium">{item.out}</td>
                    <td className="py-4 px-2 text-sm text-center text-red-600 font-bold">{item.damage}</td>
                    <td className="py-4 px-2 text-sm text-center font-bold bg-slate-50 border-x border-slate-100">
                      {expected}
                    </td>
                    <td className="py-3 px-2 bg-indigo-50/10 border-r border-slate-100">
                      <input
                        type="number"
                        className="w-20 mx-auto block px-2 py-1.5 text-center text-sm border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all bg-white"
                        value={item.physical || ''}
                        onChange={(e) => handlePhysicalChange(item.id, e.target.value)}
                        placeholder="--"
                      />
                    </td>
                    <td className="py-4 px-4 text-sm text-center">
                      {diff !== null ? (
                        <span className={`inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          diff < 0 ? 'bg-red-100 text-red-800' : 
                          diff > 0 ? 'bg-amber-100 text-amber-800' : 
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="flex gap-4 text-xs font-medium text-gray-500 justify-center sm:justify-start">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> Negative Diff (Missing)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Positive Diff (Excess)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500"></div> Matched (Perfect)</div>
      </div>
    </div>
  );
};

export default MonthlyStockCheck;
