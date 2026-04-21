import React, { useState } from 'react';
import { Card, Input, Button, Table, SearchableSelect } from '../components/ui';
import { AlertTriangle, Plus, Trash2, Save, ClipboardCheck, History, CheckCircle2, XCircle, Info, Lock, Edit2, X } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { isRecordEditable } from '../utils/dateUtils';
import emailjs from 'emailjs-com';

const DamageTracking = () => {
  const { stock, damageRecords, addDamageRecord, updateDamageRecord, deleteDamageRecord, qcRecords, addQCRecord, updateQCRecord, deleteQCRecord, drafts, updateDraft, clearDraft, purchaseRecords } = useGlobalState();
  
  const sendQCEmail = (qcData) => {
    // Replace these with your actual EmailJS credentials
    const SERVICE_ID = "service_xkm5bck";
    const TEMPLATE_ID = "template_hatngnl";
    const PUBLIC_KEY = "NWluldMCpFboOvNZG";

    const templateParams = {
      to_email: "malavikavenu914@gmail.com, nandanalakshmi21@gmail.com",
      product_name: qcData.productName,
      vendor_name: qcData.vendorName || "N/A",
      checked_qty: qcData.checked,
      damaged_qty: qcData.damaged,
      approved_qty: Number(qcData.checked) - Number(qcData.damaged),
      date: qcData.date
    };

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then((res) => {
        console.log("Email Result:", res.status, res.text);
        toast.success("Email sent to accounts!");
      })
      .catch((err) => {
        console.error("Email Failed:", err);
        toast.error("Failed to send email notification.");
      });
  };
  const [activeTab, setActiveTab] = useState('qc'); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
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
    return drafts.qc || {
      date: new Date().toISOString().split('T')[0],
      productName: '',
      vendorName: '',
      checked: '',
      damaged: '',
    };
  });

  const vendors = Array.from(new Set(purchaseRecords.map(r => r.vendorName))).filter(Boolean);

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
    const checked = Number(qcForm.checked);
    const damaged = Number(qcForm.damaged);
    
    if (damaged > checked) {
      toast.error('Damaged quantity cannot exceed checked quantity!');
      return;
    }

    const newQC = { 
      ...qcForm, 
      good: checked - damaged,
    };

    if (damaged > 0) {
      Swal.fire({
        title: isEditing ? 'Update & Deduct?' : 'Deduct Damages?',
        text: `You found ${damaged} damaged units. Deduct them from inventory?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Yes, Deduct',
        cancelButtonText: 'Log Only'
      }).then(async (result) => {
        if (isEditing) {
          await updateQCRecord(editingId, newQC, result.isConfirmed);
          toast.success('QC record updated!');
        } else {
          addQCRecord({ ...newQC, id: Date.now() }, result.isConfirmed);
          toast.success(result.isConfirmed ? 'QC recorded & Stock deducted.' : 'QC recorded (Log only).');
          clearDraft('qc');
        }

        // Ask to send email to accounts
        Swal.fire({
          title: 'Notify Accounts?',
          text: "Do you want to send this QC report to the accounts department via email?",
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#4f46e5',
          confirmButtonText: 'Yes, Send Email',
          cancelButtonText: 'No, Just Log'
        }).then((emailResult) => {
          if (emailResult.isConfirmed) {
            sendQCEmail(newQC);
          }
        });

        handleCancel();
      });
    } else {
      if (isEditing) {
        updateQCRecord(editingId, newQC, false);
      } else {
        addQCRecord({ ...newQC, id: Date.now() }, false);
      }
      
      // Also ask for email even if no damages found
      Swal.fire({
        title: 'Notify Accounts?',
        text: "Send this QC check result (No damages) to accounts?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        confirmButtonText: 'Yes, Send Email',
        cancelButtonText: 'No'
      }).then((emailResult) => {
        if (emailResult.isConfirmed) {
            sendQCEmail(newQC);
        }
      });

      handleCancel();
      toast.success(isEditing ? 'QC updated (No damages found).' : 'QC check recorded (No damages found).');
    }
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
      productName: r.productName,
      vendorName: r.vendorName || '',
      checked: r.checked,
      damaged: r.damaged
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setDamageForm({ date: new Date().toISOString().split('T')[0], productName: '', quantity: '', reason: '' });
    setQcForm({ date: new Date().toISOString().split('T')[0], productName: '', checked: '', damaged: '' });
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
            <form onSubmit={handleQCSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                  <SearchableSelect 
                    label="Product Name" 
                    options={stock.filter(s => !s.isComposite).map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                    value={qcForm.productName ? stock.find(s => s.name === qcForm.productName) ? `[${stock.find(s => s.name === qcForm.productName).sku || 'N/A'}] ${qcForm.productName} (Pack: ${stock.find(s => s.name === qcForm.productName).packSize || 1})` : '' : ''}
                    onChange={(val) => {
                      const selectedName = stock.find(s => !s.isComposite && `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                      setQcForm({...qcForm, productName: selectedName || ''});
                    }}
                    required
                  />
                </div>
                <Input 
                  label="Checked Qty" 
                  type="number" 
                  min="1" 
                  placeholder="Total Checked"
                  value={qcForm.checked}
                  onChange={(e) => setQcForm({...qcForm, checked: e.target.value})}
                  required
                />
                <Input 
                  label="Damaged Qty" 
                  type="number" 
                  min="0" 
                  placeholder="Damaged Found"
                  value={qcForm.damaged}
                  onChange={(e) => setQcForm({...qcForm, damaged: e.target.value})}
                  required
                />
                <div className="lg:col-span-1">
                  <SearchableSelect 
                    label="Vendor Name" 
                    options={vendors}
                    placeholder="Search vendor..."
                    value={qcForm.vendorName}
                    onChange={(val) => setQcForm({...qcForm, vendorName: val})}
                    required
                  />
                </div>
                <Input 
                  label="Check Date" 
                  type="date"
                  value={qcForm.date}
                  onChange={(e) => setQcForm({...qcForm, date: e.target.value})}
                  required
                />
              </div>
              <div className="flex justify-between items-center bg-white/50 p-4 rounded-xl border border-indigo-100/50">
                 <div className="flex gap-6">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Estimated Good</p>
                        <p className="text-xl font-black text-emerald-600">{(Number(qcForm.checked) || 0) - (Number(qcForm.damaged) || 0)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Found Damaged</p>
                        <p className="text-xl font-black text-rose-600">{(Number(qcForm.damaged) || 0)}</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                   {isEditing && <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>}
                   <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                     <Save size={18} /> {isEditing ? 'Update QC Result' : 'Log QC Result'}
                   </Button>
                 </div>
              </div>
            </form>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                QC Inspection History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table headers={['Date', 'Product / SKU', 'Vendor', 'Checked', 'Good', 'Damaged', 'Deducted?', 'Action']}>
                {qcRecords.length === 0 ? (
                  <tr><td colSpan="7" className="py-12 text-center text-slate-400 font-medium">No QC records yet.</td></tr>
                ) : (
                  qcRecords.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <td className="py-4 px-6 text-sm text-slate-600 font-medium">{r.date}</td>
                      <td className="py-4 px-6">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-indigo-500 font-mono italic">{stock.find(s => s.name === r.productName)?.sku || 'N/A'}</span>
                            <span className="text-sm font-bold text-slate-900">{r.productName}</span>
                         </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600 font-semibold">{r.vendorName || 'N/A'}</td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-700">{r.checked}</td>
                      <td className="py-4 px-6 text-sm">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-black">
                          <CheckCircle2 size={14} />
                          {r.good}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                         <div className={`flex items-center gap-1.5 font-black ${Number(r.damaged) > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                          <XCircle size={14} />
                          {r.damaged}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">
                         {r.deducted ? (
                           <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold italic">YES (-{r.damaged})</span>
                         ) : (
                           <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">NO</span>
                         )}
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
                                    text: r.deducted ? 'Stock (damages) will be restored to inventory.' : 'This will remove the log entry (No stock change).',
                                    icon: 'warning',
                                    showCancelButton: true,
                                    confirmButtonColor: '#4f46e5',
                                    cancelButtonColor: '#cbd5e1',
                                    confirmButtonText: 'Yes, delete it',
                                    cancelButtonText: 'Cancel'
                                  }).then((result) => {
                                    if (result.isConfirmed) {
                                      deleteQCRecord(r.id);
                                      toast.success('QC record removed.');
                                    }
                                  });
                                }} 
                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
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
                <Plus size={18} />
                {isEditing ? 'Edit Manual Damage Entry' : 'Manual Damage Entry'}
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600">
                   <X size={16} className="mr-1" /> Cancel Edit
                </Button>
              )}
            </div>
            <form onSubmit={handleDamageSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SearchableSelect 
                  label="Select Product" 
                  options={stock.filter(s => !s.isComposite).map(s => `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})`)} 
                  value={damageForm.productName ? stock.find(s => s.name === damageForm.productName) ? `[${stock.find(s => s.name === damageForm.productName).sku || 'N/A'}] ${damageForm.productName} (Pack: ${stock.find(s => s.name === damageForm.productName).packSize || 1})` : '' : ''}
                  onChange={(val) => {
                    const selectedName = stock.find(s => !s.isComposite && `[${s.sku || 'N/A'}] ${s.name} (Pack: ${s.packSize || 1})` === val)?.name;
                    setDamageForm({...damageForm, productName: selectedName || ''});
                  }}
                  required
                />
                <Input 
                  label="Quantity" 
                  type="number" 
                  min="1"
                  value={damageForm.quantity}
                  onChange={(e) => setDamageForm({...damageForm, quantity: e.target.value})}
                  required
                />
                <Input 
                  label="Date" 
                  type="date"
                  value={damageForm.date}
                  onChange={(e) => setDamageForm({...damageForm, date: e.target.value})}
                  required
                />
                <Input 
                  label="Reason" 
                  placeholder="e.g. Expired" 
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
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              Recent Damage History
            </h3>
            <Table headers={['Date', 'Product / SKU Name', 'Quantity', 'Deducted?', 'Reason', 'Action']}>
              {damageRecords.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-slate-400 font-medium">No recorded damages.</td></tr>
              ) : (
                damageRecords.map(r => (
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
