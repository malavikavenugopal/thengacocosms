import React, { useState } from 'react';
import { Card, Input, Table, Button } from '../components/ui';
import { AlertCircle, AlertTriangle, CheckCircle, Package, Search, Settings2, BarChart3, TrendingDown, Info } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';

const ReorderPoint = () => {
    const { stock, b2bShipments, b2cShipments, updateSKU } = useGlobalState();
    const [searchTerm, setSearchTerm] = useState('');
    const [editMode, setEditMode] = useState(false);

    const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    // Filter out composite products as ROP usually applies to solo components
    const products = stock
        .filter(s => !s.isComposite)
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const getCurrentMonth = () => new Date().getMonth(); // 0-11
    const isFirstHalf = getCurrentMonth() < 6; // Jan-Jun

    const getMonthlyConsumption = (productName) => {
        const consumption = Array(12).fill(0);
        const currentYear = new Date().getFullYear();
        
        const processShipments = (shipments) => {
            shipments.forEach(s => {
                if (!s.date) return;
                // Handle both YYYY-MM-DD (standard) and potentially DD-MM-YYYY
                const parts = s.date.split('-');
                let y, m;
                if (parts[0].length === 4) {
                    y = parseInt(parts[0]);
                    m = parseInt(parts[1]);
                } else if (parts[2]?.length === 4) {
                    y = parseInt(parts[2]);
                    m = parseInt(parts[1]);
                } else return;

                if (y === currentYear && m >= 1 && m <= 12) {
                    s.products?.forEach(p => {
                        if (p.name === productName) {
                            consumption[m - 1] += (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
                        }
                    });
                }
            });
        };

        processShipments(b2bShipments || []);
        processShipments(b2cShipments || []);
        return consumption;
    };

    const handleUpdateField = (id, field, value) => {
        updateSKU(id, { [field]: Number(value) || 0 });
    };

    return (
        <div className="space-y-6">
            {/* Header ... */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Reorder Point (ROP) Planning</h2>
                    <p className="text-sm text-slate-500">Manage safety stocks, lead times, and replenishment alerts</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button 
                        variant={editMode ? "primary" : "secondary"}
                        onClick={() => setEditMode(!editMode)}
                        className="flex items-center gap-2"
                    >
                        <Settings2 size={18} />
                        {editMode ? 'Exit Plan Mode' : 'Planning Mode'}
                    </Button>
                </div>
            </div>

            {/* Metrics Overview ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-rose-50 border-rose-100 font-sans">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                            <TrendingDown size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Critical Shortage</p>
                            <p className="text-2xl font-black text-rose-900">
                                {products.filter(p => {
                                    const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                                    const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                                    return totalStock < activeROP;
                                }).length} Items
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-indigo-50 border-indigo-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Active Season</p>
                            <p className="text-2xl font-black text-indigo-900">
                                {isFirstHalf ? 'JAN - JUN' : 'JUL - DEC'}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Stock Health</p>
                            <p className="text-2xl font-black text-emerald-900">
                                {Math.round((products.length - products.filter(p => {
                                    const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                                    const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                                    return totalStock < activeROP;
                                }).length) / (products.length || 1) * 100)}%
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="px-0 pt-0 pb-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[180px]">Product</th>
                                {monthsShort.map(m => (
                                    <th key={m} className="py-4 px-2 text-center text-[9px]">{m}</th>
                                ))}
                                <th className="py-4 px-3 text-center border-l border-slate-200">LT</th>
                                <th className="py-4 px-3 text-center">SS</th>
                                <th className="py-4 px-3 text-center bg-indigo-50/30 text-indigo-700">ROP 1</th>
                                <th className="py-4 px-3 text-center bg-indigo-50/30 text-indigo-700">ROP 2</th>
                                <th className="py-4 px-3 text-center border-l border-slate-200">Stock</th>
                                <th className="py-4 px-3 text-center">Status</th>
                                <th className="py-4 px-3 text-center">Needed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(p => {
                                const activeROP = isFirstHalf ? (p.ropJanJun || 0) : (p.ropJulDec || 0);
                                const totalStock = (Number(p.in) || 0) + (Number(p.returned) || 0) - (Number(p.out) || 0) - (Number(p.damage) || 0);
                                const isLow = totalStock < activeROP;
                                const shortage = isLow ? activeROP - totalStock : 0;
                                const monthly = getMonthlyConsumption(p.name);

                                return (
                                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isLow ? 'bg-rose-50/30' : ''}`}>
                                        <td className="py-4 px-6 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <span className="text-xs font-bold text-slate-900 block truncate w-40" title={p.name}>{p.name}</span>
                                            <span className="text-[9px] font-mono font-bold text-slate-400">{p.sku || '-'}</span>
                                        </td>
                                        
                                        {monthly.map((val, idx) => (
                                            <td key={idx} className="py-4 px-1 text-center text-[11px] font-medium text-slate-500">
                                                {val > 0 ? val : '-'}
                                            </td>
                                        ))}

                                        <td className="py-2 px-2 border-l border-slate-100">
                                            {editMode ? (
                                                <input 
                                                    type="number" 
                                                    className="w-12 px-1 py-1 border border-slate-200 rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    value={p.leadTime || 0}
                                                    onChange={(e) => handleUpdateField(p.id, 'leadTime', e.target.value)}
                                                />
                                            ) : (
                                                <span className="text-xs font-medium text-slate-600 block text-center">{p.leadTime || 0}</span>
                                            )}
                                        </td>

                                        <td className="py-2 px-2 text-center text-xs">
                                            {editMode ? (
                                                <input 
                                                    type="number" 
                                                    className="w-14 px-1 py-1 border border-slate-200 rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    value={p.safetyStock || 0}
                                                    onChange={(e) => handleUpdateField(p.id, 'safetyStock', e.target.value)}
                                                />
                                            ) : (
                                                <span className="text-slate-600">{p.safetyStock || 0}</span>
                                            )}
                                        </td>

                                        <td className="py-2 px-2 bg-indigo-50/10">
                                            {editMode ? (
                                                <input 
                                                    type="number" 
                                                    className={`w-16 px-1 py-1 border rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none ${isFirstHalf ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`}
                                                    value={p.ropJanJun || 0}
                                                    onChange={(e) => handleUpdateField(p.id, 'ropJanJun', e.target.value)}
                                                />
                                            ) : (
                                                <span className={`text-xs block text-center font-bold ${isFirstHalf ? 'text-indigo-600' : 'text-slate-400'}`}>{p.ropJanJun || 0}</span>
                                            )}
                                        </td>

                                        <td className="py-2 px-2 bg-indigo-50/10">
                                            {editMode ? (
                                                <input 
                                                    type="number" 
                                                    className={`w-16 px-1 py-1 border rounded text-[11px] text-center focus:ring-1 focus:ring-indigo-500 outline-none ${!isFirstHalf ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`}
                                                    value={p.ropJulDec || 0}
                                                    onChange={(e) => handleUpdateField(p.id, 'ropJulDec', e.target.value)}
                                                />
                                            ) : (
                                                <span className={`text-xs block text-center font-bold ${!isFirstHalf ? 'text-indigo-600' : 'text-slate-400'}`}>{p.ropJulDec || 0}</span>
                                            )}
                                        </td>

                                        <td className="py-4 px-3 border-l border-slate-100 text-center">
                                            <span className={`text-sm font-black ${isLow ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                                                {totalStock}
                                            </span>
                                        </td>

                                        <td className="py-4 px-3">
                                            {isLow ? (
                                                <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-tighter">
                                                    ORDER
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-tighter">
                                                    OK
                                                </div>
                                            )}
                                        </td>

                                        <td className="py-4 px-3 text-center">
                                            {shortage > 0 ? (
                                                <span className="text-xs font-black text-rose-600">+{shortage}</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 flex items-start gap-4 text-white shadow-2xl shadow-indigo-500/10">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl flex-shrink-0">
                    <Info size={20} />
                </div>
                <div className="text-sm">
                    <p className="font-bold text-indigo-300 mb-1">Consumption History & ROP Strategy:</p>
                    <p className="text-slate-400">The historical consumption shown in the JAN-DEC columns is calculated based on your total <strong>Dispatch (Out)</strong> across all channels. Use this data to adjust your <strong>ROP 1 (Jan-Jun)</strong> and <strong>ROP 2 (Jul-Dec)</strong> seasonal targets. Setting accurate Lead Times (LT) ensures the status correctly flags <span className="text-rose-400 font-bold italic">"ORDER NOW"</span> before you hit zero.</p>
                </div>
            </div>
        </div>
    );
};

export default ReorderPoint;
