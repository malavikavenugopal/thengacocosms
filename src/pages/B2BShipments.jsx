import React, { useState, useMemo, useEffect } from 'react';
import { Card, Input, Select, SearchableSelect, MultiSelect, Button, Table } from '../components/ui';
import { Plus, Trash2, Save, ShoppingCart, Edit2, X, Lock, Download, Filter, Calendar as CalendarIcon, Truck, Package, Box, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';


import { useGlobalState } from '../context/GlobalContext';
import { exportFormattedShipments } from '../utils/exportUtils';
import { generateVisualReport } from '../utils/visualReportUtils';
import { isRecordEditable } from '../utils/dateUtils';

const B2BShipments = () => {
  const { stock, staff, couriers, b2bShipments: shipments, addB2BShipment, updateB2BShipment, deleteB2BShipment, drafts, updateDraft, clearDraft, getAvailableStock } = useGlobalState();
  
  const [formData, setFormData] = useState(() => {
    const defaultDate = new Date().toISOString().split('T')[0];
    const saved = drafts.b2b?.formData;
    return {
      whoParceled: Array.isArray(saved?.whoParceled) ? saved.whoParceled : saved?.whoParceled ? [saved.whoParceled] : [],
      clientName: saved?.clientName || '',
      courierName: saved?.courierName || '',
      boxes: saved?.boxes || '',
      date: saved?.date || defaultDate,
      status: saved?.status || 'Packed'
    };
  });

  const [products, setProducts] = useState(() => {
    return drafts.b2b?.products || [{ id: Date.now(), name: '', quantity: '' }];
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync draft
  useEffect(() => {
    if (!isEditing) {
      updateDraft('b2b', { formData, products });
    }
  }, [formData, products, isEditing]);

  const [statusFilter, setStatusFilter] = useState('All');

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      // Status Filter
      if (statusFilter !== 'All' && shipment.status !== statusFilter) return false;

      // Date Filter
      let dateMatch = true;
      if (filterStartDate || filterEndDate) {
        const shipmentDate = new Date(shipment.date);
        const start = filterStartDate ? new Date(filterStartDate) : null;
        const end = filterEndDate ? new Date(filterEndDate) : null;
        
        if (start && end) dateMatch = shipmentDate >= start && shipmentDate <= end;
        else if (start) dateMatch = shipmentDate >= start;
        else if (end) dateMatch = shipmentDate <= end;
      }
      if (!dateMatch) return false;

      // Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const clientMatch = shipment.clientName.toLowerCase().includes(term);
        const courierMatch = shipment.courierName.toLowerCase().includes(term);
        const staffMatch = Array.isArray(shipment.whoParceled) 
          ? shipment.whoParceled.some(s => s?.toLowerCase().includes(term))
          : shipment.whoParceled?.toLowerCase().includes(term);
        const productMatch = shipment.products.some(p => {
          const masterSKU = stock.find(item => item.name === p.name);
          return p.name.toLowerCase().includes(term) || masterSKU?.sku?.toLowerCase().includes(term);
        });
        return clientMatch || courierMatch || staffMatch || productMatch;
      }

      return true;
    });
  }, [shipments, filterStartDate, filterEndDate, searchTerm, stock, statusFilter]);

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      exportFormattedShipments(
        filteredShipments, 
        'B2B', 
        `B2B_Shipments_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.success('Exporting B2B Shipments...');
    } finally {
      setIsExporting(false);
    }
  };

  const handleVisualReport = async () => {
    setIsGeneratingVisual(true);
    try {
      const title = filterStartDate || filterEndDate 
        ? `B2B Shipment Report`
        : "B2B Shipment Report";
      await generateVisualReport(filteredShipments, 'B2B', title, { startDate: filterStartDate, endDate: filterEndDate });
      toast.success('Report generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate visual report');
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleAddProduct = () => setProducts([...products, { id: Date.now() + products.length, name: '', quantity: '' }]);
  const handleRemoveProduct = (id) => setProducts(products.filter((p) => p.id !== id));

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {

        


      const finalizedProducts = products.map(p => {
        const masterSKU = stock.find(s => s.name === p.name);
        return {
          name: p.name,
          quantity: p.quantity,
          packSize: (() => {
            let ps = masterSKU?.packSize || 1;
            if (ps === 1) {
              const match = p.name.match(/\(\s*(?:Set|Pack)\s+of\s+(\d+)\s*\)/i);
              if (match && match[1]) ps = Number(match[1]);
            }
            return ps;
          })()
        };
      });

      const shipmentData = {
        ...formData,
        products: finalizedProducts
      };

      if (isEditing) {
        await updateB2BShipment(editingId, shipmentData);
        toast.success('B2B Shipment updated!');
      } else {
        await addB2BShipment(shipmentData);
        toast.success('B2B Shipment recorded!');
        clearDraft('b2b');
      }

      handleCancel();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save B2B shipment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setIsEditing(true);
    setEditingId(s.id);
    setFormData({
      whoParceled: Array.isArray(s.whoParceled) ? s.whoParceled : s.whoParceled ? [s.whoParceled] : [],
      clientName: s.clientName,
      courierName: s.courierName,
      boxes: s.boxes,
      date: s.date,
      status: s.status || 'Dispatched'
    });
    setProducts(s.products.map((p, idx) => ({ ...p, id: Date.now() + idx })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ whoParceled: [], clientName: '', courierName: '', boxes: '', date: new Date().toISOString().split('T')[0], status: 'Packed' });
    setProducts([{ id: Date.now(), name: '', quantity: '' }]);
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Delete this shipment?',
      text: "This will restore the deducted stock back to your inventory.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteB2BShipment(id);
        toast.error('Shipment deleted & Stock restored.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">{isEditing ? 'Edit B2B Shipment' : 'B2B Shipments'}</h2>
          <p className="text-sm text-gray-500">Manage your business-to-business dispatches</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isEditing && (
            <Button variant="ghost" onClick={handleCancel} className="text-rose-600 hover:bg-rose-50 flex-1 sm:flex-none">
              <X size={16} className="mr-2" /> Cancel Edit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <MultiSelect 
              label="Who Parceled" 
              options={staff.map(s => s.name)} 
              value={formData.whoParceled}
              onChange={(val) => setFormData({...formData, whoParceled: val})}
            />
            <Input 
              label="Client Name" 
              placeholder="e.g. Global Retailers" 
              value={formData.clientName}
              onChange={(e) => setFormData({...formData, clientName: e.target.value})}
              required
            />
            <SearchableSelect 
              label="Courier Name" 
              options={couriers.map(c => c.name)} 
              value={formData.courierName}
              onChange={(val) => setFormData({...formData, courierName: val})}
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
            <Select 
              label="Status"
              options={['Packed', 'Dispatched']}
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
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
            
            <div className="space-y-4">
              {products.map((product) => {
                const selectedSKU = stock.find(s => s.name === product.name);
                let packSize = selectedSKU?.packSize || 1;
                
                // Smart detection for UI
                if (packSize === 1 && product.name) {
                  const match = product.name.match(/\(\s*(?:Set|Pack)\s+of\s+(\d+)\s*\)/i);
                  if (match && match[1]) {
                    packSize = Number(match[1]);
                  }
                }

                const totalDeduction = (Number(product.quantity) || 0) * packSize;
                
                // Stock Availability Logic
                const available = product.name ? getAvailableStock(product.name) : null;
                let alreadyDeducted = 0;
                if (isEditing && product.name) {
                  const oldShipment = shipments.find(s => s.id === editingId);
                  const oldProduct = oldShipment?.products?.find(op => op.name === product.name);
                  if (oldProduct) {
                    alreadyDeducted = Number(oldProduct.quantity) * (Number(oldProduct.packSize) || 1);
                  }
                }
                const totalAvailable = available !== null ? available + alreadyDeducted : null;

                return (
                  <div key={product.id} className="px-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-7">
                        <SearchableSelect 
                          label={products[0].id === product.id ? "Select Product / SKU" : undefined}
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
                          label={products[0].id === product.id ? "Quantity" : undefined}
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
                       <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase tracking-wider border border-slate-200">SKU: {selectedSKU.sku}</span>
                             <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase tracking-wider border border-slate-200">
                               Pack: {(() => {
                                 let ps = selectedSKU.packSize || 1;
                                 if (ps === 1) {
                                   const match = selectedSKU.name.match(/\(\s*(?:Set|Pack)\s+of\s+(\d+)\s*\)/i);
                                   if (match && match[1]) return match[1] + " (Auto)";
                                 }
                                 return ps;
                               })()}
                             </span>
                             <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-medium italic">{selectedSKU.category}</span>
                          </div>

                          {/* Compact Stock Warning Box */}
                          <div className={`p-2 rounded-lg border transition-all ${totalAvailable <= 0 ? 'bg-red-50 border-red-200' : totalAvailable < 20 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50/30 border-emerald-100'}`}>
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                   <Box size={12} className={totalAvailable <= 0 ? 'text-red-600' : totalAvailable < 20 ? 'text-amber-600' : 'text-emerald-600'} />
                                   <div className="flex items-baseline gap-1.5">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Available Stock:</span>
                                      <span className={`text-xs font-black ${totalAvailable <= 0 ? 'text-red-700' : totalAvailable < 20 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                         {totalAvailable}
                                      </span>
                                   </div>
                                </div>
                                {totalAvailable <= 0 && <span className="text-[8px] font-black text-red-600 animate-pulse uppercase">Out of Stock</span>}
                                {totalAvailable > 0 && totalAvailable < 20 && <span className="text-[8px] font-black text-amber-600 uppercase">Low Stock</span>}
                             </div>

                             {/* Compact Combo Breakdown */}
                             {selectedSKU.isComposite && selectedSKU.components && (
                                <div className="mt-1.5 pt-1.5 border-t border-slate-200/50">
                                   <div className="flex flex-wrap gap-x-3 gap-y-1">
                                      {selectedSKU.components.map((comp, idx) => {
                                         const compStock = getAvailableStock(comp.name);
                                         return (
                                            <div key={idx} className="flex items-center gap-1">
                                               <span className="text-[8px] font-medium text-slate-500">{comp.name}:</span>
                                               <span className={`text-[8px] font-black ${compStock <= 0 ? 'text-red-600' : 'text-slate-800'}`}>{compStock}</span>
                                            </div>
                                         );
                                      })}
                                   </div>
                                </div>
                             )}
                          </div>
                       </div>
                     )}


                   </div>
                 );
               })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            {isEditing && (
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={isSubmitting}>
              <Save size={16} className="mr-2" /> {isEditing ? 'Update Order' : 'Record Order'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
             <div className="w-full md:w-64">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Quick Search</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder="Client, MCQ, Product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none placeholder:text-slate-300"
                  />
                </div>
             </div>
             <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Start Date</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
             </div>
             <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">End Date</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
             </div>
             <div className="w-full md:w-auto">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Status</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                >
                  <option value="All">All Status</option>
                  <option value="Packed">Packed Only</option>
                  <option value="Dispatched">Dispatched Only</option>
                </select>
             </div>
             {(filterStartDate || filterEndDate || searchTerm || statusFilter !== 'All') && (
               <button 
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setSearchTerm(''); setStatusFilter('All'); }}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 underline flex items-center md:pt-6"
               >
                 Clear All
               </button>
             )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto">
            <Button onClick={handleVisualReport} variant="secondary" className="bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 flex-1 sm:flex-none" loading={isGeneratingVisual}>
              <Package size={16} className="mr-2" /> Visual Report
            </Button>
            <Button onClick={exportToExcel} variant="success" className="shadow-xl shadow-emerald-100 flex-1 sm:flex-none" loading={isExporting}>
              <Download size={16} className="mr-2" /> Export
            </Button>
          </div>
        </div>
        
        <Table headers={['Date', 'Client / Courier', 'Shipment Details', 'Action']}>
          {filteredShipments.length === 0 ? (
            <tr>
              <td colSpan="4" className="py-16 text-center text-slate-500">
                 <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Package size={32} className="text-slate-300" />
                  </div>
                  <p className="text-base font-medium text-slate-800">No shipments found</p>
                  <p className="text-sm text-slate-500 mt-1">Try adjusting your date filters or add a new record.</p>
                </div>
              </td>
            </tr>
          ) : (
            filteredShipments.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-800 whitespace-nowrap">{s.date}</td>
                <td className="py-4 px-6 text-sm">
                  <div className="font-bold text-slate-900">{s.clientName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-500">{s.courierName}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${s.status === 'Packed' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {s.status || 'Dispatched'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1">Parceled By: {Array.isArray(s.whoParceled) ? s.whoParceled.join(', ') : s.whoParceled}</div>
                </td>
                <td className="py-4 px-6 text-sm">
                  <div className="min-w-[450px]">
                    {/* Internal Table Header */}
                    <div className="grid grid-cols-[1fr,60px,60px,60px] gap-2 mb-2 px-2 py-1 bg-slate-50 rounded text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Product</span>
                      <span className="text-center">Qty</span>
                      <span className="text-center">Pack</span>
                      <span className="text-center">Total</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(s.products || []).map((p, idx) => {
                         const masterSKU = stock.find(item => item.name === p.name);
                         let ps = p.packSize || 1;
                         if (ps === 1) {
                           const match = p.name.match(/\(\s*(?:Set|Pack)\s+of\s+(\d+)\s*\)/i);
                           if (match && match[1]) ps = Number(match[1]);
                         }
                         return (
                          <div key={idx} className="grid grid-cols-[1fr,50px,50px,60px] gap-2 items-center px-2 py-2 border-b border-slate-100 last:border-0 hover:bg-white rounded transition-colors group">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded shrink-0 border border-emerald-100">{masterSKU?.sku || 'N/A'}</span>
                              <span className="font-semibold text-slate-800 break-words line-clamp-2" title={p.name}>{p.name}</span>
                            </div>
                            <div className="text-center font-bold text-slate-900">{p.quantity}</div>
                            <div className="text-center text-slate-400 font-medium">{ps}</div>
                            <div className="text-center font-bold text-emerald-600 bg-emerald-50/50 py-0.5 rounded">{Number(p.quantity) * ps}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-center">
                  <div className="flex items-center justify-center gap-2">
                    {isRecordEditable(s.date) ? (
                      <>
                        <button 
                          onClick={() => handleEdit(s)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                          title="Edit Record"
                        >
                          <Edit2 size={18} />
                        </button>
                        {s.status === 'Packed' && (
                          <button 
                            onClick={async () => {
                              try {
                                await updateB2BShipment(s.id, { ...s, status: 'Dispatched' });
                                toast.success('Shipment marked as Dispatched!');
                              } catch (err) {
                                toast.error('Failed to update status');
                              }
                            }}
                            className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                            title="Mark as Dispatched"
                          >
                            <Truck size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          title="Delete Record"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    ) : (
                      <span className="p-1.5 text-slate-300 flex items-center gap-1 cursor-not-allowed" title="Records older than 5 days cannot be edited">
                        <Lock size={16} />
                        <span className="text-[10px] uppercase font-bold tracking-tighter">Locked</span>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>
      <Card className="px-0 pt-0 pb-0 overflow-hidden shadow-none border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/10">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Package size={18} className="text-indigo-500" />
            Product-wise Summary (Filtered)
          </h3>
          <p className="text-xs text-slate-500 mt-1 italic">Total units ordered across all filtered shipments</p>
        </div>
        <div className="overflow-x-auto">
          <Table headers={['SKU Code', 'Component / Solo Product', 'Stock Out']}>
            {(() => {
              const summaryMap = filteredShipments
                .filter(s => s.status !== 'Packed') // Only count Dispatched (Stock Out)
                .flatMap(s => s.products || [])
                .reduce((acc, p) => {
                  const master = stock.find(item => item.name === p.name);
                  const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
                  
                  if (master?.isComposite && master.components) {
                    master.components.forEach(comp => {
                      const compUnits = totalUnits * (Number(comp.quantity) || 1);
                      if (!acc[comp.name]) acc[comp.name] = 0;
                      acc[comp.name] += compUnits;
                    });
                  } else {
                    if (!acc[p.name]) acc[p.name] = 0;
                    acc[p.name] += totalUnits;
                  }
                  return acc;
                }, {});

              const summaryEntries = Object.entries(summaryMap);

              if (summaryEntries.length === 0) {
                return <tr><td colSpan="4" className="py-12 text-center text-slate-400 font-medium whitespace-nowrap">No summary data available.</td></tr>;
              }

              return summaryEntries.map(([name, units], idx) => {
                const masterSKU = stock.find(s => s.name === name);
                const availableStock = getAvailableStock(name);
                const isShort = availableStock < units;

                return (
                  <tr key={idx} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 font-medium font-semibold text-slate-900">
                    <td className="py-4 px-6 text-sm">
                      <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1 rounded">{masterSKU?.sku || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6 text-sm">{name}</td>
                    <td className="py-4 px-6 text-sm text-right pr-12 font-black text-indigo-600">{units} Units</td>
                  </tr>
                );
              });
            })()}
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default B2BShipments;
