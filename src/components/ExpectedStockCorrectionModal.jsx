import React, { useState, useMemo } from 'react';
import { Card, Button } from './ui';
import { 
  AlertTriangle, Mail, Send, CheckCircle2, XCircle, Clock, 
  Search, Filter, CheckSquare, Square, RefreshCw, X, ShieldAlert, ArrowRight
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import toast from 'react-hot-toast';
import emailjs from 'emailjs-com';

const EMAILJS_SERVICES = [
  {
    serviceId: "service_qjav2yr",
    templateId: "template_78mdmph",
    publicKey: "o2ag2wDxhKyk6x8Bi"
  },
  {
    serviceId: "service_3oswmta",
    templateId: "template_3py8m97",
    publicKey: "ZOxREJf15qCqFOcBq"
  },
  {
    serviceId: "service_y7lj1lk",
    templateId: "template_49vk3nm",
    publicKey: "X5FofaqJcxk9CcT5z"
  },
  {
    serviceId: "service_0xl3c02",
    templateId: "template_5t3ip0b",
    publicKey: "EKtXoYJRPVHgAB_cA"
  }
];

const sendEmailWithFallback = async (templateParams) => {
  let lastError = null;
  for (const config of EMAILJS_SERVICES) {
    try {
      const res = await emailjs.send(config.serviceId, config.templateId, templateParams, config.publicKey);
      console.log(`[EmailJS Success] Service: ${config.serviceId}`, res);
      return res;
    } catch (err) {
      console.warn(`[EmailJS Attempt Failed] Service: ${config.serviceId}`, err);
      lastError = err;
    }
  }
  throw lastError || new Error("All EmailJS services failed to send email.");
};

const CORRECTION_REASONS = [
  "Audit Correction for Negative Expected Stock",
  "Physical Stock Audit Discrepancy",
  "Unrecorded Inward Stock / Purchase",
  "Unrecorded Dispatches / B2B / B2C Adjustments",
  "QC / Damage Record Re-adjustment",
  "System Sync / Calculation Entry Error",
  "Opening Stock Balance Carryover Error",
  "Rework / Production Raw Material Adjustment",
  "Other (Custom Reason)"
];

const ExpectedStockCorrectionModal = ({ isOpen, onClose, activePeriod, itemsList = [] }) => {
  const { 
    expectedStockRequests = [], 
    addExpectedStockRequest, 
    approveExpectedStockRequest, 
    rejectExpectedStockRequest,
    deleteExpectedStockRequest,
    currentUser
  } = useGlobalState();

  const [activeTab, setActiveTab] = useState('request'); // 'request' or 'approvals'
  const [senderEmail, setSenderEmail] = useState('sumitha@thengacoco.com');
  const [recipientEmail, setRecipientEmail] = useState('maria@thengacoco.com');
  const [ccEmail, setCcEmail] = useState('malavikavenu914@gmail.com');
  const [selectedReason, setSelectedReason] = useState(CORRECTION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNegativeOnly, setFilterNegativeOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Selected products for request: { [productId]: { selected: boolean, proposedExpected: number } }
  const [correctionsMap, setCorrectionsMap] = useState({});

  // Filter items available for correction
  const filteredItems = useMemo(() => {
    return itemsList.filter(item => {
      const matchSearch = !searchQuery.trim() || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const expectedVal = Number(item.expectedStock || 0);
      const isNegative = expectedVal < 0;

      if (filterNegativeOnly) {
        return matchSearch && isNegative;
      }
      return matchSearch;
    });
  }, [itemsList, searchQuery, filterNegativeOnly]);

  const negativeCount = useMemo(() => {
    return itemsList.filter(item => Number(item.expectedStock || 0) < 0).length;
  }, [itemsList]);

  const pendingRequests = useMemo(() => {
    return expectedStockRequests.filter(r => r.status === 'pending');
  }, [expectedStockRequests]);

  const approvedRequests = useMemo(() => {
    return expectedStockRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
  }, [expectedStockRequests]);

  // Toggle item selection
  const handleToggleSelect = (item) => {
    setCorrectionsMap(prev => {
      const existing = prev[item.id];
      if (existing?.selected) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      } else {
        return {
          ...prev,
          [item.id]: {
            selected: true,
            productId: item.id,
            productName: item.name,
            sku: item.sku || '-',
            currentExpected: Number(item.expectedStock || 0),
            proposedExpected: Math.max(0, Number(item.expectedStock || 0))
          }
        };
      }
    });
  };

  // Update proposed expected stock for a product
  const handleProposedChange = (item, val) => {
    const num = val === '' ? '' : Number(val);
    setCorrectionsMap(prev => ({
      ...prev,
      [item.id]: {
        selected: true,
        productId: item.id,
        productName: item.name,
        sku: item.sku || '-',
        currentExpected: Number(item.expectedStock || 0),
        proposedExpected: num
      }
    }));
  };

  // Select all visible negative items
  const handleSelectAllNegative = () => {
    const newMap = { ...correctionsMap };
    filteredItems.forEach(item => {
      if (!newMap[item.id]?.selected) {
        newMap[item.id] = {
          selected: true,
          productId: item.id,
          productName: item.name,
          sku: item.sku || '-',
          currentExpected: Number(item.expectedStock || 0),
          proposedExpected: Math.max(0, Number(item.expectedStock || 0))
        };
      }
    });
    setCorrectionsMap(newMap);
  };

  const selectedCount = Object.values(correctionsMap).filter(v => v.selected).length;

  // Helper to build comprehensive EmailJS template parameters
  const buildExpectedStockTemplateParams = ({
    period,
    selectedItems,
    reason,
    requestedBy,
    recipientEmail,
    ccEmail,
    requestId
  }) => {
    const baseUrl = window.location.origin;
    const approvalUrl = `${baseUrl}/stock?approveRequestId=${requestId}`;

    const itemsHtml = (selectedItems || []).map(p => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-family: sans-serif; font-size: 14px; font-weight: bold; color: #1e293b;">${p.productName} <span style="font-size: 11px; color: #64748b;">(${p.sku || '-'})</span></td>
        <td style="padding: 10px; font-family: sans-serif; font-size: 14px; font-weight: bold; color: #dc2626; text-align: center;">${p.currentExpected}</td>
        <td style="padding: 10px; font-family: sans-serif; font-size: 14px; font-weight: bold; color: #059669; text-align: center;">${p.proposedExpected}</td>
        <td style="padding: 10px; font-family: sans-serif; font-size: 14px; font-weight: bold; color: #2563eb; text-align: center;">${p.proposedExpected - p.currentExpected > 0 ? `+${p.proposedExpected - p.currentExpected}` : p.proposedExpected - p.currentExpected}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; padding-bottom: 15px; border-bottom: 2px solid #4f46e5; margin-bottom: 20px;">
          <h2 style="color: #1e1b4b; margin: 0; font-size: 22px;">Expected Stock Correction Request</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 5px;">Period: <b>${period}</b> | Requested by: <b>${requestedBy}</b></p>
        </div>

        <p style="font-size: 14px; color: #334155; line-height: 1.6;">
          A request has been submitted to correct expected stock counts for <b>${(selectedItems || []).length} products</b>. Click the button below to review and approve this stock correction:
        </p>

        <div style="text-align: center; margin: 25px 0 25px 0;">
          <a href="${approvalUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 8px; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            ✓ Approve Stock Correction Request (${(selectedItems || []).length} items)
          </a>
        </div>

        <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #475569;">
          <b>Reason / Audit Category:</b> ${reason || 'Expected Stock Adjustment'}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f8fafc; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #e0e7ff; color: #3730a3; font-size: 12px; text-transform: uppercase;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Current Expected</th>
              <th style="padding: 10px; text-align: center;">Proposed Expected</th>
              <th style="padding: 10px; text-align: center;">Difference</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #1e40af;">
          <b>Direct Approval Link:</b><br/>
          <a href="${approvalUrl}" target="_blank" style="color: #2563eb; word-break: break-all; font-weight: bold;">${approvalUrl}</a>
        </div>

        <div style="text-align: center; padding-top: 15px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8;">This is an automated request notification from the ThengaCoco Stock System.</p>
        </div>
      </div>
    `;

    const targetRecipient = recipientEmail || 'maria@thengacoco.com';

    return {
      to_email: targetRecipient.trim(),
      recipient_email: targetRecipient.trim(),
      cc_email: ccEmail ? ccEmail.trim() : '',
      from_name: "ThengaCoco Stock System",
      subject: `Expected Stock Correction Request - ${period}`,
      vendor_name: "Expected Stock Correction Request",
      date: period,
      period: period,
      reason: reason || 'Expected Stock Adjustment',
      requested_by: requestedBy,
      message: emailHtml,
      product_details: emailHtml,
      html_message: emailHtml,
      body: emailHtml,
      details: emailHtml,
      content: emailHtml,
      email_html: emailHtml,
      approval_url: approvalUrl
    };
  };

  // Submit request and send email to Maria
  const handleSubmitRequest = async () => {
    const selectedItems = Object.values(correctionsMap)
      .filter(v => v.selected && v.proposedExpected !== '')
      .map(v => ({
        productId: v.productId,
        productName: v.productName,
        sku: v.sku,
        currentExpected: Number(v.currentExpected),
        proposedExpected: Number(v.proposedExpected)
      }));

    if (selectedItems.length === 0) {
      toast.error('Please select at least one product and enter a proposed expected stock value.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Submitting correction request for ${selectedItems.length} products...`);

    try {
      const finalReason = selectedReason === 'Other (Custom Reason)'
        ? (customReason.trim() || 'Custom Expected Stock Adjustment')
        : selectedReason;

      const requester = senderEmail.trim() || currentUser?.email || 'sumitha@thengacoco.com';

      // 1. Save to Firebase
      const requestData = {
        period: activePeriod,
        items: selectedItems,
        reason: finalReason,
        requestedBy: requester,
        recipientEmail: recipientEmail.trim(),
        ccEmail: ccEmail.trim()
      };

      const reqId = await addExpectedStockRequest(requestData);

      // 2. Format template parameters
      const templateParams = buildExpectedStockTemplateParams({
        period: activePeriod,
        selectedItems,
        reason: finalReason,
        requestedBy: requester,
        recipientEmail: recipientEmail.trim(),
        ccEmail: ccEmail.trim(),
        requestId: reqId
      });

      try {
        await sendEmailWithFallback(templateParams);
        toast.success(`Request submitted & approval email sent to ${recipientEmail.trim()}!`, { id: toastId });
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
        toast.error(`Request created, but email failed to send: ${emailErr.message || 'Check EmailJS configuration'}`, { id: toastId, duration: 6000 });
      }

      setCorrectionsMap({});
      setSelectedReason(CORRECTION_REASONS[0]);
      setCustomReason('');
      setActiveTab('pending');
    } catch (err) {
      toast.error('Failed to submit request: ' + err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve request and update monthlyStockData
  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    const toastId = toast.loading('Approving stock correction...');
    try {
      await approveExpectedStockRequest(requestId);
      toast.success('Success! Stock correction approved & applied to expected stock!', { id: toastId });
    } catch (err) {
      toast.error('Approval failed: ' + err.message, { id: toastId });
    } finally {
      setProcessingId(null);
    }
  };

  // Reject request
  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await rejectExpectedStockRequest(requestId);
      toast.success('Correction request rejected.');
    } catch (err) {
      toast.error('Failed to reject: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Resend approval email to recipient
  const handleResendEmail = async (req) => {
    setProcessingId(req.id);
    const toastId = toast.loading('Resending approval email...');

    try {
      const selectedItems = req.items || [];
      const requester = req.requestedBy || senderEmail.trim() || currentUser?.email || 'Staff';
      const targetRecipient = req.recipientEmail || recipientEmail || 'maria@thengacoco.com';

      const templateParams = buildExpectedStockTemplateParams({
        period: req.period,
        selectedItems,
        reason: req.reason || 'Expected Stock Adjustment',
        requestedBy: requester,
        recipientEmail: targetRecipient,
        ccEmail: req.ccEmail || ccEmail || '',
        requestId: req.id
      });

      await sendEmailWithFallback(templateParams);
      toast.success(`Approval email resent successfully to ${targetRecipient}!`, { id: toastId });
    } catch (err) {
      console.error("Resend email error:", err);
      toast.error('Failed to resend approval email: ' + err.message, { id: toastId });
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Expected Stock Correction & Approval</h2>
              <p className="text-xs text-slate-400">Period: <span className="font-semibold text-indigo-300">{activePeriod}</span></p>
            </div>
          </div>
          
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('request')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'request'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle size={15} />
            <span>Create Correction Request</span>
            {negativeCount > 0 && (
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                {negativeCount} Negative
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pending'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={15} />
            <span>Pending Approvals</span>
            {pendingRequests.length > 0 && (
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Approved & History</span>
            {approvedRequests.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                {approvedRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-5">
          {activeTab === 'request' && (
            <>
              {/* Controls bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search SKU or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none w-full focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <button
                    onClick={() => setFilterNegativeOnly(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      filterNegativeOnly
                        ? 'bg-rose-100 text-rose-700 border border-rose-300'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    <Filter size={13} />
                    <span>{filterNegativeOnly ? `Showing Negative Stock (${negativeCount})` : `Showing All Products (${itemsList.length})`}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllNegative}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Select All Visible ({filteredItems.length})
                  </button>
                  {selectedCount > 0 && (
                    <button
                      onClick={() => setCorrectionsMap({})}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Items List for Selection */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="p-3 w-10 text-center">Select</th>
                        <th className="p-3">Product Name / SKU</th>
                        <th className="p-3 text-center">Current Expected</th>
                        <th className="p-3 text-center w-40">Proposed Expected</th>
                        <th className="p-3 text-center">Adjustment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No products matching criteria found.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => {
                          const isSelected = correctionsMap[item.id]?.selected;
                          const currentVal = Number(item.expectedStock || 0);
                          const proposedVal = correctionsMap[item.id]?.proposedExpected !== undefined ? correctionsMap[item.id].proposedExpected : Math.max(0, currentVal);
                          const diff = proposedVal !== '' ? Number(proposedVal) - currentVal : 0;

                          return (
                            <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelect(item)}
                                  className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                                </button>
                              </td>

                              <td className="p-3">
                                <div className="font-bold text-slate-800">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku || '-'}</div>
                              </td>

                              <td className="p-3 text-center font-bold">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full ${currentVal < 0 ? 'bg-rose-100 text-rose-700 font-black' : 'bg-slate-100 text-slate-700'}`}>
                                  {currentVal}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  placeholder="New Expected"
                                  value={proposedVal}
                                  onChange={(e) => handleProposedChange(item, e.target.value)}
                                  className="w-28 px-2.5 py-1 text-center font-bold bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                                />
                              </td>

                              <td className="p-3 text-center font-bold">
                                {isSelected ? (
                                  <span className={`text-xs font-extrabold ${diff > 0 ? 'text-emerald-600' : (diff < 0 ? 'text-rose-600' : 'text-slate-500')}`}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Request Options & Email Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-indigo-600" />
                  <span>Notification Email Details</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Sender Email (From)
                    </label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Recipient Email (To)
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      CC Emails
                    </label>
                    <input
                      type="text"
                      placeholder="CC Emails..."
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Reason for Stock Correction
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      {CORRECTION_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>

                    {selectedReason === 'Other (Custom Reason)' && (
                      <input
                        type="text"
                        placeholder="Type custom reason..."
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="w-full px-3 py-1.5 mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-400" />
                  <p className="font-semibold text-sm">No pending approval requests.</p>
                  <p className="text-xs text-slate-400 mt-1">All stock correction requests have been processed.</p>
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">Period: {req.period}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Requested by: <span className="font-medium text-slate-600">{req.requestedBy}</span> • {new Date(req.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleResendEmail(req)}
                          disabled={processingId === req.id}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                          title="Resend approval email to recipient"
                        >
                          <Mail size={14} />
                          <span>Resend Email</span>
                        </button>
                      </div>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                        <b>Reason:</b> {req.reason}
                      </p>
                    )}

                    {/* Items table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-y border-slate-200">
                            <th className="p-2">Product</th>
                            <th className="p-2 text-center">Current</th>
                            <th className="p-2 text-center">Proposed New</th>
                            <th className="p-2 text-center">Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(req.items || []).map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-semibold text-slate-800">{item.productName}</td>
                              <td className="p-2 text-center font-bold text-rose-600">{item.currentExpected}</td>
                              <td className="p-2 text-center font-bold text-emerald-600">{item.proposedExpected}</td>
                              <td className="p-2 text-center font-bold text-indigo-600">
                                {item.proposedExpected - item.currentExpected > 0 ? `+${item.proposedExpected - item.currentExpected}` : item.proposedExpected - item.currentExpected}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {approvedRequests.length === 0 ? (
                <div className="bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
                  <Clock size={36} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-sm">No approved or past requests yet.</p>
                </div>
              ) : (
                approvedRequests.map((req) => {
                  const isApproved = req.status === 'approved';

                  return (
                    <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">Period: {req.period}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Requested by: <span className="font-medium text-slate-600">{req.requestedBy}</span> • {new Date(req.createdAt).toLocaleString()}
                            {req.approvedAt && ` • Approved at: ${new Date(req.approvedAt).toLocaleString()}`}
                          </p>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                          <b>Reason:</b> {req.reason}
                        </p>
                      )}

                      {/* Items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-y border-slate-200">
                              <th className="p-2">Product</th>
                              <th className="p-2 text-center">Current</th>
                              <th className="p-2 text-center">Proposed New</th>
                              <th className="p-2 text-center">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(req.items || []).map((item, idx) => (
                              <tr key={idx}>
                                <td className="p-2 font-semibold text-slate-800">{item.productName}</td>
                                <td className="p-2 text-center font-bold text-rose-600">{item.currentExpected}</td>
                                <td className="p-2 text-center font-bold text-emerald-600">{item.proposedExpected}</td>
                                <td className="p-2 text-center font-bold text-indigo-600">
                                  {item.proposedExpected - item.currentExpected > 0 ? `+${item.proposedExpected - item.currentExpected}` : item.proposedExpected - item.currentExpected}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {activeTab === 'request' && (
              <span>Selected: <b className="text-indigo-600 font-extrabold">{selectedCount}</b> products for correction</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onClose} variant="secondary" className="text-xs h-9 px-4 rounded-xl">
              Close
            </Button>

            {activeTab === 'request' && (
              <Button
                onClick={handleSubmitRequest}
                loading={isSubmitting}
                disabled={selectedCount === 0}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Send size={14} />
                <span>Submit Request & Send Email ({selectedCount})</span>
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExpectedStockCorrectionModal;
