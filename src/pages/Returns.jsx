import React, { useState } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, RotateCcw, Save, Lock, Edit2, X, ShoppingCart, History, Search } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';
import { generateVisualReport } from '../utils/visualReportUtils';
import { exportFormattedGeneric } from '../utils/exportUtils';
import { Filter, Download, FileSpreadsheet, Box } from 'lucide-react';

const Returns = () => {
  const { 
    stock, channels, b2bShipments, 
    returnRecords, addReturnRecord, updateReturnRecord, deleteReturnRecord, 
    replacementRecords, addReplacementRecord, updateReplacementRecord, deleteReplacementRecord,
    drafts, updateDraft, clearDraft, getAvailableStock 
  } = useGlobalState();
  
  const [activeTab, setActiveTab] = useState('returns');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    channel: '',
    search: ''
  });

  // Return Form State
  const [formData, setFormData] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const saved = drafts.return;
    return {
      productName: saved?.productName || '',
      quantity: saved?.quantity || '',
      channel: saved?.channel || '',
      date: saved?.date || defaultDate,
      reason: saved?.reason || '',
      condition: saved?.condition || 'Good (Reuse)'
    };
  });

  // Replacement Form State
  const [repForm, setRepForm] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const saved = drafts.replacement;
    return {
      type: saved?.type || 'B2C',
      orderId: saved?.orderId || '',
      channel: saved?.channel || '',
      products: saved?.products || [{ id: Date.now(), name: '', quantity: '' }],
      date: saved?.date || defaultDate,
      reason: saved?.reason || '',
      manualName: saved?.manualName || ''
    };
  });

  // Sync drafts
  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('return', formData);
    }
  }, [formData, isEditing]);

  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('replacement', repForm);
    }
  }, [repForm, isEditing]);

  const filteredReturns = returnRecords
    .filter(r => {
      const matchDate = (!filters.startDate || r.date >= filters.startDate) && 
                      (!filters.endDate || r.date <= filters.endDate);
      const matchChannel = !filters.channel || r.channel === filters.channel;
      const matchSearch = !filters.search || r.productName.toLowerCase().includes(filters.search.toLowerCase());
      return matchDate && matchChannel && matchSearch;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredReplacements = replacementRecords
    .filter(r => {
      const matchDate = (!filters.startDate || r.date >= filters.startDate) && 
                      (!filters.endDate || r.date <= filters.endDate);
      const matchChannel = !filters.channel || (r.type === 'B2C' ? r.channel === filters.channel : true);
      const matchSearch = !filters.search || (r.products || []).some(p => p.name.toLowerCase().includes(filters.search.toLowerCase())) || (r.productName && r.productName.toLowerCase().includes(filters.search.toLowerCase()));
      return matchDate && matchChannel && matchSearch;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleDownloadReport = () => {
    if (activeTab === 'returns') {
      generateVisualReport(filteredReturns, 'Return', 'Inventory Returns Report', filters);
    } else {
      generateVisualReport(filteredReplacements, 'Replacement', 'Inventory Replacement Report', filters);
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'returns') {
      exportFormattedGeneric(filteredReturns, 'Returns_Report', `Returns_${filters.startDate}_to_${filters.endDate}.xlsx`);
    } else {
      exportFormattedGeneric(filteredReplacements, 'Replacements_Report', `Replacements_${filters.startDate}_to_${filters.endDate}.xlsx`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    const defaultDate = new Date().toISOString().split('T')[0];
    if (activeTab === 'returns') {
      setFormData({
        productName: '',
        quantity: '',
        channel: '',
        date: defaultDate,
        reason: '',
        condition: 'Good (Reuse)'
      });
    } else {
      setRepForm({
        type: 'B2C',
        orderId: '',
        channel: '',
        products: [{ id: Date.now(), name: '', quantity: '' }],
        date: defaultDate,
        reason: '',
        manualName: ''
      });
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const newRecord = {
      ...formData,
      isReusable: formData.condition === 'Good (Reuse)' || formData.condition === 'Recovered (From Rejected)',
      isDamaged: formData.condition === 'Damaged (Waste)',
      isFromRejected: formData.condition === 'Recovered (From Rejected)',
      id: Date.now()
    };

    let confirmText = '';
    if (formData.condition === 'Recovered (From Rejected)') {
      confirmText = `Record for ${formData.quantity} units recovered from Rejected stock. Apply stock in?`;
    } else if (newRecord.isReusable) {
      confirmText = `Record for ${formData.quantity} reusable units. Apply stock change?`;
    } else {
      confirmText = `Record for ${formData.quantity} damaged units. History only (No stock change).`;
    }

    Swal.fire({
      title: isEditing ? 'Update Log?' : 'Log Entry?',
      text: confirmText,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Confirm',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      
      setIsSubmitting(true);
      try {
        if (isEditing) {
          await updateReturnRecord(editingId, newRecord, newRecord.isReusable);
          toast.success('Return updated!');
        } else {
          await addReturnRecord(newRecord, newRecord.isReusable);
          toast.success(newRecord.isReusable ? 'Return logged & Stock adjusted!' : 'Return logged.');
          clearDraft('return');
        }
        handleCancel();
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleRepSubmit = async (e) => {
    e.preventDefault();

    const productSummary = repForm.products.map(p => `${p.quantity}x ${p.name}`).join(', ');
    Swal.fire({
      title: 'Confirm Replacement?',
      text: `Deduct ${productSummary} from inventory for this replacement?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Yes, Deduct Stock',
      cancelButtonText: 'Log Only'
    }).then(async (result) => {
      setIsSubmitting(true);
      try {
        if (isEditing) {
          await updateReplacementRecord(editingId, repForm, result.isConfirmed);
          toast.success('Replacement updated!');
        } else {
          await addReplacementRecord({ ...repForm, id: Date.now() }, result.isConfirmed);
          toast.success(result.isConfirmed ? 'Replacement logged & Stock deducted!' : 'Replacement logged.');
          clearDraft('replacement');
        }
        handleCancel();
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleEdit = (record, tab) => {
    setIsEditing(true);
    setEditingId(record.id);
    setActiveTab(tab);
    if (tab === 'returns') {
      setFormData({
        productName: record.productName,
        quantity: record.quantity,
        channel: record.channel,
        date: record.date,
        reason: record.reason || '',
        condition: record.isFromRejected ? 'Recovered (From Rejected)' : (record.isReusable ? 'Good (Reuse)' : 'Damaged (Waste)')
      });
    } else {
      setRepForm({
        type: record.type,
        orderId: record.orderId || '',
        channel: record.channel || '',
        products: record.products || [{ id: Date.now(), name: record.productName, quantity: record.quantity }],
        date: record.date,
        reason: record.reason || '',
        manualName: record.manualName || ''
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle edit from URL params
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    const tab = params.get('tab') || 'returns';
    if (editId && returnRecords.length > 0) {
      const record = returnRecords.find(r => r.id === editId);
      if (record) {
        handleEdit(record, tab);
        // Clear the param so it doesn't trigger again on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [returnRecords]);

  const handleDelete = (record, tab) => {
    Swal.fire({
      title: 'Delete Record?',
      text: "This will revert any stock changes associated with this entry.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
      if (result.isConfirmed) {
        if (tab === 'returns') await deleteReturnRecord(record.id);
        else await deleteReplacementRecord(record.id);
        toast.success('Record deleted.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Tab Switcher (Matching DamageTracking design) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <RotateCcw size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Returns & Replacements</h2>
            <p className="text-sm text-slate-500">Manage product returns and exchange shipments</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
           <button 
             onClick={() => setActiveTab('returns')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'returns' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <RotateCcw size={16} /> Returns Log
           </button>
           <button 
             onClick={() => setActiveTab('replacements')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'replacements' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <ShoppingCart size={16} /> Replacements
           </button>
        </div>
      </div>

      {/* Form Section */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'returns' ? (
          <Card className="border-emerald-100 bg-emerald-50/30">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <RotateCcw size={18} />
                {isEditing ? 'Edit Return Record' : 'Log a New Return'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>
            
            <form onSubmit={handleReturnSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <SearchableSelect 
                  label="Product / SKU" 
                  options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name}`)} 
                  value={formData.productName ? stock.find(s => s.name === formData.productName) ? `[${stock.find(s => s.name === formData.productName).sku || 'N/A'}] ${formData.productName}` : '' : ''}
                  onChange={(val) => {
                    const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name}` === val)?.name;
                    setFormData({...formData, productName: selectedName || ''});
                  }}
                  required
                />
                <Input 
                  label="Quantity" 
                  type="number" 
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  required
                />
                <Select 
                  label="Condition" 
                  options={['Good (Reuse)', 'Damaged (Waste)', 'Recovered (From Rejected)']}
                  value={formData.condition}
                  onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  required
                />
                <SearchableSelect 
                  label="From Channel" 
                  options={channels.map(c => c.name)} 
                  value={formData.channel}
                  onChange={(val) => setFormData({...formData, channel: val})}
                  required
                />
                <Input 
                  label="Return Date" 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-end justify-between bg-white/40 p-4 rounded-xl border border-emerald-100/50">
                <div className="flex-1 w-full">
                  <Input 
                    label="Reason for Return" 
                    placeholder="e.g. Broken in transit, Customer changed mind" 
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  />
                </div>
                <div className="flex gap-3">
                  {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
                  <Button type="submit" className="px-8 bg-emerald-600 hover:bg-emerald-700" loading={isSubmitting}>
                    <Save size={18} className="mr-2" /> {isEditing ? 'Update Log' : 'Save Return Log'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="border-indigo-100 bg-indigo-50/30">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 font-bold">
                <ShoppingCart size={18} />
                {isEditing ? 'Edit Replacement Record' : 'Process New Replacement'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>

            <form onSubmit={handleRepSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select 
                  label="Replacement Type" 
                  options={['B2C', 'B2B']}
                  value={repForm.type}
                  onChange={(e) => setRepForm({...repForm, type: e.target.value, orderId: '', channel: ''})}
                />
                {repForm.type === 'B2B' ? (
                  <div className="flex flex-col gap-2">
                    <SearchableSelect 
                      label="Select B2B Order" 
                      options={['Manual Entry (Enter Name)', ...b2bShipments.slice(0, 50).map(s => `${s.clientName} - ${s.date} (#${s.id.toString().slice(-4)})`)]}
                      value={repForm.orderId === 'manual' ? 'Manual Entry (Enter Name)' : repForm.orderId ? b2bShipments.find(s => s.id === repForm.orderId) ? `${b2bShipments.find(s => s.id === repForm.orderId).clientName} - ${b2bShipments.find(s => s.id === repForm.orderId).date} (#${repForm.orderId.toString().slice(-4)})` : '' : ''}
                      onChange={(val) => {
                        if (val === 'Manual Entry (Enter Name)') {
                          setRepForm({...repForm, orderId: 'manual'});
                        } else {
                          const selected = b2bShipments.find(s => `${s.clientName} - ${s.date} (#${s.id.toString().slice(-4)})` === val);
                          setRepForm({...repForm, orderId: selected?.id || '', manualName: ''});
                        }
                      }}
                      required
                    />
                    {repForm.orderId === 'manual' && (
                      <Input 
                        label="Client Name (Manual)" 
                        placeholder="Enter client name"
                        value={repForm.manualName}
                        onChange={(e) => setRepForm({...repForm, manualName: e.target.value})}
                        required
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <SearchableSelect 
                      label="B2C Channel" 
                      options={['Others (Manual Entry)', ...channels.map(c => c.name)]} 
                      value={repForm.channel === 'manual' ? 'Others (Manual Entry)' : repForm.channel}
                      onChange={(val) => {
                        if (val === 'Others (Manual Entry)') {
                          setRepForm({...repForm, channel: 'manual'});
                        } else {
                          setRepForm({...repForm, channel: val, manualName: ''});
                        }
                      }}
                      required
                    />
                    {repForm.channel === 'manual' && (
                      <Input 
                        label="Customer / Order Info" 
                        placeholder="Enter name or order ID"
                        value={repForm.manualName}
                        onChange={(e) => setRepForm({...repForm, manualName: e.target.value})}
                        required
                      />
                    )}
                  </div>
                )}
                <Input 
                  label="Replacement Date" 
                  type="date"
                  value={repForm.date}
                  onChange={(e) => setRepForm({...repForm, date: e.target.value})}
                  required
                />
              </div>

              <div className="border-t border-indigo-100 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Products to Send</h4>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setRepForm({...repForm, products: [...repForm.products, { id: Date.now(), name: '', quantity: '' }]})}
                    className="text-indigo-600 hover:bg-indigo-100/50"
                  >
                    <Plus size={16} className="mr-1" /> Add Product
                  </Button>
                </div>
                <div className="space-y-3">
                  {repForm.products.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white/40 p-3 rounded-lg border border-indigo-50 relative group">
                      <div className="md:col-span-8">
                        <SearchableSelect 
                          label={idx === 0 ? "Product to Send" : ""} 
                          options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name}`)} 
                          value={p.name ? stock.find(s => s.name === p.name) ? `[${stock.find(s => s.name === p.name).sku || 'N/A'}] ${p.name}` : '' : ''}
                          onChange={(val) => {
                            const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name}` === val)?.name;
                            const newProducts = [...repForm.products];
                            newProducts[idx].name = selectedName || '';
                            setRepForm({...repForm, products: newProducts});
                          }}
                          required
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input 
                          label={idx === 0 ? "Quantity" : ""} 
                          type="number" 
                          min="1"
                          value={p.quantity}
                          onChange={(e) => {
                            const newProducts = [...repForm.products];
                            newProducts[idx].quantity = e.target.value;
                            setRepForm({...repForm, products: newProducts});
                          }}
                          required
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end pb-2">
                        <button 
                          type="button" 
                          onClick={() => setRepForm({...repForm, products: repForm.products.filter(item => item.id !== p.id)})}
                          disabled={repForm.products.length === 1}
                          className="p-2 text-rose-300 hover:text-rose-500 disabled:opacity-0 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-end justify-between bg-white/40 p-4 rounded-xl border border-indigo-100/50">
                <div className="flex-1 w-full">
                  <Input 
                    label="Reason for Replacement" 
                    placeholder="e.g. Previous item damaged, Wrong SKU sent" 
                    value={repForm.reason}
                    onChange={(e) => setRepForm({...repForm, reason: e.target.value})}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
                  <Button type="submit" className="px-8 bg-indigo-600 hover:bg-indigo-700" loading={isSubmitting}>
                    <Save size={18} className="mr-2" /> {isEditing ? 'Update Replacement' : 'Process Replacement'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        )}
      </div>

      {/* History & Filter Section */}
      <Card>
        <div className="mb-6 flex flex-col lg:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
            <History size={18} className="text-slate-400" />
            {activeTab === 'returns' ? 'Return Records' : 'Replacement Records'}
            <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
               {activeTab === 'returns' ? filteredReturns.length : filteredReplacements.length} Total
            </span>
          </h3>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="relative flex-1 sm:min-w-[200px]">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                type="text" 
                placeholder="Search Product..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
               />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input 
                type="date" 
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                title="End Date"
              />
            </div>
            <select 
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
              value={filters.channel}
              onChange={e => setFilters(f => ({ ...f, channel: e.target.value === 'All Channels' ? '' : e.target.value }))}
            >
              <option>All Channels</option>
              {channels.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
              <Button variant="ghost" size="sm" onClick={handleDownloadReport} className="text-slate-600 h-8">
                <Download size={14} className="mr-1" /> Report
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportExcel} className="text-slate-600 h-8">
                <FileSpreadsheet size={14} className="mr-1" /> Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          {activeTab === 'returns' ? (
            <Table headers={['Date', 'Type', 'Adjusted?', 'Channel', 'Product', 'Qty', 'Reason', 'Action']}>
              {filteredReturns.length === 0 ? (
                <tr><td colSpan="8" className="py-12 text-center text-slate-400">No return records found.</td></tr>
              ) : (
                filteredReturns.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-600">{r.date}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.isFromRejected ? 'bg-amber-100 text-amber-800' : 
                        (r.isReusable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')
                      }`}>
                        {r.isFromRejected ? 'REJECTED -> STOCK' : (r.isReusable ? 'RESTOCK' : 'DAMAGED')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {r.deducted !== false ? (
                        <span className="text-[10px] font-bold text-emerald-600 italic">YES (+{r.quantity})</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">LOG ONLY</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm font-semibold text-slate-900">{r.channel}</td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-indigo-500 italic">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                        <span className="font-medium text-slate-900">{r.productName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-emerald-600">+{r.quantity}</td>
                    <td className="py-4 px-6 text-sm text-slate-500 max-w-xs truncate">{r.reason || '-'}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(r, 'returns')} className="p-1 text-indigo-400 hover:text-indigo-600 shadow-sm rounded p-1 hover:bg-indigo-50"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(r, 'returns')} className="p-1 text-slate-400 hover:text-rose-600 shadow-sm rounded p-1 hover:bg-rose-50"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          ) : (
            <Table headers={['Date', 'Target', 'Adjusted?', 'Product', 'Qty', 'Reason', 'Action']}>
              {filteredReplacements.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400">No replacement records found.</td></tr>
              ) : (
                filteredReplacements.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-600">{r.date}</td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase">{r.type}</span>
                        <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                          {r.type === 'B2B' 
                            ? (r.orderId === 'manual' ? r.manualName : (b2bShipments.find(s => s.id === r.orderId)?.clientName || 'B2B Order'))
                            : (r.channel === 'manual' ? r.manualName : r.channel)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {r.deducted ? (
                        <span className="text-[10px] font-bold text-rose-600 italic uppercase tracking-tighter">YES (Deducted)</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">LOG ONLY</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm" colSpan="2">
                      <div className="flex flex-col gap-1 max-w-[250px]">
                        {(r.products || [{ name: r.productName, quantity: r.quantity }]).map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            <span className="font-medium text-slate-700 truncate flex-1">{p.name}</span>
                            <span className="font-bold text-rose-600 whitespace-nowrap">-{p.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500 max-w-xs truncate">{r.reason || '-'}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(r, 'replacements')} className="p-1 text-indigo-400 hover:text-indigo-600 shadow-sm rounded p-1 hover:bg-indigo-50"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(r, 'replacements')} className="p-1 text-slate-400 hover:text-rose-600 shadow-sm rounded p-1 hover:bg-rose-50"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Returns;
