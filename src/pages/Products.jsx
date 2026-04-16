import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Edit2, Check, X, Layers, Box } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const Products = () => {
  const { stock, addSKU, updateSKU, deleteSKU } = useGlobalState();
  const [newProduct, setNewProduct] = useState({ 
    name: '', sku: '', category: '', opening: 0, packSize: 1, 
    isComposite: false, components: [] 
  });
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ 
    name: '', sku: '', category: '', packSize: 1, 
    isComposite: false, components: [] 
  });

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.sku.trim()) {
      toast.error('Name and SKU Code are required');
      return;
    }

    if (newProduct.isComposite && newProduct.components.length === 0) {
      toast.error('Please add at least one component to the bundle');
      return;
    }
    
    if (stock.some(p => p.sku.toLowerCase() === newProduct.sku.trim().toLowerCase())) {
      toast.error('This SKU Code already exists!');
      return;
    }

    try {
      await addSKU({
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim().toUpperCase(),
        category: newProduct.category.trim() || 'Other',
        opening: Number(newProduct.opening) || 0,
        packSize: Number(newProduct.packSize) || 1,
        isComposite: newProduct.isComposite,
        components: newProduct.isComposite ? newProduct.components : []
      });
      setNewProduct({ name: '', sku: '', category: '', opening: 0, packSize: 1, isComposite: false, components: [] });
      toast.success('SKU added successfully!');
    } catch (err) {
      toast.error('Error adding SKU');
    }
  };

  const addComponentRow = (isEdit = false) => {
    if (isEdit) {
      setEditFields({ ...editFields, components: [...editFields.components, { name: '', quantity: 1 }] });
    } else {
      setNewProduct({ ...newProduct, components: [...newProduct.components, { name: '', quantity: 1 }] });
    }
  };

  const removeComponentRow = (index, isEdit = false) => {
    if (isEdit) {
      setEditFields({ ...editFields, components: editFields.components.filter((_, i) => i !== index) });
    } else {
      setNewProduct({ ...newProduct, components: newProduct.components.filter((_, i) => i !== index) });
    }
  };

  const updateComponent = (index, field, value, isEdit = false) => {
    const target = isEdit ? { ...editFields } : { ...newProduct };
    const newComps = [...target.components];
    newComps[index][field] = value;
    if (isEdit) {
      setEditFields({ ...editFields, components: newComps });
    } else {
      setNewProduct({ ...newProduct, components: newComps });
    }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditFields({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      packSize: product.packSize || 1,
      isComposite: product.isComposite || false,
      components: product.components || []
    });
  };

  const saveEdit = async (id) => {
    if (!editFields.name.trim() || !editFields.sku.trim()) return;
    
    try {
      await updateSKU(id, {
        name: editFields.name.trim(),
        sku: editFields.sku.trim().toUpperCase(),
        category: editFields.category.trim(),
        packSize: Number(editFields.packSize) || 1,
        isComposite: editFields.isComposite,
        components: editFields.isComposite ? editFields.components : []
      });
      setEditingId(null);
      toast.success('Product updated!');
    } catch (err) {
      toast.error('Error updating SKU');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
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
          <p className="text-sm text-slate-500">Define your SKUs and Composite Bundles</p>
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
              label="SKU Code (Unique ID)" 
              placeholder="e.g. THENGA-123" 
              value={newProduct.sku}
              onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
              required
            />
            <Input 
              label="Product Name" 
              placeholder="e.g. Wood Spoon & Fork" 
              value={newProduct.name}
              onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input 
                label="Category" 
                placeholder="e.g. Bowls" 
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
              />
              <Input 
                label="Pack Size" 
                type="number" 
                min="1"
                placeholder="1, 2, 4..." 
                value={newProduct.packSize}
                onChange={(e) => setNewProduct({...newProduct, packSize: e.target.value})}
              />
            </div>
            {!newProduct.isComposite && (
              <Input 
                label="Opening Stock" 
                type="number" 
                placeholder="0" 
                value={newProduct.opening}
                onChange={(e) => setNewProduct({...newProduct, opening: e.target.value})}
              />
            )}
            
            <div className="pt-2 border-t border-slate-100">
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={newProduct.isComposite}
                    onChange={(e) => setNewProduct({...newProduct, isComposite: e.target.checked, components: e.target.checked ? [{name: '', quantity: 1}] : [], opening: 0})}
                  />
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Composite Product / Bundle?</span>
               </label>
               <p className="text-[10px] text-slate-400 mt-1 pl-6 italic">Stock will be deducted from solo items.</p>
            </div>

            {newProduct.isComposite && (
              <div className="space-y-3 mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                    <Box size={12} /> Composition
                  </p>
                  <button type="button" onClick={() => addComponentRow(false)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">+ Add Part</button>
                </div>
                {newProduct.components.map((comp, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select 
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={comp.name}
                        onChange={(e) => updateComponent(idx, 'name', e.target.value, false)}
                        required
                      >
                        <option value="">Select Part...</option>
                        {stock.filter(s => !s.isComposite && s.name !== newProduct.name).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-16">
                      <input 
                        type="number" 
                        min="1"
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none"
                        value={comp.quantity}
                        onChange={(e) => updateComponent(idx, 'quantity', e.target.value, false)}
                        required
                      />
                    </div>
                    <button type="button" onClick={() => removeComponentRow(idx, false)} className="text-slate-300 hover:text-rose-500 pt-2"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full mt-2">
              Add SKU
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Product List</h3>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
              Total items: {stock.length}
            </span>
          </div>
          <Table headers={['Category', 'SKU Code', 'Product / SKU Name', 'Status', 'Pack', 'Opening', 'Actions']}>
            {stock.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600">
                  {editingId === product.id ? (
                    <input
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs"
                      value={editFields.category}
                      onChange={(e) => setEditFields({...editFields, category: e.target.value})}
                    />
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase">{product.category || 'Other'}</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm font-mono font-bold text-slate-900">
                  {editingId === product.id ? (
                    <input
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs"
                      value={editFields.sku}
                      onChange={(e) => setEditFields({...editFields, sku: e.target.value})}
                    />
                  ) : (
                    <span>{product.sku || 'N/A'}</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-800">
                  {editingId === product.id ? (
                    <input
                      className="w-full px-2 py-1 bg-white border border-indigo-300 rounded text-xs"
                      value={editFields.name}
                      onChange={(e) => setEditFields({...editFields, name: e.target.value})}
                    />
                  ) : (
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      {product.isComposite && (
                        <span className="text-[9px] text-indigo-500 font-bold uppercase mt-0.5 flex items-center gap-1">
                          Bundle: {product.components?.map(c => `${c.quantity}x ${c.name}`).join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-4 px-6 text-sm">
                   {product.isComposite ? (
                     <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-black tracking-tighter uppercase">Bundle</span>
                   ) : (
                     <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black tracking-tighter uppercase">Solo</span>
                   )}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 font-bold">
                  {editingId === product.id ? (
                    <input
                      type="number"
                      className="w-16 px-2 py-1 bg-white border border-indigo-300 rounded text-xs"
                      value={editFields.packSize}
                      onChange={(e) => setEditFields({...editFields, packSize: e.target.value})}
                    />
                  ) : (
                    <span className="text-indigo-600">x{product.packSize || 1}</span>
                  )}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 text-center font-bold">
                  {product.isComposite ? <span className="text-slate-300">—</span> : (product.opening || 0)}
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
