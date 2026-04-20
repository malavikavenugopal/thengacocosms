import React, { useState } from 'react';
import { Card, Input, Select, SearchableSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, Save, ShoppingCart } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const B2CShipments = () => {
  const [products, setProducts] = useState([{ id: Date.now(), name: '', quantity: '' }]);
  const { stock, staff, channels, b2cShipments: shipments, addB2CShipment, deleteB2CShipment } = useGlobalState();
  
  const [formData, setFormData] = useState({
    whoParceled: '',
    channel: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleAddProduct = () => setProducts([...products, { id: Date.now() + products.length, name: '', quantity: '' }]);
  const handleRemoveProduct = (id) => setProducts(products.filter((p) => p.id !== id));

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Inject packSize from Master Data for each product before saving
    const finalizedProducts = products.map(p => {
      const masterSKU = stock.find(s => s.name === p.name);
      return {
        name: p.name,
        quantity: p.quantity,
        packSize: masterSKU?.packSize || 1
      };
    });

    const newShipment = {
      ...formData,
      products: finalizedProducts,
      timestamp: Date.now()
    };
    addB2CShipment(newShipment);
    setFormData({ ...formData, whoParceled: '', channel: '' });
    setProducts([{ id: Date.now(), name: '', quantity: '' }]);
    toast.success('B2C Order recorded!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this record and restore stock?')) {
      deleteB2CShipment(id);
      toast.error('Order deleted & Stock restored.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
          <ShoppingCart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">B2C Retail Orders</h2>
          <p className="text-sm text-slate-500">Sales recorded here use the multiplier set in SKU Master</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SearchableSelect 
              label="Who Parceled" 
              options={staff.map(s => s.name)} 
              value={formData.whoParceled}
              onChange={(val) => setFormData({...formData, whoParceled: val})}
              required
            />
            <SearchableSelect 
              label="Sales Channel" 
              options={channels.map(c => c.name)} 
              value={formData.channel}
              onChange={(val) => setFormData({...formData, channel: val})}
              required
            />
            <Input 
              label="Order Date" 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                Add Products to Order
              </h3>
              <Button type="button" variant="ghost" onClick={handleAddProduct} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                + Add SKU
              </Button>
            </div>
            
            <div className="space-y-4">
              {products.map((product) => {
                const selectedSKU = stock.find(s => s.name === product.name);
                const packSize = selectedSKU?.packSize || 1;
                const totalDeduction = (Number(product.quantity) || 0) * packSize;
                
                return (
                  <div key={product.id} className="px-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-7">
                        <SearchableSelect 
                          label="Select Product / SKU"
                          options={stock.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)}
                          value={selectedSKU ? `[${selectedSKU.sku || 'N/A'}] ${selectedSKU.name} (Pack: ${selectedSKU.packSize || 1})` : ''}
                          onChange={(val) => {
                            const selectedName = stock.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                            updateProduct(product.id, 'name', selectedName || '');
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input 
                          label="Order Qty"
                          type="number"
                          min="1"
                          placeholder="0"
                          value={product.quantity}
                          onChange={(e) => updateProduct(product.id, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-2 py-3 text-center border-l border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">Inventory Deduction</p>
                        <p className="font-bold text-indigo-600">
                          {product.quantity ? `${product.quantity} x ${packSize} = ${totalDeduction}` : '-'}
                        </p>
                      </div>
                      <div className="md:col-span-1 flex justify-end pb-2">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveProduct(product.id)}
                          disabled={products.length === 1}
                          className="p-2 text-slate-300 hover:text-rose-500 disabled:opacity-0 transition-all font-bold"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    {selectedSKU && (
                      <div className="mt-2 flex items-center gap-3">
                         <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold uppercase tracking-wider">SKU Code: {selectedSKU.sku}</span>
                         <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold uppercase tracking-wider">Default Pack Size: {selectedSKU.packSize || 1}</span>
                         <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded font-medium italic">{selectedSKU.category}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button type="submit" className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200">
              <Save size={18} className="mr-2" /> Record B2C Order
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900">Recent B2C Orders</h3>
        </div>
        <Table headers={['Date', 'Channel', 'Parceled By', 'Products (Qty x Pack)', 'Total Units', 'Action']}>
          {shipments.length === 0 ? (
            <tr>
              <td colSpan="6" className="py-16 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <ShoppingCart size={32} className="text-slate-300" />
                  </div>
                  <p className="text-base font-medium text-slate-800">No shipments found</p>
                  <p className="text-sm text-slate-500 mt-1">Fill out the form above to record your first B2C order.</p>
                </div>
              </td>
            </tr>
          ) : (
            shipments.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-800 whitespace-nowrap">{s.date}</td>
                <td className="py-4 px-6 text-sm font-medium">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide
                    ${s.channel === 'Amazon' ? 'bg-amber-100 text-amber-800' : 
                      s.channel === 'Shopify' ? 'bg-emerald-100 text-emerald-800' :
                      s.channel === 'Flipkart' ? 'bg-sky-100 text-sky-800' :
                      'bg-slate-100 text-slate-800'}`}
                  >
                    {s.channel}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">{s.whoParceled}</td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  <div className="flex flex-col gap-1">
                    {s.products.map((p, idx) => {
                      const masterSKU = stock.find(item => item.name === p.name);
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded">{masterSKU?.sku || 'N/A'}</span>
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          <span className="text-xs text-slate-400">({p.quantity} × {p.packSize || 1})</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-indigo-600 font-bold">
                  {s.products.reduce((acc, curr) => acc + (Number(curr.quantity) * (Number(curr.packSize) || 1)), 0)} units
                </td>
                <td className="py-4 px-6 text-sm text-right">
                  <button 
                    onClick={() => handleDelete(s.id)}
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

export default B2CShipments;
