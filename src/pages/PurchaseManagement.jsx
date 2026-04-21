import React, { useState } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { ShoppingCart, Plus, Trash2, Save, MapPin, Calendar, History, Lock, Edit2, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';

const PurchaseManagement = () => {
  const { stock, purchaseRecords, addPurchaseRecord, updatePurchaseRecord, deletePurchaseRecord, drafts, updateDraft, clearDraft } = useGlobalState();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState(() => {
    return drafts.purchase || {
      productName: '',
      quantity: '',
      vendorName: '',
      place: '',
      date: new Date().toISOString().split('T')[0]
    };
  });

  // Sync draft
  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('purchase', formData);
    }
  }, [formData, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.productName || !formData.quantity || !formData.vendorName) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      const recordData = {
        ...formData,
        timestamp: Date.now()
      };
      
      if (isEditing) {
        await updatePurchaseRecord(editingId, recordData);
        toast.success('Purchase record updated and stock adjusted!');
      } else {
        await addPurchaseRecord({ ...recordData, id: Date.now() });
        toast.success('Purchase recorded and stock updated!');
        clearDraft('purchase');
      }
      handleCancel();
    } catch (err) {
      toast.error('Error saving purchase');
    }
  };

  const handleEdit = (r) => {
    setIsEditing(true);
    setEditingId(r.id);
    setFormData({
      productName: r.productName,
      quantity: r.quantity,
      vendorName: r.vendorName,
      place: r.place || '',
      date: r.date
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      productName: '',
      quantity: '',
      vendorName: '',
      place: '',
      date: new Date().toISOString().split('T')[0]
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <ShoppingCart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Management</h2>
          <p className="text-sm text-slate-500">Record new stock arrivals from vendors</p>
        </div>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/20">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Plus size={18} />
            {isEditing ? 'Edit Purchase Entry' : 'New Stock Purchase / Arrival'}
          </div>
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
               <X size={16} className="mr-1" /> Cancel Edit
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <SearchableSelect 
              label="Select Product" 
              options={stock.filter(s => !s.isComposite).map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
              value={formData.productName ? stock.find(s => s.name === formData.productName) ? `[${stock.find(s => s.name === formData.productName).sku || 'N/A'}] ${formData.productName} (Pack: ${stock.find(s => s.name === formData.productName).packSize || 1})` : '' : ''}
              onChange={(val) => {
                const selectedName = stock.find(s => !s.isComposite && `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                setFormData({...formData, productName: selectedName || ''});
              }}
              required
            />
            <Input 
              label="Quantity" 
              type="number" 
              min="1"
              placeholder="Total Units"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              required
            />
            <Input 
              label="Vendor Name" 
              placeholder="e.g. Sree Agencies" 
              value={formData.vendorName}
              onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
              required
            />
            <Input 
              label="Place" 
              placeholder="e.g. Cochin" 
              value={formData.place}
              onChange={(e) => setFormData({...formData, place: e.target.value})}
            />
            <Input 
              label="Purchase Date" 
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            {isEditing && (
              <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
            )}
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
              <Save size={18} /> {isEditing ? 'Update Purchase' : 'Save Purchase'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
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
                  <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">{r.date}</td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-tighter">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
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
                          <button 
                            onClick={() => handleEdit(r)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit Record"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(r.id)} 
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Record"
                          >
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
    </div>
  );
};

export default PurchaseManagement;
