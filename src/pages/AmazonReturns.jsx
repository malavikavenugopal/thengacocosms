import React, { useState, useRef } from 'react';
import { Card, Input, Select, Button } from '../components/ui';
import { Upload, Edit2, Trash2, X, Save, Search, Download, FileSpreadsheet, RotateCcw, Package, RefreshCcw, AlertCircle, DollarSign, Shield, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { useGlobalState } from '../context/GlobalContext';

const COL_MAP = {
  'Order ID': 'orderId',
  'Order date': 'orderDate',
  'Return request date': 'returnRequestDate',
  'Return request status': 'returnRequestStatus',
  'Amazon RMA ID': 'amazonRmaId',
  'Seller RMA ID': 'sellerRmaId',
  'Label type': 'labelType',
  'Label cost': 'labelCost',
  'Currency code': 'currencyCode',
  'Return carrier': 'returnCarrier',
  'Tracking ID': 'trackingId',
  'Label to be paid by': 'labelPaidBy',
  'A-to-z claim': 'atozClaim',
  'Is prime': 'isPrime',
  'ASIN': 'asin',
  'Merchant SKU': 'merchantSku',
  'Item Name': 'itemName',
  'Return quantity': 'returnQuantity',
  'Return reason': 'returnReason',
  'In policy': 'inPolicy',
  'Return type': 'returnType',
  'Resolution': 'resolution',
  'Invoice number': 'invoiceNumber',
  'Return delivery date': 'returnDeliveryDate',
  'Order Amount': 'orderAmount',
  'Order quantity': 'orderQuantity',
  'SafeT Action reason': 'safetActionReason',
  'SafeT claim ID': 'safetClaimId',
  'SafeT claim state': 'safetClaimState',
  'SafeT claim creation time': 'safetClaimCreationTime',
  'SafeT claim reimbursement amount': 'safetReimbursementAmount',
  'Refunded Amount': 'refundedAmount',
  'Category': 'category',
  'Order Item ID': 'orderItemId',
};

const EMPTY = Object.fromEntries(Object.values(COL_MAP).map(k => [k, '']));

const STATUS_COLORS = {
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Pending': 'bg-amber-100 text-amber-700',
  'Cancelled': 'bg-rose-100 text-rose-700',
  'Approved': 'bg-indigo-100 text-indigo-700',
};

const SAEFT_COLORS = {
  'APPROVED': 'bg-emerald-100 text-emerald-700',
  'DENIED': 'bg-rose-100 text-rose-700',
  'PENDING': 'bg-amber-100 text-amber-700',
};

const parseDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const day = parts[0].padStart(2, '0');
  const monthStr = parts[1].toLowerCase();
  const yearStr = parts[2];
  
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  
  const month = months[monthStr] || '01';
  
  let year = yearStr;
  if (year.length === 2) {
    year = `20${year}`;
  }
  
  return `${year}-${month}-${day}`;
};

