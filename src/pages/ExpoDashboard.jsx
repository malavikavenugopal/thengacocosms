import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Table, Button, Select } from '../components/ui';
import { useGlobalState } from '../context/GlobalContext';
import { Store, Package, RotateCcw, ShoppingBag, Eye, Download, Filter, Calendar as CalendarIcon, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { exportFormattedGeneric } from '../utils/exportUtils';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const ExpoDashboard = () => {
  const { stock, b2cShipments, b2bShipments, returnRecords, deleteB2CShipment, deleteB2BShipment, deleteReturnRecord, channels, updateChannel, updateB2CShipment, updateReturnRecord } = useGlobalState();
  const navigate = useNavigate();
  
  // Filters
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days for Expo
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [expoType, setExpoType] = useState('B2C'); // 'B2C' or 'B2B'
  const [selectedB2BClient, setSelectedB2BClient] = useState('');

  // Set default channel to 'Expo' or the first one containing 'expo'
  useEffect(() => {
    if (!selectedChannel && channels.length > 0) {
      const found = channels.find(c => c.name.toLowerCase().includes('expo'));
      setSelectedChannel(found ? found.name : channels[0].name);
    }
  }, [channels, selectedChannel]);

  // Calculate Expo Stats
  const expoData = useMemo(() => {
    const summary = {};

    // Helper to check date range
    const isWithinRange = (dateStr) => {
      if (!dateStr) return false;
      const date = new Date(dateStr);
      const start = filterStartDate ? new Date(filterStartDate) : null;
      const end = filterEndDate ? new Date(filterEndDate) : null;
      
      if (start && end) return date >= start && date <= end;
      if (start) return date >= start;
      if (end) return date <= end;
      return true;
    };

    if (expoType === 'B2C') {
      if (!selectedChannel) return [];

      const channelLower = selectedChannel.toLowerCase();

      // 1. Process Stock Taken to Expo (Recorded as B2C Shipments with selected channel)
      b2cShipments.forEach(s => {
        if (s.channel?.toLowerCase() === channelLower && isWithinRange(s.date)) {
          (s.products || []).forEach(p => {
            const master = stock.find(item => item.name === p.name);
            const packSize = Number(p.packSize) || Number(master?.packSize) || 1;
            const totalUnits = (Number(p.quantity) || 0) * packSize;

            if (!summary[p.name]) {
              summary[p.name] = { name: p.name, sku: master?.sku || 'N/A', taken: 0, returned: 0 };
            }
            summary[p.name].taken += totalUnits;
          });
        }
      });

      // 2. Process Stock Returned from Expo (Returns with selected channel)
      returnRecords.forEach(r => {
        if (r.channel?.toLowerCase() === channelLower && isWithinRange(r.date)) {
          const master = stock.find(item => item.name === r.productName);
          const packSize = Number(r.packSize) || Number(master?.packSize) || 1;
          const totalUnits = (Number(r.quantity) || 0) * packSize;

          if (!summary[r.productName]) {
            summary[r.productName] = { name: r.productName, sku: master?.sku || 'N/A', taken: 0, returned: 0 };
          }
          summary[r.productName].returned += totalUnits;
        }
      });
    } else {
      if (!selectedB2BClient) return [];

      const clientLower = selectedB2BClient.toLowerCase();

      // Process B2B Shipments
      const hasExpoB2BShipments = b2bShipments.some(s => s.isExpo);
      b2bShipments.forEach(s => {
        const matchesExpo = hasExpoB2BShipments ? s.isExpo : true;
        if (matchesExpo && s.clientName?.toLowerCase() === clientLower && isWithinRange(s.date)) {
          (s.products || []).forEach(p => {
            const master = stock.find(item => item.name === p.name);
            const packSize = Number(p.packSize) || Number(master?.packSize) || 1;
            const totalUnits = (Number(p.quantity) || 0) * packSize;

            if (!summary[p.name]) {
              summary[p.name] = { name: p.name, sku: master?.sku || 'N/A', taken: 0, returned: 0 };
            }
            summary[p.name].taken += totalUnits;
          });
        }
      });

      // Process Returns for B2B (assuming channel field might contain client name)
      returnRecords.forEach(r => {
        if (r.channel?.toLowerCase() === clientLower && isWithinRange(r.date)) {
          const master = stock.find(item => item.name === r.productName);
          const packSize = Number(r.packSize) || Number(master?.packSize) || 1;
          const totalUnits = (Number(r.quantity) || 0) * packSize;

          if (!summary[r.productName]) {
            summary[r.productName] = { name: r.productName, sku: master?.sku || 'N/A', taken: 0, returned: 0 };
          }
          summary[r.productName].returned += totalUnits;
        }
      });
    }

    // Calculate Actual Sold
    const dataArray = Object.values(summary).map(p => ({
      ...p,
      sold: p.taken - p.returned
    }));

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return dataArray.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.sku.toLowerCase().includes(term)
      );
    }

    return dataArray.sort((a, b) => a.name.localeCompare(b.name));
  }, [b2cShipments, b2bShipments, returnRecords, stock, filterStartDate, filterEndDate, searchTerm, selectedChannel, selectedB2BClient, expoType]);

  // Calculate totals for cards
  const totals = useMemo(() => {
    return expoData.reduce((acc, curr) => {
      acc.taken += curr.taken;
      acc.returned += curr.returned;
      acc.sold += curr.sold;
      return acc;
    }, { taken: 0, returned: 0, sold: 0 });
  }, [expoData]);

  // Get all individual records for the bottom table
  const expoRecords = useMemo(() => {
    const records = [];
    
    if (expoType === 'B2C') {
      if (!selectedChannel) return [];
      const channelLower = selectedChannel.toLowerCase();

      b2cShipments.forEach(s => {
        if (s.channel?.toLowerCase() === channelLower) {
          records.push({
            id: s.id,
            date: s.date,
            type: 'Taken',
            details: (s.products || []).map(p => `${p.name} (${p.quantity})`).join(', '),
            raw: s
          });
        }
      });

      returnRecords.forEach(r => {
        if (r.channel?.toLowerCase() === channelLower) {
          records.push({
            id: r.id,
            date: r.date,
            type: 'Returned',
            details: `${r.productName} (${r.quantity})`,
            raw: r
          });
        }
      });
    } else {
      if (!selectedB2BClient) return [];
      const clientLower = selectedB2BClient.toLowerCase();

      const hasExpoB2BShipments = b2bShipments.some(s => s.isExpo);
      b2bShipments.forEach(s => {
        const matchesExpo = hasExpoB2BShipments ? s.isExpo : true;
        if (matchesExpo && s.clientName?.toLowerCase() === clientLower) {
          records.push({
            id: s.id,
            date: s.date,
            type: 'Taken',
            details: (s.products || []).map(p => `${p.name} (${p.quantity})`).join(', '),
            raw: s
          });
        }
      });

      returnRecords.forEach(r => {
        if (r.channel?.toLowerCase() === clientLower) {
          records.push({
            id: r.id,
            date: r.date,
            type: 'Returned',
            details: `${r.productName} (${r.quantity})`,
            raw: r
          });
        }
      });
    }

    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [b2cShipments, b2bShipments, returnRecords, selectedChannel, selectedB2BClient, expoType]);

  const handleExport = () => {
    if (expoData.length === 0) {
      toast.error('No data to export');
      return;
    }
    const selectedName = expoType === 'B2C' ? selectedChannel : selectedB2BClient;
    const displayName = selectedName || 'Expo';
    const sanitizedName = displayName.replace(/[\s\(\)]+/g, '_');

    exportFormattedGeneric(
      expoData.map(p => ({
        'SKU': p.sku,
        'Product Name': p.name,
        'Qty Taken': p.taken,
        'Qty Returned': p.returned,
        'Actual Sold': p.sold
      })),
      `${sanitizedName}_Dashboard`,
      `${sanitizedName}_Dashboard_${filterStartDate}_to_${filterEndDate}.xlsx`
    );
    toast.success('Exporting Dashboard...');
  };

  const handleDelete = (record) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete this ${record.type} record?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        if (record.type === 'Taken') {
          if (expoType === 'B2C') {
            deleteB2CShipment(record.id);
          } else {
            deleteB2BShipment(record.id);
          }
          toast.success('Record deleted successfully');
        } else if (record.type === 'Returned') {
          deleteReturnRecord(record.id);
          toast.success('Record deleted successfully');
        }
      }
    });
  };

  const handleEdit = (record) => {
    if (record.type === 'Taken') {
      if (expoType === 'B2C') {
        navigate(`/b2c?edit=${record.id}`);
      } else {
        navigate(`/b2b?edit=${record.id}`);
      }
    } else if (record.type === 'Returned') {
      navigate(`/returns?edit=${record.id}&tab=returns`);
    }
  };

  const handleRenameChannel = async () => {
    if (!selectedChannel) return;

    const { value: newName } = await Swal.fire({
      title: 'Rename Channel & Update Records',
      text: `This will rename '${selectedChannel}' and update all associated B2C shipments and Returns to the new name.`,
      input: 'text',
      inputValue: selectedChannel,
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      inputValidator: (value) => {
        if (!value) return 'You need to enter a name!';
        if (value === selectedChannel) return 'Enter a different name!';
      }
    });

    if (newName) {
      setIsRenaming(true);
      const toastId = toast.loading('Updating channel and historical records...');
      try {
        const channelObj = channels.find(c => c.name === selectedChannel);
        if (channelObj) {
          await updateChannel(channelObj.id, newName);
        }

        // Update B2C Shipments
        const b2cToUpdate = b2cShipments.filter(s => s.channel === selectedChannel);
        for (const s of b2cToUpdate) {
          await updateB2CShipment(s.id, { ...s, channel: newName });
        }

        // Update Returns
        const returnsToUpdate = returnRecords.filter(r => r.channel === selectedChannel);
        for (const r of returnsToUpdate) {
          await updateReturnRecord(r.id, { ...r, channel: newName });
        }

        toast.success(`Renamed to '${newName}' and updated ${b2cToUpdate.length + returnsToUpdate.length} records!`, { id: toastId });
        setSelectedChannel(newName);
      } catch (error) {
        console.error(error);
        toast.error('Failed to update records', { id: toastId });
      } finally {
        setIsRenaming(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Store size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Expo Dashboard</h2>
            <p className="text-sm text-slate-500">Track stock taken, returned, and sold during exhibitions</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select 
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer font-bold text-slate-700"
              value={expoType === 'B2C' ? `B2C:${selectedChannel}` : `B2B:${selectedB2BClient}`}
              onChange={e => {
                const parts = e.target.value.split(':');
                if (parts.length < 2) return;
                const type = parts[0];
                const val = parts.slice(1).join(':');
                if (type === 'B2C') {
                  setExpoType('B2C');
                  setSelectedChannel(val);
                  setSelectedB2BClient('');
                } else if (type === 'B2B') {
                  setExpoType('B2B');
                  setSelectedB2BClient(val);
                  setSelectedChannel('');
                }
              }}
              disabled={isRenaming}
            >
              <option value="">Select Channel / B2B Client</option>
              
              <optgroup label="B2C Retail Channels">
                {[...channels].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={`B2C:${c.name}`} value={`B2C:${c.name}`}>{c.name}</option>
                ))}
              </optgroup>

              <optgroup label="B2B Expo Clients">
                {(() => {
                  const expoClients = Array.from(new Set(b2bShipments.filter(s => s.isExpo).map(s => s.clientName).filter(Boolean)));
                  const list = expoClients.length > 0 ? expoClients : Array.from(new Set(b2bShipments.map(s => s.clientName).filter(Boolean)));
                  return list.sort((a, b) => a.localeCompare(b)).map(client => (
                    <option key={`B2B:${client}`} value={`B2B:${client}`}>{client}</option>
                  ));
                })()}
              </optgroup>
            </select>
            
            {expoType === 'B2C' && (
              <button
                onClick={handleRenameChannel}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shrink-0"
                title="Rename Channel and Update Records"
                disabled={!selectedChannel || isRenaming}
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="date" 
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                title="Start Date"
                disabled={isRenaming}
              />
            </div>
            <span className="text-slate-400 text-xs">-</span>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="date" 
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                title="End Date"
                disabled={isRenaming}
              />
            </div>
          </div>
          
          <Button onClick={handleExport} variant="success" className="shadow-sm h-9" loading={isRenaming}>
            <Download size={14} className="mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm flex items-start gap-2">
        <Filter size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Dashboard Logic (for selected {expoType === 'B2C' ? 'channel' : 'B2B client'}: <span className="text-indigo-700">{expoType === 'B2C' ? selectedChannel : selectedB2BClient}</span>):</p>
          <div className="text-xs mt-1 space-y-1">
            {expoType === 'B2C' ? (
              <>
                <p>• <strong>Taken to Expo:</strong> Quantity recorded in B2C Shipments with Channel = '{selectedChannel}'.</p>
                <p>• <strong>Returned:</strong> Quantity recorded in Returns with Channel = '{selectedChannel}'.</p>
                <p>• <strong>Actual Sold:</strong> Calculated as `Taken - Returned`.</p>
              </>
            ) : (
              <>
                <p>• <strong>Taken to Expo:</strong> Quantity recorded in B2B Shipments with Client Name = '{selectedB2BClient}' and marked as Expo.</p>
                <p>• <strong>Returned:</strong> Quantity recorded in Returns with Channel = '{selectedB2BClient}'.</p>
                <p>• <strong>Actual Sold:</strong> Calculated as `Taken - Returned`.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-indigo-100 bg-indigo-50/30">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Package size={20} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Taken</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{totals.taken.toLocaleString()}</h3>
          <p className="text-[10px] text-slate-500 mt-1">Units recorded as sent/sold to Expo</p>
        </Card>

        <Card className="p-5 border-rose-100 bg-rose-50/30">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <RotateCcw size={20} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Returned</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{totals.returned.toLocaleString()}</h3>
          <p className="text-[10px] text-slate-500 mt-1">Units brought back</p>
        </Card>

        <Card className="p-5 border-emerald-100 bg-emerald-50/30">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <ShoppingBag size={20} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual Sold</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{totals.sold.toLocaleString()}</h3>
          <p className="text-[10px] text-slate-500 mt-1">Taken - Returned</p>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Package size={18} className="text-slate-400" />
            Product Breakdown
            <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
               {expoData.length} Products
            </span>
          </h3>
          
          <div className="w-full md:w-64">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Search Product or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none placeholder:text-slate-300"
                disabled={isRenaming}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table headers={['SKU', 'Product Name', 'Taken', 'Returned', 'Actual Sold']}>
            {expoData.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-12 text-center text-slate-400">
                  No data found for the selected period or channel.
                </td>
              </tr>
            ) : (
              expoData.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 text-sm font-mono text-slate-600">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold">{p.sku}</span>
                  </td>
                  <td className="py-4 px-6 text-sm font-semibold text-slate-900">{p.name}</td>
                  <td className="py-4 px-6 text-sm font-bold text-indigo-600">{p.taken.toLocaleString()}</td>
                  <td className="py-4 px-6 text-sm font-bold text-rose-600">{p.returned.toLocaleString()}</td>
                  <td className="py-4 px-6 text-sm">
                    <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${p.sold === 0 ? 'bg-slate-100 text-slate-600' : p.sold > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {p.sold.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </Table>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-slate-400" />
            Expo Transactions
            <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
               {expoRecords.length} Records
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">Individual records contributing to the totals above</p>
        </div>

        <div className="overflow-x-auto">
          <Table headers={['Date', 'Type', 'Details', 'Actions']}>
            {expoRecords.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-12 text-center text-slate-400">
                  No transaction records found for this channel.
                </td>
              </tr>
            ) : (
              expoRecords.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-slate-800 whitespace-nowrap">{r.date}</td>
                  <td className="py-4 px-6 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.type === 'Taken' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600 font-medium">{r.details}</td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEdit(r)}
                        className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Record"
                        disabled={isRenaming}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(r)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Record"
                        disabled={isRenaming}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ExpoDashboard;
