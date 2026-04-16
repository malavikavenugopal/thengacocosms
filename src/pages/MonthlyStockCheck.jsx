import React from 'react';
import { Card, Button } from '../components/ui';
import { DownloadCloud, CheckCircle2 } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportToCSV } from '../utils/exportUtils';
import toast from 'react-hot-toast';

const MonthlyStockCheck = () => {
  const { stock, updateSKU } = useGlobalState();

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
        <div className="flex gap-3">
          <Button onClick={handleExport} variant="secondary" className="text-slate-600">
            <DownloadCloud size={18} /> Export
          </Button>
          <Button onClick={handleFinalize} variant="primary" className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/30">
            <CheckCircle2 size={18} /> Finalize Inventory
          </Button>
        </div>
      </div>

      <Card className="px-0 pt-0 pb-0 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-slate-50 border-b border-slate-200 shadow-sm sticky top-0 z-10">
              <tr className="text-xs uppercase tracking-wider text-slate-500 font-semibold backdrop-blur-sm">
                <th className="py-4 px-6">SKU Name</th>
                <th className="py-4 px-6 text-center">Opening Stock</th>
                <th className="py-4 px-6 text-center text-indigo-600">Stock In</th>
                <th className="py-4 px-6 text-center text-emerald-600">Returns</th>
                <th className="py-4 px-6 text-center text-amber-600">Stock Out</th>
                <th className="py-4 px-6 text-center text-red-600">Damage</th>
                <th className="py-4 px-6 text-center bg-slate-100">Expected Stock</th>
                <th className="py-4 px-6 text-center bg-indigo-50/50">Physical Count</th>
                <th className="py-4 px-6 text-center">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stock.map((item) => {
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
                    <td className="py-4 px-6 text-sm font-semibold text-slate-900 border-r border-slate-100">
                      {item.name}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <input 
                        type="number" 
                        className="w-20 mx-auto block px-2 py-1 text-center text-sm border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                        value={item.opening}
                        onChange={(e) => handleStockEdit(item.id, 'opening', e.target.value)}
                      />
                    </td>
                    <td className="py-3 px-6 text-center">
                      <input 
                        type="number" 
                        className="w-20 mx-auto block px-2 py-1 text-center text-sm border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                        value={item.in}
                        onChange={(e) => handleStockEdit(item.id, 'in', e.target.value)}
                      />
                    </td>
                    <td className="py-4 px-6 text-sm text-center text-emerald-600 font-bold">
                      {item.returned || 0}
                    </td>
                    <td className="py-4 px-6 text-sm text-center text-amber-600 font-medium">{item.out}</td>
                    <td className="py-4 px-6 text-sm text-center text-red-600 font-bold">{item.damage}</td>
                    <td className="py-4 px-6 text-sm text-center font-bold bg-slate-50 border-x border-slate-100">
                      {expected}
                    </td>
                    <td className="py-3 px-6 bg-indigo-50/10 border-r border-slate-100">
                      <input
                        type="number"
                        className="w-24 mx-auto block px-3 py-2 text-center text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-sm transition-all bg-white"
                        value={item.physical || ''}
                        onChange={(e) => handlePhysicalChange(item.id, e.target.value)}
                        placeholder="--"
                      />
                    </td>
                    <td className="py-4 px-6 text-sm text-center">
                      {diff !== null ? (
                        <span className={`inline-flex min-w-[3rem] justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                          diff < 0 ? 'bg-red-100 text-red-800' : 
                          diff > 0 ? 'bg-amber-100 text-amber-800' : 
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">-</span>
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
