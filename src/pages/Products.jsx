import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Edit2, Check, X, Layers } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const Products = () => {
  const { stock, addSKU, updateSKU, deleteSKU } = useGlobalState();
  const [newProduct, setNewProduct] = useState({ name: '', opening: 0 });
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) return;
    
    if (stock.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase())) {
      toast.error('Product already exists!');
      return;
    }

    try {
      await addSKU({
        name: newProduct.name.trim(),
        opening: Number(newProduct.opening) || 0
      });
      setNewProduct({ name: '', opening: 0 });
      toast.success('Product added successfully!');
    } catch (err) {
      toast.error('Error adding SKU');
    }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditValue(product.name);
  };

  const saveEdit = async (id) => {
    if (!editValue.trim()) return;
    
    if (stock.some(p => p.id !== id && p.name.toLowerCase() === editValue.trim().toLowerCase())) {
      toast.error('Another product with this name already exists.');
      return;
    }

    try {
      await updateSKU(id, { name: editValue.trim() });
      setEditingId(null);
      setEditValue('');
      toast.success('Product updated!');
    } catch (err) {
      toast.error('Error updating SKU');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Delete this product? It will remove all inventory records for it.')) {
      try {
        await deleteSKU(id);
        toast.error('Product deleted.');
      } catch (err) {
        toast.error('Error deleting SKU');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <Layers size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">SKU Master</h2>
          <p className="text-sm text-slate-500">Manage your SKU catalog and opening stock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <div className="mb-4 flex items-center gap-2 text-indigo-600">
            <Plus size={18} />
            <h3 className="font-semibold">Add New SKU</h3>
          </div>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <Input 
              label="SKU Name" 
              placeholder="e.g. Extra Virgin Coconut Oil" 
              value={newProduct.name}
              onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              required
            />
            <Input 
              label="Opening Stock" 
              type="number" 
              placeholder="0" 
              value={newProduct.opening}
              onChange={(e) => setNewProduct({...newProduct, opening: e.target.value})}
            />
            <Button type="submit" className="w-full mt-2">
              Add SKU
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">SKU Inventory Catalog</h3>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
              Total items: {stock.length}
            </span>
          </div>
          <Table headers={['SKU Name', 'Opening Stock', 'Actions']}>
            {stock.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm font-semibold text-slate-900 w-full">
                  {editingId === product.id ? (
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(product.id)}
                      autoFocus
                    />
                  ) : (
                    <span>{product.name}</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap text-center">
                  {product.opening || 0}
                </td>
                <td className="py-4 px-6 text-sm whitespace-nowrap text-right">
                  {editingId === product.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => saveEdit(product.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Check size={18} />
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(product)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Products;
