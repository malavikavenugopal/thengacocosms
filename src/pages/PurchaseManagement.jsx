import React, { useState } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { ShoppingCart, Plus, Trash2, Save, MapPin, History, Lock, Edit2, X, ClipboardCheck, CheckCircle2, XCircle, PackagePlus, MinusCircle } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';

const PurchaseManagement = () => {
  const { 
    stock, 
    purchaseRecords, 
    addPurchaseRecord, 
    updatePurchaseRecord, 
    deletePurchaseRecord, 
    drafts, 
    updateDraft, 
    clearDraft, 
    qcRecords, 
    vendors, 
    addVendor, 
    updateVendor, 
    deleteVendor, 
    standardRecipients, 
    addStandardRecipient, 
    updateStandardRecipient, 
    deleteStandardRecipient 
  } = useGlobalState();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [historySubTab, setHistorySubTab] = useState('qc');
  const [activeTab, setActiveTab] = useState('entry');
  const [qcPage, setQcPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const itemsPerPage = 10;

  const cleanVendor = (name) => (name || '').trim().toLowerCase();

  const getQcAcceptedForPurchase = (purchaseRec) => {
    const sameProductVendorPurchases = purchaseRecords
      .filter(p => p.productName === purchaseRec.productName && cleanVendor(p.vendorName) === cleanVendor(purchaseRec.vendorName))
      .sort((a, b) => a.date.localeCompare(b.date));

    const currentIndex = sameProductVendorPurchases.findIndex(p => p.id === purchaseRec.id);
    if (currentIndex === -1) return null;

    const nextPurchase = sameProductVendorPurchases[currentIndex + 1];
    const nextPurchaseDate = nextPurchase ? nextPurchase.date : null;

    const matchingQcs = qcRecords.filter(q => 
      q.productName === purchaseRec.productName && 
      cleanVendor(q.vendorName) === cleanVendor(purchaseRec.vendorName) &&
      q.date >= purchaseRec.date &&
      (!nextPurchaseDate || q.date < nextPurchaseDate)
    );
    if (matchingQcs.length === 0) return null;
    
    return matchingQcs.reduce((sum, q) => {
      const checked = Number(q.checked) || 0;
      const accepted = checked - (Number(q.damaged) || 0) - (Number(q.rejected) || 0) - (Number(q.baseless) || 0) - (Number(q.hole) || 0);
      return sum + Math.max(0, accepted);
    }, 0);
  };
  
  const [newVendor, setNewVendor] = useState({ 
    name: '', 
    whatsappName: '', 
    email: standardRecipients.filter(r => r.label.toLowerCase() !== 'dhanya').map(r => r.email).join(', ') 
  });

  const [showManageStandards, setShowManageStandards] = useState(false);
  const [newStandard, setNewStandard] = useState({ label: '', email: '' });

  React.useEffect(() => {
    // Only update email if name/whatsapp are empty (not currently typing vendor details)
    if (!newVendor.name && !newVendor.whatsappName && (newVendor.email === '' || newVendor.email === 'sudha.thenga@gmail.com, sumitha@thengacoco.com, maria@thengacoco.com, dhanya.thenga@gmail.com')) {
      setNewVendor(prev => ({ ...prev, email: standardRecipients.filter(r => r.label.toLowerCase() !== 'dhanya').map(r => r.email).join(', ') }));
    }
  }, [standardRecipients]);

  const handleAddStandard = async () => {
    if (!newStandard.label.trim() || !newStandard.email.trim()) {
      toast.error('Both label and email are required');
      return;
    }
    try {
      await addStandardRecipient({
        label: newStandard.label.trim(),
        email: newStandard.email.trim().toLowerCase()
      });
      setNewStandard({ label: '', email: '' });
      toast.success('Standard recipient added!');
    } catch (e) {
      toast.error('Error adding standard recipient');
    }
  };

  const handleDeleteStandard = async (item) => {
    Swal.fire({
      title: 'Remove Standard Recipient?',
      text: `Delete "${item.label}" from standard list?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Yes, delete'
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          if (item.id) {
            await deleteStandardRecipient(item.id);
            toast.success('Deleted standard recipient');
          } else {
            const nonDeletedDefaults = standardRecipients
              .filter(x => x.email !== item.email)
              .map(x => ({ label: x.label, email: x.email }));
            
            // Populate remaining defaults to Firestore
            for (const d of nonDeletedDefaults) {
              await addStandardRecipient(d);
            }
            toast.success('Deleted standard recipient');
          }
        } catch (err) {
          toast.error('Error deleting standard recipient');
        }
      }
    });
  };

  const [editingVendor, setEditingVendor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  
  // Purchase History Filter State
  const [historyFilters, setHistoryFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    vendor: '',
    product: '',
    search: ''
  });

  const [formData, setFormData] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const defaultData = {
      vendorName: '',
      place: '',
      date: defaultDate,
      items: [{ productName: '', quantity: '' }]
    };

    if (!drafts.purchase) return defaultData;

    // Backward compatibility for old drafts
    const saved = drafts.purchase;
    if (!saved.items) {
      return {
        vendorName: saved.vendorName || '',
        place: saved.place || '',
        date: saved.date || defaultData.date,
        items: [{ productName: saved.productName || '', quantity: saved.quantity || '' }]
      };
    }
    return saved;
  });

  // Sync draft
  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('purchase', formData);
    }
  }, [formData, isEditing]);

  React.useEffect(() => {
    setQcPage(1);
    setPurchasePage(1);
  }, [historyFilters]);

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productName: '', quantity: '' }]
    }));
  };

  const removeRow = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateRow = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.vendorName || formData.items.some(item => !item.productName || !item.quantity)) {
      toast.error('Please fill in all vendor and product fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const item = formData.items[0];
        const recordData = {
          vendorName: formData.vendorName,
          place: formData.place,
          date: formData.date,
          productName: item.productName,
          quantity: item.quantity,
          timestamp: Date.now()
        };
        await updatePurchaseRecord(editingId, recordData);
        toast.success('Purchase record updated!');
      } else {
        for (const item of formData.items) {
          const recordData = {
            vendorName: formData.vendorName,
            place: formData.place,
            date: formData.date,
            productName: item.productName,
            quantity: item.quantity,
            timestamp: Date.now()
          };
          await addPurchaseRecord({ ...recordData, id: Date.now() + Math.random() });
        }
        toast.success(`Successfully added ${formData.items.length} products!`);
        clearDraft('purchase');
      }
      handleCancel();
    } catch (err) {
      toast.error('Error saving purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (r) => {
    setIsEditing(true);
    setEditingId(r.id);
    setFormData({
      vendorName: r.vendorName,
      place: r.place || '',
      date: r.date,
      items: [{ productName: r.productName, quantity: r.quantity }]
    });
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      vendorName: '',
      place: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ productName: '', quantity: '' }]
    });
  };

  const handleEditVendor = (v) => {
    setEditingVendor(v);
    setNewVendor({ 
      name: v.name, 
      whatsappName: v.whatsappName || '',
      email: v.email || 'sudha.thenga@gmail.com, sumitha@thengacoco.com, maria@thengacoco.com, dhanya.thenga@gmail.com'
    });
    window.scrollTo({ top: document.getElementById('vendor-form')?.offsetTop || 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Delete Purchase Record?',
      text: "This will also revert the stock added from this purchase.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deletePurchaseRecord(id);
          toast.error('Purchase record deleted & stock reverted.');
        } catch (err) {
          toast.error('Error deleting record');
        }
      }
    });
  };

  const soloProducts = stock.filter(s => !s.isComposite);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Management</h2>
            <p className="text-sm text-slate-500">Record arrivals and manage vendor lists</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar whitespace-nowrap">
          {[
            { id: 'entry', label: 'Purchase Entry', icon: PackagePlus },
            { id: 'history', label: 'History & QC', icon: History },
            { id: 'vendors', label: 'Manage Vendors', icon: MapPin }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'entry' && (
        <Card className="border-indigo-100 bg-indigo-50/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-xs">
              <PackagePlus size={18} />
              {isEditing ? 'Edit Purchase Entry' : 'Bulk Stock Arrival'}
            </div>
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600 p-0 h-auto">
                 <X size={16} className="mr-1" /> Cancel Edit
              </Button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/50 p-4 rounded-xl border border-white">
              <SearchableSelect 
                label="Vendor Name" 
                placeholder="Select Vendor" 
                options={vendors.map(v => v.name)}
                value={formData.vendorName}
                onChange={(val) => setFormData({...formData, vendorName: val})}
                required
              />
              <Input 
                label="Arrival Place" 
                placeholder="e.g. Cochin Warehouse" 
                value={formData.place}
                onChange={(e) => setFormData({...formData, place: e.target.value})}
              />
              <Input 
                label="Arrival Date" 
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 Products in this Batch
                 <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="md:col-span-8">
                    <SearchableSelect 
                      label={index === 0 ? "Select Product" : ""} 
                      options={soloProducts
                        .map(s => `[${s.sku || 'N/A'}] ${s.name}`)
                        .sort((a, b) => a.localeCompare(b))} 
                      value={item.productName ? `${soloProducts.find(s => s.name === item.productName) ? `[${soloProducts.find(s => s.name === item.productName).sku || 'N/A'}] ${item.productName}` : ''}` : ''}
                      onChange={(val) => {
                        const selectedName = soloProducts.find(s => `[${s.sku || 'N/A'}] ${s.name}` === val)?.name;
                        updateRow(index, 'productName', selectedName || '');
                      }}
                      required
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Input 
                      label={index === 0 ? "Quantity" : ""} 
                      type="number" 
                      min="1"
                      placeholder="Units"
                      value={item.quantity}
                      onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  {!isEditing && (
                    <div className="md:col-span-1 flex justify-center pb-2">
                      <button 
                        type="button" 
                        onClick={() => removeRow(index)}
                        className={`text-slate-300 hover:text-rose-500 transition-colors ${formData.items.length === 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                      >
                        <MinusCircle size={24} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              {!isEditing && (
                <button 
                  type="button" 
                  onClick={addRow}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                >
                  <Plus size={18} /> Add Another Product to this Arrival
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-white/50">
              {isEditing && (
                <Button type="button" variant="secondary" onClick={handleCancel}>Cancel Edit</Button>
              )}
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 px-8 py-3 h-auto" loading={isSubmitting}>
                <Save size={18} className="mr-2" /> {isEditing ? 'Update Selection' : 'Save all Arrivals'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'history' && (() => {
        const filteredHistory = purchaseRecords
          .filter(r => {
            const matchDate = (!historyFilters.startDate || r.date >= historyFilters.startDate) && 
                            (!historyFilters.endDate || r.date <= historyFilters.endDate);
            const matchVendor = !historyFilters.vendor || r.vendorName === historyFilters.vendor;
            const matchProduct = !historyFilters.product || r.productName === historyFilters.product;
            const matchSearch = !historyFilters.search || 
                               r.vendorName.toLowerCase().includes(historyFilters.search.toLowerCase()) || 
                               r.productName.toLowerCase().includes(historyFilters.search.toLowerCase()) ||
                               (soloProducts.find(s => s.name === r.productName)?.sku || '').toLowerCase().includes(historyFilters.search.toLowerCase());
            return matchDate && matchVendor && matchProduct && matchSearch;
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        const filteredQc = qcRecords
          .filter(r => {
            const matchDate = (!historyFilters.startDate || r.date >= historyFilters.startDate) && 
                            (!historyFilters.endDate || r.date <= historyFilters.endDate);
            const matchVendor = !historyFilters.vendor || r.vendorName === historyFilters.vendor;
            const matchProduct = !historyFilters.product || r.productName === historyFilters.product;
            const matchSearch = !historyFilters.search || 
                               (r.vendorName || '').toLowerCase().includes(historyFilters.search.toLowerCase()) || 
                               r.productName.toLowerCase().includes(historyFilters.search.toLowerCase());
            return matchDate && matchVendor && matchProduct && matchSearch;
          })
          .sort((a,b) => new Date(b.date) - new Date(a.date));

        const totalPurchasePages = Math.ceil(filteredHistory.length / itemsPerPage);
        const paginatedHistory = filteredHistory.slice((purchasePage - 1) * itemsPerPage, purchasePage * itemsPerPage);

        const totalQcPages = Math.ceil(filteredQc.length / itemsPerPage);
        const paginatedQc = filteredQc.slice((qcPage - 1) * itemsPerPage, qcPage * itemsPerPage);

         return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="mb-4 border-slate-200/60 shadow-sm overflow-visible">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Start Date</label>
                  <Input 
                    type="date" 
                    value={historyFilters.startDate} 
                    onChange={e => setHistoryFilters(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">End Date</label>
                  <Input 
                    type="date" 
                    value={historyFilters.endDate} 
                    onChange={e => setHistoryFilters(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Vendor</label>
                  <SearchableSelect 
                    options={['All Vendors', ...vendors.map(v => v.name)]}
                    value={historyFilters.vendor || 'All Vendors'}
                    onChange={val => setHistoryFilters(f => ({ ...f, vendor: val === 'All Vendors' ? '' : val }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Product</label>
                  <SearchableSelect 
                    options={['All Products', ...soloProducts.map(s => s.name).sort((a, b) => a.localeCompare(b))]}
                    value={historyFilters.product || 'All Products'}
                    onChange={val => setHistoryFilters(f => ({ ...f, product: val === 'All Products' ? '' : val }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Search</label>
                  <div className="relative">
                    <Input 
                      placeholder="Search SKU, Name..." 
                      value={historyFilters.search}
                      onChange={e => setHistoryFilters(f => ({ ...f, search: e.target.value }))}
                      className="pl-9"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Plus size={14} className="rotate-45" /> 
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit overflow-x-auto no-scrollbar whitespace-nowrap mb-2">
              <button
                type="button"
                onClick={() => setHistorySubTab('qc')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  historySubTab === 'qc' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ClipboardCheck size={16} />
                QC Reports
              </button>
              <button
                type="button"
                onClick={() => setHistorySubTab('purchase')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  historySubTab === 'purchase' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <History size={16} />
                Purchase History
              </button>
            </div>

            {historySubTab === 'purchase' ? (
              <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <History size={18} className="text-slate-400" />
                    Purchase History
                    <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                      {filteredHistory.length} Records
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table headers={['Date', 'Product / SKU', 'Vendor', 'Place', 'Quantity', 'Action']}>
                    {paginatedHistory.length === 0 ? (
                      <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No purchase records found matching your filters.</td></tr>
                    ) : (
                      paginatedHistory.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 font-medium">
                          <td className="py-4 px-6 text-sm text-slate-500">{r.date}</td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-tighter">{soloProducts.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                              <span className="text-sm font-bold text-slate-900">{r.productName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm font-semibold text-slate-900">{r.vendorName}</td>
                          <td className="py-4 px-6 text-sm text-slate-500 flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400" />
                            {r.place || 'N/A'}
                          </td>
                          <td className="py-4 px-6 text-sm">
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold ring-4 ring-emerald-50">
                                +{r.quantity}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => handleEdit(r)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                    <Edit2 size={18} />
                                  </button>
                                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </Table>
                </div>

                {filteredHistory.length > 0 && (
                  <div className="mt-4 flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                      Showing <span className="text-indigo-600 font-bold">{(purchasePage - 1) * itemsPerPage + 1}</span> to <span className="text-indigo-600 font-bold">{Math.min(purchasePage * itemsPerPage, filteredHistory.length)}</span> of <span className="text-slate-900 font-bold">{filteredHistory.length}</span> records
                    </p>
                    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={purchasePage === 1}
                        onClick={() => setPurchasePage(p => p - 1)}
                        className="h-8 px-2 text-[10px] font-bold"
                      >
                        PREV
                      </Button>
                      <div className="flex gap-1 px-1">
                        {(() => {
                          let start = Math.max(1, purchasePage - 1);
                          let end = Math.min(totalPurchasePages, start + 2);
                          if (end === totalPurchasePages) start = Math.max(1, end - 2);
                          const pages = [];
                          for (let i = start; i <= end; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setPurchasePage(i)}
                                className={`w-8 h-8 text-[10px] font-black rounded-lg transition-all ${
                                  purchasePage === i 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' 
                                    : 'text-slate-500 hover:bg-white hover:shadow-sm'
                                }`}
                              >
                                {i}
                              </button>
                            );
                          }
                          return pages;
                        })()}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={purchasePage === totalPurchasePages || totalPurchasePages === 0}
                        onClick={() => setPurchasePage(p => p + 1)}
                        className="h-8 px-2 text-[10px] font-bold text-indigo-600"
                      >
                        NEXT
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
                <div className="p-6 border-b border-slate-100 bg-indigo-50/10 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardCheck size={20} className="text-indigo-500" />
                      Quality Check Report (Last Arrivals)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Inspection logs for products received from vendors</p>
                  </div>
                  <span className="bg-white text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                    Filtered: {filteredQc.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table headers={['Date', 'Product / SKU', 'Vendor', 'Checked', 'Accepted', 'Status']}>
                    {paginatedQc.length === 0 ? (
                      <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No QC reports available matching your filters.</td></tr>
                    ) : (
                      paginatedQc.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 font-medium">
                          <td className="py-4 px-6 text-sm text-slate-500">{r.date}</td>
                          <td className="py-4 px-6">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-indigo-500 font-mono italic">{soloProducts.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                                <span className="text-sm font-bold text-slate-900">{r.productName}</span>
                             </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-600 font-semibold">{r.vendorName || 'N/A'}</td>
                          <td className="py-4 px-6 text-sm font-bold text-slate-700">{r.checked}</td>
                          <td className="py-4 px-6 text-sm">
                            <div className="flex items-center gap-1.5 text-emerald-600 font-black">
                              <CheckCircle2 size={14} />
                              {Number(r.checked) - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm">
                             {r.deducted ? (
                               <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold italic">DEDUCTED</span>
                             ) : (
                               <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">LOG ONLY</span>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </Table>
                </div>

                {filteredQc.length > 0 && (
                  <div className="mt-4 flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                      Showing <span className="text-indigo-600 font-bold">{(qcPage - 1) * itemsPerPage + 1}</span> to <span className="text-indigo-600 font-bold">{Math.min(qcPage * itemsPerPage, filteredQc.length)}</span> of <span className="text-slate-900 font-bold">{filteredQc.length}</span> reports
                    </p>
                    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={qcPage === 1}
                        onClick={() => setQcPage(p => p - 1)}
                        className="h-8 px-2 text-[10px] font-bold"
                      >
                        PREV
                      </Button>
                      <div className="flex gap-1 px-1">
                        {(() => {
                          let start = Math.max(1, qcPage - 1);
                          let end = Math.min(totalQcPages, start + 2);
                          if (end === totalQcPages) start = Math.max(1, end - 2);
                          const pages = [];
                          for (let i = start; i <= end; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setQcPage(i)}
                                className={`w-8 h-8 text-[10px] font-black rounded-lg transition-all ${
                                  qcPage === i 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' 
                                    : 'text-slate-500 hover:bg-white hover:shadow-sm'
                                }`}
                              >
                                {i}
                              </button>
                            );
                          }
                          return pages;
                        })()}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={qcPage === totalQcPages || totalQcPages === 0}
                        onClick={() => setQcPage(p => p + 1)}
                        className="h-8 px-2 text-[10px] font-bold text-indigo-600"
                      >
                        NEXT
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        );
      })()}

      {activeTab === 'vendors' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card className="border-indigo-100 bg-indigo-50/20 shadow-xl shadow-indigo-100/20">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-wider text-xs mb-4">
              <Plus size={18} />
              {editingVendor ? 'Edit Vendor' : 'Register New Vendor'}
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <Input 
                label="Vendor Full Name"
                placeholder="e.g. Sree Agencies Pvt Ltd" 
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                className="flex-1"
              />
              <Input 
                label="WhatsApp Name / No."
                placeholder="e.g. Arun (WhatsApp)" 
                value={newVendor.whatsappName}
                onChange={(e) => setNewVendor({ ...newVendor, whatsappName: e.target.value })}
                className="flex-1"
              />
              <Input 
                label="Recipient Emails (Custom)"
                placeholder="Comma separated emails..." 
                value={newVendor.email}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                className="flex-1"
              />
            </div>
            
            <div className="mt-4 p-4 bg-white/60 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Standard Recipients (Check to include)</p>
                <button
                  type="button"
                  onClick={() => setShowManageStandards(!showManageStandards)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  {showManageStandards ? 'Done' : 'Manage Standards'}
                </button>
              </div>

              {showManageStandards && (
                <div className="mb-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-semibold text-indigo-800">Add New Standard Recipient</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Name (e.g. John)"
                      value={newStandard.label}
                      onChange={(e) => setNewStandard({ ...newStandard, label: e.target.value })}
                      className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex-1"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={newStandard.email}
                      onChange={(e) => setNewStandard({ ...newStandard, email: e.target.value })}
                      className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddStandard}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus size={14} className="inline mr-0.5" /> Add
                    </button>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Standards (Click x to delete)</p>
                    <div className="flex flex-wrap gap-2">
                      {standardRecipients.map(item => (
                        <div key={item.id || item.email} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs">
                          <span className="font-medium text-slate-700">{item.label} ({item.email})</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteStandard(item)}
                            className="text-rose-600 font-bold ml-1 hover:text-rose-800"
                            title="Delete standard recipient"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                {standardRecipients.map(item => (
                  <label key={item.email} className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={newVendor.email.includes(item.email)}
                      onChange={(e) => {
                        const current = newVendor.email.split(',').map(s => s.trim()).filter(Boolean);
                        let updated;
                        if (e.target.checked) {
                          updated = [...new Set([...current, item.email])];
                        } else {
                          updated = current.filter(email => email !== item.email);
                        }
                        setNewVendor({ ...newVendor, email: updated.join(', ') });
                      }}
                    />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

              <div className="flex items-end justify-end mt-4 gap-2">
                <Button 
                  onClick={async () => {
                    if (!newVendor.name) return;
                    setIsSavingVendor(true);
                    try {
                      if (editingVendor) {
                        await updateVendor(editingVendor.id, newVendor);
                        setEditingVendor(null);
                        toast.success('Vendor updated');
                      } else {
                        await addVendor(newVendor);
                        toast.success('Vendor registered');
                      }
                    } catch (err) {
                      toast.error('Error saving vendor');
                    } finally {
                      setNewVendor({ 
                        name: '', 
                        whatsappName: '', 
                        email: standardRecipients.filter(r => r.label.toLowerCase() !== 'dhanya').map(r => r.email).join(', ') 
                      });
                      setIsSavingVendor(false);
                    }
                  }} 
                  className="h-11 px-8" 
                  loading={isSavingVendor}
                >
                  {editingVendor ? 'Update' : 'Add Vendor'}
                </Button>
                {editingVendor && (
                  <Button variant="secondary" onClick={() => {
                    setEditingVendor(null);
                    setNewVendor({ 
                      name: '', 
                      whatsappName: '', 
                      email: standardRecipients.filter(r => r.label.toLowerCase() !== 'dhanya').map(r => r.email).join(', ') 
                    });
                  }} className="h-11">Cancel</Button>
                )}
              </div>
            </Card>

            <Card className="px-0 pt-0 pb-0 overflow-hidden border-slate-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Current Vendor List</h3>
            </div>
            <Table headers={['Vendor Name', 'WhatsApp Contact', 'Email Address', 'Actions']}>
              {vendors.length === 0 ? (
                <tr><td colSpan="3" className="py-12 text-center text-slate-400 font-medium">No vendors registered yet.</td></tr>
              ) : (
                vendors.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-slate-900">{v.name}</td>
                    <td className="py-4 px-6 text-sm text-slate-500 font-medium">{v.whatsappName || 'N/A'}</td>
                    <td className="py-4 px-6 text-sm text-slate-500 font-medium">{v.email || 'N/A'}</td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleEditVendor(v)} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-indigo-100 shadow-sm transition-all">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => {
                          Swal.fire({
                            title: 'Remove Vendor?',
                            text: "Existing records will remain, but the vendor will be removed from selection.",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#e11d48',
                            confirmButtonText: 'Yes, Remove'
                          }).then(res => {
                            if (res.isConfirmed) deleteVendor(v.id);
                          });
                        }} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-white rounded-lg border border-transparent hover:border-rose-100 shadow-sm transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PurchaseManagement;
