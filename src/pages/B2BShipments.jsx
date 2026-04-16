import React, { useState } from 'react';
import { Card, Input, Select, Button, Table } from '../components/ui';
import { Plus, Trash2, Save, Package, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

import { useGlobalState } from '../context/GlobalContext';

const B2BShipments = () => {
  const [products, setProducts] = useState([{ name: '', quantity: '' }]);
  const { stock, staff, couriers, b2bShipments: shipments, addB2BShipment, deleteB2BShipment } = useGlobalState();
  
  const [formData, setFormData] = useState({
    whoParceled: '',
    clientName: '',
    courierName: '',
    boxes: '',
    date: ''
  });

  const handleAddProduct = () => setProducts([...products, { name: '', quantity: '' }]);
  const handleRemoveProduct = (index) => setProducts(products.filter((_, i) => i !== index));

  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newShipment = {
      ...formData,
      products: [...products],
      id: Date.now()
    };
    addB2BShipment(newShipment);
    setFormData({ whoParceled: '', clientName: '', courierName: '', boxes: '', date: '' });
    setProducts([{ name: '', quantity: '' }]);
    toast.success('B2B Shipment recorded!');
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this shipment and restore stock?')) {
      deleteB2BShipment(id);
      toast.error('Shipment deleted & Stock restored.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">B2B Shipments</h2>
        <p className="text-sm text-gray-500">Manage your business-to-business dispatches</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select 
              label="Who Parceled" 
              options={staff.map(s => s.name)} 
              value={formData.whoParceled}
              onChange={(e) => setFormData({...formData, whoParceled: e.target.value})}
              required
            />
            <Input 
              label="Client Name" 
              placeholder="e.g. Global Retailers" 
              value={formData.clientName}
              onChange={(e) => setFormData({...formData, clientName: e.target.value})}
              required
            />
            <Select 
              label="Courier Name" 
              options={couriers.map(c => c.name)} 
              value={formData.courierName}
              onChange={(e) => setFormData({...formData, courierName: e.target.value})}
              required
            />
            <Input 
              label="Number of Boxes" 
              type="number" 
              min="1" 
              placeholder="0"
              value={formData.boxes}
              onChange={(e) => setFormData({...formData, boxes: e.target.value})}
              required
            />
            <Input 
              label="Date" 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-gray-500" />
                SKUs in Order
              </h3>
              <Button type="button" variant="ghost" onClick={handleAddProduct} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                <Plus size={16} /> Add SKU
              </Button>
            </div>
            
            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <Select 
                      label={index === 0 ? "SKU Name" : undefined}
                      options={stock.map(s => s.name)}
                      value={product.name}
                      onChange={(e) => updateProduct(index, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <Input 
                      label={index === 0 ? "Quantity" : undefined}
                      type="number"
                      min="1"
                      placeholder="0"
                      value={product.quantity}
                      onChange={(e) => updateProduct(index, 'quantity', e.target.value)}
                      required
                    />
                  </div>
                  <div className="pb-1">
                    <button 
                      type="button" 
                      onClick={() => handleRemoveProduct(index)}
                      disabled={products.length === 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button type="submit">
              <Save size={16} /> Record Order
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900">Recent B2B Orders</h3>
        </div>
        <Table headers={['Date', 'Client', 'Courier', 'Parceled By', 'Total Units', 'SKUs', 'Action']}>
          {shipments.length === 0 ? (
            <tr>
              <td colSpan="7" className="py-16 text-center text-slate-500">
                 <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Package size={32} className="text-slate-300" />
                  </div>
                  <p className="text-base font-medium text-slate-800">No shipments found</p>
                  <p className="text-sm text-slate-500 mt-1">Fill out the form above to record your first B2B order.</p>
                </div>
              </td>
            </tr>
          ) : (
            shipments.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-800 whitespace-nowrap">{s.date}</td>
                <td className="py-4 px-6 text-sm font-medium text-slate-900">{s.clientName}</td>
                <td className="py-4 px-6 text-sm text-slate-600">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wide">
                    {s.courierName}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">{s.whoParceled}</td>
                <td className="py-4 px-6 text-sm text-slate-900 font-bold">
                  {s.products.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0)} units
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 truncate max-w-sm">
                  {s.products.map(p => `${p.name} (${p.quantity})`).join(', ')}
                </td>
                <td className="py-4 px-6 text-sm text-center">
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

export default B2BShipments;