export default function AmazonReturns() {
  const { amazonReturnRecords, addAmazonReturnRecords, updateAmazonReturnRecord, deleteAmazonReturnRecord, stock } = useGlobalState();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const d_now = new Date();
  const last_month_date = new Date(d_now.getFullYear(), d_now.getMonth(), 0);
  const prev_year = last_month_date.getFullYear();
  const prev_month = String(last_month_date.getMonth() + 1).padStart(2, '0');
  const prev_last_day = last_month_date.getDate();
  const [filters, setFilters] = useState({
    search: '',
    startDate: `${prev_year}-${prev_month}-01`,
    endDate: `${prev_year}-${prev_month}-${String(prev_last_day).padStart(2, '0')}`,
    status: ''
  });
  const fileRef = useRef(null);

  const records = amazonReturnRecords;

  // Build SKU → product name lookup from stock master
  const skuMap = React.useMemo(() => {
    const map = {};
    (stock || []).forEach(s => {
      if (s.sku) map[s.sku.trim().toLowerCase()] = s.name;
    });
    return map;
  }, [stock]);
  const lookupProduct = (sku) => skuMap[(sku || '').trim().toLowerCase()] || null;

  // Convert Excel serial numbers or Date objects → YYYY-MM-DD
  const fmtDate = (val) => {
    if (!val && val !== 0) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }
    return String(val).trim();
  };
  const DATE_FIELDS = new Set(['orderDate', 'returnRequestDate', 'returnDeliveryDate', 'safetClaimCreationTime']);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        const mapped = rows.map((row) => {
          const rec = { ...EMPTY, channel: 'Amazon' };
          Object.keys(row).forEach(col => {
            const k = COL_MAP[col.trim()];
            if (!k) return;
            const raw = row[col];
            rec[k] = DATE_FIELDS.has(k) ? fmtDate(raw) : String(raw ?? '').trim();
          });
          return rec;
        });
        await addAmazonReturnRecords(mapped);
        toast.success(`${mapped.length} records imported & saved!`);
      } catch (err) { console.error(err); toast.error('Failed to read file. Check format.'); }
      finally { setIsUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };
  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const { id, ...data } = editForm;
      await updateAmazonReturnRecord(id, data);
      toast.success('Updated!');
      cancelEdit();
    } finally { setIsSaving(false); }
  };
  const ef = f => e => setEditForm(p => ({ ...p, [f]: e.target.value }));

  // Quick inline update for manual columns — saves to Firebase immediately
  const quickUpdate = async (id, field, value) => {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const { id: _id, ...data } = rec;
    await updateAmazonReturnRecord(id, { ...data, [field]: value });
  };

  const handleDelete = (id) => Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' })
    .then(async r => { if (r.isConfirmed) { await deleteAmazonReturnRecord(id); toast.success('Deleted.'); } });

  const handleExport = () => {
    const headers = Object.keys(COL_MAP);
    const data = filteredRecords.map(r => {
      const row = {};
      headers.forEach(h => { row[h] = r[COL_MAP[h]] || ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Amazon Returns');
    XLSX.writeFile(wb, `Amazon_Returns_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredRecords = records.filter(r => {
    const q = filters.search.toLowerCase();
    const ms = !q || [r.orderId, r.itemName, r.merchantSku, r.asin, r.orderItemId].some(v => (v || '').toLowerCase().includes(q));
    const st = !filters.status || r.returnRequestStatus === filters.status;
    const orderDateFormatted = parseDate(r.orderDate);
    const sd = !filters.startDate || orderDateFormatted >= filters.startDate;
    const ed = !filters.endDate || orderDateFormatted <= filters.endDate;
    return ms && st && sd && ed;
  }).sort((a, b) => (parseDate(b.orderDate) || '').localeCompare(parseDate(a.orderDate) || ''));

  const stats = {
    total: records.length,
    atoz: records.filter(r => r.atozClaim && r.atozClaim.toLowerCase() !== 'false' && r.atozClaim !== '').length,
    safet: records.filter(r => r.safetClaimId && r.safetClaimId !== '').length,
    refunded: records.reduce((s, r) => s + (parseFloat(r.refundedAmount) || 0), 0).toFixed(2),
  };

  // ── Inline editable select for manual columns ────────────────────────────
  const InlineSelect = ({ recordId, field, value, options, colorFn }) => (
    <select
      value={value || ''}
      onChange={e => quickUpdate(recordId, field, e.target.value)}
      className={`text-[10px] font-bold rounded-lg px-2 py-1 border cursor-pointer outline-none focus:ring-1 focus:ring-orange-400 transition-all ${
        value ? (colorFn ? colorFn(value) : 'bg-slate-100 text-slate-700 border-slate-200') : 'bg-yellow-50 text-yellow-700 border-yellow-200'
      }`}
    >
      <option value="">— select —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const InlineText = ({ recordId, field, value, placeholder }) => {
    const [local, setLocal] = React.useState(value || '');
    React.useEffect(() => { setLocal(value || ''); }, [value]);
    return (
      <input
        type="text"
        value={local}
        placeholder={placeholder || 'Enter...'}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => { if (e.target.value !== (value || '')) quickUpdate(recordId, field, e.target.value); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
        className="text-[10px] w-24 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none"
      />
    );
  };

  const TABLE_COLS = [
    { h: 'Order ID', render: r => (
      <div className="flex items-center gap-1 group">
        <span className="font-mono text-[11px] font-bold text-indigo-600 whitespace-nowrap">{r.orderId || '—'}</span>
        {r.orderId && (
          <button 
            onClick={() => {
              navigator.clipboard.writeText(r.orderId);
              toast.success('Order ID copied!');
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 transition-opacity"
            title="Copy Order ID"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
    ) },
    { h: 'Order Date', render: r => <span className="text-slate-600 whitespace-nowrap text-[11px]">{r.orderDate || '—'}</span> },
    { h: 'Return Req. Date', render: r => <span className="text-slate-600 whitespace-nowrap text-[11px]">{r.returnRequestDate || '—'}</span> },
    { h: 'ASIN', render: r => <span className="font-mono text-[10px] text-amber-600 font-bold whitespace-nowrap">{r.asin || '—'}</span> },
    { h: 'Merchant SKU', render: r => <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">{r.merchantSku || '—'}</span> },
   /*  {
      h: 'Our Product',
      render: r => {
        const matched = lookupProduct(r.merchantSku);
        return matched
          ? <span className="text-[11px] font-semibold text-indigo-700 whitespace-nowrap">{matched}</span>
          : <span className="text-[10px] text-slate-300 italic">No match</span>;
      }
    }, */
    { h: 'Item Name', render: r => <div className="max-w-[160px]"><p className="text-[11px] font-medium text-slate-800 truncate" title={r.itemName}>{r.itemName || '—'}</p></div> },
    { h: 'Qty', render: r => <span className="font-bold text-slate-900 text-[11px]">{r.returnQuantity || '—'}</span> },
    { h: 'Return Reason', render: r => <span className="text-[10px] text-slate-500 max-w-[120px] block truncate" title={r.returnReason}>{r.returnReason || '—'}</span> },
    { h: 'Return Type', render: r => <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 whitespace-nowrap">{r.returnType || '—'}</span> },
    { h: 'Resolution', render: r => <span className="text-[10px] text-slate-500 max-w-[110px] block truncate" title={r.resolution}>{r.resolution || '—'}</span> },
    { h: 'Order Amt', render: r => <span className="font-semibold text-slate-700 text-[11px] whitespace-nowrap">{r.orderAmount ? `₹${r.orderAmount}` : '—'}</span> },
    { h: 'Refunded Amt', render: r => <span className="font-semibold text-emerald-700 text-[11px] whitespace-nowrap">{r.refundedAmount ? `₹${r.refundedAmount}` : '—'}</span> },
    { h: '✏ Customer Comment', manual: true, render: r => <InlineText recordId={r.id} field="customerComment" value={r.customerComment} placeholder="Add comment..." /> },
    // ── 5 manual columns ── highlighted with yellow border when empty
    {
      h: '✏ Return Received',
      manual: true,
      render: r => <InlineSelect recordId={r.id} field="returnReceived" value={r.returnReceived}
        options={['Yes', 'No', 'Pending']}
        colorFn={v => v === 'Yes' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : v === 'No' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}
      />
    },
    {
      h: '✏ Status Returned',
      manual: true,
      render: r => <InlineSelect recordId={r.id} field="statusReturned" value={r.statusReturned}
        options={['Completed', 'Pending', 'Rejected', 'Reimbursed']}
        colorFn={v => STATUS_COLORS[v] || 'bg-slate-100 text-slate-600 border-slate-200'}
      />
    },
    {
      h: '✏ Not Received',
      manual: true,
      render: r => <InlineSelect recordId={r.id} field="notReceived" value={r.notReceived}
        options={['Yes', 'No']}
        colorFn={v => v === 'Yes' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
      />
    },
    {
      h: '✏ Damaged Returns',
      manual: true,
      render: r => <InlineSelect recordId={r.id} field="damagedReturns" value={r.damagedReturns}
        options={['Yes', 'No']}
        colorFn={v => v === 'Yes' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
      />
    },
    {
      h: '✏ Claims from Amazon',
      manual: true,
      render: r => <InlineText recordId={r.id} field="claimsFromAmazon" value={r.claimsFromAmazon} placeholder="Amount / Note" />
    },
    { h: 'SafeT State', render: r => r.safetClaimState ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SAEFT_COLORS[(r.safetClaimState || '').toUpperCase()] || 'bg-slate-100 text-slate-500'}`}>{r.safetClaimState}</span> : <span className="text-slate-300">—</span> },
    { h: 'SafeT Reimb.', render: r => r.safetReimbursementAmount ? <span className="font-semibold text-indigo-600 text-[11px]">₹{r.safetReimbursementAmount}</span> : <span className="text-slate-300">—</span> },
    { h: 'A-to-Z', render: r => r.atozClaim && r.atozClaim.toLowerCase() !== 'false' && r.atozClaim !== '' ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">{r.atozClaim}</span> : <span className="text-slate-300">—</span> },
    { h: 'Return Delivery', render: r => <span className="text-slate-600 whitespace-nowrap text-[11px]">{r.returnDeliveryDate || '—'}</span> },
    { h: 'Carrier', render: r => <span className="text-[10px] text-slate-500 whitespace-nowrap">{r.returnCarrier || '—'}</span> },
    { h: 'Tracking ID', render: r => <span className="font-mono text-[10px] text-slate-500">{r.trackingId || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><RefreshCcw size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Amazon Returns</h2>
            <p className="text-sm text-slate-500">Amazon return report management</p>
          </div>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" id="az-upload" onChange={handleFileUpload} />
          <label htmlFor="az-upload" className={`cursor-pointer flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${isUploading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' : 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-400/30'}`}>
            <Upload size={16} />{isUploading ? 'Reading...' : 'Upload Amazon Report'}
          </label>
        </div>
      </div>

      {/* Edit Panel */}
      {editingId && editForm && (
        <Card className="border-orange-200 bg-orange-50/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-600 font-bold text-sm"><Edit2 size={16} /> Editing Return Record</div>
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-rose-500"><X size={15} className="mr-1" /> Cancel</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <Input label="Order ID" value={editForm.orderId} onChange={ef('orderId')} />
            <Input label="Order Date" type="date" value={editForm.orderDate} onChange={ef('orderDate')} />
            <Input label="Return Request Date" type="date" value={editForm.returnRequestDate} onChange={ef('returnRequestDate')} />
            <Select label="Return Request Status" options={['Pending', 'Approved', 'Completed', 'Cancelled']} value={editForm.returnRequestStatus} onChange={ef('returnRequestStatus')} />
            <Input label="Amazon RMA ID" value={editForm.amazonRmaId} onChange={ef('amazonRmaId')} />
            <Input label="Seller RMA ID" value={editForm.sellerRmaId} onChange={ef('sellerRmaId')} />
            <Input label="Label Type" value={editForm.labelType} onChange={ef('labelType')} />
            <Input label="Label Cost" value={editForm.labelCost} onChange={ef('labelCost')} />
            <Input label="Currency Code" value={editForm.currencyCode} onChange={ef('currencyCode')} />
            <Input label="Return Carrier" value={editForm.returnCarrier} onChange={ef('returnCarrier')} />
            <Input label="Tracking ID" value={editForm.trackingId} onChange={ef('trackingId')} />
            <Input label="Label to be Paid By" value={editForm.labelPaidBy} onChange={ef('labelPaidBy')} />
            <Input label="A-to-Z Claim" value={editForm.atozClaim} onChange={ef('atozClaim')} />
            <Select label="Is Prime" options={['Yes', 'No', 'true', 'false']} value={editForm.isPrime} onChange={ef('isPrime')} />
            <Input label="ASIN" value={editForm.asin} onChange={ef('asin')} />
            <Input label="Merchant SKU" value={editForm.merchantSku} onChange={ef('merchantSku')} />
            <Input label="Item Name" value={editForm.itemName} onChange={ef('itemName')} />
            <Input label="Return Quantity" type="number" value={editForm.returnQuantity} onChange={ef('returnQuantity')} />
            <Input label="Return Reason" value={editForm.returnReason} onChange={ef('returnReason')} />
            <Select label="In Policy" options={['Yes', 'No', 'true', 'false']} value={editForm.inPolicy} onChange={ef('inPolicy')} />
            <Input label="Return Type" value={editForm.returnType} onChange={ef('returnType')} />
            <Input label="Resolution" value={editForm.resolution} onChange={ef('resolution')} />
            <Input label="Invoice Number" value={editForm.invoiceNumber} onChange={ef('invoiceNumber')} />
            <Input label="Return Delivery Date" type="date" value={editForm.returnDeliveryDate} onChange={ef('returnDeliveryDate')} />
            <Input label="Order Amount" value={editForm.orderAmount} onChange={ef('orderAmount')} />
            <Input label="Order Quantity" type="number" value={editForm.orderQuantity} onChange={ef('orderQuantity')} />
            <Input label="SafeT Action Reason" value={editForm.safetActionReason} onChange={ef('safetActionReason')} />
            <Input label="SafeT Claim ID" value={editForm.safetClaimId} onChange={ef('safetClaimId')} />
            <Select label="SafeT Claim State" options={['PENDING', 'APPROVED', 'DENIED']} value={editForm.safetClaimState} onChange={ef('safetClaimState')} />
            <Input label="SafeT Claim Creation Time" value={editForm.safetClaimCreationTime} onChange={ef('safetClaimCreationTime')} />
            <Input label="SafeT Reimb. Amount" value={editForm.safetReimbursementAmount} onChange={ef('safetReimbursementAmount')} />
            <Input label="Refunded Amount" value={editForm.refundedAmount} onChange={ef('refundedAmount')} />
            <Input label="Category" value={editForm.category} onChange={ef('category')} />
            <Input label="Order Item ID" value={editForm.orderItemId} onChange={ef('orderItemId')} />
          </div>
          <div className="flex justify-end mt-5">
            <Button onClick={saveEdit} loading={isSaving} className="bg-orange-600 hover:bg-orange-700 px-8">
              <Save size={15} className="mr-2" /> Save Changes
            </Button>
          </div>
        </Card>
      )}



      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Returns', value: stats.total, icon: <RotateCcw size={18} />, color: 'orange' },
          { label: 'A-to-Z Claims', value: stats.atoz, icon: <AlertCircle size={18} />, color: 'rose' },
          { label: 'SafeT Claims', value: stats.safet, icon: <Shield size={18} />, color: 'indigo' },
          { label: 'Total Refunded', value: `₹${stats.refunded}`, icon: <DollarSign size={18} />, color: 'emerald' },
        ].map(s => (
          <Card key={s.label} className={`border-${s.color}-100`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${s.color}-100 text-${s.color}-600`}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card noPadding>
        {/* Filter bar */}
        <div className="px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm whitespace-nowrap">
            <RotateCcw size={16} className="text-slate-400" />
            Amazon Return Records
            <span className="ml-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{filteredRecords.length}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <div className="relative min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Order ID, SKU, ASIN..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400"
                value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
            <input type="date" className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
            <span className="text-slate-400 text-xs">—</span>
            <input type="date" className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
            <select className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option>Pending</option><option>Approved</option><option>Completed</option><option>Cancelled</option>
            </select>
            <div className="border-l border-slate-200 pl-2">
              <Button variant="ghost" size="sm" onClick={handleExport} className="text-slate-600 h-8 text-xs">
                <Download size={13} className="mr-1" /> Export
              </Button>
            </div>
          </div>
        </div>

        {/* ── Mobile / Tablet card view (hidden on lg+) ── */}
        <div className="hidden divide-y divide-slate-100">
          {filteredRecords.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <Package size={40} className="opacity-25" />
              <p className="font-medium text-sm">No Amazon return records yet</p>
              <p className="text-xs">Upload an Amazon return report Excel file above</p>
            </div>
          ) : filteredRecords.map(r => {
            const matched = lookupProduct(r.merchantSku);
            return (
              <div key={r.id} className={`p-4 space-y-3 ${editingId === r.id ? 'bg-orange-50/40' : 'bg-white hover:bg-slate-50'} transition-colors`}>

                {/* Top row: Order ID + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-600">{r.orderId || '—'}</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">{r.returnRequestDate || r.orderDate || '—'}</span>
                      {r.returnType && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">{r.returnType}</span>}
                      {r.returnRequestStatus && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[r.returnRequestStatus] || 'bg-slate-100 text-slate-500'}`}>{r.returnRequestStatus}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(r)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Product info */}
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SKU</span>
                    <span className="font-mono text-[11px] text-slate-600">{r.merchantSku || '—'}</span>
                  </div>
                  {/* {matched && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Our Product</span>
                      <span className="text-[11px] font-semibold text-indigo-700 text-right max-w-[180px] truncate">{matched}</span>
                    </div>
                  )} */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Item</span>
                    <span className="text-[11px] text-slate-700 text-right max-w-[180px] truncate">{r.itemName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Reason</span>
                    <span className="text-[11px] text-slate-600 text-right max-w-[180px] truncate">{r.returnReason || '—'}</span>
                  </div>
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Qty', value: r.returnQuantity },
                    { label: 'Order Amt', value: r.orderAmount ? `₹${r.orderAmount}` : null },
                    { label: 'Refunded', value: r.refundedAmount ? `₹${r.refundedAmount}` : null, green: true },
                  ].map(f => (
                    <div key={f.label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${f.green ? 'text-emerald-600' : 'text-slate-800'}`}>{f.value || '—'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{f.label}</p>
                    </div>
                  ))}
                </div>

                {/* Manual fields */}
                <div className="border border-orange-100 bg-orange-50/30 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2">✏ Manual Fields</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Return Received</p>
                      <InlineSelect recordId={r.id} field="returnReceived" value={r.returnReceived}
                        options={['Yes', 'No', 'Pending']}
                        colorFn={v => v === 'Yes' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : v === 'No' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Status Returned</p>
                      <InlineSelect recordId={r.id} field="statusReturned" value={r.statusReturned}
                        options={['Completed', 'Pending', 'Rejected', 'Reimbursed']}
                        colorFn={v => STATUS_COLORS[v] || 'bg-slate-100 text-slate-600 border-slate-200'}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Not Received</p>
                      <InlineSelect recordId={r.id} field="notReceived" value={r.notReceived}
                        options={['Yes', 'No']}
                        colorFn={v => v === 'Yes' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Damaged Returns</p>
                      <InlineSelect recordId={r.id} field="damagedReturns" value={r.damagedReturns}
                        options={['Yes', 'No']}
                        colorFn={v => v === 'Yes' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Claims from Amazon</p>
                    <InlineText recordId={r.id} field="claimsFromAmazon" value={r.claimsFromAmazon} placeholder="Amount / Note" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Customer Comment</p>
                    <InlineText recordId={r.id} field="customerComment" value={r.customerComment} placeholder="Add comment..." />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop table (hidden below lg) ── */}
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] show-scrollbar">
          <table className="w-full text-left border-collapse" style={{ minWidth: '2000px' }}>
            <thead className="border-b border-slate-200">
              <tr>
                {TABLE_COLS.map(c => (
                  <th key={c.h} className={`sticky top-0 z-10 py-3 px-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    c.manual
                      ? 'text-orange-600 bg-orange-50 border-b-2 border-orange-200'
                      : 'text-slate-500 bg-slate-50'
                  }`}>{c.h}</th>
                ))}
                <th className="sticky top-0 z-10 py-3 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS.length + 1} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Package size={40} className="opacity-25" />
                      <p className="font-medium text-sm">No Amazon return records yet</p>
                      <p className="text-xs">Upload an Amazon return report Excel file above</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.map(r => (
                <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${editingId === r.id ? 'bg-orange-50/50 ring-1 ring-inset ring-orange-200' : ''}`}>
                  {TABLE_COLS.map(c => (
                    <td key={c.h} className="py-3 px-3">{c.render(r)}</td>
                  ))}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(r)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit"><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

