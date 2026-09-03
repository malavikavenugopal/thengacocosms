import React, { useState, useMemo } from 'react';
import { Card, Button } from '../components/ui';
import { 
  Search, DownloadCloud, Eye, Calendar, ArrowRightLeft, X, 
  ShoppingCart, MapPin, ClipboardList, Layers, Save, 
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Scale,
  Filter, AlertCircle, Sparkles, RefreshCw, Clock, Edit3
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';
import toast from 'react-hot-toast';

const TwoWeekStockCheck = () => {
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
    reworkRecords
  } = useGlobalState();

  // Date helper functions
  const getWeekStr = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
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

  const getPeriodOfDate = (dateStr, targetPeriod) => {
    if (!dateStr) return '';
    const isMonthly = targetPeriod ? !targetPeriod.includes('-W') : false;
    return isMonthly ? getMonthStr(dateStr) : getWeekStr(dateStr);
  };

  const isTarget = (dateStr, targetPeriod) => {
    if (!dateStr || !targetPeriod) return false;
    return getPeriodOfDate(dateStr, targetPeriod) === targetPeriod;
  };

  const getPrevPeriodStr = (targetPeriod) => {
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

  // Helper to get exact Monday date for an ISO week
  const getIsoWeekMonday = (y, w) => {
    const simple = new Date(y, 0, 1 + (w - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  };

  // Generate single-week period options starting from April 2026 (Week 14) up to current week.
  // Filters to ONLY show weeks where physical stock has been entered (plus CURRENT week for new entries).
  const getWeeklyPeriodOptions = () => {
    const options = [];
    const currentWeekStr = getWeekStr(new Date()); // e.g. 2026-W35
    const [currYear, currWNum] = currentWeekStr.split('-W').map(Number);

    const startWeekNum = 14; // April 2026 (starts Monday April 6, 2026)
    const startYear = 2026;

    for (let w = currWNum; w >= startWeekNum; w--) {
      const wStr = `${currYear}-W${String(w).padStart(2, '0')}`;
      const mDate = getIsoWeekMonday(currYear, w);
      const sDate = new Date(mDate);
      sDate.setDate(mDate.getDate() + 6);

      const mFormat = mDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      const sFormat = sDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const isCurrent = wStr === currentWeekStr;

      // Check if physical stock was entered in firebase for this specific week
      const hasPhysicalInWeek = monthlyStockData?.some(d => 
        d.month === wStr && 
        d.physical !== undefined && 
        d.physical !== '' && 
        d.physical !== null
      );

      // Only include weeks that have physical stock entered OR the current week
      if (hasPhysicalInWeek || isCurrent) {
        const label = `Week ${w} (${mFormat} - ${sFormat}) ${isCurrent ? '★ CURRENT' : ''}${hasPhysicalInWeek ? ' ✓ Physical Entered' : ''}`;

        options.push({
          wNum: w,
          wStr,
          mFormat,
          sFormat,
          label,
          key: wStr,
          isCurrent,
          hasPhysicalInWeek
        });
      }
    }
    return options;
  };

  const periodOptions = useMemo(() => getWeeklyPeriodOptions(), [monthlyStockData]);
  const [selectedBlockKey, setSelectedBlockKey] = useState(periodOptions[0]?.key || '');
  const [filterMode, setFilterMode] = useState('entered'); // default to 'entered'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [physicalInputs, setPhysicalInputs] = useState({});
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync selected block key if periodOptions updates
  React.useEffect(() => {
    if (periodOptions.length > 0 && (!selectedBlockKey || !periodOptions.some(p => p.key === selectedBlockKey))) {
      setSelectedBlockKey(periodOptions[0].key);
    }
  }, [periodOptions, selectedBlockKey]);

  // Selected weekly period
  const activePeriod = useMemo(() => {
    return periodOptions.find(p => p.key === selectedBlockKey) || periodOptions[0] || { wStr: getWeekStr(new Date()), label: 'Current Week' };
  }, [periodOptions, selectedBlockKey]);

  // Exact Movement Calculation matching MonthlyStockCheck.jsx
  const getMovementsForWeek = (periodStr) => {
    const sums = {};
    const compareNames = (n1, n2) => {
      if (!n1 || !n2) return false;
      const clean = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return clean(n1) === clean(n2);
    };

    stock.forEach(item => { 
      sums[item.id] = { 
        out: 0, b2cOut: 0, b2bOut: 0, packed: 0, stockDeduction: 0, 
        returned: 0, damage: 0, purchased: 0, rejected: 0, replacement: 0, 
        produced: 0, used: 0, qcAccepted: 0, purchasedNoQC: 0, qcAcceptedOrPurchase: 0, reworkOut: 0 
      }; 
    });
    
    const prevPeriodStr = getPrevPeriodStr(periodStr);

    // B2B Shipments
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
          
          if (dispatchedThisWeek) {
            if (packedPrevWeek) {
              t.dispatched = (t.dispatched || 0) + amount;
            } else {
              t.b2bOut += amount;
            }
          }
          const packedBeforeOrThisWeek = !noPacking && packedDate && (getPeriodOfDate(packedDate, periodStr) === periodStr || getPeriodOfDate(packedDate, periodStr) === prevPeriodStr);
          if (packedBeforeOrThisWeek && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek) {
            t.packed += amount;
          }

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
      }); 
    });

    // B2C Shipments
    b2cShipments.forEach(s => {
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
              if (!packedPrevWeek) sums[id].stockDeduction += amount;
            }
            const packedBeforeOrThisWeek = packedDate && (getPeriodOfDate(packedDate, periodStr) === periodStr || getPeriodOfDate(packedDate, periodStr) === prevPeriodStr);
            if (packedBeforeOrThisWeek && s.status !== 'Dispatched' && !dispatchedThisWeek && !dispatchedPrevWeek) {
              sums[id].packed = (sums[id].packed || 0) + amount;
              if (packedThisWeek) sums[id].stockDeduction += amount;
            }
          };
          
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = stock.find(m => m.id === comp.productId || compareNames(m.name, comp.name));
              if (compMaster) { applyB2C(compMaster.id, (Number(p.quantity) || 0) * (Number(comp.quantity) || 1)); }
            });
          }
          if (master) { applyB2C(master.id, qty); }
        });
      } else {
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
          }); 
        }
      }
    });

    // Damage Tracking
    damageRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].damage += Number(r.quantity) || 0; }
    });

    // QC Records
    const qcStatsByProductAndVendor = {};
    qcRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { 
        const checkedVal = Number(r.checked) || 0;
        const acceptedVal = checkedVal - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        if (!qcStatsByProductAndVendor[master.id]) qcStatsByProductAndVendor[master.id] = {};
        if (!qcStatsByProductAndVendor[master.id][vendorKey]) {
          qcStatsByProductAndVendor[master.id][vendorKey] = { displayName: vendorName.trim(), checked: 0, accepted: 0 };
        }
        qcStatsByProductAndVendor[master.id][vendorKey].checked += checkedVal;
        qcStatsByProductAndVendor[master.id][vendorKey].accepted += Math.max(0, acceptedVal);
        sums[master.id].rejected += Number(r.rejected) || 0; 
      } 
    });

    // Returns
    returnRecords.filter(r => isTarget(r.date, periodStr) && r.isReusable && r.deducted !== false).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].returned += Number(r.quantity) || 0; }
    });

    // Purchases
    const purchasesByProductAndVendor = {};
    purchaseRecords.filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { 
        sums[master.id].purchased += Number(r.quantity) || 0; 
        if (!purchasesByProductAndVendor[master.id]) purchasesByProductAndVendor[master.id] = {};
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        if (!purchasesByProductAndVendor[master.id][vendorKey]) {
          purchasesByProductAndVendor[master.id][vendorKey] = { displayName: vendorName.trim(), quantity: 0 };
        }
        purchasesByProductAndVendor[master.id][vendorKey].quantity += Number(r.quantity) || 0;
      } 
    });

    // Replacements
    replacementRecords.filter(r => isTarget(r.date, periodStr) && r.deducted).forEach(r => { 
      const prods = r.products || [{ name: r.productName, quantity: r.quantity }]; 
      prods.forEach(p => { 
        const master = stock.find(s => compareNames(s.name, p.name));
        if (master && sums[master.id]) { sums[master.id].replacement += Number(p.quantity) || 0; }
      }); 
    });

    // Production
    (productionRecords || []).filter(r => isTarget(r.date, periodStr)).forEach(r => { 
      const master = stock.find(s => compareNames(s.name, r.productName));
      if (master && sums[master.id]) { sums[master.id].produced += Number(r.quantity) || 0; }
      (r.rawMaterials || []).forEach(rm => { 
        const rmMaster = stock.find(s => compareNames(s.name, rm.name));
        if (rmMaster && sums[rmMaster.id]) { sums[rmMaster.id].used += Number(rm.quantity) || 0; }
      }); 
    });

    // Rework Log
    (reworkRecords || []).forEach(r => {
      if (isTarget(r.outDate, periodStr)) {
        const products = r.products && r.products.length > 0 ? r.products : [{ productName: r.productName, quantity: r.quantity }];
        products.forEach(p => {
          const master = stock.find(s => compareNames(s.name, p.productName));
          if (master && sums[master.id]) {
            sums[master.id].stockDeduction += Number(p.quantity) || 0;
            sums[master.id].reworkOut += Number(p.quantity) || 0;
          }
        });
      }

      if (r.status === 'Reworked' && isTarget(r.returnDate, periodStr)) {
        const returnProducts = r.returnProducts && r.returnProducts.length > 0 ? r.returnProducts : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        returnProducts.forEach(rp => {
          const master = stock.find(s => compareNames(s.name, rp.returnProductName));
          if (master && sums[master.id]) {
            sums[master.id].returned += Number(rp.returnQuantity) || 0;
          }
        });
      }
    });

    // Effective QC and Purchase calculation
    Object.keys(sums).forEach(id => {
      sums[id].out = sums[id].b2cOut + sums[id].b2bOut + sums[id].reworkOut;
      
      let totalQCAccepted = 0;
      let effectiveQCAndPurchase = 0;
      const productQCs = qcStatsByProductAndVendor[id] || {};
      const productPurchases = purchasesByProductAndVendor[id] || {};
      const allVendors = new Set([...Object.keys(productQCs), ...Object.keys(productPurchases)]);
      
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

  // Expected Stock Calculation formula from MonthlyStockCheck.jsx
  const calculateExpected = (opening, otherIn, purchased, produced, returned, stockDeduction, replacement, damage, rejected, used, qcAcceptedOrPurchase = 0) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(produced || 0) + Number(returned || 0) + Number(qcAcceptedOrPurchase || 0) - Number(stockDeduction || 0) - Number(replacement || 0) - Number(damage || 0) - Number(used || 0);

  // Compute exact Expected Stock for any week as calculated in the Weekly Report page
  const getWeeklyReportExpected = (periodStr, itemId, itemRef) => {
    const doc = monthlyStockData.find(d => d.month === periodStr && d.productId === itemId);
    if (doc?.expected !== undefined && doc?.expected !== '') {
      return Number(doc.expected);
    }

    // Dynamic fallback calculation matching MonthlyStockCheck.jsx
    const prevPeriodStr = getPrevPeriodStr(periodStr);
    const prevDoc = monthlyStockData.find(d => d.month === prevPeriodStr && d.productId === itemId);

    let opening = 0;
    if (doc?.opening !== undefined) {
      opening = Number(doc.opening);
    } else if (prevDoc?.physical !== undefined && prevDoc.physical !== '') {
      opening = Number(prevDoc.physical);
    } else if (prevDoc?.expected !== undefined && prevDoc.expected !== '') {
      opening = Number(prevDoc.expected);
    } else {
      opening = Number(itemRef.openingStock) || 0;
    }

    const mData = getMovementsForWeek(periodStr)[itemId] || {
      out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0,
      replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0
    };

    return calculateExpected(
      opening,
      doc?.in || 0,
      mData.purchased,
      mData.produced,
      mData.returned,
      mData.stockDeduction,
      mData.replacement,
      mData.damage,
      mData.rejected,
      mData.used,
      mData.qcAcceptedOrPurchase
    );
  };

  // Compute single week stock calculations for the selected period (activePeriod)
  const biWeeklyData = useMemo(() => {
    const wStr = activePeriod?.wStr || getWeekStr(new Date());
    const mData = getMovementsForWeek(wStr);
    const prevWStr = getPrevPeriodStr(wStr);

    return stock.filter(item => !item.isComposite).map(item => {
      const doc = monthlyStockData.find(d => d.month === wStr && d.productId === item.id);
      const opening = getWeeklyReportExpected(prevWStr, item.id, item);
      const m = mData[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };

      const expectedStock = calculateExpected(
        opening,
        doc?.in || 0,
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

      const hasInput = physicalInputs[item.id] !== undefined && physicalInputs[item.id] !== '';
      const hasSaved = doc?.physical !== undefined && doc?.physical !== '';
      const hasPhysicalEntered = hasInput || hasSaved;

      let physicalStock = '';
      let difference = null;
      let absDifference = 0;
      let status = 'pending';

      if (hasPhysicalEntered) {
        const valStr = hasInput ? physicalInputs[item.id] : doc.physical;
        physicalStock = Number(valStr);
        difference = physicalStock - expectedStock;
        absDifference = Math.abs(difference);

        if (absDifference >= 10 || (expectedStock > 0 && absDifference / expectedStock >= 0.05)) {
          status = 'high_discrepancy';
        } else if (absDifference > 0) {
          status = 'low_discrepancy';
        } else {
          status = 'match';
        }
      }

      const totalInward = m.produced + m.returned + m.qcAcceptedOrPurchase;
      const totalOutward = m.stockDeduction + m.replacement + m.damage + m.used;

      return {
        ...item,
        openingStock: opening,
        expectedStock,
        physicalStock,
        hasPhysicalEntered,
        difference,
        absDifference,
        status,
        totalInward,
        totalOutward,
        movements: m
      };
    });
  }, [stock, activePeriod, monthlyStockData, physicalInputs, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, reworkRecords]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalItems = biWeeklyData.length;
    const enteredCount = biWeeklyData.filter(d => d.hasPhysicalEntered).length;
    const highCount = biWeeklyData.filter(d => d.status === 'high_discrepancy').length;
    const lowCount = biWeeklyData.filter(d => d.status === 'low_discrepancy').length;
    const matchCount = biWeeklyData.filter(d => d.status === 'match').length;
    const pendingCount = biWeeklyData.filter(d => d.status === 'pending').length;
    const totalVariance = biWeeklyData.reduce((acc, curr) => acc + (curr.hasPhysicalEntered ? curr.difference : 0), 0);

    return { totalItems, enteredCount, highCount, lowCount, matchCount, pendingCount, totalVariance };
  }, [biWeeklyData]);

  // Filtered and Sorted list
  const filteredData = useMemo(() => {
    let result = [...biWeeklyData];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(item => item.category === categoryFilter);
    }

    switch (filterMode) {
      case 'entered':
        result = result
          .filter(item => item.hasPhysicalEntered)
          .sort((a, b) => b.absDifference - a.absDifference);
        break;
      case 'high':
        result = result
          .filter(item => item.hasPhysicalEntered && item.absDifference > 0)
          .sort((a, b) => b.absDifference - a.absDifference);
        break;
      case 'low':
        result = result
          .filter(item => item.hasPhysicalEntered && item.absDifference > 0)
          .sort((a, b) => a.absDifference - b.absDifference);
        break;
      case 'none':
        result = result.filter(item => item.hasPhysicalEntered && item.difference === 0);
        break;
      case 'pending':
        result = result.filter(item => !item.hasPhysicalEntered);
        break;
      case 'a_z':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'all':
        result.sort((a, b) => {
          if (a.hasPhysicalEntered && !b.hasPhysicalEntered) return -1;
          if (!a.hasPhysicalEntered && b.hasPhysicalEntered) return 1;
          return b.absDifference - a.absDifference;
        });
        break;
      default: // 'entered'
        result = result
          .filter(item => item.hasPhysicalEntered)
          .sort((a, b) => b.absDifference - a.absDifference);
        break;
    }

    return result;
  }, [biWeeklyData, searchQuery, categoryFilter, filterMode]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set(stock.map(s => s.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [stock]);

  // Handle Physical Stock input change
  const handlePhysicalInputChange = (productId, val) => {
    setPhysicalInputs(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  // Save Stock Check records to Firebase
  const handleSaveAllPhysical = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Saving physical stock counts...');
    try {
      const wStr = activePeriod.wStr;
      let count = 0;

      for (const item of biWeeklyData) {
        const val = physicalInputs[item.id] !== undefined ? physicalInputs[item.id] : item.physicalStock;
        
        if (val !== '' && val !== undefined && val !== null) {
          await saveMonthlyStock(wStr, item.id, {
            opening: item.openingStock,
            expected: item.expectedStock,
            physical: Number(val)
          });
          count++;
        }
      }

      toast.success(`Saved physical stock counts for ${count} items!`, { id: toastId });
    } catch (err) {
      toast.error('Failed to save stock records: ' + err.message, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // Export
  const handleExport = (format = 'excel') => {
    const exportData = filteredData.map(item => ({
      'SKU / Product Name': item.name,
      'Category': item.category || 'N/A',
      'Expected Stock': item.expectedStock,
      'Physical Stock': item.hasPhysicalEntered ? item.physicalStock : 'Pending Count',
      'Discrepancy (Diff)': item.hasPhysicalEntered ? item.difference : 'N/A',
      'Status': !item.hasPhysicalEntered ? 'Pending Entry' : (item.difference === 0 ? 'Match' : (item.difference > 0 ? 'Excess Stock' : 'Shortage'))
    }));

    const fileName = `Stock_Discrepancy_${activePeriod.key}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    if (format === 'excel') {
      exportToExcel(exportData, fileName, 'Stock Discrepancy');
    } else {
      exportToCSV(exportData, fileName);
    }
    toast.success(`Exported ${exportData.length} items to ${fileName}`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="w-full bg-slate-900 rounded-2xl p-4 text-white shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Scale size={20} />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
            Weekly Stock Discrepancy Analysis
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
            <Calendar size={15} className="text-indigo-400 shrink-0" />
            <select
              value={selectedBlockKey}
              onChange={(e) => setSelectedBlockKey(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer pr-2 max-w-[320px] sm:max-w-none truncate"
            >
              {periodOptions.map(opt => (
                <option key={opt.key} value={opt.key} className="bg-slate-900 text-white py-1">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleSaveAllPhysical}
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 px-3.5 rounded-xl shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Save size={14} />
            <span>Save Stock</span>
          </Button>

          <Button
            onClick={() => handleExport('excel')}
            variant="outline"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <DownloadCloud size={14} />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <Card className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Sorting & Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
            <button
              onClick={() => setFilterMode('entered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterMode === 'entered' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-700 hover:bg-indigo-50'}`}
            >
              <CheckCircle2 size={14} /> Physical Entered ({stats.enteredCount})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Items ({biWeeklyData.length})
            </button>
            <button
              onClick={() => setFilterMode('high')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterMode === 'high' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-50'}`}
            >
              <AlertTriangle size={14} /> High Discrepancy ({stats.highCount})
            </button>
            <button
              onClick={() => setFilterMode('low')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterMode === 'low' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'}`}
            >
              <AlertCircle size={14} /> Low Discrepancy ({stats.lowCount})
            </button>
            <button
              onClick={() => setFilterMode('none')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterMode === 'none' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'}`}
            >
              <CheckCircle2 size={14} /> No Discrepancy ({stats.matchCount})
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterMode === 'pending' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              <Clock size={14} /> Pending Entry ({stats.pendingCount})
            </button>
            <button
              onClick={() => setFilterMode('a_z')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterMode === 'a_z' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              A - Z
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-700"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

        </div>
      </Card>

      {/* Main Stock Discrepancy Table */}
      <Card className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Product / SKU</th>
                <th className="py-3.5 px-4 text-center">Expected Stock</th>
                <th className="py-3.5 px-4 text-center w-40">Physical Stock</th>
                <th className="py-3.5 px-4 text-center">Difference (Discrepancy)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <ClipboardList className="mx-auto mb-2 text-slate-300" size={32} />
                    No matching inventory items found for this filter.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const isEntered = item.hasPhysicalEntered;
                  const isShortage = isEntered && item.difference < 0;
                  const isExcess = isEntered && item.difference > 0;
                  const isExact = isEntered && item.difference === 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>SKU: {item.sku || 'N/A'}</span>
                          {item.category && <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">{item.category}</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-indigo-900 text-base">
                        {item.expectedStock}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          placeholder="Enter count..."
                          value={physicalInputs[item.id] !== undefined ? physicalInputs[item.id] : (item.hasPhysicalEntered ? item.physicalStock : '')}
                          onChange={(e) => handlePhysicalInputChange(item.id, e.target.value)}
                          className="w-32 px-3 py-1.5 mx-auto block bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                        />
                      </td>

                      <td className="py-3 px-4 text-center">
                        {!isEntered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <Clock size={12} /> Pending Entry
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            isExact ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            (isShortage ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200')
                          }`}>
                            {isExact && <CheckCircle2 size={14} />}
                            {isShortage && <TrendingDown size={14} />}
                            {isExcess && <TrendingUp size={14} />}
                            {isExact ? 'Match (0)' : (isShortage ? `${item.difference} (Shortage)` : `+${item.difference} (Excess)`)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedProductDetails(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={18} />
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

      {/* Movement Breakdown Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedProductDetails.name}</h3>
                <p className="text-xs text-slate-500">Itemized Movement Details ({activePeriod.label})</p>
              </div>
              <button onClick={() => setSelectedProductDetails(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3.5 rounded-xl space-y-1.5 border border-slate-200">
                <div className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
                  {activePeriod.label}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Opening Stock</span>
                  <span className="font-semibold text-slate-800">{selectedProductDetails.openingStock}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Total Inward (+)</span>
                  <span className="font-semibold">+{(selectedProductDetails.movements?.produced || 0) + (selectedProductDetails.movements?.returned || 0) + (selectedProductDetails.movements?.qcAcceptedOrPurchase || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Total Outward (-)</span>
                  <span className="font-semibold">-{(selectedProductDetails.movements?.stockDeduction || 0) + (selectedProductDetails.movements?.replacement || 0) + (selectedProductDetails.movements?.damage || 0) + (selectedProductDetails.movements?.used || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Expected Stock</span>
                  <span className="text-indigo-900 font-extrabold">{selectedProductDetails.expectedStock}</span>
                </div>
              </div>

              <div className="flex justify-between py-2.5 bg-slate-900 text-white px-3.5 rounded-xl font-bold">
                <span>Recorded Physical Stock</span>
                <span>{selectedProductDetails.hasPhysicalEntered ? selectedProductDetails.physicalStock : 'Pending Count'}</span>
              </div>

              {selectedProductDetails.hasPhysicalEntered ? (
                <div className={`flex justify-between py-2.5 px-3.5 rounded-xl font-bold ${
                  selectedProductDetails.difference === 0 ? 'bg-emerald-100 text-emerald-800' : (selectedProductDetails.difference < 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
                }`}>
                  <span>Discrepancy (Difference)</span>
                  <span>{selectedProductDetails.difference > 0 ? `+${selectedProductDetails.difference}` : selectedProductDetails.difference}</span>
                </div>
              ) : (
                <div className="flex justify-between py-2.5 bg-slate-100 text-slate-600 px-3.5 rounded-xl font-medium">
                  <span>Status</span>
                  <span>Pending Entry</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setSelectedProductDetails(null)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-xl">
                Close Breakdown
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoWeekStockCheck;
