import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  query,
  orderBy 
} from 'firebase/firestore';

const GlobalContext = createContext();

export const useGlobalState = () => useContext(GlobalContext);

export const GlobalProvider = ({ children }) => {
  const [stock, setStock] = useState([]);
  const [b2bShipments, setB2bShipments] = useState([]);
  const [b2cShipments, setB2cShipments] = useState([]);
  const [damageRecords, setDamageRecords] = useState([]);
  const [returnRecords, setReturnRecords] = useState([]);
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [staff, setStaff] = useState([]);
  const [channels, setChannels] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [qcRecords, setQcRecords] = useState([]);
  const [replacementRecords, setReplacementRecords] = useState([]);
  const [monthlyStockData, setMonthlyStockData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const getAvailableStock = (productName) => {
    if (!productName || !stock) return 0;
    const item = stock.find(s => s.name === productName);
    if (!item) return 0;
    
    if (item.isComposite) {
      if (!item.components || item.components.length === 0) return 0;
      const componentStocks = item.components.map(comp => {
        const compStock = getAvailableStock(comp.name);
        return Math.floor(compStock / (Number(comp.quantity) || 1));
      });
      return Math.min(...componentStocks);
    } else {
      // Monthly-Aware Calculation to match "Expected" stock
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // 1. Get Opening Balance for this month
      const mData = monthlyStockData?.find(d => d.month === currentMonth && d.productId === item.id);
      
      // 2. Filter movements for this month only
      const isThisMonth = (date) => {
        if (!date) return false;
        return String(date).startsWith(currentMonth);
      };

      const movements = {
        in: (purchaseRecords || []).filter(r => r.productName === productName && isThisMonth(r.date))
            .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),
        
        out: (b2bShipments || []).filter(s => isThisMonth(s.date))
            .reduce((s, sh) => s + (sh.products || []).filter(p => p.name === productName)
            .reduce((s2, p) => s2 + (Number(p.quantity) * Number(p.packSize || 1)), 0), 0) +
            (b2cShipments || []).filter(s => isThisMonth(s.date))
            .reduce((s, sh) => s + (sh.products || []).filter(p => p.name === productName)
            .reduce((s2, p) => s2 + (Number(p.quantity) * Number(p.packSize || 1)), 0), 0),

        returned: (returnRecords || []).filter(r => r.productName === productName && r.isReusable && isThisMonth(r.date))
            .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),

        damage: (damageRecords || []).filter(r => r.productName === productName && isThisMonth(r.date))
            .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0) +
            (qcRecords || []).filter(r => r.productName === productName && isThisMonth(r.date) && r.deducted)
            .reduce((s, r) => s + (Number(r.damaged) * Number(r.packSize || 1)), 0),

        rejected: (qcRecords || []).filter(r => r.productName === productName && isThisMonth(r.date) && r.deducted)
            .reduce((s, r) => s + (Number(r.rejected) * Number(r.packSize || 1)), 0),

        replacement: (replacementRecords || []).filter(r => r.productName === productName && isThisMonth(r.date) && r.deducted)
            .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0)
      };

      // If no monthly data, fallback to master opening + global totals (initial behavior)
      if (!mData) {
        return (Number(item.opening) || 0) + (Number(item.in) || 0) + (Number(item.returned) || 0) - (Number(item.out) || 0) - (Number(item.damage) || 0) - (Number(item.rejected) || 0) - (Number(item.replacement) || 0);
      }

      return (Number(mData.opening) || 0) + (Number(mData.in) || 0) + movements.in + movements.returned - movements.out - movements.damage - movements.rejected - movements.replacement;
    }
  };
  
  // Form Drafts for Persistence
  const [drafts, setDrafts] = useState(() => {
    const saved = localStorage.getItem('thenga_form_drafts');
    try {
      return saved ? JSON.parse(saved) : {
        b2b: null,
        b2c: null,
        purchase: null,
        return: null,
        damage: null,
        qc: null,
        replacement: null
      };
    } catch (e) {
      return { b2b: null, b2c: null, purchase: null, return: null, damage: null, qc: null, replacement: null };
    }
  });

  useEffect(() => {
    localStorage.setItem('thenga_form_drafts', JSON.stringify(drafts));
  }, [drafts]);

  const updateDraft = (module, data) => {
    setDrafts(prev => ({ ...prev, [module]: data }));
  };

  const clearDraft = (module) => {
    setDrafts(prev => ({ ...prev, [module]: null }));
  };

  // Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Check for 15-day session timeout
        const loginTime = localStorage.getItem('thenga_login_timestamp');
        const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (loginTime && now - parseInt(loginTime) > fifteenDaysInMs) {
          // Session expired
          signOut(auth);
          localStorage.removeItem('thenga_login_timestamp');
          setCurrentUser(null);
        } else {
          // Valid session or new login
          if (!loginTime) {
            localStorage.setItem('thenga_login_timestamp', now.toString());
          }
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('thenga_login_timestamp');
      }
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Real-time Listeners
  useEffect(() => {
    if (!currentUser) return;
    const unsubStock = onSnapshot(collection(db, 'stock'), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    
    const unsubB2B = onSnapshot(query(collection(db, 'b2bShipments'), orderBy('date', 'desc')), (snapshot) => {
      setB2bShipments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubB2C = onSnapshot(query(collection(db, 'b2cShipments'), orderBy('date', 'desc')), (snapshot) => {
      setB2cShipments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubDamage = onSnapshot(query(collection(db, 'damageRecords'), orderBy('date', 'desc')), (snapshot) => {
      setDamageRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubReturns = onSnapshot(query(collection(db, 'returnRecords'), orderBy('date', 'desc')), (snapshot) => {
      setReturnRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    
    const unsubPurchases = onSnapshot(query(collection(db, 'purchaseRecords'), orderBy('date', 'desc')), (snapshot) => {
      setPurchaseRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubQC = onSnapshot(query(collection(db, 'qcRecords'), orderBy('date', 'desc')), (snapshot) => {
      setQcRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubChannels = onSnapshot(collection(db, 'channels'), (snapshot) => {
      setChannels(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snapshot) => {
      setCouriers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubMonthly = onSnapshot(collection(db, 'monthlyStockData'), (snapshot) => {
      setMonthlyStockData(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubVendors = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubReplacements = onSnapshot(query(collection(db, 'replacementRecords'), orderBy('date', 'desc')), (snapshot) => {
      setReplacementRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    });

    return () => {
      unsubStock(); unsubB2B(); unsubB2C(); unsubDamage(); 
      unsubReturns(); unsubQC(); unsubStaff(); unsubChannels(); unsubCouriers();
      unsubMonthly(); unsubPurchases(); unsubVendors(); unsubReplacements();
    };
  }, [currentUser]);

  const logout = () => signOut(auth);

  // API Methods
  const updateFirestoreStock = async (productName, quantity, operation = 'add', type = 'out') => {
    const sku = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());
    if (!sku) return;

    const qty = Number(quantity) || 0;

    // IF COMPOSITE: Recursively update components instead of the bundle itself
    if (sku.isComposite && sku.components && sku.components.length > 0) {
      console.log(`Bundle detected: ${sku.name}. Updating ${sku.components.length} components.`);
      for (const component of sku.components) {
        const componentQty = (Number(component.quantity) || 1) * qty;
        await updateFirestoreStock(component.name, componentQty, operation, type);
      }
      return; // Skip physical stock update for the virtual bundle SKU
    }

    const skuRef = doc(db, 'stock', sku.id);
    const currentVal = Number(sku[type]) || 0;
    const newVal = operation === 'add' ? currentVal + qty : Math.max(0, currentVal - qty);
    await updateDoc(skuRef, { [type]: newVal });
  };

  const addB2BShipment = async (shipment) => {
    await addDoc(collection(db, 'b2bShipments'), shipment);
    for (const p of shipment.products) {
      const multiplier = (Number(p.packSize) || 1);
      const totalUnits = (Number(p.quantity) || 0) * multiplier;
      await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
    }
  };

  const deleteB2BShipment = async (id) => {
    if (!id) return;
    try {
      // 1. First, try to find the record to restore stock
      const shipment = b2bShipments.find(s => s.id === id);
      
      // 2. Perform the deletion (Force this even if shipment object isn't found locally)
      // We wrap id in String() to prevent Firebase crashing on numeric IDs
      await deleteDoc(doc(db, 'b2bShipments', String(id)));
      
      // 3. If we found the shipment data, restore the stock
      if (shipment) {
        for (const p of shipment.products) {
          const multiplier = (Number(p.packSize) || 1);
          const totalUnits = (Number(p.quantity) || 0) * multiplier;
          await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
        }
      }
    } catch (err) {
      console.error("Firebase B2B Delete Error:", err);
      toast.error("Failed to delete from database");
    }
  };

  const updateB2BShipment = async (id, updatedShipment) => {
    const oldShipment = b2bShipments.find(s => s.id === id);
    if (!oldShipment) return;

    // 1. Revert old stock
    for (const p of oldShipment.products) {
      const multiplier = (Number(p.packSize) || 1);
      const totalUnits = (Number(p.quantity) || 0) * multiplier;
      await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
    }

    // 2. Update Document
    await updateDoc(doc(db, 'b2bShipments', String(id)), updatedShipment);

    // 3. Apply new stock
    for (const p of updatedShipment.products) {
      const multiplier = (Number(p.packSize) || 1);
      const totalUnits = (Number(p.quantity) || 0) * multiplier;
      await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
    }
  };

  const addB2CShipment = async (shipment) => {
    await addDoc(collection(db, 'b2cShipments'), shipment);
    for (const p of shipment.products) {
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
    }
  };

  const deleteB2CShipment = async (id) => {
    if (!id) return;
    try {
      // 1. First, try to find the record to restore stock
      const shipment = b2cShipments.find(s => s.id === id);
      
      // 2. Perform the deletion (Force this even if shipment object isn't found locally)
      // We wrap id in String() to prevent Firebase crashing on numeric IDs
      await deleteDoc(doc(db, 'b2cShipments', String(id)));
      
      // 3. If we found the shipment data, restore the stock
      if (shipment) {
        for (const p of shipment.products) {
          const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
          await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
        }
      }
    } catch (err) {
      console.error("Firebase B2C Delete Error:", err);
      toast.error("Failed to delete from database");
    }
  };

  const updateB2CShipment = async (id, updatedShipment) => {
    const oldShipment = b2cShipments.find(s => s.id === id);
    if (!oldShipment) return;

    // 1. Revert old stock
    for (const p of oldShipment.products) {
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
    }

    // 2. Update Document
    await updateDoc(doc(db, 'b2cShipments', String(id)), updatedShipment);

    // 3. Apply new stock
    for (const p of updatedShipment.products) {
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
    }
  };

  const addDamageRecord = async (record, shouldAdjust) => {
    // Inject packSize from Master Data
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { 
      ...record, 
      packSize: masterSKU?.packSize || 1,
      deducted: shouldAdjust 
    };
    
    await addDoc(collection(db, 'damageRecords'), finalizedRecord);
    
    if (shouldAdjust) {
      const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'damage');
    }
  };

  const updateDamageRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = damageRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old stock if it was deducted
    if (oldRecord.deducted) {
      const oldUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, oldUnits, 'sub', 'damage');
    }

    // 2. Update doc
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await updateDoc(doc(db, 'damageRecords', String(id)), finalized);

    // 3. Apply new stock if requested
    if (shouldAdjust) {
      const newUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, newUnits, 'add', 'damage');
    }
  };

  const deleteDamageRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = damageRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'damageRecords', docId));
        if (record.deducted) {
          const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
          await updateFirestoreStock(record.productName, totalUnits, 'sub', 'damage');
        }
      } catch (err) {
        console.error("Firebase Damage Delete Error:", err);
      }
    }
  };

  const addReturnRecord = async (record, shouldAdjust) => {
    // Inject packSize from Master Data
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { 
      ...record, 
      packSize: masterSKU?.packSize || 1,
      deducted: shouldAdjust // Reusing 'deducted' field name for consistency
    };

    await addDoc(collection(db, 'returnRecords'), finalizedRecord);
    
    // LOGIC: ONLY add to stock if it is REUSABLE (SELLABLE) AND user confirmed adjustment.
    if (shouldAdjust && record.isReusable) {
      const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'returned');
    }
  };

  const updateReturnRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = returnRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old stock
    if (oldRecord.deducted && oldRecord.isReusable) {
      const oldUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, oldUnits, 'sub', 'returned');
    }

    // 2. Update doc
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { 
      ...updatedRecord, 
      packSize: masterSKU?.packSize || 1, 
      deducted: shouldAdjust,
      isReusable: updatedRecord.condition === 'Good (Reuse)',
      isDamaged: updatedRecord.condition === 'Damaged (Waste)'
    };
    await updateDoc(doc(db, 'returnRecords', String(id)), finalized);

    // 3. Apply new stock
    if (shouldAdjust && finalized.isReusable) {
      const newUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, newUnits, 'add', 'returned');
    }
  };

  const deleteReturnRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = returnRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'returnRecords', docId));
        if (record.deducted && record.isReusable) {
          const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
          await updateFirestoreStock(record.productName, totalUnits, 'sub', 'returned');
        }
      } catch (err) {
        console.error("Firebase Return Delete Error:", err);
      }
    }
  };

  const addPurchaseRecord = async (record) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { ...record, packSize: masterSKU?.packSize || 1 };
    
    await addDoc(collection(db, 'purchaseRecords'), finalizedRecord);
    const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(record.productName, totalUnits, 'add', 'in');
  };

  const updatePurchaseRecord = async (id, updatedRecord) => {
    const oldRecord = purchaseRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old
    const oldUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
    await updateFirestoreStock(oldRecord.productName, oldUnits, 'sub', 'in');

    // 2. Update
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1 };
    await updateDoc(doc(db, 'purchaseRecords', String(id)), finalized);

    // 3. Apply new
    const newUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(updatedRecord.productName, newUnits, 'add', 'in');
  };

  const deletePurchaseRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = purchaseRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'purchaseRecords', docId));
        const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
        await updateFirestoreStock(record.productName, totalUnits, 'sub', 'in');
      } catch (err) {
        console.error("Purchase Delete Error:", err);
      }
    }
  };

  const addQCRecord = async (record, shouldDeduct) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { 
      ...record, 
      packSize: masterSKU?.packSize || 1,
      deducted: shouldDeduct 
    };
    
    await addDoc(collection(db, 'qcRecords'), finalizedRecord);
    
    // Deduct Rejected, Damaged, and Baseless items from stock if any and confirmed
    const issueQty = (Number(record.rejected) || 0) + (Number(record.damaged) || 0) + (Number(record.baseless) || 0);
    if (shouldDeduct && issueQty > 0) {
      const totalUnits = issueQty * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'damage');
    }
  };

  const updateQCRecord = async (id, updatedRecord, shouldDeduct) => {
    const oldRecord = qcRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old (Rejected + Damaged + Baseless)
    const oldIssues = (Number(oldRecord.rejected) || 0) + (Number(oldRecord.damaged) || 0) + (Number(oldRecord.baseless) || 0);
    if (oldRecord.deducted && oldIssues > 0) {
      const oldUnits = oldIssues * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, oldUnits, 'sub', 'damage');
    }

    // 2. Update
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldDeduct };
    await updateDoc(doc(db, 'qcRecords', String(id)), finalized);

    // 3. Apply new (Rejected + Damaged + Baseless)
    const newIssues = (Number(updatedRecord.rejected) || 0) + (Number(updatedRecord.damaged) || 0) + (Number(updatedRecord.baseless) || 0);
    if (shouldDeduct && newIssues > 0) {
      const newUnits = newIssues * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, newUnits, 'add', 'damage');
    }
  };

  const deleteQCRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = qcRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'qcRecords', docId));
        // Restore stock if there was rejection/damage/baseless AND it was deducted
        const issueQty = (Number(record.rejected) || 0) + (Number(record.damaged) || 0) + (Number(record.baseless) || 0);
        if (record.deducted && issueQty > 0) {
          const totalUnits = issueQty * (Number(record.packSize) || 1);
          await updateFirestoreStock(record.productName, totalUnits, 'sub', 'damage');
        }
      } catch (err) {
        console.error("QC Delete Error:", err);
      }
    }
  };

  const addReplacementRecord = async (record, shouldDeduct) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { ...record, packSize: masterSKU?.packSize || 1, deducted: shouldDeduct };
    await addDoc(collection(db, 'replacementRecords'), finalizedRecord);

    if (shouldDeduct) {
      const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'replacement');
    }
  };

  const updateReplacementRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = replacementRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old stock if it was deducted
    if (oldRecord.deducted) {
      const oldUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, oldUnits, 'sub', 'replacement');
    }

    // 2. Update Document
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await updateDoc(doc(db, 'replacementRecords', String(id)), finalized);

    // 3. Apply new stock if confirmed
    if (shouldAdjust) {
      const newUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, newUnits, 'add', 'replacement');
    }
  };

  const deleteReplacementRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = replacementRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'replacementRecords', docId));
        if (record.deducted) {
          const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
          await updateFirestoreStock(record.productName, totalUnits, 'sub', 'replacement');
        }
      } catch (err) {
        console.error("Replacement Delete Error:", err);
      }
    }
  };

  // Master Data Methods
  const addStaffMember = async (name) => {
    await addDoc(collection(db, 'staff'), { name });
  };
  const updateStaffMember = async (id, name) => {
    await updateDoc(doc(db, 'staff', id), { name });
  };
  const deleteStaffMember = async (id) => {
    await deleteDoc(doc(db, 'staff', id));
  };

  const addChannel = async (name) => {
    await addDoc(collection(db, 'channels'), { name });
  };
  const updateChannel = async (id, name) => {
    await updateDoc(doc(db, 'channels', id), { name });
  };
  const deleteChannel = async (id) => {
    await deleteDoc(doc(db, 'channels', id));
  };

  const addCourier = async (name) => {
    await addDoc(collection(db, 'couriers'), { name });
  };
  const updateCourier = async (id, name) => {
    await updateDoc(doc(db, 'couriers', id), { name });
  };
  const deleteCourier = async (id) => {
    await deleteDoc(doc(db, 'couriers', id));
  };

  const addVendor = async (data) => {
    await addDoc(collection(db, 'vendors'), data);
  };
  const updateVendor = async (id, data) => {
    await updateDoc(doc(db, 'vendors', id), data);
  };
  const deleteVendor = async (id) => {
    await deleteDoc(doc(db, 'vendors', id));
  };

  // SKU Management
  const addSKU = async (sku) => {
    await addDoc(collection(db, 'stock'), {
      ...sku,
      in: 0, out: 0, damage: 0, returned: 0, physical: ''
    });
  };
  
  const updateSKU = async (id, updates) => {
    const oldProduct = stock.find(p => p.id === id);
    const oldName = oldProduct?.name;
    const newName = updates.name;

    // 1. Update the product itself
    await updateDoc(doc(db, 'stock', id), updates);

    // 2. Cascade name change to all composite bundles if necessary
    if (oldName && newName && oldName !== newName) {
      console.log(`Renaming "${oldName}" to "${newName}". Updating bundles...`);
      const compositesToUpdate = stock.filter(p => 
        p.isComposite && p.components?.some(c => c.name === oldName)
      );

      for (const composite of compositesToUpdate) {
        const updatedComponents = (composite.components || []).map(c => 
          c.name === oldName ? { ...c, name: newName } : c
        );
        await updateDoc(doc(db, 'stock', composite.id), { 
          components: updatedComponents 
        });
      }
    }
  };

  const deleteSKU = async (id) => {
    await deleteDoc(doc(db, 'stock', id));
  };

  return (
    <GlobalContext.Provider value={{ 
      currentUser, logout, authLoading,
      stock, addSKU, updateSKU, deleteSKU,
      b2bShipments, addB2BShipment, updateB2BShipment, deleteB2BShipment,
      b2cShipments, addB2CShipment, updateB2CShipment, deleteB2CShipment,
      damageRecords, addDamageRecord, updateDamageRecord, deleteDamageRecord,
      returnRecords, addReturnRecord, updateReturnRecord, deleteReturnRecord,
      purchaseRecords, addPurchaseRecord, updatePurchaseRecord, deletePurchaseRecord,
      qcRecords, addQCRecord, updateQCRecord, deleteQCRecord,
      replacementRecords, addReplacementRecord, updateReplacementRecord, deleteReplacementRecord,
      staff, addStaffMember, updateStaffMember, deleteStaffMember,
      channels, addChannel, updateChannel, deleteChannel,
      couriers, addCourier, updateCourier, deleteCourier,
      vendors, addVendor, updateVendor, deleteVendor,
      drafts, updateDraft, clearDraft,
      getAvailableStock,
      monthlyStockData,
      saveMonthlyStock: async (month, productId, updates) => {
        const id = `${month}_${productId}`;
        await setDoc(doc(db, 'monthlyStockData', id), {
          ...updates,
          month,
          productId
        }, { merge: true });
      },
      uploadQCImages: async (files) => {
        const urls = [];
        for (const file of files) {
          if (!file) continue;
          if (typeof file === 'string') {
            urls.push(file);
            continue;
          }
          const storageRef = ref(storage, `qc/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          urls.push(url);
        }
        return urls;
      },
      getQCImageBase64: async (url) => {
        try {
          if (!url) return null;
          if (url.startsWith('data:')) return url;
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
          try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const blob = await response.blob();
              return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn("Primary proxy failed, trying secondary...");
          }
          const secondaryProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response2 = await fetch(secondaryProxy);
          if (response2.ok) {
            const blob = await response2.blob();
            return await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
          throw new Error("All proxies failed");
        } catch (err) {
          console.warn("CORS Proxy Failed. Falling back to direct URL link.", err);
          return url;
        }
      }
    }}>
      {currentUser && loading && stock.length === 0 ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium tracking-wide">Syncing data...</p>
        </div>
      ) : children}
    </GlobalContext.Provider>
  );
};
