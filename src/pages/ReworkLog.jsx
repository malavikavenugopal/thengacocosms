import React, { useState } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, RotateCcw, Save, X, History, Search, ArrowRight, CheckCircle2, Clock, FileText } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { generateVisualReport } from '../utils/visualReportUtils';

const ReworkLog = () => {
  const context = useGlobalState();
  const { 
    stock = [], 
    reworkRecords = [], 
    addReworkRecord, 
    updateReworkRecord, 
    deleteReworkRecord, 
    drafts = {}, 
    updateDraft, 
    clearDraft 
  } = context || {};
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    search: '',
    status: 'All'
  });

  // Outward Form State
  const [formData, setFormData] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const saved = drafts?.rework;
    let initialProducts = [{ id: Date.now(), productName: '', quantity: '' }];
    if (saved?.products && saved.products.length > 0) {
      initialProducts = saved.products.map((p, idx) => ({
        id: p.id || `${Date.now()}-${idx}-${Math.random()}`,
        productName: p.productName || '',
        quantity: p.quantity || ''
      }));
    } else if (saved?.productName) {
      initialProducts = [{ id: Date.now(), productName: saved.productName, quantity: saved.quantity || '' }];
    }
    return {
      products: initialProducts,
      destination: saved?.destination || '',
      outDate: saved?.outDate || defaultDate,
      notes: saved?.notes || '',
      status: 'Sent'
    };
  });

  // Receive Form State
  const [receiveData, setReceiveData] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    products: []
  });

  // Sync drafts
  React.useEffect(() => {
    if (!isEditing && !isReceiving && updateDraft) {
      updateDraft('rework', formData);
    }
  }, [formData, isEditing, isReceiving, updateDraft]);

  const filteredRecords = (reworkRecords || [])
    .filter(r => {
      if (!r) return false;
      const matchDate = (!filters.startDate || (r.outDate && r.outDate >= filters.startDate)) && 
                      (!filters.endDate || (r.outDate && r.outDate <= filters.endDate));
      const matchStatus = filters.status === 'All' || r.status === filters.status;
      
      const dest = (r.destination || '').toLowerCase();
      const sTerm = (filters.search || '').toLowerCase();
      
      let matchSearch = !sTerm || dest.includes(sTerm);
      if (!matchSearch && sTerm) {
        if (r.products && r.products.length > 0) {
          matchSearch = r.products.some(p => (p.productName || '').toLowerCase().includes(sTerm));
        } else {
          matchSearch = (r.productName || '').toLowerCase().includes(sTerm);
        }
      }
      return matchDate && matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const dateA = a.outDate ? new Date(a.outDate) : new Date(0);
      const dateB = b.outDate ? new Date(b.outDate) : new Date(0);
      return dateB - dateA;
    });

  const handleCancel = () => {
    setIsEditing(false);
    setIsReceiving(false);
    setEditingId(null);
    setReceivingId(null);
    const defaultDate = new Date().toISOString().split('T')[0];
    setFormData({
      products: [{ id: Date.now(), productName: '', quantity: '' }],
      destination: '',
      outDate: defaultDate,
      notes: '',
      status: 'Sent'
    });
    setReceiveData({
      returnDate: defaultDate,
      products: []
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!addReworkRecord || !updateReworkRecord) return;
    
    if (!formData.products || formData.products.length === 0) {
      toast.error('Please add at least one product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        outDate: formData.outDate,
        destination: formData.destination,
        notes: formData.notes,
        status: formData.status,
        products: formData.products.map(p => ({
          productName: p.productName,
          quantity: p.quantity
        }))
      };

      if (isEditing) {
        await updateReworkRecord(editingId, { ...payload, id: editingId });
        toast.success('Rework log updated!');
      } else {
        await addReworkRecord({ ...payload, createdAt: new Date().toISOString() });
        toast.success('Outgoing rework logged!');
        if (clearDraft) clearDraft('rework');
      }
      handleCancel();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!updateReworkRecord) return;
    setIsSubmitting(true);
    try {
      const originalRecord = reworkRecords.find(r => r.id === receivingId);
      if (!originalRecord) throw new Error("Original record not found");
      await updateReworkRecord(receivingId, {
        ...originalRecord,
        returnDate: receiveData.returnDate,
        returnProducts: receiveData.products.map(p => ({
          returnProductName: p.returnProductName,
          returnQuantity: p.returnQuantity,
          returnNotes: p.returnNotes
        })),
        status: 'Reworked'
      });
      toast.success('Rework return logged!');
      handleCancel();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save return log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    if (!record) return;
    setIsEditing(true);
    setIsReceiving(false);
    setEditingId(record.id);
    
    const recordProducts = record.products && record.products.length > 0
      ? record.products.map((p, idx) => ({ id: p.id || `${Date.now()}-${idx}-${Math.random()}`, productName: p.productName || '', quantity: p.quantity || '' }))
      : [{ id: Date.now(), productName: record.productName || '', quantity: record.quantity || '' }];

    setFormData({
      products: recordProducts,
      destination: record.destination || '',
      outDate: record.outDate || '',
      notes: record.notes || '',
      status: record.status || 'Sent'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReceiveInitiate = (record) => {
    if (!record) return;
    setIsReceiving(true);
    setIsEditing(false);
    setReceivingId(record.id);

    const recordProducts = record.products && record.products.length > 0
      ? record.products
      : [{ productName: record.productName || '', quantity: record.quantity || '' }];

    setReceiveData({
      returnDate: new Date().toISOString().split('T')[0],
      products: recordProducts.map((p, idx) => ({
        id: p.id || `${Date.now()}-${idx}-${Math.random()}`,
        originalProductName: p.productName,
        originalQuantity: p.quantity,
        returnProductName: p.productName,
        returnQuantity: p.quantity,
        returnNotes: ''
      }))
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (!deleteReworkRecord) return;
    Swal.fire({
      title: 'Delete Rework Log?',
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteReworkRecord(id);
        toast.success('Record deleted.');
      }
    });
  };

  const handleVisualReport = async () => {
    if (filteredRecords.length === 0) {
      toast.error('No records to export');
      return;
    }
    setIsGeneratingVisual(true);
    try {
      const title = filters.startDate || filters.endDate
        ? `Rework Summary`
        : "Rework Summary";
      await generateVisualReport(filteredRecords, 'Rework', title, { startDate: filters.startDate, endDate: filters.endDate });
      toast.success('Report generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate visual report');
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  if (!context) return <div className="p-8 text-center text-slate-500">Loading context...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <RotateCcw size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rework Log Entry</h2>
            <p className="text-sm text-slate-500">Log products going for rework (No stock movement)</p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {isReceiving ? (
          <Card className="border-emerald-100 bg-emerald-50/30">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 size={18} />
                Log Rework Return (Inward)
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                 <X size={16} className="mr-1" /> Cancel
              </Button>
            </div>
            
            <form onSubmit={handleReceiveSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input 
                  label="Return Date" 
                  type="date"
                  value={receiveData.returnDate}
                  onChange={(e) => setReceiveData({...receiveData, returnDate: e.target.value})}
                  required
                />
              </div>

              <div className="border-t border-emerald-100 pt-4">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Returned Products</h4>
                </div>
                <div className="space-y-4">
                  {receiveData.products?.map((p, idx) => (
                    <div key={p.id} className="p-4 rounded-xl border border-emerald-100 bg-white/50 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                          <Input 
                            label="Original Product (Sent Out)" 
                            value={`${p.originalQuantity}x ${p.originalProductName}`}
                            disabled
                            className="opacity-70 bg-slate-100"
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-center pb-2">
                          <ArrowRight className="hidden md:block text-slate-300" />
                        </div>
                        <div className="md:col-span-5">
                          <SearchableSelect 
                            label="Product Returned (New SKU?)" 
                            options={(stock || []).map(s => s.name)} 
                            value={p.returnProductName}
                            onChange={(val) => {
                              const newProducts = [...receiveData.products];
                              newProducts[idx].returnProductName = val;
                              setReceiveData({...receiveData, products: newProducts});
                            }}
                            required
                            className="border-emerald-200"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Input 
                            label="Qty Returned" 
                            type="number" 
                            min="1"
                            value={p.returnQuantity}
                            onChange={(e) => {
                              const newProducts = [...receiveData.products];
                              newProducts[idx].returnQuantity = e.target.value;
                              setReceiveData({...receiveData, products: newProducts});
                            }}
                            required
                          />
                        </div>
                      </div>
                      <div className="w-full">
                        <Input 
                          label="Notes / Comments" 
                          placeholder="e.g. Polished, minor adjustments, etc." 
                          value={p.returnNotes}
                          onChange={(e) => {
                            const newProducts = [...receiveData.products];
                            newProducts[idx].returnNotes = e.target.value;
                            setReceiveData({...receiveData, products: newProducts});
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
                <Button type="submit" className="px-8 bg-emerald-600 hover:bg-emerald-700" loading={isSubmitting}>
                  <Save size={18} className="mr-2" /> Log Return
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className={`${isEditing ? 'border-amber-100 bg-amber-50/30' : 'border-indigo-100 bg-indigo-50/30'}`}>
            <div className="mb-6 flex items-center justify-between">
              <div className={`flex items-center gap-2 font-bold ${isEditing ? 'text-amber-600' : 'text-indigo-600'}`}>
                <ArrowRight size={18} />
                {isEditing ? 'Edit Rework Log' : 'New Outgoing Rework'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Outgoing Date" 
                  type="date"
                  value={formData.outDate}
                  onChange={(e) => setFormData({...formData, outDate: e.target.value})}
                  required
                />
                <Input 
                  label="Destination / Where to?" 
                  placeholder="e.g. Local Workshop, Unit 2" 
                  value={formData.destination}
                  onChange={(e) => setFormData({...formData, destination: e.target.value})}
                  required
                />
              </div>

              {/* Products List Section */}
              <div className="border-t border-indigo-100 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Products to Rework</h4>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFormData({
                      ...formData, 
                      products: [...formData.products, { id: Date.now() + Math.random(), productName: '', quantity: '' }]
                    })}
                    className="text-indigo-600 hover:bg-indigo-100/50"
                  >
                    <Plus size={16} className="mr-1" /> Add Product
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.products.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white/40 p-3 rounded-lg border border-indigo-50 relative group">
                      <div className="md:col-span-8">
                        <SearchableSelect 
                          label={idx === 0 ? "Product to Rework" : ""} 
                          options={(stock || []).map(s => s.name)} 
                          value={p.productName}
                          onChange={(val) => {
                            const newProducts = [...formData.products];
                            newProducts[idx].productName = val;
                            setFormData({...formData, products: newProducts});
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
                            const newProducts = [...formData.products];
                            newProducts[idx].quantity = e.target.value;
                            setFormData({...formData, products: newProducts});
                          }}
                          required
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end pb-2">
                        <button 
                          type="button" 
                          onClick={() => setFormData({
                            ...formData, 
                            products: formData.products.filter(item => item.id !== p.id)
                          })}
                          disabled={formData.products.length === 1}
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
                    label="Notes / Instructions" 
                    placeholder="e.g. Polishing needed, Fix threading" 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <div className="flex gap-3">
                  {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
                  <Button type="submit" className={`px-8 ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`} loading={isSubmitting}>
                    <Save size={18} className="mr-2" /> {isEditing ? 'Update Log' : 'Save Outgoing Log'}
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
            Rework History
            <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
               {filteredRecords.length} Total
            </span>
          </h3>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
              />
              <span className="text-xs text-slate-400">to</span>
              <input 
                type="date" 
                className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="relative flex-1 sm:min-w-[150px]">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                type="text" 
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
               />
            </div>
            <select 
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              <option value="All">All Status</option>
              <option value="Sent">Pending (Sent)</option>
              <option value="Reworked">Completed (Returned)</option>
            </select>
            {(filters.startDate || filters.endDate || filters.search || filters.status !== 'All') && (
              <button 
                onClick={() => setFilters({ startDate: '', endDate: '', search: '', status: 'All' })}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 underline"
              >
                Clear
              </button>
            )}
            <Button onClick={handleVisualReport} variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 text-xs py-1.5 px-3 flex items-center gap-1.5" loading={isGeneratingVisual}>
              <FileText size={14} /> Visual Report
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <Table headers={['Status', 'Out Date', 'Product Out', 'Qty', 'Destination', 'Return Details', 'Action']}>
            {filteredRecords.length === 0 ? (
              <tr><td colSpan="7" className="py-12 text-center text-slate-400">No rework logs found.</td></tr>
            ) : (
              filteredRecords.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${r.status === 'Reworked' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.status === 'Reworked' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {r.status === 'Reworked' ? 'COMPLETED' : 'PENDING'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600">{r.outDate}</td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex flex-col gap-1">
                      {r.products && r.products.length > 0 ? (
                        r.products.map((p, idx) => (
                          <span key={idx} className="font-medium text-slate-900 block">
                            {p.productName}
                          </span>
                        ))
                      ) : (
                        <span className="font-medium text-slate-900">{r.productName}</span>
                      )}
                      {r.notes && <span className="text-[10px] text-slate-500 italic truncate max-w-[150px]">{r.notes}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-slate-700">
                    <div className="flex flex-col gap-1">
                      {r.products && r.products.length > 0 ? (
                        r.products.map((p, idx) => (
                          <span key={idx} className="block">
                            {p.quantity}
                          </span>
                        ))
                      ) : (
                        <span>{r.quantity}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-semibold text-indigo-600">{r.destination}</td>
                  <td className="py-4 px-6 text-sm">
                    {r.status === 'Reworked' ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit">
                          {r.returnDate}
                        </div>
                        <div className="flex flex-col gap-1">
                          {r.returnProducts && r.returnProducts.length > 0 ? (
                            r.returnProducts.map((rp, idx) => (
                              <div key={idx} className="text-[11px] font-medium text-slate-700">
                                {rp.returnQuantity}x {rp.returnProductName}
                                {rp.returnNotes && <span className="block text-[9px] text-slate-400 italic">Note: {rp.returnNotes}</span>}
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] font-medium text-slate-700">
                              {r.returnQuantity}x {r.returnProductName}
                              {r.returnNotes && <span className="block text-[9px] text-slate-400 italic">Note: {r.returnNotes}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleReceiveInitiate(r)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 border border-indigo-200 rounded bg-white hover:bg-indigo-50 transition-all"
                      >
                        Log Return
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(r)} className="p-1 text-indigo-400 hover:text-indigo-600"><History size={16} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
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


export default ReworkLog;
