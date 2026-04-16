import React, { useState } from 'react';
import { Card, Input, Select, Button, Table } from '../components/ui';
import { Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const Returns = () => {
  const { stock, channels, returnRecords, addReturnRecord, deleteReturnRecord } = useGlobalState();
  
  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    channel: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRecord = {
      ...formData,
      id: Date.now()
    };
    addReturnRecord(newRecord);
    setFormData({
      productName: '',
      quantity: '',
      channel: '',
      date: new Date().toISOString().split('T')[0],
      reason: ''
    });
    toast.success('Return logged & Stock restocked!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this return record? Inventory will be adjusted.')) {
      deleteReturnRecord(id);
      toast.error('Return deleted.');
    }
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
        <div className="mb-4 flex items-center gap-2 text-indigo-600 font-semibold">
          <Plus size={18} />
          Log a Return
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
            <Select 
              label="From Channel" 
              options={channels.map(c => c.name)} 
              value={formData.channel}
              onChange={(e) => setFormData({...formData, channel: e.target.value})}
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
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <Input 
                label="Reason for Return" 
                placeholder="e.g. Size issue, Order cancellation" 
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto h-[42px]">
              <Save size={18} /> Log Return
            </Button>
          </div>
        </form>
      </Card>

      <Card className="px-0 pt-0 pb-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Return History</h3>
          <div className="text-xs px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full font-bold">
            RESTOCKED
          </div>
        </div>
        <Table headers={['Date', 'Channel', 'SKU Name', 'Qty', 'Reason', 'Action']}>
          {returnRecords.length === 0 ? (
            <tr>
              <td colSpan="6" className="py-12 text-center text-slate-400">No return records found.</td>
            </tr>
          ) : (
            [...returnRecords].sort((a,b) => new Date(b.date) - new Date(a.date)).map(record => (
              <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600">{record.date}</td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900">{record.channel}</td>
                <td className="py-4 px-6 text-sm text-slate-800">{record.productName}</td>
                <td className="py-4 px-6 text-sm text-emerald-600 font-bold">+{record.quantity}</td>
                <td className="py-4 px-6 text-sm text-slate-500 truncate max-w-xs">{record.reason || 'N/A'}</td>
                <td className="py-4 px-6 text-right">
                  <button 
                    onClick={() => handleDelete(record.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
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

export default Returns;
