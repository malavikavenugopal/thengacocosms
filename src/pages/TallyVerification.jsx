import React, { useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { 
  FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Info, X, 
  Search, DownloadCloud, History, RefreshCw, Layers, Calendar, 
  HelpCircle, ArrowUpRight, ArrowDownRight, Trash2, Eye, Image as ImageIcon, Loader2
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportToExcel } from '../utils/exportUtils';
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

// Helper for soft name matching between Tally sheet item names and system SKU names
const cleanName = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const matchProductName = (tallyName, stockList = []) => {
  if (!tallyName) return null;
  const cleanTally = cleanName(tallyName);

  // 1. Exact or cleaned match
  let match = stockList.find(s => cleanName(s.name) === cleanTally);
  if (match) return match.name;

  // 2. Partial containment match
  match = stockList.find(s => {
    const cStock = cleanName(s.name);
    return cleanTally.includes(cStock) || cStock.includes(cleanTally);
  });
  if (match) return match.name;

  return null;
};

const TallyVerification = () => {
  const { 
    stock = [], 
    b2bShipments = [], 
    purchaseRecords = [], 
    productionRecords = [], 
    returnRecords = [], 
    damageRecords = [], 
    replacementRecords = [], 
    reworkRecords = [],
    tallyVerifications = [],
    addTallyVerification,
    deleteTallyVerification,
    currentUser
  } = useGlobalState();

  const [activeTab, setActiveTab] = useState('reconcile'); // 'reconcile' | 'history'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tallyItems, setTallyItems] = useState([]); // Empty state by default — populated on file/image upload
  const [sheetMetadata, setSheetMetadata] = useState({
    fileName: '',
    godown: 'Main Location',
    company: 'THENGA',
    sourceType: ''
  });

  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'MATCHED' | 'DISCREPANCY' | 'MISSING_SYSTEM' | 'MISSING_TALLY'
  const [activeDetailItem, setActiveDetailItem] = useState(null); // For "i" button modal
  const [viewHistoryRecord, setViewHistoryRecord] = useState(null); // For history detail view modal
  const [saving, setSaving] = useState(false);

  // File upload handler for Excel/CSV
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length === 0) {
          toast.error('The uploaded file is empty');
          return;
        }

        let headerRowIndex = -1;
        let colMap = { name: -1, opening: -1, inwards: -1, outwards: -1, closing: -1, remarks: -1 };

        for (let r = 0; r < Math.min(15, data.length); r++) {
          const row = data[r] || [];
          row.forEach((cell, c) => {
            const cellStr = String(cell || '').toLowerCase();
            if (cellStr.includes('particular') || cellStr.includes('product') || cellStr.includes('item')) colMap.name = c;
            if (cellStr.includes('opening')) colMap.opening = c;
            if (cellStr.includes('inward') || cellStr === 'in') colMap.inwards = c;
            if (cellStr.includes('outward') || cellStr === 'out') colMap.outwards = c;
            if (cellStr.includes('closing')) colMap.closing = c;
            if (cellStr.includes('remark') || cellStr.includes('note')) colMap.remarks = c;
          });

          if (colMap.name !== -1 && (colMap.inwards !== -1 || colMap.outwards !== -1)) {
            headerRowIndex = r;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error('Could not detect table headers (Particulars, Inwards, Outwards). Please check format.');
          return;
        }

        const parsedItems = [];
        for (let r = headerRowIndex + 1; r < data.length; r++) {
          const row = data[r] || [];
          const rawName = String(row[colMap.name] || '').trim();
          if (!rawName || rawName.toLowerCase().includes('grand total') || rawName.toLowerCase().includes('total')) continue;

          const parseValAndUnit = (valStr) => {
            if (valStr === undefined || valStr === null) return { val: 0, unit: 'NOS' };
            const str = String(valStr).trim();
            const num = parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
            let unit = 'NOS';
            if (str.toLowerCase().includes('gm')) unit = 'gm';
            else if (str.toLowerCase().includes('kg')) unit = 'kg';
            else if (str.toLowerCase().includes('pcs')) unit = 'pcs';
            return { val: num, unit };
          };

          const openData = parseValAndUnit(row[colMap.opening]);
          const inData = parseValAndUnit(row[colMap.inwards]);
          const outData = parseValAndUnit(row[colMap.outwards]);
          const closeData = parseValAndUnit(row[colMap.closing]);
          const remarks = colMap.remarks !== -1 ? String(row[colMap.remarks] || '').trim() : '';

          parsedItems.push({
            name: rawName,
            opening: openData.val,
            inwards: inData.val,
            outwards: outData.val,
            closing: closeData.val,
            unit: inData.unit || outData.unit || 'NOS',
            remarks
          });
        }

        if (parsedItems.length === 0) {
          toast.error('No item rows parsed from sheet');
          return;
        }

        setTallyItems(parsedItems);
        setUploadedImagePreview(null);
        setSheetMetadata({
          fileName: file.name,
          godown: 'Main Location',
          company: 'THENGA',
          sourceType: 'Excel File'
        });
        toast.success(`Loaded ${parsedItems.length} items from ${file.name}`);
      } catch (err) {
        console.error("Excel parse error:", err);
        toast.error('Failed to parse file. Make sure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Image Upload Handler & OCR Processing
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Display image preview thumbnail immediately
    const imageObjectURL = URL.createObjectURL(file);
    setUploadedImagePreview(imageObjectURL);
    setOcrLoading(true);
    setOcrProgress(10);
    setOcrStatusText('Initializing Image OCR Engine...');

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
            setOcrStatusText(`Scanning Image Text... ${Math.round(m.progress * 100)}%`);
          } else {
            setOcrStatusText(m.status);
          }
        }
      });

      setOcrStatusText('Extracting product table entries from image...');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // Parse OCR Extracted text line by line
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedItems = [];

      // Check if Date is present in header (e.g., 17-Sep-26, 17/09/2026, 2026-09-17)
      const dateMatch = text.match(/(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})/i);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const monthStr = dateMatch[2];
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        
        const monthsMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        const monthNum = monthsMap[monthStr.toLowerCase()] || (parseInt(monthStr, 10) ? String(monthStr).padStart(2, '0') : '09');
        setSelectedDate(`${year}-${monthNum}-${day}`);
      }

      // Try matching lines against System SKU Master list or tabular pattern
      lines.forEach((line) => {
        if (line.toLowerCase().includes('grand total') || line.toLowerCase().includes('godown summary')) return;

        // Try to find if this line contains any SKU from stock
        const matchedStock = stock.find(s => {
          const cName = cleanName(s.name);
          const cLine = cleanName(line);
          return cName.length > 3 && cLine.includes(cName);
        });

        // Extract numbers and units from the line
        const numbers = line.match(/[-+]?\d*\.?\d+/g) || [];

        if (matchedStock || numbers.length >= 2) {
          const itemName = matchedStock ? matchedStock.name : line.replace(/[-+]?\d*\.?\d+/g, '').replace(/\b(NOS|gm|kg|pcs)\b/gi, '').trim();

          if (itemName && itemName.length > 2) {
            let unit = 'NOS';
            if (line.toLowerCase().includes('gm')) unit = 'gm';
            else if (line.toLowerCase().includes('kg')) unit = 'kg';
            else if (line.toLowerCase().includes('pcs')) unit = 'pcs';

            // Numbers in Tally Godown summary order: Opening, Inwards, Outwards, Closing
            let opening = 0, inwards = 0, outwards = 0, closing = 0;
            if (numbers.length >= 4) {
              opening = parseFloat(numbers[0]) || 0;
              inwards = parseFloat(numbers[1]) || 0;
              outwards = parseFloat(numbers[2]) || 0;
              closing = parseFloat(numbers[3]) || 0;
            } else if (numbers.length === 3) {
              inwards = parseFloat(numbers[0]) || 0;
              outwards = parseFloat(numbers[1]) || 0;
              closing = parseFloat(numbers[2]) || 0;
            } else if (numbers.length === 2) {
              inwards = parseFloat(numbers[0]) || 0;
              outwards = parseFloat(numbers[1]) || 0;
            } else if (numbers.length === 1) {
              outwards = parseFloat(numbers[0]) || 0;
            }

            // Extract remarks at end of line (e.g. "Blessed stems", "Fingent global")
            let remarks = '';
            const remarksMatch = line.match(/(Blessed stems|Fingent global|ALP department|Reindeer Candlemaking|[A-Za-z\s]{5,})$/i);
            if (remarksMatch && !remarksMatch[0].toLowerCase().includes(itemName.toLowerCase())) {
              remarks = remarksMatch[0].trim();
            }

            // Avoid duplicate additions
            if (!parsedItems.some(p => p.name.toLowerCase() === itemName.toLowerCase())) {
              parsedItems.push({
                name: itemName,
                opening,
                inwards,
                outwards,
                closing,
                unit,
                remarks
              });
            }
          }
        }
      });

      if (parsedItems.length > 0) {
        setTallyItems(parsedItems);
        toast.success(`OCR Scan Complete! Extracted ${parsedItems.length} products from image.`);
      } else {
        toast.error('Could not extract structured product table entries from image. Please ensure image is clear.');
      }

      setSheetMetadata({
        fileName: file.name,
        godown: 'Main Location',
        company: 'THENGA',
        sourceType: 'Uploaded Image (OCR Scan)'
      });

    } catch (err) {
      console.error("OCR Image processing failed:", err);
      toast.error('Failed to process image OCR. Please try uploading a clearer image or Excel file.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Build System Movement Data for the Selected Date
  const systemMovementsByProduct = useMemo(() => {
    const movements = {};

    const getProdBucket = (pName) => {
      if (!pName) return null;
      if (!movements[pName]) {
        movements[pName] = {
          inwards: 0,
          outwards: 0,
          purchases: [],
          productionIn: [],
          returnsIn: [],
          reworkIn: [],
          b2bOut: [],
          productionOut: [],
          damageOut: [],
          replacementOut: [],
          reworkOut: []
        };
      }
      return movements[pName];
    };

    // 1. Inwards: Purchases
    (purchaseRecords || []).forEach(p => {
      if (p.date === selectedDate && p.productName) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        const b = getProdBucket(p.productName);
        if (b) {
          b.inwards += totalUnits;
          b.purchases.push({ vendor: p.vendorName || 'Vendor', qty: totalUnits, invoice: p.invoiceNo || 'N/A' });
        }
      }
    });

    // 2. Inwards: Candle Manufacturing (Finished candles produced)
    (productionRecords || []).forEach(pr => {
      if (pr.date === selectedDate && pr.productName) {
        const totalUnits = (Number(pr.quantity) || 0) * (Number(pr.packSize) || 1);
        const b = getProdBucket(pr.productName);
        if (b) {
          b.inwards += totalUnits;
          b.productionIn.push({ batch: pr.batchNo || 'Production', qty: totalUnits });
        }
      }
      // Outwards: Raw Materials consumed in candle manufacturing
      if (pr.date === selectedDate && Array.isArray(pr.rawMaterials)) {
        pr.rawMaterials.forEach(rm => {
          if (rm.name) {
            const rmUnits = (Number(rm.quantity) || 0) * (Number(rm.packSize) || 1);
            const rmBucket = getProdBucket(rm.name);
            if (rmBucket) {
              rmBucket.outwards += rmUnits;
              rmBucket.productionOut.push({ finishedProduct: pr.productName, qty: rmUnits });
            }
          }
        });
      }
    });

    // 3. Inwards: Reusable Returns
    (returnRecords || []).forEach(r => {
      if (r.date === selectedDate && r.productName && r.isReusable) {
        const totalUnits = (Number(r.quantity) || 0) * (Number(r.packSize) || 1);
        const b = getProdBucket(r.productName);
        if (b) {
          b.inwards += totalUnits;
          b.returnsIn.push({ client: r.clientName || 'Customer Return', qty: totalUnits, reason: r.reason });
        }
      }
    });

    // 4. Inwards & Outwards: Rework
    (reworkRecords || []).forEach(rw => {
      if (rw.outDate === selectedDate) {
        const prods = rw.products && rw.products.length > 0 ? rw.products : [{ productName: rw.productName, quantity: rw.quantity }];
        prods.forEach(p => {
          if (p.productName) {
            const qty = Number(p.quantity) || 0;
            const b = getProdBucket(p.productName);
            if (b) {
              b.outwards += qty;
              b.reworkOut.push({ recipient: rw.artisan || 'Rework Unit', qty });
            }
          }
        });
      }
      if (rw.returnDate === selectedDate && rw.status === 'Reworked') {
        const retProds = rw.returnProducts && rw.returnProducts.length > 0 ? rw.returnProducts : [{ returnProductName: rw.returnProductName, returnQuantity: rw.returnQuantity }];
        retProds.forEach(rp => {
          if (rp.returnProductName) {
            const qty = Number(rp.returnQuantity) || 0;
            const b = getProdBucket(rp.returnProductName);
            if (b) {
              b.inwards += qty;
              b.reworkIn.push({ artisan: rw.artisan || 'Rework Return', qty });
            }
          }
        });
      }
    });

    // 5. Outwards: B2B Shipments
    (b2bShipments || []).forEach(sh => {
      if (sh.date === selectedDate && sh.status !== 'Cancelled') {
        (sh.products || []).forEach(p => {
          if (p.name) {
            const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
            const b = getProdBucket(p.name);
            if (b) {
              b.outwards += totalUnits;
              b.b2bOut.push({
                client: sh.clientName,
                courier: sh.courierName,
                tracking: sh.trackingNumber,
                qty: totalUnits,
                stockOption: p.stockOption
              });
            }
          }
        });
      }
    });

    // 6. Outwards: Damage Tracking
    (damageRecords || []).forEach(d => {
      if (d.date === selectedDate && d.productName) {
        const totalUnits = (Number(d.quantity) || 0) * (Number(d.packSize) || 1);
        const b = getProdBucket(d.productName);
        if (b) {
          b.outwards += totalUnits;
          b.damageOut.push({ reason: d.reason || 'Damaged', qty: totalUnits });
        }
      }
    });

    // 7. Outwards: Replacements
    (replacementRecords || []).forEach(rep => {
      if (rep.date === selectedDate) {
        const prods = rep.products || [{ productName: rep.productName, quantity: rep.quantity, packSize: rep.packSize }];
        prods.forEach(p => {
          const pName = p.name || p.productName;
          if (pName) {
            const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
            const b = getProdBucket(pName);
            if (b) {
              b.outwards += totalUnits;
              b.replacementOut.push({ client: rep.clientName || 'Replacement', qty: totalUnits });
            }
          }
        });
      }
    });

    return movements;
  }, [selectedDate, b2bShipments, purchaseRecords, productionRecords, returnRecords, damageRecords, replacementRecords, reworkRecords]);

  // Combined Verification Items List (Tally Sheet + System Data Comparison)
  const reconciliationReport = useMemo(() => {
    const reportMap = new Map();

    tallyItems.forEach(tItem => {
      const matchedSystemSKU = matchProductName(tItem.name, stock);
      const systemName = matchedSystemSKU || tItem.name;

      const sysData = systemMovementsByProduct[systemName] || {
        inwards: 0,
        outwards: 0,
        purchases: [],
        productionIn: [],
        returnsIn: [],
        reworkIn: [],
        b2bOut: [],
        productionOut: [],
        damageOut: [],
        replacementOut: [],
        reworkOut: []
      };

      const matchedSKUObj = stock.find(s => s.name === systemName);

      const tallyIn = Number(tItem.inwards) || 0;
      const tallyOut = Number(tItem.outwards) || 0;
      const sysIn = sysData.inwards;
      const sysOut = sysData.outwards;

      const inDiff = tallyIn - sysIn;
      const outDiff = tallyOut - sysOut;

      let status = 'MATCHED';
      if (!matchedSKUObj && (sysIn === 0 && sysOut === 0)) {
        status = 'MISSING_SYSTEM';
      } else if (inDiff !== 0 || outDiff !== 0) {
        status = 'DISCREPANCY';
      }

      reportMap.set(tItem.name.toLowerCase(), {
        id: `tally_${tItem.name}`,
        tallyName: tItem.name,
        systemName: matchedSKUObj ? systemName : null,
        unit: tItem.unit || 'NOS',
        opening: tItem.opening,
        tallyIn,
        tallyOut,
        tallyClosing: tItem.closing,
        remarks: tItem.remarks,
        sysIn,
        sysOut,
        inDiff,
        outDiff,
        status,
        sysData,
        inTallySheet: true
      });
    });

    Object.keys(systemMovementsByProduct).forEach(sysProdName => {
      const sysData = systemMovementsByProduct[sysProdName];
      if (sysData.inwards === 0 && sysData.outwards === 0) return;

      const alreadyProcessed = Array.from(reportMap.values()).some(r => r.systemName === sysProdName || r.tallyName.toLowerCase() === sysProdName.toLowerCase());

      if (!alreadyProcessed) {
        reportMap.set(`sys_${sysProdName.toLowerCase()}`, {
          id: `sys_${sysProdName}`,
          tallyName: '— (Not in Tally Sheet)',
          systemName: sysProdName,
          unit: 'NOS',
          opening: 0,
          tallyIn: 0,
          tallyOut: 0,
          tallyClosing: 0,
          remarks: 'Present in System, missing in Tally sheet',
          sysIn: sysData.inwards,
          sysOut: sysData.outwards,
          inDiff: -sysData.inwards,
          outDiff: -sysData.outwards,
          status: 'MISSING_TALLY',
          sysData,
          inTallySheet: false
        });
      }
    });

    return Array.from(reportMap.values());
  }, [tallyItems, systemMovementsByProduct, stock]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = reconciliationReport.length;
    const matched = reconciliationReport.filter(r => r.status === 'MATCHED').length;
    const discrepancies = reconciliationReport.filter(r => r.status === 'DISCREPANCY').length;
    const missingSystem = reconciliationReport.filter(r => r.status === 'MISSING_SYSTEM').length;
    const missingTally = reconciliationReport.filter(r => r.status === 'MISSING_TALLY').length;
    return { total, matched, discrepancies, missingSystem, missingTally };
  }, [reconciliationReport]);

  // Filtered List
  const filteredReport = useMemo(() => {
    return reconciliationReport.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.tallyName.toLowerCase().includes(q) || 
                            (item.systemName && item.systemName.toLowerCase().includes(q)) ||
                            (item.remarks && item.remarks.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'MATCHED') return item.status === 'MATCHED';
      if (statusFilter === 'DISCREPANCY') return item.status === 'DISCREPANCY';
      if (statusFilter === 'MISSING_SYSTEM') return item.status === 'MISSING_SYSTEM';
      if (statusFilter === 'MISSING_TALLY') return item.status === 'MISSING_TALLY';
      return true;
    });
  }, [reconciliationReport, searchQuery, statusFilter]);

  // Save current verification report to Firebase History Log
  const handleSaveVerification = async () => {
    if (reconciliationReport.length === 0) {
      toast.error('No items in current verification sheet to save. Upload an image or file first.');
      return;
    }

    setSaving(true);
    try {
      const recordToSave = {
        date: selectedDate,
        fileName: sheetMetadata.fileName || 'Tally_Image_Scan',
        godown: sheetMetadata.godown,
        company: sheetMetadata.company,
        verifiedBy: currentUser?.email || 'Admin',
        stats,
        items: reconciliationReport.map(r => ({
          tallyName: r.tallyName,
          systemName: r.systemName,
          unit: r.unit,
          tallyIn: r.tallyIn,
          sysIn: r.sysIn,
          inDiff: r.inDiff,
          tallyOut: r.tallyOut,
          sysOut: r.sysOut,
          outDiff: r.outDiff,
          status: r.status,
          remarks: r.remarks
        }))
      };

      await addTallyVerification(recordToSave);
      toast.success(`Tally verification for ${selectedDate} saved to history log!`);
    } catch (err) {
      console.error("Save error:", err);
      toast.error('Failed to save verification log.');
    } finally {
      setSaving(false);
    }
  };

  // Delete verification log from history
  const handleDeleteHistory = async (id, date) => {
    const result = await Swal.fire({
      title: 'Delete Verification Log?',
      text: `Are you sure you want to delete the verification record for ${date}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      await deleteTallyVerification(id);
      toast.success(`Deleted verification record for ${date}`);
    }
  };

  // Export current reconciliation to Excel
  const handleExportExcel = () => {
    if (reconciliationReport.length === 0) {
      toast.error('No data to export. Upload a Tally image or file first.');
      return;
    }

    const exportData = reconciliationReport.map(item => ({
      'Tally Product Name': item.tallyName,
      'System SKU Name': item.systemName || 'N/A',
      'Unit': item.unit,
      'Opening Balance': item.opening,
      'Tally Inwards': item.tallyIn,
      'System Inwards': item.sysIn,
      'Inwards Diff': item.inDiff,
      'Tally Outwards': item.tallyOut,
      'System Outwards': item.sysOut,
      'Outwards Diff': item.outDiff,
      'Status': item.status,
      'Tally Sheet Remarks': item.remarks || ''
    }));

    exportToExcel(exportData, `Tally_Reconciliation_${selectedDate}.xlsx`, `Tally ${selectedDate}`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Page Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-600/30">
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Tally Stock Verification & Reconciliation
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Upload your Tally Godown summary sheet image or Excel file to verify date-wise stock movements against system records.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('reconcile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
              activeTab === 'reconcile'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RefreshCw size={16} />
            Reconciliation Tool
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History size={16} />
            Verification History Logs
            {tallyVerifications.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {tallyVerifications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'reconcile' ? (
        <>
          {/* Controls Bar: Upload Image, Upload Excel & Date Selector */}
          <Card className="p-4 md:p-6 border-slate-200 shadow-sm bg-white rounded-2xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Target Date Selector */}
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Verification Date
                  </label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>

                {/* Primary Action: Upload Tally Image */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 text-indigo-700 flex items-center gap-1">
                    <ImageIcon size={14} /> Upload Tally Image
                  </label>
                  <label className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer font-bold text-sm shadow-md shadow-indigo-600/30 transition-all duration-200">
                    <ImageIcon size={18} />
                    <span>Upload Tally Image (PNG/JPG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Secondary Action: Upload Excel */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Or Upload Excel
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl cursor-pointer font-semibold text-sm transition-all duration-200">
                    <Upload size={18} />
                    <span>Excel / CSV</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleExportExcel}
                  disabled={tallyItems.length === 0}
                  variant="outline"
                  className="flex items-center gap-2 rounded-xl text-slate-700 border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                >
                  <DownloadCloud size={18} />
                  <span>Export</span>
                </Button>

                <Button
                  onClick={handleSaveVerification}
                  disabled={saving || tallyItems.length === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  <span>{saving ? 'Saving...' : 'Save Log to History'}</span>
                </Button>
              </div>
            </div>

            {/* OCR Progress Loading State */}
            {ocrLoading && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                    {ocrStatusText}
                  </span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Uploaded Sheet Details & Image Thumbnail Bar */}
            {sheetMetadata.fileName && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-medium">
                <div className="flex flex-wrap items-center gap-4">
                  <span>📷 Source Image: <strong className="text-slate-800">{sheetMetadata.fileName}</strong></span>
                  <span>📍 Godown: <strong className="text-slate-800">{sheetMetadata.godown}</strong></span>
                </div>

                {uploadedImagePreview && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Uploaded Image:</span>
                    <a 
                      href={uploadedImagePreview} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Eye size={14} /> Preview Photo
                    </a>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-2xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products</p>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
                <span className="text-xs text-slate-400 font-medium">Checked</span>
              </div>
            </Card>

            <Card className="p-4 bg-emerald-50/50 border-emerald-200/80 shadow-sm rounded-2xl">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Fully Matched
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-emerald-700">{stats.matched}</h3>
                <span className="text-xs text-emerald-600 font-medium">
                  {stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0}%
                </span>
              </div>
            </Card>

            <Card className="p-4 bg-rose-50/50 border-rose-200/80 shadow-sm rounded-2xl">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={16} /> Discrepancies
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-rose-700">{stats.discrepancies}</h3>
                <span className="text-xs text-rose-600 font-medium">Qty Mismatch</span>
              </div>
            </Card>

            <Card className="p-4 bg-amber-50/50 border-amber-200/80 shadow-sm rounded-2xl">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={16} /> Missing in System
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-amber-700">{stats.missingSystem}</h3>
                <span className="text-xs text-amber-600 font-medium">In Tally only</span>
              </div>
            </Card>

            <Card className="p-4 bg-purple-50/50 border-purple-200/80 shadow-sm rounded-2xl">
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle size={16} /> Missing in Tally
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-purple-700">{stats.missingTally}</h3>
                <span className="text-xs text-purple-600 font-medium">In System only</span>
              </div>
            </Card>
          </div>

          {/* Search & Status Filter */}
          <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search product name or sheet remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Status Filter Badges */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('MATCHED')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    statusFilter === 'MATCHED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Matched ({stats.matched})
                </button>
                <button
                  onClick={() => setStatusFilter('DISCREPANCY')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    statusFilter === 'DISCREPANCY'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Discrepancy ({stats.discrepancies})
                </button>
                <button
                  onClick={() => setStatusFilter('MISSING_SYSTEM')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    statusFilter === 'MISSING_SYSTEM'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Missing System ({stats.missingSystem})
                </button>
              </div>
            </div>

            {/* Reconciliation Comparison Table / Empty State */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                    <th className="p-3.5 pl-4">Status</th>
                    <th className="p-3.5">Product Name (Tally vs System)</th>
                    <th className="p-3.5 text-center bg-slate-800/80">Tally In</th>
                    <th className="p-3.5 text-center bg-indigo-900/60">System In</th>
                    <th className="p-3.5 text-center">In Diff</th>
                    <th className="p-3.5 text-center bg-slate-800/80">Tally Out</th>
                    <th className="p-3.5 text-center bg-indigo-900/60">System Out</th>
                    <th className="p-3.5 text-center">Out Diff</th>
                    <th className="p-3.5">Remarks / Customer</th>
                    <th className="p-3.5 text-center">Breakdown (i)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredReport.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-16 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                            <ImageIcon size={32} />
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-800">No Tally Sheet Uploaded Yet</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                              Upload your Tally Godown summary sheet image using the button above to extract products and run automatic stock reconciliation.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow hover:bg-indigo-700 transition-colors">
                            <ImageIcon size={16} />
                            Upload Tally Image
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReport.map((item) => {
                      const isMatched = item.status === 'MATCHED';
                      const isDiscrepancy = item.status === 'DISCREPANCY';
                      const isMissingSys = item.status === 'MISSING_SYSTEM';
                      const isMissingTally = item.status === 'MISSING_TALLY';

                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isDiscrepancy ? 'bg-rose-50/30' : isMissingSys ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* Status Badge */}
                          <td className="p-3.5 pl-4">
                            {isMatched && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={13} /> Matched
                              </span>
                            )}
                            {isDiscrepancy && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle size={13} /> Discrepancy
                              </span>
                            )}
                            {isMissingSys && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Info size={13} /> Tally Only
                              </span>
                            )}
                            {isMissingTally && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <HelpCircle size={13} /> System Only
                              </span>
                            )}
                          </td>

                          {/* Product Names */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{item.tallyName}</div>
                            {item.systemName && item.systemName !== item.tallyName && (
                              <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                                System SKU: {item.systemName}
                              </div>
                            )}
                          </td>

                          {/* Inwards */}
                          <td className="p-3.5 text-center font-semibold text-slate-700 bg-slate-50/50">
                            {item.tallyIn} {item.unit}
                          </td>
                          <td className="p-3.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
                            {item.sysIn} {item.unit}
                          </td>
                          <td className={`p-3.5 text-center font-bold ${
                            item.inDiff === 0 ? 'text-slate-400' : item.inDiff > 0 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {item.inDiff > 0 ? `+${item.inDiff}` : item.inDiff}
                          </td>

                          {/* Outwards */}
                          <td className="p-3.5 text-center font-semibold text-slate-700 bg-slate-50/50">
                            {item.tallyOut} {item.unit}
                          </td>
                          <td className="p-3.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
                            {item.sysOut} {item.unit}
                          </td>
                          <td className={`p-3.5 text-center font-bold ${
                            item.outDiff === 0 ? 'text-slate-400' : item.outDiff > 0 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {item.outDiff > 0 ? `+${item.outDiff}` : item.outDiff}
                          </td>

                          {/* Remarks */}
                          <td className="p-3.5 text-xs text-slate-600 font-medium max-w-xs truncate">
                            {item.remarks ? (
                              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold border border-slate-200">
                                {item.remarks}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Action Info ("i") Button */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setActiveDetailItem(item)}
                              className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all font-bold text-xs flex items-center justify-center gap-1 mx-auto"
                              title="Click for full transaction breakdown"
                            >
                              <Info size={16} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        /* Verification History Logs Tab */
        <Card className="p-4 md:p-6 bg-white border-slate-200 shadow-sm rounded-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Saved Verification Logs</h2>
              <p className="text-sm text-slate-500">Historical records of Tally sheet verifications saved by date.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-4">Target Date</th>
                  <th className="p-3.5">Sheet Source / File</th>
                  <th className="p-3.5 text-center">Total Checked</th>
                  <th className="p-3.5 text-center">Matched</th>
                  <th className="p-3.5 text-center">Discrepancies</th>
                  <th className="p-3.5 text-center">Missing System</th>
                  <th className="p-3.5">Verified By & Timestamp</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {tallyVerifications.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-400 font-medium">
                      No saved verification logs yet. Use the <strong>"Save Log to History"</strong> button in the Reconciliation Tool to record verifications.
                    </td>
                  </tr>
                ) : (
                  tallyVerifications.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-slate-900">
                        {log.date}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-indigo-700">{log.fileName || 'Uploaded Sheet Image'}</div>
                        <div className="text-xs text-slate-400">{log.godown || 'Main Location'}</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-800">
                        {log.stats?.total || log.items?.length || 0}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          {log.stats?.matched || 0}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          (log.stats?.discrepancies || 0) > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {log.stats?.discrepancies || 0}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          {log.stats?.missingSystem || 0}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-slate-600">
                        <div>{log.verifiedBy}</div>
                        <div className="text-slate-400 font-medium">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setViewHistoryRecord(log)}
                            className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium text-xs flex items-center gap-1"
                            title="View log details"
                          >
                            <Eye size={16} /> View
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(log.id, log.date)}
                            className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                            title="Delete log"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transaction Breakdown Modal (Triggered by "i" info button) */}
      {activeDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Item Reconciliation Breakdown ({selectedDate})
                </span>
                <h3 className="text-2xl font-bold text-white mt-0.5">
                  {activeDetailItem.tallyName}
                </h3>
                {activeDetailItem.systemName && (
                  <p className="text-xs text-slate-300 mt-1">
                    System SKU: <span className="text-indigo-300 font-semibold">{activeDetailItem.systemName}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setActiveDetailItem(null)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">

              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                activeDetailItem.status === 'MATCHED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : activeDetailItem.status === 'DISCREPANCY'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <Info size={22} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">
                    {activeDetailItem.status === 'MATCHED' && 'Perfect Match! System records match Tally sheet exactly.'}
                    {activeDetailItem.status === 'DISCREPANCY' && 'Quantity Discrepancy Detected!'}
                    {activeDetailItem.status === 'MISSING_SYSTEM' && 'Product in Tally sheet but missing system transactions.'}
                    {activeDetailItem.status === 'MISSING_TALLY' && 'Product present in System but absent from Tally sheet.'}
                  </h4>
                  <p className="text-xs mt-1 opacity-90">
                    Tally In: <strong>{activeDetailItem.tallyIn}</strong> | System In: <strong>{activeDetailItem.sysIn}</strong> | Diff: <strong>{activeDetailItem.inDiff}</strong>
                    <br />
                    Tally Out: <strong>{activeDetailItem.tallyOut}</strong> | System Out: <strong>{activeDetailItem.sysOut}</strong> | Diff: <strong>{activeDetailItem.outDiff}</strong>
                  </p>
                </div>
              </div>

              {/* Side-by-Side Comparison Overview */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-white border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-slate-900 text-sm mb-3 border-b pb-2 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-indigo-600" /> Tally Sheet Figures
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Opening Balance:</span>
                      <strong className="text-slate-800">{activeDetailItem.opening} {activeDetailItem.unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inwards (Stock In):</span>
                      <strong className="text-slate-800">{activeDetailItem.tallyIn} {activeDetailItem.unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Outwards (Stock Out):</span>
                      <strong className="text-slate-800">{activeDetailItem.tallyOut} {activeDetailItem.unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Closing Balance:</span>
                      <strong className="text-slate-800">{activeDetailItem.tallyClosing} {activeDetailItem.unit}</strong>
                    </div>
                    {activeDetailItem.remarks && (
                      <div className="pt-2 border-t mt-2">
                        <span className="text-slate-400 block font-semibold mb-0.5">Sheet Remarks:</span>
                        <span className="text-slate-800 bg-slate-100 p-1.5 rounded block font-medium">
                          {activeDetailItem.remarks}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4 bg-white border-slate-200 rounded-2xl">
                  <h4 className="font-bold text-slate-900 text-sm mb-3 border-b pb-2 flex items-center gap-2">
                    <Layers size={16} className="text-indigo-600" /> System Aggregated Figures
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total System Inwards:</span>
                      <strong className="text-indigo-700">{activeDetailItem.sysIn} {activeDetailItem.unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total System Outwards:</span>
                      <strong className="text-indigo-700">{activeDetailItem.sysOut} {activeDetailItem.unit}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inwards Variance:</span>
                      <strong className={activeDetailItem.inDiff === 0 ? 'text-slate-500' : 'text-rose-600'}>
                        {activeDetailItem.inDiff}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Outwards Variance:</span>
                      <strong className={activeDetailItem.outDiff === 0 ? 'text-slate-500' : 'text-rose-600'}>
                        {activeDetailItem.outDiff}
                      </strong>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Itemized System Transactions List */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-sm">System Transactions on {selectedDate}</h4>
                
                {/* System Outwards Details */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ArrowUpRight size={16} className="text-rose-600" /> System Outwards Breakdown ({activeDetailItem.sysOut} {activeDetailItem.unit})
                  </h5>
                  {activeDetailItem.sysData?.b2bOut?.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500">B2B Shipments:</p>
                      {activeDetailItem.sysData.b2bOut.map((b, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-800">{b.client}</span>
                            <span className="text-slate-400 ml-2">({b.courier || 'Courier'})</span>
                          </div>
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            {b.qty} units
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No B2B shipments recorded on this date.</p>
                  )}

                  {activeDetailItem.sysData?.productionOut?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-semibold text-slate-500">Raw Materials Consumed in Manufacturing:</p>
                      {activeDetailItem.sysData.productionOut.map((po, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                          <span>Used for: <strong>{po.finishedProduct}</strong></span>
                          <span className="font-bold text-amber-800">{po.qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Inwards Details */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <ArrowDownRight size={16} className="text-emerald-600" /> System Inwards Breakdown ({activeDetailItem.sysIn} {activeDetailItem.unit})
                  </h5>
                  {activeDetailItem.sysData?.productionIn?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500">Candle Manufacturing Output:</p>
                      {activeDetailItem.sysData.productionIn.map((pi, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                          <span>Batch: <strong>{pi.batch}</strong></span>
                          <span className="font-bold text-emerald-800">{pi.qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDetailItem.sysData?.purchases?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500">Purchases Received:</p>
                      {activeDetailItem.sysData.purchases.map((pu, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                          <span>Vendor: <strong>{pu.vendor}</strong> (Inv #{pu.invoice})</span>
                          <span className="font-bold text-indigo-800">{pu.qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <Button onClick={() => setActiveDetailItem(null)} className="bg-slate-900 text-white rounded-xl">
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Verification Snapshot Modal */}
      {viewHistoryRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Verification Log Snapshot ({viewHistoryRecord.date})
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  Tally Verification Snapshot — {viewHistoryRecord.fileName}
                </h3>
              </div>
              <button
                onClick={() => setViewHistoryRecord(null)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase">Total Checked</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{viewHistoryRecord.stats?.total || viewHistoryRecord.items?.length || 0}</p>
                </div>
                <div>
                  <span className="text-emerald-600 font-bold uppercase">Matched</span>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{viewHistoryRecord.stats?.matched || 0}</p>
                </div>
                <div>
                  <span className="text-rose-600 font-bold uppercase">Discrepancies</span>
                  <p className="text-xl font-bold text-rose-700 mt-1">{viewHistoryRecord.stats?.discrepancies || 0}</p>
                </div>
                <div>
                  <span className="text-amber-600 font-bold uppercase">Tally Only</span>
                  <p className="text-xl font-bold text-amber-700 mt-1">{viewHistoryRecord.stats?.missingSystem || 0}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5 text-center">Tally In</th>
                      <th className="p-2.5 text-center">System In</th>
                      <th className="p-2.5 text-center">Tally Out</th>
                      <th className="p-2.5 text-center">System Out</th>
                      <th className="p-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(viewHistoryRecord.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            it.status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{it.tallyName}</td>
                        <td className="p-2.5 text-center">{it.tallyIn}</td>
                        <td className="p-2.5 text-center">{it.sysIn}</td>
                        <td className="p-2.5 text-center">{it.tallyOut}</td>
                        <td className="p-2.5 text-center">{it.sysOut}</td>
                        <td className="p-2.5 text-slate-500">{it.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <Button onClick={() => setViewHistoryRecord(null)} className="bg-slate-900 text-white rounded-xl">
                Close Snapshot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TallyVerification;
