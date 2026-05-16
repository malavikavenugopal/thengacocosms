import * as React from 'react';
import { Card, Input, Table, Button } from '../components/ui';
import { AlertCircle, AlertTriangle, CheckCircle, Package, Search, Settings2, BarChart3, TrendingDown, Info, Download, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportFormattedROP } from '../utils/exportUtils';

const ReorderPoint = () => {
    const { stock = [], b2bShipments = [], b2cShipments = [], updateSKU } = useGlobalState();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [editMode, setEditMode] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [sortOrder, setSortOrder] = React.useState('asc'); // 'asc' or 'desc'

    const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const currentMonthNum = new Date().getMonth();
    const isFirstHalf = currentMonthNum < 6;

    const products = React.useMemo(() => {
        return stock
            .filter(s => !s.isComposite)
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const comparison = a.name.localeCompare(b.name);
                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [stock, searchTerm, sortOrder]);

    const getMonthlyConsumption = (productName) => {
        const consumption = Array(12).fill(0);
        const currentYear = new Date().getFullYear();
        const processShipments = (shipQueue) => {
            if (!shipQueue) return;
            shipQueue.forEach(s => {
                if (!s.date) return;
                const parts = s.date.split('-');
                let y, m;
                if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]); }
                else if (parts[2]?.length === 4) { y = parseInt(parts[2]); m = parseInt(parts[1]); }
                else return;
                if (y === currentYear && m >= 1 && m <= 12) {
                    s.products?.forEach(p => {
                        if (p.name === productName) {
                            consumption[m - 1] += (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
                        }
                    });
                }
            });
        };
        processShipments(b2bShipments);
        processShipments(b2cShipments);
        return consumption;
    };

    const handleUpdateField = (id, field, value) => {
        updateSKU(id, { [field]: Number(value) || 0 });
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const dataToExport = products.map(p => {
                const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                const isLow = totalStock < activeROP;
                const shortageAmt = isLow ? activeROP - totalStock : 0;
                const monthly = getMonthlyConsumption(p.name);
                return { ...p, monthly, totalStock, isLow, shortageAmt, isFirstHalf };
            });
            exportFormattedROP(dataToExport, 'ROP', `ROP_Planning_${new Date().toISOString().split('T')[0]}.xlsx`);
        } finally { setIsExporting(false); }
    };

    const stats = React.useMemo(() => {
        const critical = products.filter(p => {
            const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
            const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
            return totalStock < activeROP;
        }).length;
        return { critical, health: Math.round((products.length - critical) / (products.length || 1) * 100) };
    }, [products, isFirstHalf]);

    return (
        <div className="space-y-6 pb-20 md:pb-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="min-w-fit">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">ROP Planning</h2>
                    <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider font-medium">Seasonal Safety Stock & Lead Times</p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto">
                    <Button variant="success" onClick={handleExport} className="col-span-2 sm:col-auto flex items-center justify-center gap-2 h-10 px-4 text-xs font-bold" loading={isExporting}><Download size={16} /> Download Report</Button>
                    <div className="flex items-center gap-2 flex-1 sm:min-w-[200px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Search SKU..." className="pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-lg text-xs outline-none w-full focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="px-3 h-10 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0"
                            title={sortOrder === 'asc' ? 'Sort Z-A' : 'Sort A-Z'}
                        >
                            <ArrowRight size={16} className={sortOrder === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            <span className="text-[10px] font-bold uppercase">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
                        </button>
                    </div>
                    <Button variant={editMode ? "primary" : "secondary"} onClick={() => setEditMode(!editMode)} className="flex items-center justify-center gap-2 h-10 px-4 text-xs font-bold"><Settings2 size={16} /> {editMode ? 'Finish' : 'Edit Plan'}</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-rose-50 border-rose-100 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown size={20} /></div>
                        <div><p className="text-[9px] font-bold text-rose-600 uppercase">Critical</p><p className="text-xl font-black text-rose-900 leading-none">{stats.critical} Items</p></div>
                    </div>
                </Card>
                <Card className="bg-indigo-50 border-indigo-100 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><BarChart3 size={20} /></div>
                        <div><p className="text-[9px] font-bold text-indigo-600 uppercase">Active Season</p><p className="text-xl font-black text-indigo-900 leading-none">{isFirstHalf ? 'JAN - JUN' : 'JUL - DEC'}</p></div>
                    </div>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle size={20} /></div>
                        <div><p className="text-[9px] font-bold text-emerald-600 uppercase">Health</p><p className="text-xl font-black text-emerald-900 leading-none">{stats.health}%</p></div>
                    </div>
                </Card>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
                <div className="overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-slate-200">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 min-w-[180px]">Product Name / SKU</th>
                                {monthsShort.map(m => (<th key={m} className="py-4 px-1 text-center font-mono">{m}</th>))}
                                <th className="py-4 px-3 text-center border-l border-slate-200">LT</th>
                                <th className="py-4 px-3 text-center">SS</th>
                                <th className="py-4 px-3 text-center bg-indigo-50/30 text-indigo-700">ROP 1</th>
                                <th className="py-4 px-3 text-center bg-indigo-50/30 text-indigo-700">ROP 2</th>
                                <th className="py-4 px-3 text-center border-l border-slate-200">Stock</th>
                                <th className="py-4 px-3 text-center">Status</th>
                                <th className="py-4 px-3 text-center">Need</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(p => {
                                const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                                const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                                const isLow = totalStock < activeROP;
                                const shortageAmt = isLow ? activeROP - totalStock : 0;
                                const monthly = getMonthlyConsumption(p.name);
                                return (
                                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${isLow ? 'bg-rose-50/30' : ''}`}>
                                        <td className="py-4 px-6 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <span className="text-xs font-bold text-slate-900 block truncate w-40" title={p.name}>{p.name}</span>
                                            <span className="text-[9px] font-mono font-bold text-slate-400">{p.sku || 'NO SKU'}</span>
                                        </td>
                                        {monthly.map((val, idx) => (<td key={idx} className="py-4 px-1 text-center text-[10px] font-medium text-slate-500">{val > 0 ? val : '-'}</td>))}
                                        <td className="py-2 px-2 border-l border-slate-100 text-center">
                                            {editMode ? (<input type="number" className="w-12 px-1 py-1 border border-slate-200 rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none" value={p.leadTime || 0} onChange={(e) => handleUpdateField(p.id, 'leadTime', e.target.value)} />) : (<span className="text-xs font-medium text-slate-600">{p.leadTime || 0}</span>)}
                                        </td>
                                        <td className="py-2 px-2 text-center text-xs">
                                            {editMode ? (<input type="number" className="w-14 px-1 py-1 border border-slate-200 rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none" value={p.safetyStock || 0} onChange={(e) => handleUpdateField(p.id, 'safetyStock', e.target.value)} />) : (<span className="text-slate-600">{p.safetyStock || 0}</span>)}
                                        </td>
                                        <td className="py-2 px-2 bg-indigo-50/10 text-center">
                                            {editMode ? (<input type="number" className={`w-16 px-1 py-1 border rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none ${isFirstHalf ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`} value={p.ropJanJun || 0} onChange={(e) => handleUpdateField(p.id, 'ropJanJun', e.target.value)} />) : (<span className={`text-xs font-bold ${isFirstHalf ? 'text-indigo-600' : 'text-slate-400'}`}>{p.ropJanJun || 0}</span>)}
                                        </td>
                                        <td className="py-2 px-2 bg-indigo-50/10 text-center">
                                            {editMode ? (<input type="number" className={`w-16 px-1 py-1 border rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none ${!isFirstHalf ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`} value={p.ropJulDec || 0} onChange={(e) => handleUpdateField(p.id, 'ropJulDec', e.target.value)} />) : (<span className={`text-xs font-bold ${!isFirstHalf ? 'text-indigo-600' : 'text-slate-400'}`}>{p.ropJulDec || 0}</span>)}
                                        </td>
                                        <td className="py-4 px-3 border-l border-slate-100 text-center"><span className={`text-sm font-black ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>{totalStock}</span></td>
                                        <td className="py-4 px-3 text-center">
                                            {isLow ? (<div className="inline-flex px-2 py-0.5 rounded-full bg-rose-600 text-white text-[8px] font-black uppercase">ORDER</div>) : (<div className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase">HEALTHY</div>)}
                                        </td>
                                        <td className="py-4 px-3 text-center">{shortageAmt > 0 ? (<span className="text-[11px] font-black text-rose-600">+{shortageAmt}</span>) : (<span className="text-slate-300">-</span>)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile & Tablet Card List View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(p => {
                    const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                    const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                    const isLow = totalStock < activeROP;
                    const shortageAmt = isLow ? activeROP - totalStock : 0;
                    return (
                        <div key={p.id} className={`bg-white rounded-2xl border ${isLow ? 'border-rose-200 shadow-rose-50 shadow-lg' : 'border-slate-200'} overflow-hidden`}>
                            <div className="p-4 bg-slate-50 flex justify-between items-start border-b border-slate-100">
                                <div>
                                    <span className="text-[9px] font-bold text-indigo-600 uppercase">{p.sku || 'No SKU'}</span>
                                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{p.name}</h3>
                                </div>
                                {isLow ? (<span className="px-2 py-1 bg-rose-600 text-white text-[8px] font-black rounded-lg uppercase">Action Needed</span>) : (<span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[8px] font-black rounded-lg uppercase">Healthy</span>)}
                            </div>
                            
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold flex items-center gap-1"><TrendingDown size={10}/> Stock Availability</span>
                                    <div className="flex items-baseline gap-1"><span className={`text-xl font-black ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>{totalStock}</span><span className="text-[10px] text-slate-400 font-medium">/ {activeROP} ROP</span></div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold flex items-center gap-1"><Clock size={10}/> Lead Time</span>
                                    <div className="flex items-center gap-2">
                                        {editMode ? (<input type="number" className="w-16 px-2 py-1 text-sm font-bold bg-slate-100 border border-slate-200 rounded-lg outline-none" value={p.leadTime || 0} onChange={(e) => handleUpdateField(p.id, 'leadTime', e.target.value)} />) : (<span className="text-sm font-bold text-slate-700">{p.leadTime || 0} Days</span>)}
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col"><span className="text-[8px] text-slate-400 uppercase font-bold">Safety Stock</span><span className="text-xs font-bold text-slate-700">{p.safetyStock || 0}</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] text-slate-400 uppercase font-bold">Shortage</span><span className={`text-xs font-bold ${shortageAmt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{shortageAmt > 0 ? `+${shortageAmt}` : '-'}</span></div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col text-right"><span className="text-[8px] text-slate-400 uppercase font-bold">ROP Target</span><span className="text-xs font-bold text-indigo-600">{activeROP}</span></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-4 bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-800 flex items-start gap-4 text-white shadow-xl">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl flex-shrink-0"><Info size={20} /></div>
                <div className="text-[11px] md:text-sm">
                    <p className="font-bold text-indigo-300 mb-1">Reorder Point (ROP) Strategy:</p>
                    <p className="text-slate-400 leading-relaxed">This tool alerts you when current stock levels drop below your safety targets. "ORDER NOW" flags indicate you need to restock based on your defined Lead Time and Safety Stock settings.</p>
                </div>
            </div>
        </div>
    );
};

export default ReorderPoint;
