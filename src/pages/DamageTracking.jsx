import React, { useState } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { AlertTriangle, Plus, Trash2, Save, ClipboardCheck, History, CheckCircle2, XCircle, Info, Lock, Edit2, X, Camera, Image as ImageIcon, Download, FileText, Upload, MessageCircle, Mail, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';
import emailjs from 'emailjs-com';

const DamageTracking = () => {
  const { stock, damageRecords, addDamageRecord, updateDamageRecord, deleteDamageRecord, qcRecords, addQCRecord, updateQCRecord, deleteQCRecord, drafts, updateDraft, clearDraft, purchaseRecords, vendors, uploadQCImages, getQCImageBase64 } = useGlobalState();
  
  const sendQCEmail = (vendorName, date, products, images = []) => {
    // Replace these with your actual EmailJS credentials
    const SERVICE_ID = "service_xkm5bck";
    const TEMPLATE_ID = "template_hatngnl";
    const PUBLIC_KEY = "NWluldMCpFboOvNZG";

    // Format product details as a multi-line string/HTML
    const productDetails = (products || []).map(p => 
      `• <b>${p.productName}</b>: Checked: ${p.checked}, Rejected: ${p.rejected || 0}, Damaged: ${p.damaged}, Approved: ${Number(p.checked) - Number(p.damaged) - (Number(p.rejected) || 0)}`
    ).join('<br/>');

    // Format images as HTML tags
    const imageHtml = images && images.length > 0 
      ? `<br/><br/><b>Inspection Photos:</b><br/>` + 
        images.map(url => `<br/><img src="${url}" alt="QC Photo" style="max-width: 400px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 10px;" />`).join('')
      : '';

    const recipients = ["malavikavenu914@gmail.com", "nandanalakshmi21@gmail.com"];
    
    // Loop through each recipient to ensure everyone definitely receives it
    recipients.forEach(email => {
      const templateParams = {
        to_email: email,
        vendor_name: vendorName || "N/A",
        date: date,
        product_details: productDetails + imageHtml 
      };

      emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
        .then((res) => {
          console.log(`Email sent to ${email}:`, res.status);
        })
        .catch((err) => {
          console.error(`Failed to send to ${email}:`, err);
        });
    });
    
    toast.success("Email sent to all accounts!");
  };
  const [activeTab, setActiveTab] = useState('qc'); 
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All Vendors');
  const [selectedImages, setSelectedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (selectedImages.length + files.length > 4) {
      toast.error("Maximum 4 images allowed");
      return;
    }
    setSelectedImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const generatePDFReport = async (vendorName, date, products, imagesArray = [], isShare = false) => {
    if (!products || products.length === 0) {
      toast.error("No product data to generate report.");
      return null;
    }
    
    // If it's a summary and imagesArray is empty, collect from all products
    let finalImages = [...imagesArray];
    if (products.length > 1 && finalImages.length === 0) {
       products.forEach(p => {
         if (p.images && p.images.length > 0) finalImages.push(...p.images);
       });
    }

    const doc = new jsPDF();
    const isSummary = products.length > 1;
    
    // Header
    try {
      doc.addImage("/logo.jpg", "JPEG", 15, 12, 18, 18);
    } catch (e) {
      console.error("Logo failed to load", e);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.setTextColor(5, 150, 105); // Emerald Green
    doc.text("ThengaCoco", 38, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Quality Assurance & Inspection Report", 38, 30);
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 195, 20, { align: 'right' });

    doc.setDrawColor(5, 150, 105);
    doc.line(15, 35, 195, 35);

    doc.setFontSize(12);
    doc.setTextColor(60);
    if (!isSummary) {
      doc.text(`Vendor: ${vendorName || 'N/A'}`, 15, 45);
      doc.text(`Inspection Date: ${date}`, 15, 52);
    } else {
      doc.text(`Vendor: ${vendorFilter}`, 15, 45);
      doc.text(`Total Records: ${products.length}`, 15, 52);
    }
    
    // Table
    const tableData = products.map((p, i) => [
      i + 1,
      p.date || date,
      isSummary ? `${p.productName}\n(${p.vendorName || 'N/A'})` : p.productName,
      p.checked,
      Number(p.checked) - (Number(p.damaged) || 0) - (Number(p.rejected) || 0),
      p.damaged || 0,
      p.rejected || 0
    ]);
    
    autoTable(doc, {
      startY: 60,
      head: [['#', 'Date', 'Product / Vendor', 'Checked', 'Good', 'Damaged', 'Rejected']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] }
    });

    // Add Images if they exist
    if (finalImages && finalImages.length > 0) {
      console.log("PDF DEBUG: Images found:", finalImages);
      toast.loading("Preparing " + finalImages.length + " inspection photos...");
      doc.addPage();
      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.text("Inspection Gallery", 15, 20);
      doc.line(15, 25, 195, 25);

      let x = 15;
      let y = 35;
      for (let i = 0; i < finalImages.length; i++) {
        const imgUrl = finalImages[i];
        if (!imgUrl || typeof imgUrl !== 'string') {
          console.warn(`PDF DEBUG: skipping image ${i+1} - invalid URL type:`, typeof imgUrl);
          continue;
        }

        try {
          console.log(`PDF DEBUG: Processing #${i+1}: ${imgUrl}`);
          const base64 = await getQCImageBase64(imgUrl);
          
          if (base64 && base64.startsWith('data:')) {
            console.log(`PDF DEBUG: Image #${i+1} Base64 ready`);
            const format = imgUrl.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
            doc.addImage(base64, format, x, y, 85, 60, undefined, 'FAST');
          } else {
            console.warn(`PDF DEBUG: Image #${i+1} failed conversion, using link fallback`);
            doc.setDrawColor(5, 150, 105);
            doc.rect(x, y, 85, 60);
            doc.setFontSize(10);
            doc.setTextColor(5, 150, 105);
            doc.text("Photo Link (Click View)", x + 10, y + 25);
            doc.textWithLink("View Inspection Photo", x + 10, y + 35, { url: imgUrl });
          }
          
          if ((i + 1) % 2 === 0) {
            x = 15;
            y += 70;
          } else {
            x = 110;
          }

          if (y > 240 && i < finalImages.length - 1) {
            doc.addPage();
            y = 20;
            x = 15;
          }
        } catch (err) {
          console.error(`PDF DEBUG: Error on image #${i+1}:`, err);
        }
      }
      toast.dismiss();
    } else {
      console.log("PDF DEBUG: No images to process.");
    }
    
    if (isShare) return doc;
    doc.save(isSummary ? `QC_History_Summary_${new Date().toISOString().split('T')[0]}.pdf` : `QC_Report_${vendorName}_${date}.pdf`);
  };

  const generateDamagePDFReport = (records) => {
    if (!records || records.length === 0) {
      toast.error("No records to export.");
      return;
    }
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(225, 29, 72); // Rose-600
    doc.text("Damage History Report", 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(`Total Log Entries: ${records.length}`, 20, 38);
    if (historySearch) {
       doc.text(`Search Term: "${historySearch}"`, 20, 45);
    }

    const tableData = records.map((r, i) => [
      i + 1,
      r.date,
      r.productName,
      r.quantity,
      r.deducted ? 'Yes' : 'No',
      r.reason
    ]);

    autoTable(doc, {
       startY: 55,
       head: [['#', 'Date', 'Product Name', 'Qty', 'Deducted', 'Reason']],
       body: tableData,
       theme: 'grid',
       headStyles: { fillColor: [190, 18, 60] } // Rose-700
    });

    doc.save(`Damage_History_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  // Damage Form State
  const [damageForm, setDamageForm] = useState(() => {
    return drafts.damage || {
      date: new Date().toISOString().split('T')[0],
      productName: '',
      quantity: '',
      reason: ''
    };
  });

  // QC Form State
  const [qcForm, setQcForm] = useState(() => {
    const base = drafts.qc || {
      date: new Date().toISOString().split('T')[0],
      vendorName: '',
      products: [{ id: Date.now(), productName: '', checked: '', damaged: '', rejected: '' }]
    };
    // Ensure products is always an array for local storage compatibility
    if (!base.products) {
      return {
        ...base,
        products: [{ id: Date.now(), productName: base.productName || '', checked: base.checked || '', damaged: base.damaged || '', rejected: base.rejected || '' }]
      };
    }
    return base;
  });

  const vendorsList = vendors.length > 0 ? vendors.map(v => v.name) : Array.from(new Set((purchaseRecords || []).map(r => r.vendorName))).filter(Boolean);

  // Filter products based on selected vendor
  const availableQCProducts = React.useMemo(() => {
    const soloProducts = stock.filter(s => !s.isComposite);
    if (!qcForm.vendorName) return soloProducts;
    
    // Get products historically purchased from this vendor
    const vendorProdNames = new Set(
      (purchaseRecords || [])
        .filter(r => r.vendorName === qcForm.vendorName)
        .map(r => r.productName)
    );
    
    const filtered = soloProducts.filter(s => vendorProdNames.has(s.name));
    // If no history found, show all solo products as fallback
    return filtered.length > 0 ? filtered : soloProducts;
  }, [qcForm.vendorName, stock, purchaseRecords]);

  // Sync drafts
  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('damage', damageForm);
    }
  }, [damageForm, isEditing]);

  React.useEffect(() => {
    if (!isEditing) {
      updateDraft('qc', qcForm);
    }
  }, [qcForm, isEditing]);

  const handleDamageSubmit = (e) => {
    e.preventDefault();
    Swal.fire({
      title: 'Deduct from Stock?',
      text: `Do you want to reduce ${damageForm.quantity} units of ${damageForm.productName} from your inventory?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Yes, Deduct',
      cancelButtonText: 'Log Entry Only'
    }).then(async (result) => {
      if (isEditing) {
        await updateDamageRecord(editingId, damageForm, result.isConfirmed);
        toast.success('Damage record updated!');
      } else {
        addDamageRecord({ ...damageForm, id: Date.now() }, result.isConfirmed);
        toast.success(result.isConfirmed ? 'Damage recorded & Stock deducted.' : 'Damage recorded (Log only).');
        clearDraft('damage');
      }
      handleCancel();
    });
  };

  const handleQCSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const invalid = qcForm.products.find(p => !p.productName || p.checked === '' || p.damaged === '');
    if (invalid) {
      toast.error('Please fill all product details');
      return;
    }

    const hasDamages = qcForm.products.some(p => Number(p.damaged) > 0 || (Number(p.rejected) || 0) > 0);

    const processSubmission = async (shouldDeduct) => {
      try {
        setIsUploading(true);
        let imageUrls = [];
        if (selectedImages.length > 0) {
          imageUrls = await uploadQCImages(selectedImages);
        }

        const recordsToProcess = qcForm.products.map(p => ({
          ...p,
          date: qcForm.date,
          vendorName: qcForm.vendorName,
          good: Number(p.checked) - Number(p.damaged) - (Number(p.rejected) || 0),
          images: imageUrls
        }));

        for (const record of recordsToProcess) {
          if (editingId) {
            await updateQCRecord(editingId, record, shouldDeduct);
          } else {
            await addQCRecord({ ...record, id: Date.now() + Math.random() }, shouldDeduct);
          }
        }

        // Success actions: Clear state first to provide immediate feedback
        toast.success("QC Report saved.");
        clearDraft('qc');
        setSelectedImages([]);
        handleCancel();


      } catch (err) {
        console.error("QC Submit Error:", err);
        // Error handling: Keep form data if it fails so they can retry
        if (err.code === 'storage/unauthorized' || err.code === 'permission-denied') {
          toast.error("Permission Denied: Please check your Firebase Storage/Firestore rules.");
        } else {
          toast.error("Failed to save QC report");
        }
      } finally {
        setIsUploading(false);
      }
    };

  if (hasDamages) {
    Swal.fire({
      title: 'Deduct from Stock?',
      text: `Deduct identified non-sellable units (Damaged + Rejected items) from stock?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Yes, Deduct',
      cancelButtonText: 'Log Only'
    }).then((result) => {
      processSubmission(result.isConfirmed);
    });
  } else {
    processSubmission(false);
  }
};

  const addQCProduct = () => {
    setQcForm({
      ...qcForm,
      products: [...qcForm.products, { id: Date.now(), productName: '', checked: '', damaged: '', rejected: '' }]
    });
  };

  const removeQCProduct = (id) => {
    if (qcForm.products.length > 1) {
      setQcForm({
        ...qcForm,
        products: qcForm.products.filter(p => p.id !== id)
      });
    }
  };

  const updateQCProductField = (id, field, value) => {
    setQcForm({
      ...qcForm,
      products: qcForm.products.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const handleEditDamage = (r) => {
    setIsEditing(true);
    setEditingId(r.id);
    setActiveTab('damage');
    setDamageForm({
      date: r.date,
      productName: r.productName,
      quantity: r.quantity,
      reason: r.reason
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditQC = (r) => {
    setIsEditing(true);
    setEditingId(r.id);
    setActiveTab('qc');
    setQcForm({
      date: r.date,
      vendorName: r.vendorName || '',
      products: [{ id: Date.now(), productName: r.productName, checked: r.checked, damaged: r.damaged, rejected: r.rejected || '' }]
    });
    setSelectedImages(r.images || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setDamageForm({ date: new Date().toISOString().split('T')[0], productName: '', quantity: '', reason: '' });
    setQcForm({ 
      date: new Date().toISOString().split('T')[0], 
      vendorName: '',
      products: [{ id: Date.now(), productName: '', checked: '', damaged: '', rejected: '' }]
    });
    setSelectedImages([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Damage & Quality Control</h2>
            <p className="text-sm text-slate-500">Log damaged goods and track quality inspection logs</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
           <button 
             onClick={() => setActiveTab('qc')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'qc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <ClipboardCheck size={16} /> Quality Control
           </button>
           <button 
             onClick={() => setActiveTab('damage')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'damage' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
           >
             <AlertTriangle size={16} /> Damage Logs
           </button>
        </div>
      </div>

      {activeTab === 'qc' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-indigo-100 bg-indigo-50/30">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 font-bold">
                <ClipboardCheck size={18} />
                {isEditing ? 'Edit QC Check Record' : 'New Quality Control Check'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>
            <form onSubmit={handleQCSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="QC Check Date" 
                  type="date"
                  value={qcForm.date}
                  onChange={(e) => setQcForm({...qcForm, date: e.target.value})}
                  required
                />
                <SearchableSelect 
                  label="Vendor Name" 
                  placeholder="Select Vendor" 
                  options={vendorsList} 
                  value={qcForm.vendorName}
                  onChange={(val) => setQcForm({...qcForm, vendorName: val})}
                  required
                />
              </div>

              <div className="border-t border-indigo-100 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Products to Inspect</h4>
                  {!isEditing && (
                    <Button type="button" variant="ghost" onClick={addQCProduct} className="text-indigo-600 hover:bg-indigo-100/50">
                      <Plus size={16} className="mr-1" /> Add Product
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {qcForm.products.map((p, index) => (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white/40 p-3 rounded-lg border border-indigo-50 relative group">
                      <div className="md:col-span-12 lg:col-span-5">
                        <SearchableSelect 
                          label="Product / SKU" 
                          options={availableQCProducts.map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                          value={p.productName ? (stock.find(s => s.name === p.productName) ? `[${stock.find(s => s.name === p.productName).sku || 'N/A'}] ${p.productName} (Pack: ${stock.find(s => s.name === p.productName).packSize || 1})` : '') : ''}
                          onChange={(val) => {
                            const selectedName = availableQCProducts.find(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                            updateQCProductField(p.id, 'productName', selectedName || '');
                          }}
                          required
                        />
                      </div>
                      <div className="md:col-span-4 lg:col-span-2">
                        <Input 
                          label="Checked" 
                          type="number" 
                          min="1" 
                          value={p.checked}
                          onChange={(e) => updateQCProductField(p.id, 'checked', e.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-4 lg:col-span-2">
                        <Input 
                          label="Damaged" 
                          type="number" 
                          min="0" 
                          value={p.damaged}
                          onChange={(e) => updateQCProductField(p.id, 'damaged', e.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-4 lg:col-span-2">
                        <Input 
                          label="Rejected" 
                          type="number" 
                          min="0" 
                          value={p.rejected}
                          onChange={(e) => updateQCProductField(p.id, 'rejected', e.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-4 lg:col-span-1 flex justify-end pb-2">
                         {!isEditing && qcForm.products.length > 1 && (
                           <button 
                             type="button" 
                             onClick={() => removeQCProduct(p.id)}
                             className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
                           >
                             <Trash2 size={18} />
                           </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="border-t border-indigo-100 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                       <Camera size={14} /> Inspection Photos
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Max 4 images • JPG/PNG • Galley/Photo</p>
                  </div>
                  <label className="cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handleImageSelect}
                      disabled={selectedImages.length >= 4 || isUploading}
                    />
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedImages.length >= 4 || isUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                      {isUploading ? 'Uploading...' : 'Take Photo / Upload'}
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedImages.map((file, idx) => (
                    <div key={idx} className="relative group aspect-video sm:aspect-square rounded-xl overflow-hidden border-2 border-indigo-100 bg-slate-50 shadow-sm">
                      <img 
                        src={typeof file === 'string' ? file : URL.createObjectURL(file)} 
                        alt="preview" 
                        className="w-full h-full object-cover"
                      />
                      <button 
                        type="button" 
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {selectedImages.length === 0 && (
                    <div className="col-span-full py-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                      <ImageIcon size={32} className="mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-wider">No photos attached</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-indigo-100/50">
                 <div className="flex gap-6">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Good</p>
                        <p className="text-xl font-black text-emerald-600">
                          {qcForm.products.reduce((acc, p) => acc + (Number(p.checked) || 0) - (Number(p.damaged) || 0) - (Number(p.rejected) || 0), 0)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Rejected</p>
                        <p className="text-xl font-black text-rose-400">
                          {qcForm.products.reduce((acc, p) => acc + (Number(p.rejected) || 0), 0)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Damaged</p>
                        <p className="text-xl font-black text-rose-600">
                          {qcForm.products.reduce((acc, p) => acc + (Number(p.damaged) || 0), 0)}
                        </p>
                    </div>
                 </div>
                 <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
                  <Button type="submit" disabled={isUploading}>
                    {isUploading ? (
                      <span className="flex items-center gap-2">Uploading images...</span>
                    ) : (
                      editingId ? 'Update Report' : 'Save Report'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          <Card>
            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                <History size={18} className="text-slate-400" />
                QC Inspection History
              </h3>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:min-w-[200px]">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                    type="text" 
                    placeholder="Search Product..."
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                   />
                </div>
                <select 
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                >
                  <option>All Vendors</option>
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
                <Button 
                   onClick={async () => {
                     const filtered = qcRecords.filter(r => {
                       const matchesSearch = r.productName.toLowerCase().includes(historySearch.toLowerCase()) || 
                                             (r.vendorName && r.vendorName.toLowerCase().includes(historySearch.toLowerCase()));
                       const matchesVendor = vendorFilter === 'All Vendors' || r.vendorName === vendorFilter;
                       return matchesSearch && matchesVendor;
                     });
                     await generatePDFReport(vendorFilter, 'Multiple', filtered);
                   }}
                   variant="success" 
                   size="sm"
                   className="text-[10px] h-8 px-2 bg-indigo-600 hover:bg-indigo-700 border-none shadow-md"
                >
                   <Download size={14} /> Report
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table headers={['Date', 'Product', 'Vendor', 'Checked', 'Preview + Share', 'Actions']}>
                {qcRecords
                  .filter(r => {
                    const matchesSearch = r.productName.toLowerCase().includes(historySearch.toLowerCase()) || 
                                          (r.vendorName && r.vendorName.toLowerCase().includes(historySearch.toLowerCase()));
                    const matchesVendor = vendorFilter === 'All Vendors' || r.vendorName === vendorFilter;
                    return matchesSearch && matchesVendor;
                  })
                  .length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No records matching your search.</td></tr>
                ) : (
                  [...qcRecords]
                    .filter(r => {
                      const matchesSearch = r.productName.toLowerCase().includes(historySearch.toLowerCase()) || 
                                            (r.vendorName && r.vendorName.toLowerCase().includes(historySearch.toLowerCase()));
                      const matchesVendor = vendorFilter === 'All Vendors' || r.vendorName === vendorFilter;
                      return matchesSearch && matchesVendor;
                    })
                    .sort((a,b) => new Date(b.date) - new Date(a.date))
                    .map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                      <td className="py-4 px-6 text-sm text-slate-600 font-medium">{r.date}</td>
                      <td className="py-4 px-6">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-indigo-500 font-mono italic">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                            <span className="text-sm font-bold text-slate-900">{r.productName}</span>
                         </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600 font-semibold">{r.vendorName || 'N/A'}</td>
                      <td className="py-4 px-6 text-sm font-black text-slate-900">{r.checked}</td>
                      <td className="py-4 px-6 text-sm">
                         <div className="flex items-center gap-2">
                            {r.images && r.images.length > 0 && (
                               <div className="flex -space-x-2 mr-2">
                                  {r.images.map((url, i) => (
                                     <div 
                                        key={i} 
                                        className={`w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-slate-100 shadow-sm cursor-pointer hover:scale-110 transition-transform ${i >= 3 ? 'hidden' : 'inline-block'}`}
                                        onClick={() => {
                                          Swal.fire({
                                            imageUrl: url,
                                            imageAlt: 'QC Inspection Photo',
                                            showCloseButton: true,
                                            showConfirmButton: false,
                                            background: 'transparent',
                                            backdrop: `rgba(0,0,0,0.8)`
                                          });
                                        }}
                                      >
                                        <img src={url} alt="qc" className="w-full h-full object-cover" />
                                     </div>
                                  ))}
                                  {r.images.length > 3 && (
                                     <button 
                                      type="button"
                                      onClick={() => {
                                         Swal.fire({
                                           title: 'Inspection Photos',
                                           html: `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                              ${r.images.map(url => `<img src="${url}" style="width: 100%; border-radius: 8px; cursor: pointer" onclick="window.open('${url}', '_blank')"/>`).join('')}
                                           </div>`,
                                           width: '600px',
                                           showConfirmButton: false
                                         });
                                      }}
                                      className="w-6 h-6 rounded-full border-2 border-white bg-indigo-500 text-white text-[8px] flex items-center justify-center font-bold hover:bg-indigo-600 transition-colors"
                                     >
                                        +{r.images.length - 3}
                                     </button>
                                  )}
                               </div>
                            )}
                            <button 
                              onClick={async () => {
                                 // 1. Generate the PDF Report blob
                                 toast.loading("Generating report...");
                                 const doc = await generatePDFReport(r.vendorName, r.date, [r], r.images, true);
                                 toast.dismiss();

                                 if (!doc) {
                                   toast.error("Failed to generate report for sharing.");
                                   return;
                                 }

                                 const pdfBlob = doc.output('blob');
                                 const pdfFile = new File([pdfBlob], `QC_Report_${r.productName.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });

                                 // 2. Try Native Share (Mobile)
                                 if (navigator.share) {
                                   try {
                                     // Create the list of files to share
                                     const shareFiles = [pdfFile];
                                     
                                     // Also add images to the share if they exist
                                     if (r.images && r.images.length > 0) {
                                       toast.loading("Attaching photos...");
                                       for (let i = 0; i < r.images.length; i++) {
                                         try {
                                           const imgRes = await fetch(r.images[i]);
                                           const imgBlob = await imgRes.blob();
                                           shareFiles.push(new File([imgBlob], `QC_Photo_${i+1}.jpg`, { type: 'image/jpeg' }));
                                         } catch (err) { console.error("Image attachment failed", err); }
                                       }
                                       toast.dismiss();
                                     }

                                     const shareData = {
                                       files: shareFiles,
                                       title: `QC Report: ${r.productName}`,
                                       text: `Hi,, Please find the official QC Inspection Report attached.`
                                     };
                                     
                                     // Try sharing all files (Report + Photos)
                                     if (navigator.canShare && navigator.canShare(shareData)) {
                                       await navigator.share(shareData);
                                       return;
                                     } 
                                     // Fallback: Try sharing ONLY the PDF Report if multi-file share is rejected
                                     else if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                                       await navigator.share({
                                         files: [pdfFile],
                                         title: `QC Report: ${r.productName}`,
                                         text: `Hi,, Please find the official QC Inspection Report attached.`
                                       });
                                       return;
                                     }
                                   } catch (shareErr) {
                                     toast.dismiss();
                                     console.log("Native share failed, falling back to link...", shareErr);
                                   }
                                 }

                                 // 3. Fallback to WhatsApp Link for Desktop
                                 const vendor = vendors.find(v => v.name === r.vendorName);
                                 const contact = vendor?.whatsappName || "";
                                 const phone = contact.replace(/\D/g, "");
                                 const msg = `Hi,, Please find the official QC Inspection Report attached.\n\nView here: ${r.images?.[0] || 'See attached document'}`;
                                 const whatsappUrl = `https://wa.me/${phone ? phone : ""}?text=${encodeURIComponent(msg)}`;
                                 window.open(whatsappUrl, "_blank");
                               }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-200 transition-all shadow-sm"
                              title="Share QC via WhatsApp (Images + Text)"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                 <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                               </svg>
                            </button>
                            <button 
                              onClick={() => {
                                Swal.fire({
                                  title: 'Resend Email?',
                                  text: "Send this QC report as a message to accounts?",
                                  icon: 'question',
                                  showCancelButton: true,
                                  confirmButtonColor: '#4f46e5',
                                  confirmButtonText: 'Yes, Send'
                                }).then((result) => {
                                  if (result.isConfirmed) {
                                    sendQCEmail(r.vendorName, r.date, [r], r.images);
                                  }
                                });
                              }}
                              className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-blue-100 transition-all shadow-sm"
                              title="Send Email"
                            >
                              <Mail size={18} />
                            </button>
                            <button 
                              onClick={async () => {
                                try {
                                  await generatePDFReport(r.vendorName, r.date, [r], r.images);
                                } catch (err) {
                                  console.error("PDF Download Error:", err);
                                  toast.error("Error generating PDF.");
                                }
                              }}
                              className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-indigo-100 transition-all shadow-sm"
                              title="Download PDF Report File"
                            >
                              <Download size={18} />
                            </button>
                         </div>
                      </td>
                       <td className="py-4 px-6 text-center">
                         {isRecordEditable(r.date) ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => handleEditQC(r)}
                                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit Record"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => {
                                  Swal.fire({
                                    title: 'Delete QC Record?',
                                    text: 'This will remove the log and restore any deducted stock.',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: '#ef4444',
                                    confirmButtonText: 'Delete'
                                  }).then((result) => {
                                    if (result.isConfirmed) {
                                      deleteQCRecord(r.id);
                                      toast.success('Record deleted.');
                                    }
                                  });
                                }} 
                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                         ) : (
                           <div className="flex justify-center p-1.5 text-slate-200" title="Records older than 5 days cannot be deleted">
                              <Lock size={14} />
                           </div>
                         )}
                       </td>
                    </tr>
                  ))
                )}
              </Table>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-rose-100 bg-rose-50/20">
             <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertTriangle size={18} />
                {isEditing ? 'Edit Damage Record' : 'Log New Damaged Goods'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>
            
            <form onSubmit={handleDamageSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Date Occurred" 
                  type="date" 
                  value={damageForm.date}
                  onChange={(e) => setDamageForm({...damageForm, date: e.target.value})}
                  required
                />
                <SearchableSelect 
                  label="Product Name" 
                  options={stock.map(s => s.name)} 
                  value={damageForm.productName}
                  onChange={(val) => setDamageForm({...damageForm, productName: val})}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Quantity" 
                  type="number" 
                  min="1"
                  value={damageForm.quantity}
                  onChange={(e) => setDamageForm({...damageForm, quantity: e.target.value})}
                  required
                />
                <Input 
                  label="Reason / Remarks" 
                  placeholder="e.g. Broken in transit, expired, etc."
                  value={damageForm.reason}
                  onChange={(e) => setDamageForm({...damageForm, reason: e.target.value})}
                  required
                />
              </div>
               <div className="flex justify-end gap-3">
                {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700">
                  <Save size={18} /> {isEditing ? 'Update Damage Record' : 'Confirm Damage'}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                <History size={18} className="text-slate-400" />
                Damage History Logs
              </h3>

              <div className="relative w-full sm:w-64">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  type="text" 
                  placeholder="Search Product..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                 />
              </div>
              <Button 
                onClick={() => {
                   const filtered = damageRecords.filter(r => r.productName.toLowerCase().includes(historySearch.toLowerCase()));
                   generateDamagePDFReport(filtered);
                }}
                variant="success" 
                size="sm"
                className="text-[10px] h-8 px-2 bg-rose-600 hover:bg-rose-700 border-none shadow-md"
              >
                 <Download size={14} /> Report
              </Button>
            </div>

            <Table headers={['Date', 'Product / SKU Name', 'Quantity', 'Deducted?', 'Reason', 'Action']}>
              {damageRecords
                .filter(r => r.productName.toLowerCase().includes(historySearch.toLowerCase()))
                .length === 0 ? (
                <tr><td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No records matching your search.</td></tr>
              ) : (
                damageRecords
                  .filter(r => r.productName.toLowerCase().includes(historySearch.toLowerCase()))
                  .map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 font-medium">
                    <td className="py-4 px-6 text-sm text-slate-500">{r.date}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-rose-500 uppercase tracking-tighter">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                        <span className="font-bold text-slate-900">{r.productName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-900 font-black">{r.quantity}</td>
                    <td className="py-4 px-6 text-sm">
                       {r.deducted ? (
                         <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold italic">YES (-{r.quantity})</span>
                       ) : (
                         <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">NO</span>
                       )}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500 italic">"{r.reason}"</td>
                     <td className="py-4 px-6 text-center">
                       {isRecordEditable(r.date) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleEditDamage(r)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Edit Record"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              Swal.fire({
                                title: 'Delete Damage Entry?',
                                text: r.deducted ? 'This will restore the deducted quantity back to your stock.' : 'This will remove the log record (No stock change).',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#e11d48',
                                cancelButtonColor: '#cbd5e1',
                                confirmButtonText: 'Yes, delete it',
                                cancelButtonText: 'Cancel'
                              }).then((result) => {
                                if (result.isConfirmed) {
                                  deleteDamageRecord(r.id);
                                  toast.success('Stock restored.');
                                }
                              });
                            }} 
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                       ) : (
                         <div className="flex justify-center p-1.5 text-slate-200" title="Records older than 5 days cannot be deleted">
                            <Lock size={14} />
                         </div>
                       )}
                     </td>
                  </tr>
                ))
              )}
            </Table>
          </Card>
        </div>
      )}

      {/* Custom modal removed in favor of SweetAlert2 */}
    </div>
  );
};

export default DamageTracking;
