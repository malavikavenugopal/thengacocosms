import React, { useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { 
  PackageSearch, 
  TrendingUp, 
  AlertOctagon, 
  RotateCcw, 
  ChevronRight, 
  Package, 
  Truck, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus, 
  Clock, 
  ShieldCheck,
  ShoppingBag,
  Store,
  History
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalContext';

const Dashboard = () => {
  const { stock, b2bShipments, b2cShipments, damageRecords, returnRecords } = useGlobalState();
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState('This Month');

  // Utility to filter data based on selected time
  const filteredData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
    
    const filterFn = (items) => {
      if (timeFilter === 'All Time') return items;
      return items.filter(item => item.date && item.date.startsWith(currentMonth));
    };

    return {
      b2b: filterFn(b2bShipments).filter(s => s.deducted !== false),
      b2c: filterFn(b2cShipments),
      damage: filterFn(damageRecords),
      returns: filterFn(returnRecords)
    };
  }, [timeFilter, b2bShipments, b2cShipments, damageRecords, returnRecords]);

  // Calculate stats
  const stats = useMemo(() => {
    const calcUnits = (shipments) => shipments.reduce((acc, s) => 
      acc + (s.products || []).reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.packSize) || 1), 0), 0
    );

    return {
      b2bUnits: calcUnits(filteredData.b2b),
      b2cUnits: calcUnits(filteredData.b2c),
      returnUnits: filteredData.returns.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0),
      damageUnits: filteredData.damage.reduce((acc, d) => acc + (Number(d.quantity) || 0), 0)
    };
  }, [filteredData]);

  // Critical Stock (ROP)
  const criticalItems = useMemo(() => {
    const currentMonthNum = new Date().getMonth();
    const isFirstHalf = currentMonthNum < 6;
    
    return stock
      .filter(s => !s.isComposite)
      .map(item => {
        const rop = isFirstHalf ? (item.ropJanJun || 0) : (item.ropJulDec || 0);
        const current = (Number(item.opening) || 0) + (Number(item.in) || 0) - (Number(item.out) || 0) - (Number(item.damage) || 0);
        return { ...item, current, rop };
      })
      .filter(item => item.current < item.rop)
      .sort((a, b) => a.current - b.current)
      .slice(0, 5);
  }, [stock]);

  // Sales by Channel (B2C)
  const channelSales = useMemo(() => {
    const channels = {};
    filteredData.b2c.forEach(s => {
      const name = s.channel || 'Direct';
      const qty = (s.products || []).reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.packSize) || 1), 0);
      channels[name] = (channels[name] || 0) + qty;
    });
    return Object.entries(channels)
      .map(([name, units]) => ({ name, units }))
      .sort((a, b) => b.units - a.units);
  }, [filteredData.b2c]);

  // Recent Activity
  const recentActivity = useMemo(() => {
    const activities = [
      ...b2bShipments.map(s => ({ type: 'B2B', detail: s.clientName, date: s.date, units: 'Multiple', color: 'bg-indigo-100 text-indigo-700', icon: <Package size={14}/> })),
      ...b2cShipments.map(s => ({ type: 'B2C', detail: s.channel, date: s.date, units: 'Multiple', color: 'bg-emerald-100 text-emerald-700', icon: <ShoppingBag size={14}/> })),
      ...returnRecords.map(r => ({ type: 'Return', detail: r.productName, date: r.date, units: r.quantity, color: 'bg-rose-100 text-rose-700', icon: <RotateCcw size={14}/> }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    return activities;
  }, [b2bShipments, b2cShipments, returnRecords]);

  return (
    <div className="space-y-6 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-indigo-500 text-[10px] font-bold rounded uppercase tracking-widest">Active System</span>
            <span className="text-slate-400 text-xs">• Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Thengacoco Overview</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-md">Operations are healthy. {criticalItems.length} items require reordering attention.</p>
        </div>
        
        <div className="flex items-center gap-3 relative z-10 w-full lg:w-auto">
          <select 
            className="flex-1 lg:flex-none px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="This Month">This Month</option>
            <option value="All Time">All Time</option>
          </select>
          <Button onClick={() => navigate('/b2b')} variant="primary" className="flex-1 lg:flex-none bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40 text-xs h-10 px-6 font-bold"><Plus size={16} className="mr-2" /> New Dispatch</Button>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'B2B Shipments', value: stats.b2bUnits, icon: <Truck />, color: 'indigo', trend: '+12%', sub: 'Total units dispatched' },
          { label: 'B2C Sales', value: stats.b2cUnits, icon: <ShoppingBag />, color: 'emerald', trend: '+8%', sub: 'Online store units' },
          { label: 'Returns Received', value: stats.returnUnits, icon: <RotateCcw />, color: 'rose', trend: '-2%', sub: 'Reusable stock in' },
          { label: 'Damage/Loss', value: stats.damageUnits, icon: <AlertOctagon />, color: 'amber', trend: '+1%', sub: 'Recorded inventory loss' }
        ].map((item, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 bg-${item.color}-50 text-${item.color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
                {React.cloneElement(item.icon, { size: 24, strokeWidth: 2.5 })}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${item.color}-50 text-${item.color}-600 border border-${item.color}-100`}>
                {item.trend}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{item.value.toLocaleString()}</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts & Channels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Critical Stock Alerts */}
          <Card className="p-0 border-rose-100 overflow-hidden shadow-lg shadow-rose-900/5">
            <div className="px-6 py-4 border-b border-rose-50 bg-rose-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-600" size={18} />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Critical Stock Alerts</h3>
              </div>
              <button onClick={() => navigate('/rop')} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">Manage ROP <ChevronRight size={14}/></button>
            </div>
            <div className="p-4 space-y-3">
              {criticalItems.length > 0 ? criticalItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-rose-200 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shrink-0 font-bold text-slate-400 text-xs">
                      {item.sku?.substring(0, 2) || 'SK'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Current: <span className="text-rose-600">{item.current}</span> / Target: {item.rop}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.max(10, (item.current / item.rop) * 100)}%` }}></div>
                    </div>
                    <span className="text-[10px] font-black text-rose-600 uppercase">Order Now</span>
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center">
                  <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full mb-2"><ShieldCheck size={24}/></div>
                  <p className="text-sm font-bold text-slate-900">All Stock Levels Healthy</p>
                  <p className="text-xs text-slate-400">All active SKUs are above their reorder points.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Channel Performance List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6">
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                  <Store size={20} />
                  <h3 className="font-bold text-slate-900 uppercase tracking-tight text-sm">B2C Channel Ranking</h3>
                </div>
                <div className="space-y-5">
                   {channelSales.length > 0 ? channelSales.map((ch, idx) => (
                     <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-end">
                           <span className="text-xs font-bold text-slate-700">{ch.name}</span>
                           <span className="text-xs font-black text-slate-900">{ch.units.toLocaleString()} units</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-indigo-600 rounded-full" 
                             style={{ width: `${(ch.units / channelSales[0].units) * 100}%` }}
                           ></div>
                        </div>
                     </div>
                   )) : <p className="text-xs text-slate-400 text-center py-4">No B2C shipments this month.</p>}
                </div>
             </Card>

             <Card className="p-6 bg-slate-50 border-slate-200">
                <h3 className="font-bold text-slate-900 uppercase tracking-tight text-sm mb-4">Quick Shortcuts</h3>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { label: 'SKU Master', path: '/products', icon: <Package size={16}/>, color: 'bg-white' },
                     { label: 'Stock Audit', path: '/stock', icon: <Clock size={16}/>, color: 'bg-white' },
                     { label: 'Reports', path: '/reports', icon: <TrendingUp size={16}/>, color: 'bg-white' },
                     { label: 'Staff Info', path: '/staff', icon: <Plus size={16}/>, color: 'bg-white' }
                   ].map((btn, i) => (
                     <button 
                       key={i}
                       onClick={() => navigate(btn.path)}
                       className={`${btn.color} p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 text-center group`}
                     >
                       <div className="p-2 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">{btn.icon}</div>
                       <span className="text-[10px] font-bold text-slate-700">{btn.label}</span>
                     </button>
                   ))}
                </div>
             </Card>
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="space-y-6">
           <Card className="p-0 border-slate-200 shadow-sm h-full">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <History className="text-slate-400" size={18} />
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Recent Activity</h3>
                </div>
              </div>
              <div className="p-2 space-y-1">
                 {recentActivity.map((act, idx) => (
                   <div key={idx} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                      <div className={`p-2 rounded-lg ${act.color} group-hover:scale-110 transition-transform`}>
                         {act.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                         <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-slate-900 truncate">{act.detail}</p>
                            <span className="text-[9px] text-slate-400 font-medium">{act.date}</span>
                         </div>
                         <p className="text-[10px] text-slate-500 font-medium">
                           {act.type} • {act.units} {typeof act.units === 'number' ? 'units' : 'Record'}
                         </p>
                      </div>
                      <ArrowUpRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                 ))}
                 <button 
                  onClick={() => navigate('/reports')}
                  className="w-full py-4 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors mt-2"
                >
                  View Full Operations Log
                </button>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
