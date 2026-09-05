import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import { Search, DownloadCloud, Eye, Calendar, ArrowRightLeft, X, ShoppingCart, MapPin, ClipboardList, History, Zap, Package, TrendingUp, TrendingDown, Layers, Save, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportFormattedStockCheck } from '../utils/exportUtils';
import ExpectedStockCorrectionModal from '../components/ExpectedStockCorrectionModal';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const isOptionMatch = (n1, n2) => {
  if (!n1 || !n2 || n2 === 'None') return false;
  const clean1 = n1.trim().toLowerCase().replace(/\s+/g, ' ');
  const clean2 = n2.trim().toLowerCase().replace(/\s+/g, ' ');
  if (clean1 === clean2) return true;
  if (clean1.includes('macr') && clean1.includes('rope') && clean2.includes('macr') && clean2.includes('rope')) return true;
  if (clean1.includes('cork') && clean1.includes('base') && clean2.includes('cork') && clean2.includes('base')) return true;
  if (clean1.includes('cork') && clean1.includes('lid') && clean2.includes('cork') && clean2.includes('lid')) return true;
  return false;
};

const MonthlyStockCheck = () => {
  const { 
    stock, 
    b2bShipments, 
    b2cShipments, 
    damageRecords, 
    returnRecords, 
    qcRecords,
    purchaseRecords,
    replacementRecords,
    monthlyStockData,
    saveMonthlyStock,
    productionRecords,
    reworkRecords,
    expectedStockRequests = [],
    approveExpectedStockRequest
  } = useGlobalState();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  const getWeekStr = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    // ISO Week Calculation: Thursday Rule
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const year = d.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  const getMonthStr = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const [auditMode, setAuditMode] = useState('weekly'); // 'weekly' or 'monthly'
  const [selectedWeek, setSelectedWeek] = useState(() => getWeekStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthStr(new Date()));
  const [isCarryingForward, setIsCarryingForward] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const activePeriod = auditMode === 'monthly' ? selectedMonth : selectedWeek;

  const getPeriodOfDate = (dateStr, targetPeriod = activePeriod) => {
    if (!dateStr) return '';
    const isMonthly = targetPeriod ? !targetPeriod.includes('-W') : auditMode === 'monthly';
    return isMonthly ? getMonthStr(dateStr) : getWeekStr(dateStr);
  };

  const isTarget = (dateStr, targetPeriod = activePeriod) => {
    if (!dateStr || !targetPeriod) return false;
    return getPeriodOfDate(dateStr, targetPeriod) === targetPeriod;
  };

  const getPrevPeriodStr = (targetPeriod = activePeriod) => {
    if (!targetPeriod) return '';
    if (targetPeriod.includes('-W')) {
      const [year, wNum] = targetPeriod.split('-W').map(Number);
      const d = new Date(year, 0, 1 + (wNum - 1) * 7);
      d.setDate(d.getDate() - 7);
      return getWeekStr(d);
    } else {
      const [year, mNum] = targetPeriod.split('-').map(Number);
      const d = new Date(year, mNum - 2, 1);
      return getMonthStr(d);
    }
  };

  const handleCarryPhysicalForward = async () => {
    setIsSyncing(true);
    const toastId = toast.loading(`Carrying forward Physical Stock to ${activePeriod}...`);
    try {
      const prevPeriodStr = getPrevPeriodStr(activePeriod);
      
      const prevData = monthlyStockData.filter(d => d.month === prevPeriodStr);
      if (prevData.length === 0) {
        toast.error(`No data found for previous period (${prevPeriodStr})`, { id: toastId });
        return;
      }

      const prevMovements = getMovements(prevPeriodStr);

      for (const item of stock) {
        if (item.isComposite) continue;
        const pData = prevData.find(d => d.productId === item.id);
        if (pData) {
          const m = prevMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0 };
          const expected = calculateExpected(pData.opening, pData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used);
          
          const valueToCarry = (pData.physical !== undefined && pData.physical !== '') ? Number(pData.physical) : expected;
          
          await saveMonthlyStock(activePeriod, item.id, { opening: valueToCarry });
          await saveMonthlyStock(prevPeriodStr, item.id, { expected });
        }
      }
      toast.success(`Success! Carried forward balances from ${prevPeriodStr}`, { id: toastId });
    } catch (error) {
      toast.error("Process failed: " + error.message, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const getMovements = (periodStr) => {
    const sums = {};
    const compareNames = (n1, n2) => {
      if (!n1 || !n2) return false;
      const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return clean(n1) === clean(n2);
    };

    stock.forEach(item => { 
      sums[item.id] = { out: 0, b2cOut: 0, b2bOut: 0, packed: 0, stockDeduction: 0, returned: 0, damage: 0, purchased: 0, rejected: 0, replacement: 0, produced: 0, used: 0, qcAccepted: 0, purchasedNoQC: 0 }; 
    });
    
    const prevPeriodStr = getPrevPeriodStr(periodStr);

    b2bShipments.forEach(s => { 
      if (!s.products || s.deducted === false || s.deducted === 'false') return;
      s.products.forEach(p => { 
        const pName = p.name || p.productName;
        const packedDate = p.packedDate || s.packedDate || s.date;
        const dispatchDate = s.dispatchDate || (s.status === 'Dispatched' ? s.date : null);
        const noPacking = s.isPacked === false;

        const packedThisWeek = !noPacking && isTarget(packedDate, periodStr);
        const dispatchedThisWeek = isTarget(dispatchDate, periodStr);
        const packedPrevWeek = !noPacking && packedDate && !isTarget(packedDate, periodStr) && getPeriodOfDate(packedDate, periodStr) < periodStr;

        const dispatchedPrevWeek = dispatchDate && !isTarget(dispatchDate, periodStr) && getPeriodOfDate(dispatchDate, periodStr) < periodStr;
        const qty = (Number(p.quantity) || 0);
        const master = stock.find(item => compareNames(item.name, pName));

        const applyB2B = (id, amount) => {
          if (!sums[id]) return;
          const t = sums[id];
          
          // 1. UI Columns: Show what physically happened this period
          if (dispatchedThisWeek) {
            if (packedPrevWeek) {
              t.dispatched = (t.dispatched || 0) + amount; // Last period packed, this period dispatched
            } else {
              t.b2bOut += amount; // Packed and dispatched this period
            }
          }
          // Only show as packed if it has been packed in the current period or previous period, and hasn't been dispatched yet
          const packedBeforeOrThisWeek = !noPacking && packedDate && (getPeriodOfDate(packedDate, periodStr) === periodStr || getPeriodOfDate(packedDate, periodStr) === prevPeriodStr);
          if (packedBeforeOrThisWeek && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek) {
            t.packed += amount;
          }

          // 2. Math: Deduct exactly once
          if (dispatchedThisWeek && (noPacking || packedThisWeek)) {
            t.stockDeduction += amount;
          } else if (packedThisWeek && !dispatchedThisWeek && !dispatchedPrevWeek) {
            t.stockDeduction += amount;
          }
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
            if (compMaster) { applyB2B(compMaster.id, qty * (Number(comp.quantity) || 1)); }
          });
        }
        if (master) { applyB2B(master.id, qty); }
        if (p.stockOption && p.stockOption !== 'None') {
          const optMaster = stock.find(m => compareNames(m.name, p.stockOption) || isOptionMatch(m.name, p.stockOption));
          if (optMaster) { applyB2B(optMaster.id, qty); }
        }
      }); 
    });

    b2cShipments.forEach(s => {
      // FBA shipments: use dispatchDate for dispatched, packedDate for packed
      // Non-FBA: use date as before
      const isFBA = s.isFBA;
      
      if (isFBA) {
        const packedDate = s.packedDate || s.date;
        const packedThisWeek = packedDate && isTarget(packedDate, periodStr);
        const packedPrevWeek = packedDate && !isTarget(packedDate, periodStr) && getPeriodOfDate(packedDate, periodStr) < periodStr;
        const dispatchedThisWeek = s.status === 'Dispatched' && isTarget(s.dispatchDate, periodStr);
        const dispatchedPrevWeek = s.status === 'Dispatched' && s.dispatchDate && !isTarget(s.dispatchDate, periodStr) && getPeriodOfDate(s.dispatchDate, periodStr) < periodStr;

        s.products.forEach(p => { 
          const pName = p.name || p.productName;
          const master = stock.find(item => compareNames(item.name, pName));
          const qty = Number(p.quantity) || 0;

          const applyB2C = (id, amount) => {
            if (!sums[id]) return;
            
            if (dispatchedThisWeek) {
              sums[id].b2cOut += amount;
              if (!packedPrevWeek) {
                sums[id].stockDeduction += amount;
              }
            }
            
            const packedBeforeOrThisWeek = packedDate && (getPeriodOfDate(packedDate, periodStr) === periodStr || getPeriodOfDate(packedDate, periodStr) === prevPeriodStr);
            if (packedBeforeOrThisWeek && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek) {
              sums[id].packed = (sums[id].packed || 0) + amount;
              if (packedThisWeek) {
                sums[id].stockDeduction += amount;
              }
            }
          };
          
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
              if (compMaster) { applyB2C(compMaster.id, (Number(p.quantity) || 0) * (Number(comp.quantity) || 1)); }
            });
          }
          if (master) { applyB2C(master.id, qty); }
          if (p.stockOption && p.stockOption !== 'None') {
            const optMaster = stock.find(m => compareNames(m.name, p.stockOption));
            if (optMaster) { applyB2C(optMaster.id, qty); }
          }
        });
      } else {
        // Normal B2C: count as Out on shipment date
        const shouldCountAsOut = isTarget(s.date, periodStr);
        if (shouldCountAsOut) {
          s.products.forEach(p => { 
            const pName = p.name || p.productName;
            const master = stock.find(item => compareNames(item.name, pName));
            
            const qty = Number(p.quantity) || 0;

            const applyB2C = (id, amount) => {
              if (!sums[id]) return;
              sums[id].b2cOut += amount;
              sums[id].stockDeduction += amount;
            };

            if (master?.isComposite && master.components) {
              master.components.forEach(comp => {
                const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
                if (compMaster) { applyB2C(compMaster.id, (Number(p.quantity) || 0) * (Number(comp.quantity) || 1)); }
              });
            }
            if (master) { applyB2C(master.id, qty); }
            if (p.stockOption && p.stockOption !== 'None') {
              const optMaster = stock.find(m => compareNames(m.name, p.stockOption));
              if (optMaster) { applyB2C(optMaster.id, qty); }
            }
          }); 
        }
      }
    });

    damageRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].damage += Number(r.quantity) || 0; }
    });
    const qcStatsByProductAndVendor = {};

    qcRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { 
        const checkedVal = Number(r.checked) || 0;
        const acceptedVal = checkedVal - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        if (!qcStatsByProductAndVendor[master.id]) {
          qcStatsByProductAndVendor[master.id] = {};
        }
        if (!qcStatsByProductAndVendor[master.id][vendorKey]) {
          qcStatsByProductAndVendor[master.id][vendorKey] = { displayName: vendorName.trim(), checked: 0, accepted: 0 };
        }
        qcStatsByProductAndVendor[master.id][vendorKey].checked += checkedVal;
        qcStatsByProductAndVendor[master.id][vendorKey].accepted += Math.max(0, acceptedVal);
        sums[master.id].rejected += Number(r.rejected) || 0; 
      } 
    });
    returnRecords.filter(r => isTarget(r.date, periodStr) && r.isReusable && r.deducted !== false).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].returned += Number(r.quantity) || 0; }
    });
    const purchasesByProductAndVendor = {};
    purchaseRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { 
        sums[master.id].purchased += Number(r.quantity) || 0; 
        if (!purchasesByProductAndVendor[master.id]) {
          purchasesByProductAndVendor[master.id] = {};
        }
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        if (!purchasesByProductAndVendor[master.id][vendorKey]) {
          purchasesByProductAndVendor[master.id][vendorKey] = { displayName: vendorName.trim(), quantity: 0 };
        }
        purchasesByProductAndVendor[master.id][vendorKey].quantity += Number(r.quantity) || 0;
      } 
    });
    replacementRecords.filter(r => isTarget(r.date, periodStr) && r.deducted).forEach(r => { 
      const prods = r.products || [{ name: r.productName, quantity: r.quantity }]; 
      prods.forEach(p => { 
        const master = stock.find(s => compareNames(s.name, p.name));
        if (master && sums[master.id]) { sums[master.id].replacement += Number(p.quantity) || 0; }
      }); 
    });
    (productionRecords || []).filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].produced += Number(r.quantity) || 0; }
      (r.rawMaterials || []).forEach(rm => { 
        const rmMaster = stock.find(s => compareNames(s.name, rm.name));
        if (rmMaster && sums[rmMaster.id]) { sums[rmMaster.id].used += Number(rm.quantity) || 0; }
      }); 
    });

    (reworkRecords || []).forEach(r => {
      // 1. Rework Outward: subtract from stock
      if (isTarget(r.outDate, periodStr)) {
        const products = r.products && r.products.length > 0 
          ? r.products 
          : [{ productName: r.productName, quantity: r.quantity }];
        
        products.forEach(p => {
          const master = stock.find(s => compareNames(s.name, p.productName));
          if (master && sums[master.id]) {
            sums[master.id].stockDeduction += Number(p.quantity) || 0;
            sums[master.id].reworkOut = (sums[master.id].reworkOut || 0) + (Number(p.quantity) || 0);
          }
        });
      }

      // 2. Rework Inward: add to stock
      if (r.status === 'Reworked' && isTarget(r.returnDate, periodStr)) {
        const returnProducts = r.returnProducts && r.returnProducts.length > 0
          ? r.returnProducts
          : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        
        returnProducts.forEach(rp => {
          const master = stock.find(s => compareNames(s.name, rp.returnProductName));
          if (master && sums[master.id]) {
            sums[master.id].returned += Number(rp.returnQuantity) || 0;
          }
        });
      }
    });

    // Final UI cleanup: Out = B2C + B2B Dispatched + Rework Out
    Object.keys(sums).forEach(id => {
      sums[id].out = sums[id].b2cOut + sums[id].b2bOut + (sums[id].reworkOut || 0);
      
      let totalQCAccepted = 0;
      let effectiveQCAndPurchase = 0;
      const productQCs = qcStatsByProductAndVendor[id] || {};
      const productPurchases = purchasesByProductAndVendor[id] || {};
      const allVendors = new Set([
        ...Object.keys(productQCs),
        ...Object.keys(productPurchases)
      ]);
      allVendors.forEach(vendorKey => {
        const A = productQCs[vendorKey]?.accepted || 0;
        const C = productQCs[vendorKey]?.checked || 0;
        const P = productPurchases[vendorKey]?.quantity || 0;
        totalQCAccepted += A;
        effectiveQCAndPurchase += A + Math.max(0, P - C);
      });
      sums[id].qcAccepted = totalQCAccepted;
      sums[id].qcAcceptedOrPurchase = effectiveQCAndPurchase;
    });

    return sums;
  };

  const getProductMovements = (product, period) => {
    const results = { in: [], b2bOut: [], b2cOut: [], packed: [], sent: [], onHold: [], adjustments: [] };
    if (!product) return results;

    const compareNames = (n1, n2) => {
      if (!n1 || !n2) return false;
      const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return clean(n1) === clean(n2);
    };

    const targetPeriod = period || activePeriod;
    const prevPeriodStr = getPrevPeriodStr(targetPeriod);

    // B2B Shipments
    b2bShipments.forEach(s => {
      if (!s.products || !Array.isArray(s.products) || s.deducted === false || s.deducted === 'false') return;

      const dDate = s.dispatchDate || (s.status === 'Dispatched' ? s.date : null);
      const noPacking = s.isPacked === false;

      s.products.forEach(p => {
        const pDate = p.packedDate || s.packedDate || s.date;
        const dispatchedThisWeek = isTarget(dDate, period);
        const packedThisWeek = !noPacking && isTarget(pDate, period);
        const packedPrevWeek = !noPacking && pDate && !isTarget(pDate, period) && getPeriodOfDate(pDate, targetPeriod) < targetPeriod;
        let matchQty = 0;
        const pName = p.name || p.productName;
        
        if (compareNames(product.name, pName)) {
          matchQty = Number(p.quantity) || 0;
        } else if (p.stockOption && p.stockOption !== 'None' && (compareNames(product.name, p.stockOption) || isOptionMatch(product.name, p.stockOption))) {
          matchQty = Number(p.quantity) || 0;
        } else {
          const parentProduct = stock.find(st => compareNames(st.name, pName) && st.isComposite);
          if (parentProduct) {
            const component = (parentProduct.components || []).find(c => {
              return compareNames(c.name, product.name) || c.productId === product.id;
            });
            if (component) matchQty = (Number(p.quantity) || 0) * (Number(component.quantity) || 1);
          }
        }

        if (matchQty > 0) {
          const viaText = `VIA: ${pName} (QTY: ${p.quantity || 0})`.toUpperCase();
          const item = { 
            id: `${s.id}-${pName}`, 
            label: s.clientName || s.customerName || 'B2B Order', 
            impact: matchQty, 
            sublabel: `${s.date}${pName !== product.name ? ` (via ${pName})` : ''}`,
            detail: viaText
          };
          
          const packedBeforeOrThisWeek = !noPacking && pDate && (getPeriodOfDate(pDate, targetPeriod) === targetPeriod || getPeriodOfDate(pDate, targetPeriod) === prevPeriodStr);
          const dispatchedPrevWeek = dDate && !isTarget(dDate, period) && getPeriodOfDate(dDate, targetPeriod) < targetPeriod;

          if (dispatchedThisWeek) {
            if (noPacking || packedThisWeek) results.b2bOut.push(item);
            else results.sent.push(item);
          } else if (packedBeforeOrThisWeek && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek) {
             results.packed.push(item);
          }
        }
      });
    });

    // B2C Shipments
    b2cShipments.forEach(s => {
      const isFBA = s.isFBA;
      let isOutThisPeriod = false;
      let isPackedThisPeriod = false;
      let isPackedBeforeOrThisPeriod = false;

      if (isFBA) {
        const packedDate = s.packedDate || s.date;
        const dispatchedThisWeek = s.status === 'Dispatched' && isTarget(s.dispatchDate, period);
        const dispatchedPrevWeek = s.status === 'Dispatched' && s.dispatchDate && !isTarget(s.dispatchDate, period) && getPeriodOfDate(s.dispatchDate, targetPeriod) < targetPeriod;
        
        isOutThisPeriod = dispatchedThisWeek;
        isPackedThisPeriod = packedDate && isTarget(packedDate, period);
        isPackedBeforeOrThisPeriod = packedDate && (getPeriodOfDate(packedDate, targetPeriod) === targetPeriod || getPeriodOfDate(packedDate, targetPeriod) === prevPeriodStr) && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek;
      } else {
        isOutThisPeriod = isTarget(s.date, period);
      }

      if (!isOutThisPeriod && !isPackedThisPeriod && !isPackedBeforeOrThisPeriod) return;

      s.products.forEach(p => {
        const master = stock.find(item => compareNames(item.name, p.name));
        
        const qty = Number(p.quantity) || 0;
        
        let impact = 0;
        if (compareNames(p.name, product.name)) impact = qty;
        else if (p.stockOption && p.stockOption !== 'None' && (compareNames(product.name, p.stockOption) || isOptionMatch(product.name, p.stockOption))) impact = qty;
        else if (master?.isComposite) {
          const comp = master.components?.find(c => compareNames(c.name, product.name));
          if (comp) {
            impact = (Number(p.quantity) || 0) * (Number(comp.quantity) || 1);
          }
        }

        if (impact > 0) {
          const viaText = `VIA: ${p.name} (QTY: ${p.quantity || 0})`.toUpperCase();
          if (isOutThisPeriod) {
            results.b2cOut.push({
              id: `${s.id}-${p.name}`,
              label: `${s.channel || 'Amazon FBA'} (Dispatched)`,
              sublabel: s.dispatchDate || s.date,
              detail: viaText,
              impact
            });
          } else if (isPackedBeforeOrThisPeriod) {
            results.packed.push({
              id: `${s.id}-${p.name}`,
              label: `${s.channel || 'Amazon FBA'} (Packed)`,
              sublabel: s.packedDate || s.date,
              detail: viaText,
              impact
            });
          }
        }
      });
    });

    // Group purchases and QC by vendor to match the mathematical logic
    const vendorMap = {};

    purchaseRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      const vendorName = r.vendorName || 'Unknown';
      const key = vendorName.trim().toLowerCase();
      if (!vendorMap[key]) {
        vendorMap[key] = { vendorName, purchases: [], qcs: [] };
      }
      vendorMap[key].purchases.push(r);
    });

    qcRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      const vendorName = r.vendorName || 'Unknown';
      const key = vendorName.trim().toLowerCase();
      if (!vendorMap[key]) {
        vendorMap[key] = { vendorName, purchases: [], qcs: [] };
      }
      vendorMap[key].qcs.push(r);
    });

    // Add production and return records normally
    productionRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      results.in.push({ id: r.id, label: `Mfg: ${r.location}`, impact: Number(r.quantity) || 0, color: 'indigo' });
    });

    returnRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name) && r.isReusable && r.deducted !== false).forEach(r => {
      results.in.push({ id: r.id, label: `Return: ${r.channel}`, impact: Number(r.quantity) || 0, color: 'blue' });
    });

    // Now process the vendors and calculate QC Accepted + Unchecked Purchase balance
    Object.values(vendorMap).forEach(v => {
      const totalPurchased = v.purchases.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      const totalChecked = v.qcs.reduce((sum, r) => sum + (Number(r.checked) || 0), 0);
      
      // Add each QC record's accepted quantity
      v.qcs.forEach(r => {
        const accepted = Number(r.checked) - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
        if (accepted > 0) {
          results.in.push({
            id: r.id,
            label: `QC Accepted: ${v.vendorName}`,
            impact: accepted,
            color: 'emerald'
          });
        }
      });

      // Add the remaining unchecked purchase balance if any
      const unchecked = Math.max(0, totalPurchased - totalChecked);
      if (unchecked > 0) {
        const label = totalChecked > 0 ? `Unchecked Purchase: ${v.vendorName}` : `Purchase: ${v.vendorName}`;
        const repId = v.purchases[0]?.id || `unchecked-${v.vendorName}`;
        results.in.push({
          id: repId,
          label: label,
          impact: unchecked,
          color: 'emerald'
        });
      }
    });

    damageRecords.filter(r => isTarget(r.date, period) && compareNames(r.productName, product.name)).forEach(r => {
      results.adjustments.push({ id: r.id, label: 'Damage/Loss', impact: r.quantity, color: 'red' });
    });

    (reworkRecords || []).forEach(r => {
      // 1. Rework Outward
      if (isTarget(r.outDate, period)) {
        const products = r.products && r.products.length > 0 
          ? r.products 
          : [{ productName: r.productName, quantity: r.quantity }];
        
        products.forEach(p => {
          if (compareNames(p.productName, product.name)) {
            results.adjustments.push({
              id: `${r.id}-out`,
              label: `Rework Outward (Sent to ${r.destination || 'External'})`,
              impact: Number(p.quantity) || 0,
              color: 'indigo'
            });
          }
        });
      }

      // 2. Rework Inward Return
      if (r.status === 'Reworked' && isTarget(r.returnDate, period)) {
        const returnProducts = r.returnProducts && r.returnProducts.length > 0
          ? r.returnProducts
          : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        
        returnProducts.forEach(rp => {
          if (compareNames(rp.returnProductName, product.name)) {
            results.in.push({
              id: `${r.id}-in`,
              label: `Rework Return (${r.returnNotes || 'Rework Completed'})`,
              impact: Number(rp.returnQuantity) || 0,
              color: 'indigo'
            });
          }
        });
      }
    });

    return results;
  };

  const monthlyMovements = useMemo(() => getMovements(activePeriod), [activePeriod, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, stock, reworkRecords]);

  const productMovements = useMemo(() => getProductMovements(selectedProductDetails, activePeriod), [selectedProductDetails, activePeriod, b2bShipments, b2cShipments, purchaseRecords, productionRecords, returnRecords, damageRecords, qcRecords, stock, reworkRecords]);

  const calculateExpected = (opening, otherIn, purchased, produced, returned, stockDeduction, replacement, damage, rejected, used, qcAcceptedOrPurchase = 0) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(produced || 0) + Number(returned || 0) + Number(qcAcceptedOrPurchase || 0) - Number(stockDeduction || 0) - Number(replacement || 0) - Number(damage || 0) - Number(used || 0);

  // Automatically derive Opening Stock from previous week's Expected Stock if not manually entered
  const getEffectiveOpeningStock = (periodStr, itemId, itemRef) => {
    const doc = monthlyStockData.find(d => d.month === periodStr && d.productId === itemId);
    if (doc?.opening !== undefined && doc?.opening !== '') {
      return Number(doc.opening);
    }

    const prevPeriodStr = getPrevPeriodStr(periodStr);
    const prevDoc = monthlyStockData.find(d => d.month === prevPeriodStr && d.productId === itemId);

    const prevApprovedReq = expectedStockRequests.find(r => r.status === 'approved' && r.period === prevPeriodStr && r.items?.some(i => i.productId === itemId));
    const prevApprovedItem = prevApprovedReq?.items?.find(i => i.productId === itemId);
    if (prevApprovedItem && prevApprovedItem.proposedExpected !== undefined && prevApprovedItem.proposedExpected !== '') {
      return Number(prevApprovedItem.proposedExpected);
    }

    if (prevDoc?.expected !== undefined && prevDoc?.expected !== '') {
      return Number(prevDoc.expected);
    }

    const prevM = getMovements(prevPeriodStr)[itemId] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
    const prevOpening = prevDoc?.opening !== undefined && prevDoc.opening !== '' ? Number(prevDoc.opening) : (Number(itemRef?.openingStock) || 0);

    return calculateExpected(
      prevOpening,
      prevDoc?.in || 0,
      prevM.purchased,
      prevM.produced,
      prevM.returned,
      prevM.stockDeduction,
      prevM.replacement,
      prevM.damage,
      prevM.rejected,
      prevM.used,
      prevM.qcAcceptedOrPurchase
    );
  };

  const handleResetExpectedStock = async () => {
    const confirm = await Swal.fire({
      title: 'Reset & Recalculate Expected Stock?',
      text: `This will recalculate expected stock for ALL products in ${activePeriod} based strictly on Opening Stock and all recorded movements (Stock In, Purchases/QC, Produced, Returns, Dispatches, Damage, Rework).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Recalculate & Reset',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    const toastId = toast.loading('Recalculating expected stock for all products...');
    try {
      for (const item of stock) {
        if (item.isComposite) continue;
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const opening = getEffectiveOpeningStock(activePeriod, item.id, item);
        const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
        const calculatedExpected = calculateExpected(
          opening,
          mData.in || 0,
          m.purchased,
          m.produced,
          m.returned,
          m.stockDeduction,
          m.replacement,
          m.damage,
          m.rejected,
          m.used,
          m.qcAcceptedOrPurchase
        );
        await saveMonthlyStock(activePeriod, item.id, { expected: calculatedExpected, isCorrected: false });
      }
      toast.success(`Expected stock reset & recalculated based on all calculations!`, { id: toastId });
    } catch (err) {
      console.error("Reset expected stock error:", err);
      toast.error('Failed to reset expected stock: ' + err.message, { id: toastId });
    }
  };

  const getItemExpectedStock = (item, periodStr = activePeriod) => {
    const approvedReq = expectedStockRequests.find(r => r.status === 'approved' && r.period === periodStr && r.items?.some(i => i.productId === item.id));
    const approvedItem = approvedReq?.items?.find(i => i.productId === item.id);
    if (approvedItem && approvedItem.proposedExpected !== undefined && approvedItem.proposedExpected !== '') {
      return Number(approvedItem.proposedExpected);
    }

    const mData = monthlyStockData.find(d => d.month === periodStr && d.productId === item.id) || {};
    if (mData.isCorrected && mData.expected !== undefined && mData.expected !== '') {
      return Number(mData.expected);
    }

    const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
    const opening = getEffectiveOpeningStock(periodStr, item.id, item);
    return calculateExpected(opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used, m.qcAcceptedOrPurchase);
  };

  useEffect(() => {
    if (!monthlyMovements || stock.length === 0) return;
    const sync = async () => {
      stock.forEach(item => {
        if (item.isComposite) return;
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const hasApprovedReq = expectedStockRequests.some(r => r.status === 'approved' && r.period === activePeriod && r.items?.some(i => i.productId === item.id));
        if (hasApprovedReq || mData.isCorrected) return;

        const opening = getEffectiveOpeningStock(activePeriod, item.id, item);
        const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
        const expected = calculateExpected(opening, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used, m.qcAcceptedOrPurchase);
        if (mData.expected !== expected) {
          saveMonthlyStock(activePeriod, item.id, { expected, isCorrected: false });
        }
      });
    };
    sync();
  }, [monthlyMovements, activePeriod, monthlyStockData, stock, expectedStockRequests]);

  // Handle direct approval link from email (?approveRequestId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqId = params.get('approveRequestId');
    if (!reqId || !expectedStockRequests || expectedStockRequests.length === 0) return;

    const targetReq = expectedStockRequests.find(r => r.id === reqId);
    if (!targetReq) return;

    if (targetReq.status === 'approved') {
      toast.success('This stock correction request has already been approved and applied!');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (targetReq.status === 'pending') {
      Swal.fire({
        title: 'Approve Stock Correction Request?',
        html: `
          <div style="text-align: left; font-size: 13px; color: #334155;">
            <p style="margin-bottom: 8px;"><b>Period:</b> ${targetReq.period}</p>
            <p style="margin-bottom: 8px;"><b>Requested By:</b> ${targetReq.requestedBy || 'Staff'}</p>
            <p style="margin-bottom: 12px;"><b>Reason:</b> ${targetReq.reason || 'Correction'}</p>
            <p style="font-weight: bold; color: #4f46e5; margin-bottom: 6px;">Products to be corrected (${targetReq.items?.length || 0}):</p>
            <ul style="max-height: 150px; overflow-y: auto; background: #f8fafc; padding: 10px 15px; border-radius: 8px; font-size: 12px; margin: 0;">
              ${(targetReq.items || []).map(i => `<li><b>${i.productName}</b>: ${i.currentExpected} &rarr; <b style="color: #059669;">${i.proposedExpected}</b></li>`).join('')}
            </ul>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Approve & Apply Stock',
        cancelButtonText: 'Review Later'
      }).then((result) => {
        if (result.isConfirmed) {
          approveExpectedStockRequest(reqId).then(() => {
            toast.success('Expected stock corrections approved & applied to stock!');
            window.history.replaceState({}, '', window.location.pathname);
          }).catch(err => {
            toast.error('Approval failed: ' + err.message);
          });
        } else {
          setIsCorrectionModalOpen(true);
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    }
  }, [expectedStockRequests, approveExpectedStockRequest]);

  const handleCarryForward = async () => {
    setIsCarryingForward(true);
    try {
      const prevPeriodStr = getPrevPeriodStr(activePeriod);

      const prevData = monthlyStockData.filter(d => d.month === prevPeriodStr);
      if (prevData.length === 0) { toast.error(`No data found for previous period (${prevPeriodStr})`); return; }
      
      const prevMovements = getMovements(prevPeriodStr);
      for (const item of prevData) {
        const product = stock.find(s => s.id === item.productId);
        if (!product) continue;
        const m = prevMovements[product.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, purchased: 0, produced: 0, rejected: 0, replacement: 0, used: 0, qcAcceptedOrPurchase: 0 };
        const expected = calculateExpected(item.opening, item.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used, m.qcAcceptedOrPurchase);
        await saveMonthlyStock(activePeriod, item.productId, { opening: expected });
        await saveMonthlyStock(prevPeriodStr, item.productId, { expected });
      }
      toast.success('Balances carried forward successfully!');
    } finally { setIsCarryingForward(false); }
  };

  const filteredStock = useMemo(() => {
    return stock
      .filter(item => !item.isComposite && (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))))
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [stock, searchTerm, sortOrder]);

  const analyticsData = useMemo(() => {
    let perfectMatch = [];
    let highDifference = [];
    let notAudited = [];
    
    filteredStock.forEach(item => {
      const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
      const expected = getItemExpectedStock(item);
      
      const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
      
      if (physical === null) {
        notAudited.push(item);
      } else {
        const diff = Math.abs(physical - expected);
        if (diff === 0) {
          perfectMatch.push(item);
        } else {
          highDifference.push({ item, diff: physical - expected, absDiff: diff });
        }
      }
    });

    highDifference.sort((a, b) => b.absDiff - a.absDiff);

    return { perfectMatch, highDifference: highDifference.slice(0, 10), notAudited };
  }, [filteredStock, monthlyStockData, activePeriod, monthlyMovements, expectedStockRequests]);

  const allStockItemsWithExpected = useMemo(() => {
    return stock.filter(item => !item.isComposite).map(item => ({
      ...item,
      expectedStock: getItemExpectedStock(item)
    }));
  }, [stock, monthlyStockData, activePeriod, monthlyMovements, expectedStockRequests]);

  const stockItemsWithExpected = useMemo(() => {
    return filteredStock.map(item => {
      const expectedStock = getItemExpectedStock(item);
      return {
        ...item,
        expectedStock
      };
    });
  }, [filteredStock, monthlyStockData, activePeriod, monthlyMovements, expectedStockRequests]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = stock.filter(item => !item.isComposite).map(item => {
        const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
        const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, dispatched: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
        const expected = getItemExpectedStock(item);
        
        const physical = mData.physical !== undefined && mData.physical !== '' ? Number(mData.physical) : null;
        const diff = physical !== null ? physical - expected : -expected;

        return { 
          SKU: item.sku, 
          Name: item.name, 
          Period: activePeriod, 
          Opening: mData.opening || 0, 
          'Stock In': (Number(mData.in) || 0) + m.produced + (m.qcAcceptedOrPurchase || 0), 
          Returns: m.returned, 
          Dispatch: m.out, 
          Packed: m.packed || 0, 
          Dispatched: m.dispatched || 0,
          Replacement: m.replacement, 
          Damage: m.damage, 
          Rejected: m.rejected, 
          Used: m.used || 0,
          Expected: expected, 
          Physical: physical !== null ? physical : 'Pending', 
          Difference: physical !== null ? diff : 'N/A'
        };
      });
      exportFormattedStockCheck(dataToExport, activePeriod, `Stock_Check_${activePeriod}.xlsx`, analyticsData);
      exportFormattedStockCheck(dataToExport, activePeriod, `Stock_Check_${activePeriod}.xlsx`);
    } finally { setIsExporting(false); }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header Controls */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Calendar size={20} className="md:w-6 md:h-6"/></div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 leading-tight">
                {auditMode === 'monthly' ? 'Monthly Stock Report' : 'Weekly Stock Report'}
              </h2>
              <p className="text-[10px] md:text-xs text-slate-500 font-medium">Expected stock & movements overview</p>
            </div>
          </div>

          {/* Mode Switcher: Weekly / Monthly */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setAuditMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                auditMode === 'weekly' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setAuditMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                auditMode === 'monthly' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Period Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10 shrink-0">
            <Calendar size={14} className="text-slate-400" />
            {auditMode === 'weekly' ? (
              <input 
                type="week" 
                className="text-xs font-bold text-slate-700 outline-none w-32 bg-transparent" 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(e.target.value)} 
              />
            ) : (
              <input 
                type="month" 
                className="text-xs font-bold text-slate-700 outline-none w-32 bg-transparent" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
              />
            )}
          </div>

          {/* Search SKU & Sort */}
          <div className="relative min-w-[140px] max-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search SKU..." 
              className="pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs outline-none w-full focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1.5 shrink-0"
            title={sortOrder === 'asc' ? 'Sort Z-A' : 'Sort A-Z'}
          >
            <ArrowRightLeft size={14} className={sortOrder === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            <span className="text-[10px] font-bold uppercase">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
          </button>

          {/* Action Buttons */}
          <Button onClick={() => setIsCorrectionModalOpen(true)} className="whitespace-nowrap text-xs h-10 px-3 rounded-xl shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-sm">
            <AlertTriangle size={14} className="text-amber-300" /> <span>Correct Expected Stock</span>
            {expectedStockRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-amber-400 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-0.5">
                {expectedStockRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </Button>

          <Button onClick={handleResetExpectedStock} variant="secondary" className="whitespace-nowrap text-xs h-10 px-3 rounded-xl shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1.5 shadow-sm" title="Recalculate and reset expected stock for all products based on all movements">
            <RefreshCw size={14} className="text-amber-600" /> <span>Reset Expected Stock</span>
          </Button>

          <Button onClick={handleCarryForward} variant="secondary" loading={isCarryingForward} className="whitespace-nowrap text-xs h-10 px-3 rounded-xl shrink-0" title="Carry forward expected stock to next period">
            <ArrowRightLeft size={14} className="mr-1.5" /> <span>Carry Expected</span>
          </Button>

          <Button onClick={handleCarryPhysicalForward} variant="secondary" loading={isSyncing} className="whitespace-nowrap text-xs h-10 px-3 rounded-xl shrink-0" title="Carry forward physical stock count to next period">
            <ArrowRightLeft size={14} className="mr-1.5 text-purple-600" /> <span>Carry Physical</span>
          </Button>

          <Button onClick={handleExport} variant="success" loading={isExporting} className="whitespace-nowrap text-xs h-10 px-3 rounded-xl shrink-0">
            <DownloadCloud size={14} className="mr-1.5" /> <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh] scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="py-4 px-4 min-w-[180px] bg-slate-50 sticky left-0 z-30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">SKU Name</th>
                <th className="py-4 px-2 text-center bg-slate-50">Opening</th>
                <th className="py-4 px-2 text-center text-indigo-600 bg-slate-50">Stock In</th>
                <th className="py-4 px-2 text-center text-emerald-600 bg-slate-50">Returns</th>
                <th className="py-4 px-2 text-center text-amber-600 bg-slate-50">Out</th>
                <th className="py-4 px-2 text-center text-orange-500 bg-slate-50">Packed</th>
                <th className="py-4 px-2 text-center text-blue-500 bg-slate-50">Dispatched</th>
                <th className="py-4 px-2 text-center text-orange-500 bg-slate-50">Repl</th>
                <th className="py-4 px-2 text-center text-red-600 bg-slate-50">Damage</th>
                <th className="py-4 px-2 text-center text-rose-500 bg-slate-50">Rejected</th>
                <th className="py-4 px-2 text-center text-rose-600 bg-slate-50">Used</th>
                <th className="py-4 px-3 text-center bg-indigo-50/80 font-bold text-indigo-900 border-l border-slate-200">Expected Stock</th>
                <th className="py-4 px-3 text-center bg-purple-50/80 font-bold text-purple-900 border-l border-slate-200">Physical Stock</th>
                <th className="py-4 px-3 text-center bg-slate-100 font-bold text-slate-700 border-l border-slate-200">Diff</th>
                <th className="py-4 px-4 text-center bg-slate-50 sticky right-0 z-20 border-l border-slate-200">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.map((item) => {
                const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
                const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
                const opening = getEffectiveOpeningStock(activePeriod, item.id, item);
                const expected = getItemExpectedStock(item);
                
                const hasPhysical = mData.physical !== undefined && mData.physical !== '';
                const physicalVal = hasPhysical ? mData.physical : '';
                const physicalNum = hasPhysical ? Number(mData.physical) : null;
                const diff = physicalNum !== null ? physicalNum - expected : null;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-4 text-sm border-r border-slate-100 font-semibold text-slate-900 bg-white sticky left-0 z-10 group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div className="flex flex-col"><span className="text-[9px] text-indigo-500 font-mono font-bold uppercase tracking-tighter">{item.sku || '-'}</span><span>{item.name}</span></div>
                    </td>
                    <td className="py-3 px-1 text-center">
                      <input 
                        type="number" 
                        className="w-14 mx-auto block px-1 py-1 text-center text-xs border border-slate-200 rounded outline-none font-semibold text-slate-800" 
                        value={mData.opening !== undefined && mData.opening !== '' ? mData.opening : opening} 
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
                          const exp = calculateExpected(val === '' ? opening : val, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used, m.qcAcceptedOrPurchase);
                          saveMonthlyStock(activePeriod, item.id, { opening: val, expected: exp });
                        }} 
                      />
                    </td>
                    <td className="py-4 px-2 text-center text-indigo-600 text-xs font-bold"><span>{(Number(mData.in) || 0) + m.produced + (m.qcAcceptedOrPurchase || 0)}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-emerald-600 font-bold"><span>{m.returned || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-amber-600 font-bold"><span>{m.out || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold"><span>{m.packed || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-blue-500 font-bold cursor-pointer hover:bg-blue-50" onClick={() => setSelectedProductDetails(item)}><span>{m.dispatched || 0}</span> <Eye className="inline ml-1 opacity-50" size={10} /></td>
                    <td className="py-4 px-2 text-xs text-center text-orange-500 font-bold"><span>{m.replacement || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-red-600 font-bold"><span>{m.damage || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-rose-500 font-bold"><span>{m.rejected || 0}</span></td>
                    <td className="py-4 px-2 text-xs text-center text-rose-600 font-black"><span>{m.used || 0}</span></td>
                    <td className="py-4 px-3 text-sm text-center font-bold text-indigo-900 bg-indigo-50/30 border-l border-slate-200 group-hover:bg-indigo-50/50"><span>{expected}</span></td>
                    <td className="py-3 px-2 text-center bg-purple-50/20 border-l border-slate-200 group-hover:bg-purple-50/40">
                      <input 
                        type="number" 
                        placeholder="Qty"
                        className="w-16 mx-auto block px-1.5 py-1 text-center text-xs border border-purple-300 rounded outline-none font-bold text-purple-900 bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
                        value={physicalVal} 
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          saveMonthlyStock(activePeriod, item.id, { physical: val, expected });
                        }} 
                      />
                    </td>
                    <td className="py-4 px-3 text-center border-l border-slate-200">
                      {diff === null ? (
                        <span className="text-slate-400 text-xs font-medium">-</span>
                      ) : diff === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">0</span>
                      ) : diff > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">+{diff}</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">{diff}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center sticky right-0 z-10 bg-white group-hover:bg-slate-50 border-l border-slate-100">
                      <button onClick={() => setSelectedProductDetails(item)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition-all"><Eye size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3">
        {filteredStock.map((item) => {
          const mData = monthlyStockData.find(d => d.month === activePeriod && d.productId === item.id) || {};
          const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
          const opening = getEffectiveOpeningStock(activePeriod, item.id, item);
          const expected = getItemExpectedStock(item);

          const hasPhysical = mData.physical !== undefined && mData.physical !== '';
          const physicalVal = hasPhysical ? mData.physical : '';
          const physicalNum = hasPhysical ? Number(mData.physical) : null;
          const diff = physicalNum !== null ? physicalNum - expected : null;

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
               <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
                  <div className="pr-4">
                    <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase tracking-tighter mb-1 block">{item.sku || '-'}</span>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h3>
                  </div>
                  <button onClick={() => setSelectedProductDetails(item)} className="p-1.5 text-indigo-600 bg-indigo-100 rounded-lg shrink-0"><Eye size={16} /></button>
               </div>

               <div className="grid grid-cols-2 gap-3 p-3 border-b border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Opening Stock</span>
                    <input type="number" className="w-full px-2 py-1.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded outline-none focus:border-indigo-500" value={mData.opening !== undefined && mData.opening !== '' ? mData.opening : opening} onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      const m = monthlyMovements[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
                      const exp = calculateExpected(val === '' ? opening : val, mData.in, m.purchased, m.produced, m.returned, m.stockDeduction, m.replacement, m.damage, m.rejected, m.used, m.qcAcceptedOrPurchase);
                      saveMonthlyStock(activePeriod, item.id, { opening: val, expected: exp });
                    }} />
                  </div>
                  <div>
                    <span className="text-[9px] text-purple-600 uppercase font-bold block mb-1">Physical Stock</span>
                    <input type="number" placeholder="Physical Qty" className="w-full px-2 py-1.5 text-sm font-bold bg-purple-50 border border-purple-200 rounded outline-none focus:border-purple-500 font-mono text-purple-900" value={physicalVal} onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      saveMonthlyStock(activePeriod, item.id, { physical: val, expected });
                    }} />
                  </div>
               </div>

               <div className="p-4 bg-indigo-50/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block">Expected Stock</span>
                    <span className="text-base font-black text-indigo-900">{expected}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Discrepancy</span>
                    {diff === null ? (
                      <span className="text-xs font-semibold text-slate-400">Pending</span>
                    ) : (
                      <span className={`text-sm font-black ${
                        diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
               </div>
            </div>
          );
        })}
      </div>
          
      {/* Transaction Details Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <Layers className="text-indigo-400" size={24}/>
                 <div>
                   <h3 className="text-lg font-bold">Transaction History</h3>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest">{selectedProductDetails.name} • {activePeriod}</p>
                 </div>
               </div>
               <button onClick={() => setSelectedProductDetails(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Inventory In */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <TrendingUp size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">Inventory In</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.in.map(item => (
                      <li key={item.id} className={`flex justify-between items-center text-xs p-2 bg-${item.color}-50/50 rounded border-l-2 border-${item.color}-400`}>
                        <span className="font-medium text-slate-600">{item.label}</span>
                        <span className={`font-black text-${item.color}-600`}>+{item.impact}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <span>Total In</span>
                    <span className="text-emerald-600">
                      +{ (Number(monthlyStockData.find(d => d.month === activePeriod && d.productId === selectedProductDetails.id)?.in) || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.qcAcceptedOrPurchase || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.produced || 0) + 
                         (monthlyMovements[selectedProductDetails.id]?.returned || 0) }
                    </span>
                  </div>
                </div>

                {/* Card 2: B2C Out */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-amber-600">
                    <ShoppingCart size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">B2C Shipments</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.b2cOut.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-amber-50/50 rounded border-l-2 border-amber-400">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-black text-amber-600">-{item.impact}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <span>B2C Total</span>
                    <span className="text-amber-600">-{monthlyMovements[selectedProductDetails.id]?.b2cOut || 0}</span>
                  </div>
                </div>

                {/* Card 3: B2B Activity */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 text-orange-600">
                    <Package size={20}/>
                    <h4 className="font-bold uppercase tracking-tight text-sm">B2B Activity (Dispatched)</h4>
                  </div>
                  <ul className="space-y-2 flex-1 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {productMovements.b2bOut.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-orange-50/50 rounded border-l-2 border-orange-400">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-black text-orange-600">-{item.impact}</span>
                      </li>
                    ))}
                    {productMovements.sent.map(item => (
                      <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border-l-2 border-slate-200 opacity-80">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-500">{item.label}</span>
                          <span className="text-[10px] text-slate-400">{item.sublabel} (Prev. Packed)</span>
                          {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                        </div>
                        <span className="font-bold text-slate-400">{item.impact}*</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center font-black text-sm text-slate-900">
                    <div className="flex flex-col">
                      <span>B2B Total Deducted</span>
                      <span className="text-[9px] text-slate-400 font-normal">*Prev. packed items not deducted again</span>
                    </div>
                    <span className="text-orange-600">-{monthlyMovements[selectedProductDetails.id]?.b2bOut || 0}</span>
                  </div>
                </div>

                {/* Bottom Row Grid */}
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Packed & Pending */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Packed & Pending</h4>
                    <div className="space-y-4 flex-1">
                      {productMovements.packed.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-amber-50/50 rounded border-l-2 border-amber-300 list-none">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-600">{item.label}</span>
                            <span className="text-[10px] text-slate-400">{item.sublabel}</span>
                            {item.detail && <span className="text-[9px] font-bold text-emerald-600 mt-0.5">{item.detail}</span>}
                          </div>
                          <span className="font-bold text-amber-600">-{item.impact}</span>
                        </li>
                      ))}
                      {productMovements.onHold.map(item => (
                        <li key={item.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border-l-2 border-slate-200 opacity-60 list-none">
                          <span className="font-medium text-slate-400">{item.label}</span>
                          <span className="font-bold text-slate-400">-{item.impact}*</span>
                        </li>
                      ))}
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs">
                      <span className="text-slate-400">Reserved (This Week)</span>
                      <span className="text-slate-600">-{monthlyMovements[selectedProductDetails.id]?.packed || 0}</span>
                    </div>
                  </div>

                  {/* Adjustments */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Other Adjustments</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ul className="space-y-2">
                        {productMovements.adjustments.map(item => (
                          <li key={item.id} className={`flex justify-between items-center text-xs p-2 bg-${item.color}-50/50 rounded border-l-2 border-${item.color}-400`}>
                            <span className="font-medium text-slate-600">{item.label}</span>
                            <span className={`font-bold text-${item.color}-600`}>-{item.impact}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Weekly Summary</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span>Total Dispatch</span><span className="font-bold text-slate-700">-{monthlyMovements[selectedProductDetails.id]?.out || 0}</span></div>
                          <div className="flex justify-between"><span>Damage/Other</span><span className="font-bold text-slate-700">-{Number(monthlyMovements[selectedProductDetails.id]?.damage || 0) + Number(monthlyMovements[selectedProductDetails.id]?.rejected || 0) + Number(monthlyMovements[selectedProductDetails.id]?.replacement || 0)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <Button onClick={() => setSelectedProductDetails(null)} variant="secondary" className="w-full md:w-auto">Close History</Button>
            </div>
          </div>
        </div>
      )}

      {/* Expected Stock Correction Modal */}
      <ExpectedStockCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        activePeriod={activePeriod}
        itemsList={allStockItemsWithExpected}
      />
    </div>
  );
};

export default MonthlyStockCheck;
