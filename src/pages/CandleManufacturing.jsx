import React, { useState, useMemo } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, Save, Hammer, History, Lock, Download, Filter, Package, Box, Layers, User, Search, Edit, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';

const CandleManufacturing = () => {
  const { stock, staff, productionRecords, addProductionRecord, updateProductionRecord, deleteProductionRecord, drafts, updateDraft, clearDraft, getAvailableStock } = useGlobalState();
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const saved = drafts.production?.formData;
    return {
      staffName: saved?.staffName || '',
      productName: saved?.productName || '',
      quantity: saved?.quantity || '',
      location: saved?.location || '',
      date: saved?.date || defaultDate
    };
  });

  const [rawMaterials, setRawMaterials] = useState(() => {
    return drafts.production?.rawMaterials || [{ id: Date.now(), name: '', quantity: '' }];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync draft
  React.useEffect(() => {
    if (!editingId) {
      updateDraft('production', { formData, rawMaterials });
    }
  }, [formData, rawMaterials, editingId]);

  const filteredRecords = useMemo(() => {
    return (productionRecords || []).filter(r => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return r.productName.toLowerCase().includes(term) || 
             r.staffName.toLowerCase().includes(term) ||
             (r.location || '').toLowerCase().includes(term) ||
             (r.rawMaterials || []).some(rm => rm.name.toLowerCase().includes(term));
    });
  }, [productionRecords, searchTerm]);

  const handleAddRawMaterial = () => setRawMaterials([...rawMaterials, { id: Date.now() + rawMaterials.length, name: '', quantity: '' }]);
  const handleRemoveRawMaterial = (id) => setRawMaterials(rawMaterials.filter((rm) => rm.id !== id));

  const updateRawMaterial = (id, field, value) => {
    setRawMaterials(rawMaterials.map(rm => rm.id === id ? { ...rm, [field]: value } : rm));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.staffName || !formData.productName || !formData.quantity || !formData.location) {
      toast.error("Please fill all manufacturing details including location");
      return;
    }

    if (rawMaterials.some(rm => !rm.name || !rm.quantity)) {
      toast.error("Please fill all raw material details");
      return;
    }

    setIsSubmitting(true);
    try {
      const recordData = {
        ...formData,
        rawMaterials: rawMaterials.map(rm => ({
          name: rm.name,
          quantity: rm.quantity,
          packSize: stock.find(s => s.name === rm.name)?.packSize || 1
        })),
        timestamp: editingId ? productionRecords.find(r => r.id === editingId).timestamp : Date.now()
      };

      if (editingId) {
        await updateProductionRecord(editingId, recordData);
        toast.success('Manufacturing record updated!');
      } else {
        await addProductionRecord(recordData);
        toast.success('Manufacturing record saved & stock updated!');
      }
      
      handleReset();
    } catch (error) {
      console.error(error);
      toast.error(editingId ? 'Failed to update record' : 'Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ staffName: '', productName: '', quantity: '', location: '', date: new Date().toISOString().split('T')[0] });
    setRawMaterials([{ id: Date.now(), name: '', quantity: '' }]);
    setEditingId(null);
    clearDraft('production');
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      staffName: record.staffName,
      productName: record.productName,
      quantity: record.quantity,
      location: record.location || '',
      date: record.date
    });
    setRawMaterials(record.rawMaterials.map((rm, idx) => ({
      id: Date.now() + idx,
      name: rm.name,
      quantity: rm.quantity
    })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Delete this record?',
      text: "This will revert the stock changes (Subtract finished product and restore raw materials).",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteProductionRecord(id);
        toast.success('Record deleted and stock reverted.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Hammer size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Candle Manufacturing</h2>
            <p className="text-sm text-slate-500">Record production and track raw material consumption</p>
          </div>
        </div>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Hammer size={18} />
            {editingId ? 'Edit Manufacturing Entry' : 'Log Manufacturing Process'}
          </div>
          {editingId && (
            <Button type="button" variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-700">
              <X size={16} className="mr-1" /> Cancel Edit
            </Button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select 
              label="Manufactured By" 
              options={staff.map(s => s.name)} 
              value={formData.staffName}
              onChange={(e) => setFormData({...formData, staffName: e.target.value})}
              required
            />
            <div className="lg:col-span-2 space-y-1">
              <SearchableSelect 
                label="Product Manufactured" 
                options={stock.filter(s => !s.isComposite).map(s => s.name)} 
                value={formData.productName}
                onChange={(val) => setFormData({...formData, productName: val})}
                required
              />
              {formData.productName && (
                <div className="flex items-center gap-1.5 px-2">
                  <Package size={10} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    Current Available: <span className="text-emerald-600 font-black">{getAvailableStock(formData.productName)}</span>
                  </span>
                </div>
              )}
            </div>
            <Input 
              label="Quantity Produced" 
              type="number" 
              placeholder="0"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Manufacturing Date" 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
            <Select 
              label="Manufacturing Location"
              options={['Palakkad', 'Thrissur']}
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required
            />
          </div>

          <div className="border-t border-indigo-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-indigo-400 uppercase tracking-widest text-xs flex items-center gap-2">
                <Layers size={14} />
                Raw Materials Consumed
              </h3>
              <Button type="button" variant="ghost" onClick={handleAddRawMaterial} className="text-indigo-600 hover:bg-indigo-100/50">
                <Plus size={16} className="mr-1" /> Add Material
              </Button>
            </div>
            
            <div className="space-y-3">
              {rawMaterials.map((rm) => (
                <div key={rm.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white/40 p-3 rounded-xl border border-indigo-50 relative group">
                  <div className="md:col-span-8 lg:col-span-9 space-y-1">
                    <SearchableSelect 
                      label={rawMaterials[0].id === rm.id ? "Select Raw Material" : undefined}
                      options={stock.filter(s => !s.isComposite).map(s => s.name)}
                      value={rm.name}
                      onChange={(val) => updateRawMaterial(rm.id, 'name', val)}
                    />
                    {rm.name && (
                      <div className="flex items-center gap-1.5 px-2">
                        <Box size={10} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          Available: <span className="text-indigo-600 font-black">{getAvailableStock(rm.name)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3 lg:col-span-2">
                    <Input 
                      label={rawMaterials[0].id === rm.id ? "Quantity Used" : undefined}
                      type="number"
                      placeholder="0"
                      value={rm.quantity}
                      onChange={(e) => updateRawMaterial(rm.id, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end pb-2">
                    <button 
                      type="button" 
                      onClick={() => handleRemoveRawMaterial(rm.id)}
                      disabled={rawMaterials.length === 1}
                      className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0 transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-indigo-100">
            <Button type="submit" variant="primary" loading={isSubmitting} className="w-full sm:w-auto shadow-xl shadow-indigo-100 px-8">
              <Save size={18} className="mr-2" /> {editingId ? 'Update Manufacturing Entry' : 'Save Manufacturing Entry'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <History size={18} className="text-slate-400" />
            Manufacturing History Logs
          </h3>
          <div className="relative w-full sm:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
              type="text" 
              placeholder="Search history..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>
        <Table headers={['Date', 'Staff', 'Location', 'Product Manufactured', 'Raw Materials Consumed', 'Action']}>
          {filteredRecords.length === 0 ? (
            <tr><td colSpan="5" className="py-16 text-center text-slate-400 font-medium">No manufacturing records found.</td></tr>
          ) : (
            filteredRecords
              .sort((a,b) => b.timestamp - a.timestamp)
              .map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">{r.date}</td>
                <td className="py-4 px-6 text-sm font-bold text-slate-900">{r.staffName}</td>
                <td className="py-4 px-6 text-sm font-medium text-slate-600 italic">{r.location || '-'}</td>
                <td className="py-4 px-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{r.productName}</span>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Qty Produced: {r.quantity}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-wrap gap-1.5 max-w-md">
                    {(r.rawMaterials || []).map((rm, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 whitespace-nowrap">
                        {rm.name} (-{rm.quantity})
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => handleEdit(r)} 
                      className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit Record"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(r.id)} 
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete Record"
                    >
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
  );
};

export default CandleManufacturing;
