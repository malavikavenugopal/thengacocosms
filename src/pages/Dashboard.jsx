import React, { useState } from 'react';
import { Card } from '../components/ui';
import { PackageSearch, TrendingUp, AlertOctagon, RotateCcw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';
import { useGlobalState } from '../context/GlobalContext';

const Dashboard = () => {
  const { b2bShipments, b2cShipments, damageRecords, returnRecords } = useGlobalState();
  const [timeFilter, setTimeFilter] = useState('All Time');

  // Filter Data by Date
  const filterByDate = (records) => {
    if (timeFilter === 'All Time') return records;
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;
    
    return records.filter(record => {
      if (!record.date) return false;
      const recordDate = new Date(record.date);
      const diffDays = Math.floor((now - recordDate) / msInDay);
      if (timeFilter === 'Weekly') return diffDays <= 7;
      if (timeFilter === 'Monthly') return diffDays <= 30;
      return true;
    });
  };

  const filteredB2B = filterByDate(b2bShipments);
  const filteredB2C = filterByDate(b2cShipments);
  const filteredDamage = filterByDate(damageRecords);
  const filteredReturns = filterByDate(returnRecords);

  // Calculate totals
  const totalB2B = filteredB2B.reduce((acc, shipment) => 
    acc + shipment.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0), 0
  );

  const totalB2C = filteredB2C.reduce((acc, shipment) => 
    acc + shipment.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0), 0
  );

  const totalDamaged = filteredDamage.reduce((acc, record) => 
    acc + (Number(record.quantity) || 0), 0
  );

  const totalReturns = filteredReturns.reduce((acc, record) => 
    acc + (Number(record.quantity) || 0), 0
  );

  // Generate Line Chart Data (Monthly Aggregation)
  const generateLineData = () => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const aggregated = monthNames.map(name => ({ name, B2B: 0, B2C: 0, Returns: 0 }));
    
    filteredB2B.forEach(s => {
      if (!s.date) return;
      const monthIdx = new Date(s.date).getMonth();
      const qty = s.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      aggregated[monthIdx].B2B += qty;
    });
    
    filteredB2C.forEach(s => {
      if (!s.date) return;
      const monthIdx = new Date(s.date).getMonth();
      const qty = s.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      aggregated[monthIdx].B2C += qty;
    });

    filteredReturns.forEach(r => {
      if (!r.date) return;
      const monthIdx = new Date(r.date).getMonth();
      aggregated[monthIdx].Returns += Number(r.quantity) || 0;
    });
    
    const activeMonths = aggregated.filter(a => a.B2B > 0 || a.B2C > 0 || a.Returns > 0);
    return activeMonths.length > 0 ? activeMonths : [{ name: 'No Data', B2B: 0, B2C: 0, Returns: 0 }];
  };

  // Generate Bar Chart Data (Sales Channels B2C)
  const generateBarData = () => {
    const channels = {};
    filteredB2C.forEach(s => {
      const channel = s.channel || 'Unknown';
      const qty = s.products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
      channels[channel] = (channels[channel] || 0) + qty;
    });
    
    const result = Object.keys(channels).map(name => ({ name, value: channels[name] }));
    return result.length > 0 ? result : [{ name: 'No Data', value: 0 }];
  };

  const generateReturnChannelData = () => {
    const channels = {};
    filteredReturns.forEach(r => {
      const channel = r.channel || 'Unknown';
      channels[channel] = (channels[channel] || 0) + (Number(r.quantity) || 0);
    });
    return Object.keys(channels).map(name => ({ name, value: channels[name] }));
  };

  const lineData = generateLineData();
  const barData = generateBarData();
  const returnChannelData = generateReturnChannelData();

  const PIE_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time metrics of shipments and inventory</p>
        </div>
        <div className="flex items-center">
          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer hover:bg-slate-50"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="All Time">All Time</option>
            <option value="Weekly">Last 7 Days</option>
            <option value="Monthly">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="flex flex-col justify-center hover:shadow-[0_8px_30px_rgba(79,70,229,0.12)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <PackageSearch size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total B2B SKUs</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalB2B.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col justify-center hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total B2C SKUs</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalB2C.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col justify-center hover:shadow-[0_8px_30_rgba(244,63,94,0.12)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <RotateCcw size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Returns</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalReturns.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col justify-center hover:shadow-[0_8px_30px_rgba(239,68,68,0.12)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertOctagon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Damaged</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalDamaged.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Operational Trends</h3>
            <p className="text-sm text-slate-500">B2B vs B2C vs Returns</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="B2B" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} />
                <Line type="monotone" dataKey="B2C" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                <Line type="monotone" dataKey="Returns" stroke="#f43f5e" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: '#f43f5e' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">B2C Sales by Channel</h3>
            <p className="text-sm text-slate-500">Sales volume distribution</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]}>
                   {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Returns by Channel</h3>
            <p className="text-sm text-slate-500">Analyzing platform return rates</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnChannelData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#fdf2f8' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#f43f5e" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#64748b' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
