import React, { useState } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, RotateCcw, Save, Lock, Edit2, X, ShoppingCart, History } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';
import { generateVisualReport } from '../utils/visualReportUtils';
import { exportFormattedGeneric } from '../utils/exportUtils';
import { Filter, Download, FileSpreadsheet } from 'lucide-react';

const Returns = () => {
  const { 
    stock, channels, b2bShipments, 
    returnRecords, addReturnRecord, updateReturnRecord, deleteReturnRecord, 
    replacementRecords, addReplacementRecord, updateReplacementRecord, deleteReplacementRecord,
    drafts, updateDraft, clearDraft 
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
    product: ''
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
      productName: saved?.productName || '',
      quantity: saved?.quantity || '',
      date: saved?.date || defaultDate,
      reason: saved?.reason || ''
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
      const matchProduct = !filters.product || r.productName === filters.product;
      return matchDate && matchChannel && matchProduct;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredReplacements = replacementRecords
    .filter(r => {
      const matchDate = (!filters.startDate || r.date >= filters.startDate) && 
                      (!filters.endDate || r.date <= filters.endDate);
      const matchChannel = !filters.channel || (r.type === 'B2C' ? r.channel === filters.channel : true);
      const matchProduct = !filters.product || r.productName === filters.product;
      return matchDate && matchChannel && matchProduct;
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
        productName: '',
        quantity: '',
        date: defaultDate,
        reason: ''
      });
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const newRecord = {
      ...formData,
      isReusable: formData.condition === 'Good (Reuse)',
      isDamaged: formData.condition === 'Damaged (Waste)',
      id: Date.now()
    };

    const confirmText = newRecord.isReusable 
      ? `Record for ${formData.quantity} reusable units. Apply stock change?`
      : `Record for ${formData.quantity} damaged units. History only (No stock change).`;

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
    Swal.fire({
      title: 'Confirm Replacement?',
      text: `Deduct ${repForm.quantity} units of ${repForm.productName} from inventory for this replacement?`,
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
        condition: record.isReusable ? 'Good (Reuse)' : 'Damaged (Waste)'
      });
    } else {
      setRepForm({
        type: record.type,
        orderId: record.orderId || '',
        channel: record.channel || '',
        productName: record.productName,
        quantity: record.quantity,
        date: record.date,
        reason: record.reason || ''
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Returns & Replacements</h2>
          <p className="text-slate-500 text-sm">Manage product returns and exchange shipments</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('returns')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
              activeTab === 'returns' 
              ? 'bg-emerald-600 text-white shadow-emerald-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RotateCcw size={18} />
            Returns Log
          </button>
          <button
            onClick={() => setActiveTab('replacements')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${
              activeTab === 'replacements' 
              ? 'bg-indigo-600 text-white shadow-indigo-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart size={18} />
            Replacements
          </button>
        </div>
      </div>

      <Card className="mb-8 border-slate-200/60 shadow-sm overflow-visible">
        <div className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Start Date</label>
            <Input 
              type="date" 
              value={filters.startDate} 
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">End Date</label>
            <Input 
              type="date" 
              value={filters.endDate} 
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Channel</label>
            <Select 
              options={['All Channels', ...channels.map(c => c.name)]}
              value={filters.channel}
              onChange={val => setFilters(f => ({ ...f, channel: val === 'All Channels' ? '' : val }))}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Product</label>
            <SearchableSelect 
              options={['All Products', ...stock.map(s => s.name)]}
              value={filters.product}
              onChange={val => setFilters(f => ({ ...f, product: val === 'All Products' ? '' : val }))}
            />
          </div>
        </div>
      </Card>

      <Card className="border-indigo-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
            {activeTab === 'returns' ? <RotateCcw size={18} /> : <ShoppingCart size={18} />}
            {isEditing ? `Edit ${activeTab === 'returns' ? 'Return' : 'Replacement'}` : `Log a ${activeTab === 'returns' ? 'Return' : 'Replacement'}`}
          </div>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
               <X size={16} className="mr-1" /> Cancel Edit
            </Button>
          )}
        </div>

        {activeTab === 'returns' ? (
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <SearchableSelect 
                label="Product / SKU" 
                options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                value={formData.productName ? stock.find(s => s.name === formData.productName) ? `[${stock.find(s => s.name === formData.productName).sku || 'N/A'}] ${formData.productName} (Pack: ${stock.find(s => s.name === formData.productName).packSize || 1})` : '' : ''}
                onChange={(val) => {
                  const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                  setFormData({...formData, productName: selectedName || ''});
                }}
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
                options={['Good (Reuse)', 'Damaged (Waste)']}
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
            <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
              <div className="flex-1 w-full">
                <Input 
                  label="Reason for Return" 
                  placeholder="e.g. Broken in transit, Customer changed mind" 
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
              </div>
              <Button type="submit" className="px-8" loading={isSubmitting}>
                <Save size={18} className="mr-2" /> {isEditing ? 'Update Log' : 'Log Return'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRepSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select 
                label="Replacement Type" 
                options={['B2C', 'B2B']}
                value={repForm.type}
                onChange={(e) => setRepForm({...repForm, type: e.target.value, orderId: '', channel: ''})}
              />
              {repForm.type === 'B2B' ? (
                <SearchableSelect 
                  label="Select B2B Order" 
                  options={b2bShipments.slice(0, 50).map(s => `${s.clientName} - ${s.date} (#${s.id.toString().slice(-4)})`)}
                  value={repForm.orderId ? b2bShipments.find(s => s.id === repForm.orderId) ? `${b2bShipments.find(s => s.id === repForm.orderId).clientName} - ${b2bShipments.find(s => s.id === repForm.orderId).date} (#${repForm.orderId.toString().slice(-4)})` : '' : ''}
                  onChange={(val) => {
                    const selected = b2bShipments.find(s => `${s.clientName} - ${s.date} (#${s.id.toString().slice(-4)})` === val);
                    setRepForm({...repForm, orderId: selected?.id || ''});
                  }}
                  required
                />
              ) : (
                <SearchableSelect 
                  label="B2C Channel" 
                  options={channels.map(c => c.name)} 
                  value={repForm.channel}
                  onChange={(val) => setRepForm({...repForm, channel: val})}
                  required
                />
              )}
              <Input 
                label="Replacement Date" 
                type="date"
                value={repForm.date}
                onChange={(e) => setRepForm({...repForm, date: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SearchableSelect 
                label="Product to Send" 
                options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                value={repForm.productName ? stock.find(s => s.name === repForm.productName) ? `[${stock.find(s => s.name === repForm.productName).sku || 'N/A'}] ${repForm.productName} (Pack: ${stock.find(s => s.name === repForm.productName).packSize || 1})` : '' : ''}
                onChange={(val) => {
                  const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                  setRepForm({...repForm, productName: selectedName || ''});
                }}
                required
              />
              <Input 
                label="Quantity" 
                type="number" 
                min="1"
                value={repForm.quantity}
                onChange={(e) => setRepForm({...repForm, quantity: e.target.value})}
                required
              />
               <Input 
                label="Reason for Replacement" 
                placeholder="e.g. Previous item damaged, Wrong SKU sent" 
                value={repForm.reason}
                onChange={(e) => setRepForm({...repForm, reason: e.target.value})}
                required
              />
            </div>
            <div className="flex justify-end pt-2">
               <Button type="submit" className="px-8 bg-indigo-600 hover:bg-indigo-700" loading={isSubmitting}>
                  <Save size={18} className="mr-2" /> {isEditing ? 'Update Replacement' : 'Process Replacement'}
               </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="px-0 pt-0 pb-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <History size={18} className="text-slate-400" />
            {activeTab === 'returns' ? 'Return Records' : 'Replacement Records'}
            <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
               {activeTab === 'returns' ? filteredReturns.length : filteredReplacements.length} Total
            </span>
          </h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleDownloadReport} className="text-slate-600">
              <Download size={14} className="mr-1" /> Report
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportExcel} className="text-slate-600">
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>
        </div>
        
        {activeTab === 'returns' ? (
          <Table headers={['Date', 'Type', 'Adjusted?', 'Channel', 'Product', 'Qty', 'Reason', 'Action']}>
            {filteredReturns.length === 0 ? (
              <tr><td colSpan="8" className="py-12 text-center text-slate-400">No return records found.</td></tr>
            ) : (
              filteredReturns.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-slate-600">{r.date}</td>
                  <td className="py-4 px-6 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.isReusable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {r.isReusable ? 'RESTOCK' : 'DAMAGED'}
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
                      {isRecordEditable(r.date) && (
                        <>
                          <button onClick={() => handleEdit(r, 'returns')} className="p-1 text-indigo-400 hover:text-indigo-600 shadow-sm rounded p-1 hover:bg-indigo-50"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(r, 'returns')} className="p-1 text-slate-400 hover:text-rose-600 shadow-sm rounded p-1 hover:bg-rose-50"><Trash2 size={16} /></button>
                        </>
                      )}
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
                        {r.type === 'B2B' ? r.clientName : r.channel}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm">
                    {r.deducted ? (
                      <span className="text-[10px] font-bold text-rose-600 italic">YES (-{r.quantity})</span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">LOG ONLY</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono font-bold text-indigo-500 italic">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                      <span className="font-medium text-slate-900">{r.productName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-rose-600">-{r.quantity}</td>
                  <td className="py-4 px-6 text-sm text-slate-500 max-w-xs truncate">{r.reason || '-'}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-1">
                      {isRecordEditable(r.date) && (
                        <>
                          <button onClick={() => handleEdit(r, 'replacements')} className="p-1 text-indigo-400 hover:text-indigo-600 shadow-sm rounded p-1 hover:bg-indigo-50"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(r, 'replacements')} className="p-1 text-slate-400 hover:text-rose-600 shadow-sm rounded p-1 hover:bg-rose-50"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </Table>
        )}
      </Card>
    </div>
  );
};

export default Returns;
