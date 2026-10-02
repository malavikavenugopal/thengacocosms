import React, { useState, useMemo } from 'react';
import { 
  Calendar, Search, Filter, Eye, ArrowUpRight, ArrowDownRight, Package, 
  DownloadCloud, Printer, CheckCircle2, AlertTriangle, Layers, X, RefreshCw
} from 'lucide-react';
import { useGlobalState } from '../context/GlobalContext';
import { Card, Button } from '../components/ui';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const CustomDateStockCheck = () => {
  const { 
    stock = [], 
    monthlyStockData = [], 
    b2bShipments = [], 
    b2cShipments = [], 
    damageRecords = [], 
    returnRecords = [], 
    qcRecords = [], 
    purchaseRecords = [], 
    replacementRecords = [], 
    productionRecords = [], 
    reworkRecords = [],
    expectedStockRequests = []
  } = useGlobalState();

  // Helper date formatters
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getFirstOfMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getWeekStr = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMonthStr = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // State
  const [fromDate, setFromDate] = useState(() => getFirstOfMonthStr());
  const [toDate, setToDate] = useState(() => getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Modal for Eye Button (Details)
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    product: null,
    type: 'IN', // 'IN' or 'OUT'
    records: [],
    total: 0
  });

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set();
    stock.forEach(s => { if (s.category) set.add(s.category); });
    return ['all', ...Array.from(set)];
  }, [stock]);

  // Master product resolution map
  const stockMap = useMemo(() => {
    const mapById = {};
    const mapByName = {};
    stock.forEach(item => {
      mapById[item.id] = item;
      if (item.name) mapByName[item.name.toLowerCase().trim()] = item;
    });

    const findMaster = (name) => {
      if (!name) return null;
      return mapByName[name.toLowerCase().trim()] || null;
    };

    return { mapById, mapByName, findMaster };
  }, [stock]);

  // Helper to check if date falls strictly between fromDate and toDate (inclusive)
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.split('T')[0];
    if (fromDate && cleanDate < fromDate) return false;
    if (toDate && cleanDate > toDate) return false;
    return true;
  };

  // Get Monday start date for the week containing a date
  const getWeekStartDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const pad = (n) => String(n).padStart(2, '0');
    return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  };

  // Helper to check if a date is within weekStartDate (inclusive) up to fromDate (exclusive)
  const isDateInPrevDaysOfWeek = (dateStr, weekStartDate, targetFromDate) => {
    if (!dateStr || !weekStartDate || !targetFromDate) return false;
    const cleanDate = dateStr.split('T')[0];
    return cleanDate >= weekStartDate && cleanDate < targetFromDate;
  };

  const getIsoWeekMonday = (y, w) => {
    const targetJan4 = new Date(y, 0, 4);
    const dayOfWeek = targetJan4.getDay() || 7;
    const firstMonday = new Date(targetJan4);
    firstMonday.setDate(targetJan4.getDate() - dayOfWeek + 1);
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (w - 1) * 7);
    return monday;
  };

  const getPeriodSequence = (startPeriod, endPeriod) => {
    if (!startPeriod || !endPeriod) return [];
    if (startPeriod > endPeriod) return [endPeriod];
    
    const periods = [];
    let curr = startPeriod;
    let safety = 0;

    while (curr <= endPeriod && safety < 120) {
      periods.push(curr);
      if (curr === endPeriod) break;

      const [y, w] = curr.split('-W').map(Number);
      const mDate = getIsoWeekMonday(y, w);
      mDate.setDate(mDate.getDate() + 7);
      curr = getWeekStr(mDate);
      safety++;
    }
    return periods;
  };

  const isTargetWeek = (dateStr, targetPeriod) => {
    if (!dateStr || !targetPeriod) return false;
    return getWeekStr(dateStr) === targetPeriod;
  };

  const calculateExpected = (opening, otherIn, purchased, produced, returned, stockDeduction, replacement, damage, rejected, used, qcAcceptedOrPurchase = 0) => 
    Number(opening || 0) + Number(otherIn || 0) + Number(produced || 0) + Number(returned || 0) + Number(qcAcceptedOrPurchase || 0) - Number(stockDeduction || 0) - Number(replacement || 0) - Number(damage || 0) - Number(used || 0);

  // Compute movements for a week
  const getMovementsForWeek = (periodStr) => {
    const sums = {};
    stock.forEach(item => {
      sums[item.id] = { 
        out: 0, b2cOut: 0, b2bOut: 0, packed: 0, stockDeduction: 0, 
        returned: 0, damage: 0, purchased: 0, rejected: 0, replacement: 0, 
        produced: 0, used: 0, qcAccepted: 0, purchasedNoQC: 0, qcAcceptedOrPurchase: 0, reworkOut: 0 
      }; 
    });

    b2bShipments.forEach(s => { 
      if (!s.products || s.deducted === false || s.deducted === 'false') return;
      s.products.forEach(p => { 
        const pName = p.name || p.productName;
        const dispatchDate = s.dispatchDate || s.date;
        if (dispatchDate && isTargetWeek(dispatchDate, periodStr)) {
          const qty = Number(p.quantity) || 0;
          const master = stockMap.findMaster(pName);
          const applyB2B = (id, amount) => {
            if (sums[id]) sums[id].stockDeduction += amount;
          };
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
              if (compMaster) applyB2B(compMaster.id, qty * (Number(comp.quantity) || 1));
            });
          }
          if (master) applyB2B(master.id, qty);
        }
      });
    });

    b2cShipments.forEach(s => {
      const dispatchDate = s.dispatchDate || s.date;
      if (dispatchDate && isTargetWeek(dispatchDate, periodStr)) {
        s.products.forEach(p => { 
          const pName = p.name || p.productName;
          const master = stockMap.findMaster(pName);
          const qty = Number(p.quantity) || 0;
          const applyB2C = (id, amount) => {
            if (sums[id]) sums[id].stockDeduction += amount;
          };
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
              if (compMaster) applyB2C(compMaster.id, qty * (Number(comp.quantity) || 1));
            });
          }
          if (master) applyB2C(master.id, qty);
        });
      }
    });

    damageRecords.filter(r => isTargetWeek(r.date, periodStr)).forEach(r => { 
      const master = stockMap.findMaster(r.productName);
      if (master && sums[master.id]) { sums[master.id].damage += Number(r.quantity) || 0; }
    });

    qcRecords.filter(r => isTargetWeek(r.date, periodStr)).forEach(r => { 
      const master = stockMap.findMaster(r.productName);
      if (master && sums[master.id]) { 
        const checkedVal = Number(r.checked) || 0;
        const acceptedVal = checkedVal - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
        sums[master.id].qcAccepted += Math.max(0, acceptedVal);
        sums[master.id].rejected += Number(r.rejected) || 0; 
      } 
    });

    returnRecords.filter(r => isTargetWeek(r.date, periodStr) && r.isReusable && r.deducted !== false).forEach(r => { 
      const master = stockMap.findMaster(r.productName);
      if (master && sums[master.id]) { sums[master.id].returned += Number(r.quantity) || 0; }
    });

    purchaseRecords.filter(r => isTargetWeek(r.date, periodStr)).forEach(r => { 
      const master = stockMap.findMaster(r.productName);
      if (master && sums[master.id]) { 
        sums[master.id].purchased += Number(r.quantity) || 0; 
      } 
    });

    replacementRecords.filter(r => isTargetWeek(r.date, periodStr) && r.deducted).forEach(r => { 
      const prods = r.products || [{ name: r.productName, quantity: r.quantity }]; 
      prods.forEach(p => { 
        const master = stockMap.findMaster(p.name);
        if (master && sums[master.id]) { sums[master.id].replacement += Number(p.quantity) || 0; }
      }); 
    });

    (productionRecords || []).filter(r => isTargetWeek(r.date, periodStr)).forEach(r => { 
      const master = stockMap.findMaster(r.productName);
      if (master && sums[master.id]) { sums[master.id].produced += Number(r.quantity) || 0; }
      (r.rawMaterials || []).forEach(rm => { 
        const rmMaster = stockMap.findMaster(rm.name);
        if (rmMaster && sums[rmMaster.id]) { sums[rmMaster.id].used += Number(rm.quantity) || 0; }
      }); 
    });

    (reworkRecords || []).forEach(r => {
      if (isTargetWeek(r.outDate, periodStr)) {
        const products = r.products && r.products.length > 0 ? r.products : [{ productName: r.productName, quantity: r.quantity }];
        products.forEach(p => {
          const master = stockMap.findMaster(p.productName);
          if (master && sums[master.id]) {
            sums[master.id].stockDeduction += Number(p.quantity) || 0;
          }
        });
      }
      if (r.status === 'Reworked' && isTargetWeek(r.returnDate, periodStr)) {
        const returnProducts = r.returnProducts && r.returnProducts.length > 0 ? r.returnProducts : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        returnProducts.forEach(rp => {
          const master = stockMap.findMaster(rp.returnProductName);
          if (master && sums[master.id]) {
            sums[master.id].returned += Number(rp.returnQuantity) || 0;
          }
        });
      }
    });

    stock.forEach(item => {
      if (!sums[item.id]) return;
      const s = sums[item.id];
      s.qcAcceptedOrPurchase = s.qcAccepted || 0;
    });

    return sums;
  };

  // Stock chains computation matching TwoWeekStockCheck & MonthlyStockCheck
  const stockChains = useMemo(() => {
    const fromWeek = fromDate ? getWeekStr(fromDate) : getWeekStr(new Date());
    const MAY_BASE_PERIOD = '2026-W18';
    
    const startPeriod = (fromWeek && fromWeek < MAY_BASE_PERIOD) ? fromWeek : MAY_BASE_PERIOD;
    const periodList = getPeriodSequence(startPeriod, fromWeek);

    const monthlyDataMap = {};
    (monthlyStockData || []).forEach(d => {
      if (d.month && d.productId) {
        monthlyDataMap[`${d.month}_${d.productId}`] = d;
      }
    });

    const approvedReqMap = {};
    (expectedStockRequests || []).forEach(r => {
      if (r.status === 'approved' && r.period && r.items) {
        r.items.forEach(it => {
          if (it.productId && it.proposedExpected !== undefined && it.proposedExpected !== '') {
            approvedReqMap[`${r.period}_${it.productId}`] = Number(it.proposedExpected);
          }
        });
      }
    });

    const runningOpenings = {};
    const chains = {};
    stock.forEach(item => { chains[item.id] = {}; });

    for (let i = 0; i < periodList.length; i++) {
      const pStr = periodList[i];
      const mData = getMovementsForWeek(pStr);

      for (let j = 0; j < stock.length; j++) {
        const item = stock[j];
        if (item.isComposite) continue;

        const key = `${pStr}_${item.id}`;
        const doc = monthlyDataMap[key];
        const approvedExpected = approvedReqMap[key];

        let opening;
        if (doc?.opening !== undefined && doc?.opening !== '') {
          opening = Number(doc.opening);
        } else if (runningOpenings[item.id] !== undefined) {
          opening = runningOpenings[item.id];
        } else {
          opening = Number(item?.openingStock || item?.opening || item?.stock) || 0;
        }

        let expected;
        if (approvedExpected !== undefined) {
          expected = approvedExpected;
        } else if (doc?.isCorrected && doc?.expected !== undefined && doc?.expected !== '') {
          expected = Number(doc.expected);
        } else {
          const m = mData[item.id] || { out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0, replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0 };
          expected = calculateExpected(
            opening,
            doc?.in || 0,
            m.purchased || 0,
            m.produced || 0,
            m.returned || 0,
            m.stockDeduction || 0,
            m.replacement || 0,
            m.damage || 0,
            m.rejected || 0,
            m.used || 0,
            m.qcAcceptedOrPurchase || 0
          );
        }

        runningOpenings[item.id] = expected;

        if (chains[item.id]) {
          chains[item.id][pStr] = { opening, expected };
        }
      }
    }

    return chains;
  }, [stock, fromDate, monthlyStockData, expectedStockRequests, b2bShipments, b2cShipments, damageRecords, returnRecords, qcRecords, purchaseRecords, replacementRecords, productionRecords, reworkRecords]);

  // Calculate Opening Stock for a product as of fromDate
  const getOpeningStockOnFromDate = (item) => {
    if (!item) return 0;
    if (!fromDate) return Number(item.openingStock || item.opening || 0);

    const fromWeek = getWeekStr(fromDate);
    const weekStartDate = getWeekStartDate(fromDate);
    const weekChain = stockChains[item.id]?.[fromWeek];

    // Opening stock of fromWeek
    const weekOpening = weekChain?.opening !== undefined 
      ? weekChain.opening 
      : (Number(item?.openingStock || item?.opening || item?.stock) || 0);

    // If fromDate is Monday (start of the week), opening stock IS weekOpening
    if (!weekStartDate || fromDate <= weekStartDate) {
      return weekOpening;
    }

    // Otherwise, add IN & subtract OUT for days in fromWeek BEFORE fromDate
    let prevIn = 0;
    let prevOut = 0;

    (productionRecords || []).forEach(pr => {
      if (pr.date && pr.date >= weekStartDate && pr.date < fromDate) {
        const master = stockMap.findMaster(pr.productName);
        if (master?.id === item.id) prevIn += Number(pr.quantity) || 0;
        (pr.rawMaterials || []).forEach(rm => {
          const rmMaster = stockMap.findMaster(rm.name);
          if (rmMaster?.id === item.id) prevOut += Number(rm.quantity) || 0;
        });
      }
    });

    returnRecords.forEach(r => {
      if (r.date && r.date >= weekStartDate && r.date < fromDate && r.isReusable && r.deducted !== false) {
        const master = stockMap.findMaster(r.productName);
        if (master?.id === item.id) prevIn += Number(r.quantity) || 0;
      }
    });

    qcRecords.forEach(qc => {
      if (qc.date && qc.date >= weekStartDate && qc.date < fromDate) {
        const master = stockMap.findMaster(qc.productName);
        if (master?.id === item.id) {
          const checkedVal = Number(qc.checked) || 0;
          const rejectedVal = Number(qc.rejected) || 0;
          const damagedVal = (Number(qc.damaged) || 0) + (Number(qc.baseless) || 0) + (Number(qc.hole) || 0);
          prevIn += Math.max(0, checkedVal - rejectedVal - damagedVal);
          prevOut += rejectedVal;
        }
      }
    });

    b2bShipments.forEach(s => {
      if (s.deducted === false || s.deducted === 'false') return;
      const dDate = s.dispatchDate || s.date;
      if (dDate && dDate >= weekStartDate && dDate < fromDate) {
        (s.products || []).forEach(p => {
          const master = stockMap.findMaster(p.name || p.productName);
          const qty = Number(p.quantity) || 0;
          if (master?.id === item.id) prevOut += qty;
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
              if (compMaster?.id === item.id) prevOut += qty * (Number(comp.quantity) || 1);
            });
          }
        });
      }
    });

    b2cShipments.forEach(s => {
      const dDate = s.dispatchDate || s.date;
      if (dDate && dDate >= weekStartDate && dDate < fromDate) {
        (s.products || []).forEach(p => {
          const master = stockMap.findMaster(p.name || p.productName);
          const qty = Number(p.quantity) || 0;
          if (master?.id === item.id) prevOut += qty;
          if (master?.isComposite && master.components) {
            master.components.forEach(comp => {
              const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
              if (compMaster?.id === item.id) prevOut += qty * (Number(comp.quantity) || 1);
            });
          }
        });
      }
    });

    damageRecords.forEach(d => {
      if (d.date && d.date >= weekStartDate && d.date < fromDate) {
        const master = stockMap.findMaster(d.productName);
        if (master?.id === item.id) prevOut += Number(d.quantity) || 0;
      }
    });

    (reworkRecords || []).forEach(r => {
      if (r.outDate && r.outDate >= weekStartDate && r.outDate < fromDate) {
        const prods = r.products?.length > 0 ? r.products : [{ productName: r.productName, quantity: r.quantity }];
        prods.forEach(p => {
          const master = stockMap.findMaster(p.productName);
          if (master?.id === item.id) prevOut += Number(p.quantity) || 0;
        });
      }
      if (r.status === 'Reworked' && r.returnDate && r.returnDate >= weekStartDate && r.returnDate < fromDate) {
        const retProds = r.returnProducts?.length > 0 ? r.returnProducts : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        retProds.forEach(rp => {
          const master = stockMap.findMaster(rp.returnProductName);
          if (master?.id === item.id) prevIn += Number(rp.returnQuantity) || 0;
        });
      }
    });

    replacementRecords.forEach(rep => {
      if (rep.date && rep.date >= weekStartDate && rep.date < fromDate && rep.deducted) {
        const prods = rep.products || [{ name: rep.productName, quantity: rep.quantity }];
        prods.forEach(p => {
          const master = stockMap.findMaster(p.name);
          if (master?.id === item.id) prevOut += Number(p.quantity) || 0;
        });
      }
    });

    return weekOpening + prevIn - prevOut;
  };

  // Calculate detailed IN & OUT breakdown records for date range
  const auditData = useMemo(() => {
    if (!stock || stock.length === 0) return [];

    // Map: productId -> { opening: number, inTotal: number, outTotal: number, inRecords: [], outRecords: [] }
    const resMap = {};
    stock.forEach(item => {
      if (item.isComposite) return;
      resMap[item.id] = {
        item,
        opening: getOpeningStockOnFromDate(item),
        inTotal: 0,
        outTotal: 0,
        inRecords: [],
        outRecords: []
      };
    });

    const addIn = (productId, amount, type, date, notes = '', ref = '') => {
      if (!resMap[productId] || !amount || amount <= 0) return;
      resMap[productId].inTotal += amount;
      resMap[productId].inRecords.push({ date, type, qty: amount, notes, ref });
    };

    const addOut = (productId, amount, type, date, notes = '', ref = '') => {
      if (!resMap[productId] || !amount || amount <= 0) return;
      resMap[productId].outTotal += amount;
      resMap[productId].outRecords.push({ date, type, qty: amount, notes, ref });
    };

    // 1. Production / Manufacturing (IN for produced candle, OUT for components)
    (productionRecords || []).forEach(pr => {
      if (!isDateInRange(pr.date)) return;
      const master = stockMap.findMaster(pr.productName);
      if (master && resMap[master.id]) {
        addIn(master.id, Number(pr.quantity) || 0, 'Production Finished Goods', pr.date, `Batch: ${pr.batchNumber || '-'}`, `Batch ID: ${pr.id}`);
      }
      (pr.rawMaterials || []).forEach(rm => {
        const rmMaster = stockMap.findMaster(rm.name);
        if (rmMaster && resMap[rmMaster.id]) {
          addOut(rmMaster.id, Number(rm.quantity) || 0, 'Raw Material Used in Production', pr.date, `Used for: ${pr.productName}`, `Batch ID: ${pr.id}`);
        }
      });
    });

    // 3. Returns (IN)
    returnRecords.forEach(r => {
      if (!isDateInRange(r.date) || !r.isReusable || r.deducted === false) return;
      const master = stockMap.findMaster(r.productName);
      if (master && resMap[master.id]) {
        addIn(master.id, Number(r.quantity) || 0, 'Customer Return', r.date, `Reason: ${r.reason || '-'}`, `Return ID: ${r.id}`);
      }
    });

    // 4. QC Records (IN for Accepted, OUT for Rejected)
    qcRecords.forEach(qc => {
      if (!isDateInRange(qc.date)) return;
      const master = stockMap.findMaster(qc.productName);
      if (master && resMap[master.id]) {
        const checkedVal = Number(qc.checked) || 0;
        const rejectedVal = Number(qc.rejected) || 0;
        const damagedVal = (Number(qc.damaged) || 0) + (Number(qc.baseless) || 0) + (Number(qc.hole) || 0);
        const acceptedVal = Math.max(0, checkedVal - rejectedVal - damagedVal);

        if (acceptedVal > 0) {
          addIn(master.id, acceptedVal, 'QC Accepted Stock', qc.date, `Vendor: ${qc.vendorName || '-'}`, `QC #${qc.id}`);
        }
        if (rejectedVal > 0) {
          addOut(master.id, rejectedVal, 'QC Rejected Stock', qc.date, `Vendor: ${qc.vendorName || '-'}`, `QC #${qc.id}`);
        }
      }
    });

    // 5. B2B Shipments (OUT)
    b2bShipments.forEach(s => {
      if (s.deducted === false || s.deducted === 'false') return;
      const dispatchDate = s.dispatchDate || s.date;
      if (!isDateInRange(dispatchDate)) return;

      (s.products || []).forEach(p => {
        const pName = p.name || p.productName;
        const qty = Number(p.quantity) || 0;
        const master = stockMap.findMaster(pName);

        const processB2B = (id, amount) => {
          addOut(id, amount, 'B2B Dispatch', dispatchDate, `Client: ${s.clientName || 'General Client'}`, `Invoice: ${s.invoiceNo || s.id}`);
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
            if (compMaster) processB2B(compMaster.id, qty * (Number(comp.quantity) || 1));
          });
        }
        if (master) processB2B(master.id, qty);
      });
    });

    // 6. B2C Shipments (OUT)
    b2cShipments.forEach(s => {
      const dispatchDate = s.dispatchDate || s.date;
      if (!isDateInRange(dispatchDate)) return;

      (s.products || []).forEach(p => {
        const pName = p.name || p.productName;
        const qty = Number(p.quantity) || 0;
        const master = stockMap.findMaster(pName);

        const processB2C = (id, amount) => {
          addOut(id, amount, 'B2C Order Dispatch', dispatchDate, `Channel: ${s.channel || 'Direct'}`, `Order #${s.orderCount || s.id}`);
        };

        if (master?.isComposite && master.components) {
          master.components.forEach(comp => {
            const compMaster = comp.productId ? stockMap.mapById[comp.productId] : stockMap.findMaster(comp.name);
            if (compMaster) processB2C(compMaster.id, qty * (Number(comp.quantity) || 1));
          });
        }
        if (master) processB2C(master.id, qty);
      });
    });

    // 7. Damage Tracking (OUT)
    damageRecords.forEach(d => {
      if (!isDateInRange(d.date)) return;
      const master = stockMap.findMaster(d.productName);
      if (master && resMap[master.id]) {
        addOut(master.id, Number(d.quantity) || 0, 'Damaged / Defective', d.date, `Type: ${d.type || 'Damage'}`, `Damage ID: ${d.id}`);
      }
    });

    // 8. Rework Log (OUT for OutDate, IN for ReturnDate)
    (reworkRecords || []).forEach(r => {
      if (isDateInRange(r.outDate)) {
        const prods = r.products?.length > 0 ? r.products : [{ productName: r.productName, quantity: r.quantity }];
        prods.forEach(p => {
          const master = stockMap.findMaster(p.productName);
          if (master && resMap[master.id]) {
            addOut(master.id, Number(p.quantity) || 0, 'Sent for Rework', r.outDate, `Reason: ${r.reason || '-'}`, `Rework #${r.id}`);
          }
        });
      }
      if (r.status === 'Reworked' && isDateInRange(r.returnDate)) {
        const retProds = r.returnProducts?.length > 0 ? r.returnProducts : [{ returnProductName: r.returnProductName, returnQuantity: r.returnQuantity }];
        retProds.forEach(rp => {
          const master = stockMap.findMaster(rp.returnProductName);
          if (master && resMap[master.id]) {
            addIn(master.id, Number(rp.returnQuantity) || 0, 'Returned from Rework', r.returnDate, `Status: Reworked`, `Rework #${r.id}`);
          }
        });
      }
    });

    // 9. Replacement Records (OUT)
    replacementRecords.forEach(rep => {
      if (!isDateInRange(rep.date) || !rep.deducted) return;
      const prods = rep.products || [{ name: rep.productName, quantity: rep.quantity }];
      prods.forEach(p => {
        const master = stockMap.findMaster(p.name);
        if (master && resMap[master.id]) {
          addOut(master.id, Number(p.quantity) || 0, 'Replacement Sent', rep.date, `Reason: ${rep.reason || '-'}`, `Rep #${rep.id}`);
        }
      });
    });

    // Final calculations per item
    return Object.values(resMap).map(row => {
      const expectedStock = row.opening + row.inTotal - row.outTotal;
      return {
        ...row,
        expectedStock
      };
    });
  }, [stock, monthlyStockData, productionRecords, returnRecords, qcRecords, b2bShipments, b2cShipments, damageRecords, reworkRecords, replacementRecords, fromDate, toDate, stockMap]);

  // Filtered rows for UI
  const filteredData = useMemo(() => {
    return auditData.filter(row => {
      const p = row.item;
      const matchSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [auditData, searchQuery, categoryFilter]);

  // Overall Metrics Summary
  const summaryMetrics = useMemo(() => {
    const totalItems = filteredData.length;
    const totalIn = filteredData.reduce((acc, curr) => acc + curr.inTotal, 0);
    const totalOut = filteredData.reduce((acc, curr) => acc + curr.outTotal, 0);
    const netChange = totalIn - totalOut;

    return { totalItems, totalIn, totalOut, netChange };
  }, [filteredData]);

  // Eye Button Click Handler -> Open Details Modal
  const handleOpenDetails = (row, type) => {
    const records = type === 'IN' ? row.inRecords : row.outRecords;
    // Sort records descending by date
    const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = type === 'IN' ? row.inTotal : row.outTotal;

    setDetailsModal({
      isOpen: true,
      product: row.item,
      type,
      records: sorted,
      total
    });
  };

  // Quick Date Range Presets
  const applyDatePreset = (preset) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    if (preset === 'this-week') {
      const start = new Date(today);
      start.setDate(today.getDate() - (today.getDay() || 7) + 1);
      const fromStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      setFromDate(fromStr);
      setToDate(toStr);
    } else if (preset === 'this-month') {
      const fromStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
      setFromDate(fromStr);
      setToDate(toStr);
    } else if (preset === 'last-30') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      const fromStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      setFromDate(fromStr);
      setToDate(toStr);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportRows = filteredData.map(row => ({
      'Product Name': row.item.name,
      'SKU': row.item.sku || '-',
      'Category': row.item.category || '-',
      'Opening Stock': row.opening,
      'Total IN (+)': row.inTotal,
      'Total OUT (-)': row.outTotal,
      'Calculated Expected Stock': row.expectedStock
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Date Range Audit');
    XLSX.writeFile(workbook, `Stock_Audit_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Stock Audit Excel exported successfully!');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
            <Calendar size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Date Range Stock Audit</h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Exact expected stock calculations and IN/OUT breakdown between selected dates
            </p>
          </div>
        </div>

        {/* Date Filter & Presets Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-1.5 text-xs">
            <div 
              onClick={(e) => {
                const inp = e.currentTarget.querySelector('input');
                if (inp && typeof inp.showPicker === 'function') inp.showPicker();
              }}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 cursor-pointer transition-all shadow-sm"
            >
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-xs font-bold text-white outline-none bg-transparent cursor-pointer [color-scheme:dark]"
              />
            </div>

            <div 
              onClick={(e) => {
                const inp = e.currentTarget.querySelector('input');
                if (inp && typeof inp.showPicker === 'function') inp.showPicker();
              }}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 cursor-pointer transition-all shadow-sm"
            >
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-xs font-bold text-white outline-none bg-transparent cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => applyDatePreset('this-week')}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 font-semibold transition-all"
            >
              This Week
            </button>
            <button
              onClick={() => applyDatePreset('this-month')}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 font-semibold transition-all"
            >
              This Month
            </button>
            <button
              onClick={() => applyDatePreset('last-30')}
              className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 font-semibold transition-all"
            >
              Last 30 Days
            </button>
          </div>

          <Button
            onClick={handleExportExcel}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <DownloadCloud size={14} />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total SKUs</p>
            <p className="text-xl font-black text-slate-800">{summaryMetrics.totalItems}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowUpRight size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total IN (+)</p>
            <p className="text-xl font-black text-emerald-600">+{summaryMetrics.totalIn}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownRight size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total OUT (-)</p>
            <p className="text-xl font-black text-rose-600">-{summaryMetrics.totalOut}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className={`p-3 rounded-xl ${summaryMetrics.netChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <RefreshCw size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Movement</p>
            <p className={`text-xl font-black ${summaryMetrics.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {summaryMetrics.netChange >= 0 ? `+${summaryMetrics.netChange}` : summaryMetrics.netChange}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none w-full focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={15} className="text-slate-400 shrink-0 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 text-slate-800 shadow-sm"
          >
            {categories.map(c => (
              <option key={c} value={c} className="bg-white text-slate-800 py-1">
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stock Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4">SKU / Product Name</th>
                <th className="p-4 text-center">Category</th>
                <th className="p-4 text-center">Opening Stock</th>
                <th className="p-4 text-center bg-emerald-950/60 text-emerald-300">Total IN (+)</th>
                <th className="p-4 text-center bg-rose-950/60 text-rose-300">Total OUT (-)</th>
                <th className="p-4 text-center bg-indigo-950/80 text-indigo-200">Expected Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No products matching your filter criteria were found.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.item.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Product Name & SKU */}
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{row.item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {row.item.sku || '-'}</div>
                    </td>

                    {/* Category */}
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {row.item.category || 'General'}
                      </span>
                    </td>

                    {/* Opening Stock */}
                    <td className="p-4 text-center font-bold text-slate-700">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-800 font-mono">
                        {row.opening}
                      </span>
                    </td>

                    {/* Total IN (+ Eye Button) */}
                    <td className="p-4 text-center bg-emerald-50/30">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-extrabold text-emerald-700 text-sm font-mono">
                          +{row.inTotal}
                        </span>
                        <button
                          onClick={() => handleOpenDetails(row, 'IN')}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                          title="Click to view all IN details (Eye Button)"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>

                    {/* Total OUT (+ Eye Button) */}
                    <td className="p-4 text-center bg-rose-50/30">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-extrabold text-rose-700 text-sm font-mono">
                          -{row.outTotal}
                        </span>
                        <button
                          onClick={() => handleOpenDetails(row, 'OUT')}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                          title="Click to view all OUT details (Eye Button)"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>

                    {/* Expected Stock */}
                    <td className="p-4 text-center bg-indigo-50/40">
                      <span className={`inline-block px-3 py-1 rounded-lg text-sm font-black font-mono shadow-sm ${
                        row.expectedStock < 0 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : 'bg-indigo-600 text-white'
                      }`}>
                        {row.expectedStock}
                      </span>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eye Button Details Modal */}
      {detailsModal.isOpen && detailsModal.product && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className={`p-5 text-white flex items-center justify-between ${
              detailsModal.type === 'IN' ? 'bg-emerald-900' : 'bg-rose-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  detailsModal.type === 'IN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  <Eye size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {detailsModal.product.name} — {detailsModal.type} Details
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    Date Range: <span className="font-bold underline">{fromDate}</span> to <span className="font-bold underline">{toDate}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailsModal({ ...detailsModal, isOpen: false })}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[450px] overflow-y-auto bg-slate-50/50">
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Total {detailsModal.type} Count:</span>
                <span className={`text-lg font-black font-mono ${
                  detailsModal.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {detailsModal.type === 'IN' ? `+${detailsModal.total}` : `-${detailsModal.total}`}
                </span>
              </div>

              {detailsModal.records.length === 0 ? (
                <div className="bg-white p-8 text-center text-slate-400 rounded-xl border border-slate-200 text-xs font-medium">
                  No {detailsModal.type} transactions recorded between {fromDate} and {toDate}.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <th className="p-3">Date</th>
                        <th className="p-3">Transaction Type</th>
                        <th className="p-3 text-center">Quantity</th>
                        <th className="p-3">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {detailsModal.records.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold text-slate-700 font-mono whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              detailsModal.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {rec.type}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            <span className={detailsModal.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                              {detailsModal.type === 'IN' ? `+${rec.qty}` : `-${rec.qty}`}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 text-[11px]">
                            <div>{rec.notes}</div>
                            {rec.ref && <div className="text-[10px] text-slate-400 font-mono">{rec.ref}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <Button
                onClick={() => setDetailsModal({ ...detailsModal, isOpen: false })}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Close
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CustomDateStockCheck;
