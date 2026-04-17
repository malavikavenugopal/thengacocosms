import React, { useState } from 'react';
import { Card, Input, Button, Table } from '../components/ui';
import { Plus, Trash2, Edit2, Check, X, Layers, Box, Upload, FileDown } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = React.useRef(null);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white cursor-pointer flex justify-between items-center hover:border-indigo-300 transition-colors"
      >
        <span className={value ? "text-slate-900 font-medium" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <Plus size={12} className="rotate-45 text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100">
          <input 
            autoFocus
            type="text"
            className="w-full p-2 mb-2 text-xs border-b border-slate-100 outline-none placeholder:text-slate-300 font-medium"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, i) => (
                <div 
                  key={i}
                  className={`p-2 text-xs rounded-lg cursor-pointer transition-colors ${
                    value === opt 
                      ? 'bg-indigo-50 text-indigo-700 font-bold' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="p-2 text-[10px] text-slate-400 italic text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Products = () => {
  const { stock, addSKU, updateSKU, deleteSKU } = useGlobalState();
  const [newProduct, setNewProduct] = useState({ 
    name: '', sku: '', category: '', opening: 0, packSize: 1, 
    isComposite: false, components: [] 
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filter State
  const [filterType, setFilterType] = useState('all'); // all, solo, composite

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      toast.error('Product Name is required');
      return;
    }

    if (newProduct.isComposite && !newProduct.sku.trim()) {
      toast.error('SKU Code is required for bundles');
      return;
    }
    
    // No restrictions on SKU uniqueness for bulk or manual as per request
    try {
      await addSKU({
        name: newProduct.name.trim(),
        sku: (newProduct.isComposite ? newProduct.sku.trim().toUpperCase() : ''),
        category: newProduct.category.trim() || 'Other',
        opening: Number(newProduct.opening) || 0,
        packSize: Number(newProduct.packSize) || 1,
        isComposite: newProduct.isComposite,
        components: newProduct.isComposite ? newProduct.components : []
      });
      setNewProduct({ name: '', sku: '', category: '', opening: 0, packSize: 1, isComposite: false, components: [] });
      toast.success('Product added successfully!');
    } catch (err) {
      toast.error('Error adding product');
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
    setEditingProduct({
      ...product,
      components: product.components || []
    });
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingProduct.name.trim()) return;
    if (editingProduct.isComposite && !editingProduct.sku.trim()) return;
    
    try {
      await updateSKU(editingProduct.id, {
        name: editingProduct.name.trim(),
        sku: (editingProduct.isComposite ? editingProduct.sku.trim().toUpperCase() : ''),
        category: editingProduct.category.trim() || 'Other',
        packSize: Number(editingProduct.packSize) || 1,
        isComposite: editingProduct.isComposite,
        components: editingProduct.isComposite ? editingProduct.components : []
      });
      setIsEditModalOpen(false);
      setEditingProduct(null);
      toast.success('Product updated successfully!');
    } catch (err) {
      toast.error('Error updating product');
    }
  };

  const cancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingProduct(null);
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

  const [searchTerm, setSearchTerm] = useState('');

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let addedCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);

        try {
          // Normalize column names to handle variations
          const type = (row.type || row.producttype || 'solo').toLowerCase();
          const isComposite = type === 'composite' || type === 'bundle';
          const name = row.name || row.productname || row.itemname;
          const sku = (row.sku || row.skucode || row.id || '').toUpperCase();
          const category = row.category || row.group || 'Other';
          const packSize = Number(row.packsize || row.pack) || 1;
          const opening = Number(row.openingstock || row.opening || row.stock) || 0;
          
          let components = [];
          if (isComposite && (row.components || row.parts)) {
            const compStr = row.components || row.parts;
            try {
              components = compStr.split(';').map(part => {
                if (!part.includes(':')) return null;
                const [pName, pQty] = part.split(':');
                return { name: pName.trim(), quantity: Number(pQty) || 1 };
              }).filter(p => p && p.name);
            } catch (e) {
              console.warn(`Row ${i}: Error parsing components`, e);
              components = [];
            }
          }

          if (!name) {
            console.warn(`Row ${i}: Missing product name, skipping.`, row);
            errorCount++;
            continue;
          }

          const productData = {
            name,
            sku: isComposite ? sku : '',
            category,
            packSize,
            opening: isComposite ? 0 : opening,
            isComposite,
            components
          };

          console.log(`Row ${i}: Attempting to add`, productData);
          await addSKU(productData);
          addedCount++;
        } catch (err) {
          console.error(`Row ${i}: Failed to upload`, err);
          errorCount++;
        }
      }

      console.log(`Bulk Upload Summary: ${addedCount} added, ${errorCount} failed.`);
      toast.success(`Bulk Upload Complete! Added ${addedCount} products.`);
      if (errorCount > 0) toast.error(`Failed to add ${errorCount} items. Check format.`);
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };

  const downloadTemplate = (isBundle = false) => {
    let csvContent = "";
    if (isBundle) {
      csvContent = "Type,SKU,Name,Category,PackSize,Components\nComposite,BUNDLE-123,Thengacoco Premium Set,Bowls,1,Teak Bowl:2;Wooden Spoon:2";
    } else {
      csvContent = "Type,Name,Category,PackSize,OpeningStock\nSolo,Teak Bowl,Bowls,1,150";
    }
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isBundle ? "composite_template.csv" : "solo_template.csv";
    a.click();
  };

  const filteredStock = stock.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesFilter = filterType === 'all' || 
      (filterType === 'solo' && !p.isComposite) || 
      (filterType === 'composite' && p.isComposite);
      
    return matchesSearch && matchesFilter;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredStock.length / itemsPerPage);
  const paginatedStock = filteredStock.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">SKU Master</h2>
            <p className="text-sm text-slate-500">Define your SKUs and Composite Bundles</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="relative group">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleBulkUpload} 
                className="hidden" 
                id="bulk-upload-input" 
              />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => document.getElementById('bulk-upload-input').click()}
                className="text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
              >
                <Upload size={16} className="mr-2" /> Bulk Upload
              </Button>
           </div>
           <div className="flex gap-1 bg-slate-100/50 p-1 rounded-lg">
              <Button variant="ghost" size="sm" onClick={() => downloadTemplate(false)} className="h-8 text-[10px] font-bold text-slate-500 hover:text-indigo-600 px-2" title="Solo Template">
                <FileDown size={14} className="mr-1" /> SOLO TEMPLATE
              </Button>
              <div className="w-px h-4 bg-slate-200 self-center mx-1"></div>
              <Button variant="ghost" size="sm" onClick={() => downloadTemplate(true)} className="h-8 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 px-2" title="Bundle Template">
                <FileDown size={14} className="mr-1" /> BUNDLE TEMPLATE
              </Button>
           </div>
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
                    onChange={(e) => setNewProduct({...newProduct, isComposite: e.target.checked, components: e.target.checked ? [{name: '', quantity: 1}] : [], opening: 0, sku: ''})}
                  />
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Composite Product / Bundle?</span>
               </label>
               <p className="text-[10px] text-slate-400 mt-1 pl-6 italic">Stock will be deducted from solo items.</p>
            </div>

            {newProduct.isComposite && (
              <Input 
                label="SKU Code (Unique ID)" 
                placeholder="e.g. THENGA-123" 
                value={newProduct.sku}
                onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                required={newProduct.isComposite}
              />
            )}

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
                      <SearchableSelect 
                        placeholder="Select Part..."
                        value={comp.name}
                        options={stock.filter(s => !s.isComposite && s.name !== newProduct.name).map(s => s.name)}
                        onChange={(val) => updateComponent(idx, 'name', val, false)}
                      />
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
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Product List</h3>
              <p className="text-[10px] text-slate-500">Managing {filteredStock.length} items</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
               <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {['all', 'solo', 'composite'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${
                        filterType === t 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
               </div>
               <div className="w-full sm:w-64">
                  <input 
                    type="text"
                    placeholder="Search SKU, Name or Category..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>
          </div>
          <Table headers={['Category', 'SKU Code', 'Product / SKU Name', 'Status', 'Pack', 'Opening', 'Actions']}>
            {paginatedStock.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase">{product.category || 'Other'}</span>
                </td>
                <td className="py-4 px-6 text-sm font-mono font-bold text-slate-900">
                    <span>{product.sku || '-'}</span>
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-800">
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      {product.isComposite && (
                        <span className="text-[9px] text-indigo-500 font-bold uppercase mt-0.5 flex items-center gap-1">
                          Bundle: {product.components?.map(c => `${c.quantity}x ${c.name}`).join(', ')}
                        </span>
                      )}
                    </div>
                </td>
                <td className="py-4 px-6 text-sm">
                   {product.isComposite ? (
                     <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-black tracking-tighter uppercase">Bundle</span>
                   ) : (
                     <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black tracking-tighter uppercase">Solo</span>
                   )}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 font-bold">
                    <span className="text-indigo-600">x{product.packSize || 1}</span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 text-center font-bold">
                  {product.isComposite ? <span className="text-slate-300">—</span> : (product.opening || 0)}
                </td>
                <td className="py-4 px-6 text-sm whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(product)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                </td>
              </tr>
            ))}
          </Table>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between px-2">
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
              Showing <span className="text-indigo-600 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-indigo-600 font-bold">{Math.min(currentPage * itemsPerPage, filteredStock.length)}</span> of <span className="text-slate-900 font-bold">{filteredStock.length}</span> items
            </p>
            <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-8 px-2 text-[10px] font-bold"
              >
                PREV
              </Button>
              
              <div className="flex gap-1 px-1">
                {(() => {
                  let start = Math.max(1, currentPage - 1);
                  let end = Math.min(totalPages, start + 2);
                  if (end === totalPages) start = Math.max(1, end - 2);
                  
                  const pages = [];
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 text-[10px] font-black rounded-lg transition-all ${
                          currentPage === i 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' 
                            : 'text-slate-500 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pages;
                })()}
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-8 px-2 text-[10px] font-bold text-indigo-600"
              >
                NEXT
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Product</h3>
                  <p className="text-xs text-slate-500">Modify SKU details and composition</p>
                </div>
              </div>
              <button onClick={cancelEdit} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh] space-y-4">
              <Input 
                label="Product Name" 
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input 
                  label="Category" 
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                />
                <Input 
                  label="Pack Size" 
                  type="number" 
                  value={editingProduct.packSize}
                  onChange={(e) => setEditingProduct({...editingProduct, packSize: e.target.value})}
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={editingProduct.isComposite}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct, 
                        isComposite: e.target.checked,
                        components: e.target.checked && editingProduct.components.length === 0 ? [{name: '', quantity: 1}] : editingProduct.components
                      })}
                    />
                    <span className="text-sm font-semibold text-slate-700">Composite Product / Bundle?</span>
                 </label>
              </div>

              {editingProduct.isComposite && (
                <Input 
                  label="SKU Code" 
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                  required
                />
              )}

              {editingProduct.isComposite && (
                <div className="space-y-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-indigo-600 uppercase">Composition</p>
                    <button type="button" onClick={() => {
                      const newComps = [...editingProduct.components, { name: '', quantity: 1 }];
                      setEditingProduct({...editingProduct, components: newComps});
                    }} className="text-[10px] font-bold text-indigo-600">+ Add Part</button>
                  </div>
                  {editingProduct.components.map((comp, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <SearchableSelect 
                          placeholder="Select Part..."
                          value={comp.name}
                          options={stock.filter(s => !s.isComposite && s.id !== editingProduct.id).map(s => s.name)}
                          onChange={(val) => {
                            const newComps = [...editingProduct.components];
                            newComps[idx].name = val;
                            setEditingProduct({...editingProduct, components: newComps});
                          }}
                        />
                      </div>
                      <div className="w-16">
                        <input 
                          type="number" 
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg"
                          value={comp.quantity}
                          onChange={(e) => {
                            const newComps = [...editingProduct.components];
                            newComps[idx].quantity = e.target.value;
                            setEditingProduct({...editingProduct, components: newComps});
                          }}
                        />
                      </div>
                      <button onClick={() => {
                        const newComps = editingProduct.components.filter((_, i) => i !== idx);
                        setEditingProduct({...editingProduct, components: newComps});
                      }} className="text-rose-500 pt-2"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 sticky bottom-0 border-t border-slate-100">
              <Button variant="ghost" className="flex-1" onClick={cancelEdit}>Cancel</Button>
              <Button className="flex-1" onClick={saveEdit}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
