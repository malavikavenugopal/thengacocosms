import React, { useState } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, RotateCcw, Save, Lock, Edit2, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';

const Returns = () => {
  const { stock, channels, returnRecords, addReturnRecord, updateReturnRecord, deleteReturnRecord, drafts, updateDraft, clearDraft } = useGlobalState();
  
  const [formData, setFormData] = useState(() => {
    return drafts.return || {
      productName: '',
      quantity: '',
      channel: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      condition: 'Good (Reuse)'
    };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Sync draft
  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('return', formData);
    }
  }, [formData, isEditing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRecord = {
      ...formData,
      isReusable: formData.condition === 'Good (Reuse)',
      isDamaged: formData.condition === 'Damaged (Waste)',
      id: Date.now()
    };

    if (newRecord.isReusable) {
      Swal.fire({
        title: isEditing ? 'Update & Adjust?' : 'Adjust Inventory?',
        text: `Record for ${formData.quantity} reusable units of ${formData.productName}. Apply stock change?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Yes, Adjust Stock',
        cancelButtonText: 'Log Only'
      }).then(async (result) => {
        if (isEditing) {
          await updateReturnRecord(editingId, newRecord, result.isConfirmed);
          toast.success('Return updated!');
        } else {
          addReturnRecord(newRecord, result.isConfirmed);
          toast.success(result.isConfirmed ? 'Return logged & Stock adjusted!' : 'Return logged (History only).');
          clearDraft('return');
        }
        handleCancel();
      });
    } else {
      if (isEditing) {
        updateReturnRecord(editingId, newRecord, false);
      } else {
        addReturnRecord(newRecord, false);
      }
      handleCancel();
      toast.success(isEditing ? 'Return updated (No stock change).' : 'Return logged (Damaged items not restocked).');
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setFormData({
      productName: record.productName,
      quantity: record.quantity,
      channel: record.channel,
      date: record.date,
      reason: record.reason || '',
      condition: record.isReusable ? 'Good (Reuse)' : 'Damaged (Waste)'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      productName: '',
      quantity: '',
      channel: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      condition: 'Good (Reuse)'
    });
  };

  const handleDelete = (record) => {
    Swal.fire({
      title: 'Delete return record?',
      text: record.deducted ? "This will deduct the previously added stock from your inventory." : "This will remove the log record (No stock change).",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteReturnRecord(record.id);
        toast.error('Return record deleted.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
          <RotateCcw size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Returns Management</h2>
          <p className="text-sm text-slate-500">Track SKU returns from channels and restock inventory</p>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold">
            <Plus size={18} />
            {isEditing ? 'Edit Return Log' : 'Log a Return'}
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
            <div className="flex gap-3">
              {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
              <Button type="submit" className="px-8">
                <Save size={18} /> {isEditing ? 'Update Log' : 'Log Return'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card className="px-0 pt-0 pb-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Return History</h3>
        </div>
        <Table headers={['Date', 'Condition', 'Adjusted?', 'Channel', 'SKU Name', 'Qty', 'Reason', 'Action']}>
          {returnRecords.length === 0 ? (
            <tr>
              <td colSpan="7" className="py-12 text-center text-slate-400">No return records found.</td>
            </tr>
          ) : (
            [...returnRecords].sort((a,b) => new Date(b.date) - new Date(a.date)).map(record => (
              <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600">{record.date}</td>
                <td className="py-4 px-6 text-sm">
                   {record.isReusable ? (
                     <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">RESTOCKED</span>
                   ) : (
                     <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold">DAMAGED</span>
                   )}
                </td>
                 <td className="py-4 px-6 text-sm">
                   {record.deducted ? (
                     <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold italic">YES (+{record.quantity})</span>
                   ) : (
                     <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">NO</span>
                   )}
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900">{record.channel}</td>
                <td className="py-4 px-6 text-sm text-slate-800 leading-relaxed">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-rose-600 uppercase tracking-tighter">{stock.find(s => s.name === record.productName)?.sku || 'N/A'}</span>
                    <span className="font-semibold text-slate-900">{record.productName}</span>
                  </div>
                </td>
                <td className={`py-4 px-6 text-sm font-bold ${record.isReusable ? 'text-emerald-600' : 'text-rose-600'}`}>+{record.quantity}</td>
                <td className="py-4 px-6 text-sm text-slate-500 leading-relaxed">{record.reason || 'N/A'}</td>
                 <td className="py-4 px-6 text-right">
                   {isRecordEditable(record.date) ? (
                     <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                          title="Edit Log"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(record)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          title="Delete Record"
                        >
                          <Trash2 size={18} />
                        </button>
                     </div>
                   ) : (
                     <div className="flex justify-end p-1.5 text-slate-300" title="Records older than 5 days cannot be deleted">
                        <Lock size={16} />
                     </div>
                   )}
                 </td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </div>
  );
};

export default Returns;
