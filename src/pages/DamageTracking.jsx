import React, { useState } from 'react';
import { Card, Input, Button, Table, Select } from '../components/ui';
import { AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const DamageTracking = () => {
  const { stock, damageRecords: records, addDamageRecord, deleteDamageRecord } = useGlobalState();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    productName: '',
    quantity: '',
    reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRecord = {
      ...formData,
      id: Date.now()
    };
    addDamageRecord(newRecord);
    setFormData({ 
      date: new Date().toISOString().split('T')[0], 
      productName: '', 
      quantity: '', 
      reason: '' 
    });
    toast.success('Damage recorded!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this record? Stock will be restored.')) {
      deleteDamageRecord(id);
      toast.error('Damage removed & Stock restored.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Damage Tracking</h2>
          <p className="text-sm text-slate-500">Log damaged or expired SKUs to maintain stock accuracy</p>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2 text-indigo-600 font-semibold">
          <Plus size={18} />
          Report Damage
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select 
              label="Select Product / SKU" 
              options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
              value={formData.productName ? stock.find(s => s.name === formData.productName) ? `[${stock.find(s => s.name === formData.productName).sku || 'N/A'}] ${formData.productName} (Pack: ${stock.find(s => s.name === formData.productName).packSize || 1})` : '' : ''}
              onChange={(e) => {
                const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === e.target.value)?.name;
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
            <Input 
              label="Date" 
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
            <div className="flex items-end flex-1">
              <Input 
                className="w-full"
                label="Reason" 
                placeholder="e.g. Expired, Leaking" 
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <Save size={18} /> Record Damage
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Damage Logs</h3>
        <Table headers={['Date', 'SKU Name', 'Qty', 'Reason', 'Action']}>
          {records.length === 0 ? (
            <tr>
              <td colSpan="5" className="py-12 text-center text-slate-400">No damage records found.</td>
            </tr>
          ) : (
            records.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600">{r.date}</td>
                <td className="py-4 px-6 text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-amber-600 uppercase tracking-tighter">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                    <span className="font-semibold text-slate-900">{r.productName}</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-rose-600 font-bold">-{r.quantity}</td>
                <td className="py-4 px-6 text-sm text-slate-500">{r.reason}</td>
                <td className="py-4 px-6 text-sm text-center">
                  <button 
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Delete Record & Restore Stock"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>
    </div>
  );
};

export default DamageTracking;
