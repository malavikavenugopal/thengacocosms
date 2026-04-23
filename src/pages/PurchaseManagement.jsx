import React, { useState } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { ShoppingCart, Plus, Trash2, Save, MapPin, History, Lock, Edit2, X, ClipboardCheck, CheckCircle2, XCircle, PackagePlus, MinusCircle } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';

const PurchaseManagement = () => {
  const { stock, purchaseRecords, addPurchaseRecord, updatePurchaseRecord, deletePurchaseRecord, drafts, updateDraft, clearDraft, qcRecords, vendors, addVendor, updateVendor, deleteVendor } = useGlobalState();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('entry');
  const [newVendor, setNewVendor] = useState({ name: '', whatsappName: '' });
  const [editingVendor, setEditingVendor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  
  const [formData, setFormData] = useState(() => {
    const defaultData = {
      vendorName: '',
      place: '',
      date: new Date().toISOString().split('T')[0],
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

        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
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
                      options={soloProducts.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                      value={item.productName ? `${soloProducts.find(s => s.name === item.productName) ? `[${soloProducts.find(s => s.name === item.productName).sku || 'N/A'}] ${item.productName} (Pack: ${soloProducts.find(s => s.name === item.productName).packSize || 1})` : ''}` : ''}
                      onChange={(val) => {
                        const selectedName = soloProducts.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
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

      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                Purchase History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table headers={['Date', 'Product / SKU', 'Vendor', 'Place', 'Quantity', 'Action']}>
                {purchaseRecords.length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No purchase records found.</td></tr>
                ) : (
                  purchaseRecords.map(r => (
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold ring-4 ring-emerald-50">
                          +{r.quantity}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isRecordEditable(r.date) ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleEdit(r)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                <Trash2 size={18} />
                              </button>
                            </div>
                        ) : (
                          <div className="flex justify-center p-1.5 text-slate-200" title="Records older than 5 days cannot be deleted">
                              <Lock size={16} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </Table>
            </div>
          </Card>

          <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
            <div className="p-6 border-b border-slate-100 bg-indigo-50/10">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck size={20} className="text-indigo-500" />
                Quality Check Report (Last Arrivals)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Inspection logs for products received from vendors</p>
            </div>
            <div className="overflow-x-auto">
              <Table headers={['Date', 'Product / SKU', 'Vendor', 'Checked', 'Good', 'Damaged', 'Rejected', 'Status']}>
                {qcRecords.length === 0 ? (
                  <tr><td colSpan="8" className="py-12 text-center text-slate-400 font-medium">No QC reports available.</td></tr>
                ) : (
                  [...qcRecords].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(r => (
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
                          {r.good}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                         <div className={`flex items-center gap-1.5 font-black ${Number(r.damaged) > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                          <XCircle size={14} />
                          {r.damaged}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                         <div className={`flex items-center gap-1.5 font-black ${Number(r.rejected) > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                          <XCircle size={14} />
                          {r.rejected || 0}
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
          </Card>
        </div>
      )}

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
              <div className="flex items-end gap-2">
                <Button onClick={async () => {
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
                    setNewVendor({ name: '', whatsappName: '' });
                  } finally {
                    setIsSavingVendor(false);
                  }
                }} className="h-11" loading={isSavingVendor}>
                  {editingVendor ? 'Update' : 'Add Vendor'}
                </Button>
                {editingVendor && (
                  <Button variant="secondary" onClick={() => {
                    setEditingVendor(null);
                    setNewVendor({ name: '', whatsappName: '' });
                  }} className="h-11">Cancel</Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="px-0 pt-0 pb-0 overflow-hidden border-slate-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Current Vendor List</h3>
            </div>
            <Table headers={['Vendor Name', 'WhatsApp Contact', 'Actions']}>
              {vendors.length === 0 ? (
                <tr><td colSpan="3" className="py-12 text-center text-slate-400 font-medium">No vendors registered yet.</td></tr>
              ) : (
                vendors.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-slate-900">{v.name}</td>
                    <td className="py-4 px-6 text-sm text-slate-500 font-medium">{v.whatsappName || 'N/A'}</td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => {
                          setEditingVendor(v);
                          setNewVendor({ name: v.name, whatsappName: v.whatsappName || '' });
                        }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-indigo-100 shadow-sm transition-all">
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
