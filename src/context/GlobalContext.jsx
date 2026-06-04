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
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';
import toast from 'react-hot-toast';

const GlobalContext = createContext();

export const useGlobalState = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    console.warn("useGlobalState must be used within a GlobalProvider. Returning safe fallback to prevent crashes.");
    return {
      currentUser: null,
      authLoading: true,
      stock: [],
      storeSales: [],
      stores: [],
      b2bShipments: [],
      b2cShipments: [],
      damageRecords: [],
      returnRecords: [],
      purchaseRecords: [],
      staff: [],
      channels: [],
      couriers: [],
      vendors: [],
      qcRecords: [],
      replacementRecords: [],
      monthlyStockData: [],
      productionRecords: [],
      reworkRecords: [],
      amazonReturnRecords: [],
      storeReminders: [],
      standardRecipients: [],
      loading: true,
      drafts: { b2b: null, b2c: null, purchase: null, return: null, damage: null, qc: null, replacement: null, production: null, rework: null },
      updateDraft: () => {},
      clearDraft: () => {},
      getAvailableStock: () => 0,
      addSKU: async () => {},
      updateSKU: async () => {},
      deleteSKU: async () => {},
      addB2BShipment: async () => {},
      deleteB2BShipment: async () => {},
      updateB2BShipment: async () => {},
      addB2CShipment: async () => {},
      deleteB2CShipment: async () => {},
      updateB2CShipment: async () => {},
      addDamageRecord: async () => {},
      deleteDamageRecord: async () => {},
      updateDamageRecord: async () => {},
      addReturnRecord: async () => {},
      deleteReturnRecord: async () => {},
      updateReturnRecord: async () => {},
      addPurchaseRecord: async () => {},
      deletePurchaseRecord: async () => {},
      updatePurchaseRecord: async () => {},
      addQCRecord: async () => {},
      deleteQCRecord: async () => {},
      updateQCRecord: async () => {},
      addReplacementRecord: async () => {},
      deleteReplacementRecord: async () => {},
      updateReplacementRecord: async () => {},
      addProductionRecord: async () => {},
      deleteProductionRecord: async () => {},
      updateProductionRecord: async () => {},
      addStaffMember: async () => {},
      updateStaffMember: async () => {},
      deleteStaffMember: async () => {},
      addChannel: async () => {},
      updateChannel: async () => {},
      deleteChannel: async () => {},
      addCourier: async () => {},
      updateCourier: async () => {},
      deleteCourier: async () => {},
      addVendor: async () => {},
      updateVendor: async () => {},
      deleteVendor: async () => {},
      addStore: async () => {},
      updateStore: async () => {},
      deleteStore: async () => {},
      addStoreSale: async () => {},
      updateStoreSale: async () => {},
      deleteStoreSale: async () => {},
      addStoreReminder: async () => {},
      addReworkRecord: async () => {},
      updateReworkRecord: async () => {},
      deleteReworkRecord: async () => {},
      addAmazonReturnRecords: async () => {},
      updateAmazonReturnRecord: async () => {},
      deleteAmazonReturnRecord: async () => {},
      addStandardRecipient: async () => {},
      updateStandardRecipient: async () => {},
      deleteStandardRecipient: async () => {},
      logout: async () => {}
    };
  }
  return context;
};

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
  const [productionRecords, setProductionRecords] = useState([]);
  const [reworkRecords, setReworkRecords] = useState([]);
  const [amazonReturnRecords, setAmazonReturnRecords] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeSales, setStoreSales] = useState([]);
  const [storeReminders, setStoreReminders] = useState([]);
  const [standardRecipients, setStandardRecipients] = useState([
    { email: 'sudha.thenga@gmail.com', label: 'Sudha' },
    { email: 'sumitha@thengacoco.com', label: 'Sumitha' },
    { email: 'maria@thengacoco.com', label: 'Maria' },
    { email: 'dhanya.thenga@gmail.com', label: 'Dhanya' }
  ]);
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
      // Monthly-Aware Calculation
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const isTargetMonth = (dateStr) => dateStr && dateStr.startsWith(currentMonth);

      // 1. Get Opening Balance for this month
      const mData = monthlyStockData?.find(d => d.month === currentMonth && d.productId === item.id);

      // 2. Filter movements for this month only
      const movements = {
        in: (purchaseRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date))
          .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),

        out: (b2bShipments || []).filter(s => isTargetMonth(s.date) && (!s.status || s.status === 'Dispatched') && s.deducted !== false && s.deducted !== 'false')
          .reduce((total, sh) => {
            return total + (sh.products || []).reduce((shTotal, p) => {
              let usage = 0;
              if (p.name === productName) {
                usage = (Number(p.quantity) * Number(p.packSize || 1));
              } else {
                const bundle = (stock || []).find(item => item.name === p.name);
                if (bundle?.isComposite && bundle.components) {
                  const comp = bundle.components.find(c => c.name === productName);
                  if (comp) {
                    usage = (Number(p.quantity) * Number(comp.quantity || 1));
                  }
                }
              }
              return shTotal + usage;
            }, 0);
          }, 0) +
          (b2cShipments || []).filter(s => isTargetMonth(s.date))
          .reduce((total, sh) => {
            return total + (sh.products || []).reduce((shTotal, p) => {
              let usage = 0;
              if (p.name === productName) {
                usage = (Number(p.quantity) * Number(p.packSize || 1));
              } else {
                const bundle = (stock || []).find(item => item.name === p.name);
                if (bundle?.isComposite && bundle.components) {
                  const comp = bundle.components.find(c => c.name === productName);
                  if (comp) {
                    usage = (Number(p.quantity) * Number(comp.quantity || 1));
                  }
                }
              }
              return shTotal + usage;
            }, 0);
          }, 0) +
          (storeSales || []).filter(s => isTargetMonth(s.date) && s.deducted)
          .reduce((total, sh) => {
            return total + (sh.products || []).reduce((shTotal, p) => {
              let usage = 0;
              const prodName = p.productName || p.name;
              if (prodName === productName) {
                usage = (Number(p.quantity) * Number(p.packSize || 1));
              } else {
                const bundle = (stock || []).find(item => item.name === prodName);
                if (bundle?.isComposite && bundle.components) {
                  const comp = bundle.components.find(c => c.name === productName);
                  if (comp) {
                    usage = (Number(p.quantity) * Number(comp.quantity || 1));
                  }
                }
              }
              return shTotal + usage;
            }, 0);
          }, 0),

        packed: (b2bShipments || []).filter(s => isTargetMonth(s.date) && s.status === 'Packed' && s.deducted !== false && s.deducted !== 'false')
          .reduce((total, sh) => {
            return total + (sh.products || []).reduce((shTotal, p) => {
              if (p.isPacked === false) return shTotal;
              let usage = 0;
              if (p.name === productName) {
                usage = (Number(p.quantity) * Number(p.packSize || 1));
              } else {
                const bundle = (stock || []).find(item => item.name === p.name);
                if (bundle?.isComposite && bundle.components) {
                  const comp = bundle.components.find(c => c.name === productName);
                  if (comp) {
                    usage = (Number(p.quantity) * Number(comp.quantity || 1));
                  }
                }
              }
              return shTotal + usage;
            }, 0);
          }, 0),

        returned: (returnRecords || []).filter(r => r.productName === productName && r.isReusable && isTargetMonth(r.date) && r.deducted !== false && r.deducted !== 'false')
          .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),

        damage: (damageRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date))
          .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),

        qcAccepted: (qcRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date))
          .reduce((s, r) => {
            const accepted = Number(r.checked) - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
            return s + (Math.max(0, accepted) * Number(r.packSize || 1));
          }, 0),

        rejected: (qcRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date) && r.deducted)
          .reduce((s, r) => s + (Number(r.rejected) * Number(r.packSize || 1)), 0),

        baseless: (qcRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date) && r.deducted)
          .reduce((s, r) => s + (Number(r.baseless || 0) * Number(r.packSize || 1)), 0),

        hole: (qcRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date) && r.deducted)
          .reduce((s, r) => s + (Number(r.hole || 0) * Number(r.packSize || 1)), 0),

        replacement: (replacementRecords || []).filter(r => isTargetMonth(r.date) && r.deducted)
          .reduce((s, r) => {
            if (r.products) {
              return s + r.products
                .filter(p => p.name === productName)
                .reduce((s2, p) => s2 + (Number(p.quantity) * (Number(p.packSize) || 1)), 0);
            }
            return s + (r.productName === productName ? (Number(r.quantity) * (Number(r.packSize) || 1)) : 0);
          }, 0),

        produced: (productionRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date))
          .reduce((s, r) => s + (Number(r.quantity) * Number(r.packSize || 1)), 0),

        usedInProduction: (productionRecords || []).filter(r => isTargetMonth(r.date))
          .reduce((s, r) => s + (r.rawMaterials || [])
            .filter(rm => rm.name === productName)
            .reduce((s2, rm) => s2 + (Number(rm.quantity) * (Number(rm.packSize) || 1)), 0), 0)
      };

      const productQC = (qcRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date));
      const qcStatsByVendor = {};
      productQC.forEach(r => {
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        if (!qcStatsByVendor[vendorKey]) {
          qcStatsByVendor[vendorKey] = { checked: 0, accepted: 0 };
        }
        const checkedVal = Number(r.checked) || 0;
        const acceptedVal = checkedVal - (Number(r.damaged) || 0) - (Number(r.rejected) || 0) - (Number(r.baseless) || 0) - (Number(r.hole) || 0);
        qcStatsByVendor[vendorKey].checked += checkedVal * Number(r.packSize || 1);
        qcStatsByVendor[vendorKey].accepted += Math.max(0, acceptedVal) * Number(r.packSize || 1);
      });

      const purchasesByVendor = {};
      const productPurchases = (purchaseRecords || []).filter(r => r.productName === productName && isTargetMonth(r.date));
      productPurchases.forEach(r => {
        const vendorName = r.vendorName || 'Unknown';
        const vendorKey = vendorName.trim().toLowerCase();
        purchasesByVendor[vendorKey] = (purchasesByVendor[vendorKey] || 0) + (Number(r.quantity) * Number(r.packSize || 1));
      });

      let qcAcceptedOrPurchase = 0;
      const allVendors = new Set([
        ...Object.keys(qcStatsByVendor),
        ...Object.keys(purchasesByVendor)
      ]);

      allVendors.forEach(vendorKey => {
        const A = qcStatsByVendor[vendorKey]?.accepted || 0;
        const C = qcStatsByVendor[vendorKey]?.checked || 0;
        const P = purchasesByVendor[vendorKey] || 0;
        qcAcceptedOrPurchase += A + Math.max(0, P - C);
      });

      if (!mData) {
        const legacyReplacements = (replacementRecords || []).filter(r => !r.products && r.productName === productName && r.deducted)
          .reduce((s, r) => s + (Number(r.quantity) * (Number(r.packSize) || 1)), 0);

        const multiReplacements = (replacementRecords || []).filter(r => r.products && r.deducted)
          .reduce((s, r) => s + (r.products || [])
            .filter(p => p.name === productName)
            .reduce((s2, p) => s2 + (Number(p.quantity) * (Number(p.packSize) || 1)), 0), 0);

        return (Number(item.opening) || 0) + (Number(item.returned) || 0) + (Number(item.produced) || 0) + qcAcceptedOrPurchase - (Number(item.out) || 0) - (Number(item.damage) || 0) - (Number(item.replacement) || 0) - legacyReplacements - multiReplacements - (Number(item.used) || 0);
      }

      // If we have a reconciled 'expected' value in the DB, use it as the primary truth.
      // This ensures the UI matches exactly what is in the Monthly Stock Check and Firebase.
      if (mData && mData.expected !== undefined && mData.expected !== null) {
        return Number(mData.expected);
      }

      const totalIn = (Number(mData.in) || 0) + (Number(movements.produced) || 0) + (Number(movements.returned) || 0) + qcAcceptedOrPurchase;
      const totalOut = (Number(movements.out) || 0) + (Number(movements.packed) || 0) + (Number(movements.damage) || 0) + (Number(movements.replacement) || 0) + (Number(movements.usedInProduction) || 0);

      return (Number(mData.opening) || 0) + totalIn - totalOut;
    }
  };

  // Form Drafts for Persistence
  const [drafts, setDrafts] = useState(() => {
    const saved = localStorage.getItem('thenga_form_drafts');
    try {
      return saved ? JSON.parse(saved) : {
        b2b: null, b2c: null, purchase: null, return: null, damage: null, qc: null, replacement: null, production: null, rework: null
      };
    } catch (e) {
      return { b2b: null, b2c: null, purchase: null, return: null, damage: null, qc: null, replacement: null, production: null, rework: null };
    }
  });

  useEffect(() => {
    localStorage.setItem('thenga_form_drafts', JSON.stringify(drafts));
  }, [drafts]);

  const updateDraft = React.useCallback((module, data) => {
    setDrafts(prev => ({ ...prev, [module]: data }));
  }, []);

  const clearDraft = React.useCallback((module) => {
    setDrafts(prev => ({ ...prev, [module]: null }));
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          let role = 'staff';
          
          if (userDoc.exists()) {
            role = userDoc.data().role || 'staff';
          } else if (user.email === 'admin@thengacoco.com') {
            role = 'admin';
            await setDoc(doc(db, 'users', user.uid), {
              email: user.email,
              role: 'admin',
              createdAt: new Date().toISOString()
            });
          }
          
          setCurrentUser({ ...user, role });
        } catch (error) {
          console.error("Error fetching user role:", error);
          setCurrentUser({ ...user, role: 'staff' });
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  const logout = () => signOut(auth);

  // Real-time Listeners
  useEffect(() => {
    if (!currentUser) return;
    const unsubStock = onSnapshot(collection(db, 'stock'), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false); // Stock is the core data, once it's here, we can show the UI
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
    });
    const unsubProduction = onSnapshot(query(collection(db, 'productionRecords'), orderBy('date', 'desc')), (snapshot) => {
      setProductionRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubRework = onSnapshot(query(collection(db, 'reworkRecords'), orderBy('outDate', 'desc')), (snapshot) => {
      setReworkRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubAmazonReturns = onSnapshot(query(collection(db, 'amazonReturnRecords'), orderBy('returnRequestDate', 'desc')), (snapshot) => {
      setAmazonReturnRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubStoreSales = onSnapshot(collection(db, 'storeSales'), (snapshot) => {
      setStoreSales(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubStoreReminders = onSnapshot(query(collection(db, 'storeReminders'), orderBy('date', 'desc')), (snapshot) => {
      setStoreReminders(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const unsubStandardRecipients = onSnapshot(collection(db, 'standardRecipients'), (snapshot) => {
      if (!snapshot.empty) {
        setStandardRecipients(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }
    });

    // Fallback: If data takes too long (e.g. empty database), stop loading after 3 seconds
    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      clearTimeout(timeout);
      unsubStock(); unsubB2B(); unsubB2C(); unsubDamage();
      unsubReturns(); unsubQC(); unsubStaff(); unsubChannels(); unsubCouriers();
      unsubMonthly(); unsubPurchases(); unsubVendors(); unsubReplacements(); unsubProduction(); unsubRework(); unsubAmazonReturns();
      unsubStores(); unsubStoreSales(); unsubStoreReminders(); unsubStandardRecipients();
    };
  }, [currentUser]);



  // API Methods
  const updateFirestoreStock = async (productName, quantity, operation = 'add', type = 'out') => {
    const sku = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());
    if (!sku) return;
    const qty = Number(quantity) || 0;
    if (sku.isComposite && sku.components && sku.components.length > 0) {
      for (const component of sku.components) {
        const componentQty = (Number(component.quantity) || 1) * qty;
        await updateFirestoreStock(component.name, componentQty, operation, type);
      }
      return;
    }
    const skuRef = doc(db, 'stock', sku.id);
    const currentVal = Number(sku[type]) || 0;
    const newVal = operation === 'add' ? currentVal + qty : Math.max(0, currentVal - qty);
    await updateDoc(skuRef, { [type]: newVal });
  };

  const addB2BShipment = async (shipment) => {
    await addDoc(collection(db, 'b2bShipments'), shipment);
    if (shipment.deducted !== false && shipment.deducted !== 'false') {
      for (const p of shipment.products) {
        if (p.isPacked !== false) {
          const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
          await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
        }
      }
    }
  };

  const deleteB2BShipment = async (id) => {
    if (!id) return;
    const shipment = b2bShipments.find(s => s.id === id);
    await deleteDoc(doc(db, 'b2bShipments', String(id)));
    if (shipment && shipment.deducted !== false && shipment.deducted !== 'false') {
      for (const p of shipment.products) {
        if (p.isPacked !== false) {
          const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
          await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
        }
      }
    }
  };

  const updateB2BShipment = async (id, updatedShipment) => {
    const oldShipment = b2bShipments.find(s => s.id === id);
    if (!oldShipment) return;
    if (oldShipment.deducted !== false && oldShipment.deducted !== 'false') {
      for (const p of oldShipment.products) {
        if (p.isPacked !== false) {
          const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
          await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
        }
      }
    }
    await updateDoc(doc(db, 'b2bShipments', String(id)), updatedShipment);
    if (updatedShipment.deducted !== false && updatedShipment.deducted !== 'false') {
      for (const p of updatedShipment.products) {
        if (p.isPacked !== false) {
          const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
          await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
        }
      }
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
    const shipment = b2cShipments.find(s => s.id === id);
    await deleteDoc(doc(db, 'b2cShipments', String(id)));
    if (shipment) {
      for (const p of shipment.products) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
      }
    }
  };

  const updateB2CShipment = async (id, updatedShipment) => {
    const oldShipment = b2cShipments.find(s => s.id === id);
    if (!oldShipment) return;
    for (const p of oldShipment.products) {
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      await updateFirestoreStock(p.name, totalUnits, 'sub', 'out');
    }
    await updateDoc(doc(db, 'b2cShipments', String(id)), updatedShipment);
    for (const p of updatedShipment.products) {
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      await updateFirestoreStock(p.name, totalUnits, 'add', 'out');
    }
  };

  const addDamageRecord = async (record, shouldAdjust) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalized = { ...record, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await addDoc(collection(db, 'damageRecords'), finalized);
    if (shouldAdjust) {
      const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'damage');
    }
  };

  const deleteDamageRecord = async (id) => {
    if (!id) return;
    const record = damageRecords.find(r => r.id === id);
    await deleteDoc(doc(db, 'damageRecords', String(id)));
    if (record && record.deducted) {
      const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'sub', 'damage');
    }
  };

  const updateDamageRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = damageRecords.find(r => r.id === id);
    if (!oldRecord) return;
    if (oldRecord.deducted) {
      const totalUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, totalUnits, 'sub', 'damage');
    }
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await updateDoc(doc(db, 'damageRecords', String(id)), finalized);
    if (shouldAdjust) {
      const totalUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, totalUnits, 'add', 'damage');
    }
  };

  const addReturnRecord = async (record, shouldAdjust) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalized = { ...record, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await addDoc(collection(db, 'returnRecords'), finalized);
    if (shouldAdjust && record.isReusable) {
      const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'returned');
    }
  };

  const deleteReturnRecord = async (id) => {
    if (!id) return;
    const record = returnRecords.find(r => r.id === id);
    await deleteDoc(doc(db, 'returnRecords', String(id)));
    if (record && record.deducted && record.isReusable) {
      const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'sub', 'returned');
    }
  };

  const updateReturnRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = returnRecords.find(r => r.id === id);
    if (!oldRecord) return;
    if (oldRecord.deducted && oldRecord.isReusable) {
      const totalUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
      await updateFirestoreStock(oldRecord.productName, totalUnits, 'sub', 'returned');
    }
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await updateDoc(doc(db, 'returnRecords', String(id)), finalized);
    if (shouldAdjust && updatedRecord.isReusable) {
      const totalUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
      await updateFirestoreStock(updatedRecord.productName, totalUnits, 'add', 'returned');
    }
  };

  const addPurchaseRecord = async (record) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalized = { ...record, packSize: masterSKU?.packSize || 1 };
    await addDoc(collection(db, 'purchaseRecords'), finalized);
    const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(record.productName, totalUnits, 'add', 'in');
  };

  const deletePurchaseRecord = async (id) => {
    if (!id) return;
    const record = purchaseRecords.find(r => r.id === id);
    await deleteDoc(doc(db, 'purchaseRecords', String(id)));
    if (record) {
      const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'sub', 'in');
    }
  };

  const updatePurchaseRecord = async (id, updatedRecord) => {
    if (!id) return;
    const oldRecord = purchaseRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old stock
    const oldTotalUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
    await updateFirestoreStock(oldRecord.productName, oldTotalUnits, 'sub', 'in');

    // 2. Update record in DB
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1 };
    await updateDoc(doc(db, 'purchaseRecords', String(id)), finalized);

    // 3. Add new stock
    const newTotalUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(updatedRecord.productName, newTotalUnits, 'add', 'in');
  };

  const addQCRecord = async (record, shouldDeduct) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalized = { ...record, packSize: masterSKU?.packSize || 1, deducted: shouldDeduct };
    await addDoc(collection(db, 'qcRecords'), finalized);
    const issueQty = (Number(record.rejected) || 0) + (Number(record.damaged) || 0) + (Number(record.baseless) || 0) + (Number(record.hole) || 0);
    if (shouldDeduct && issueQty > 0) {
      const totalUnits = issueQty * (masterSKU?.packSize || 1);
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'damage');
    }
  };

  const deleteQCRecord = async (id) => {
    if (!id) return;
    const record = qcRecords.find(r => r.id === id);
    await deleteDoc(doc(db, 'qcRecords', String(id)));
    if (record && record.deducted) {
      const issueQty = (Number(record.rejected) || 0) + (Number(record.damaged) || 0) + (Number(record.baseless) || 0) + (Number(record.hole) || 0);
      if (issueQty > 0) {
        const totalUnits = issueQty * (Number(record.packSize) || 1);
        await updateFirestoreStock(record.productName, totalUnits, 'sub', 'damage');
      }
    }
  };

  const updateQCRecord = async (id, updatedRecord, shouldAdjust) => {
    const oldRecord = qcRecords.find(r => r.id === id);
    if (!oldRecord) return;

    // 1. Revert old stock adjustment
    if (oldRecord.deducted) {
      const oldIssueQty = (Number(oldRecord.rejected) || 0) + (Number(oldRecord.damaged) || 0) + (Number(oldRecord.baseless) || 0) + (Number(oldRecord.hole) || 0);
      if (oldIssueQty > 0) {
        const totalUnits = oldIssueQty * (Number(oldRecord.packSize) || 1);
        await updateFirestoreStock(oldRecord.productName, totalUnits, 'sub', 'damage');
      }
    }

    // 2. Update record in DB
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1, deducted: shouldAdjust };
    await updateDoc(doc(db, 'qcRecords', String(id)), finalized);

    // 3. Apply new stock adjustment
    if (shouldAdjust) {
      const newIssueQty = (Number(updatedRecord.rejected) || 0) + (Number(updatedRecord.damaged) || 0) + (Number(updatedRecord.baseless) || 0) + (Number(updatedRecord.hole) || 0);
      if (newIssueQty > 0) {
        const totalUnits = newIssueQty * (masterSKU?.packSize || 1);
        await updateFirestoreStock(updatedRecord.productName, totalUnits, 'add', 'damage');
      }
    }
  };

  const addReplacementRecord = async (record, shouldDeduct) => {
    const processedProducts = (record.products || []).map(p => {
      const master = stock.find(s => s.name === p.name);
      return { ...p, packSize: master?.packSize || 1 };
    });
    const finalized = { ...record, products: processedProducts, deducted: shouldDeduct };
    await addDoc(collection(db, 'replacementRecords'), finalized);
    if (shouldDeduct) {
      for (const p of processedProducts) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.name, totalUnits, 'add', 'replacement');
      }
    }
  };

  const deleteReplacementRecord = async (id) => {
    if (!id) return;
    const record = replacementRecords.find(r => r.id === id);
    await deleteDoc(doc(db, 'replacementRecords', String(id)));
    if (record && record.deducted) {
      const products = record.products || [{ name: record.productName, quantity: record.quantity, packSize: record.packSize }];
      for (const p of products) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.name, totalUnits, 'sub', 'replacement');
      }
    }
  };

  const updateReplacementRecord = async (id, updatedRecord, shouldDeduct) => {
    const oldRecord = replacementRecords.find(r => r.id === id);
    if (!oldRecord) return;
    if (oldRecord.deducted) {
      const oldProducts = oldRecord.products || [{ name: oldRecord.productName, quantity: oldRecord.quantity, packSize: oldRecord.packSize }];
      for (const p of oldProducts) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.name, totalUnits, 'sub', 'replacement');
      }
    }
    const processedProducts = (updatedRecord.products || []).map(p => {
      const master = stock.find(s => s.name === p.name);
      return { ...p, packSize: master?.packSize || 1 };
    });
    const finalized = { ...updatedRecord, products: processedProducts, deducted: shouldDeduct };
    await updateDoc(doc(db, 'replacementRecords', String(id)), finalized);
    if (shouldDeduct) {
      for (const p of processedProducts) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.name, totalUnits, 'add', 'replacement');
      }
    }
  };

  const addProductionRecord = async (record) => {
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalized = { ...record, packSize: masterSKU?.packSize || 1 };
    await addDoc(collection(db, 'productionRecords'), finalized);
    const producedUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(record.productName, producedUnits, 'add', 'produced');
    for (const rm of (record.rawMaterials || [])) {
      const rmSKU = stock.find(s => s.name === rm.name);
      const usedUnits = (Number(rm.quantity) || 0) * (rmSKU?.packSize || 1);
      await updateFirestoreStock(rm.name, usedUnits, 'add', 'used');
    }
  };

  const deleteProductionRecord = async (id) => {
    const record = productionRecords.find(r => r.id === id);
    if (!record) return;
    await deleteDoc(doc(db, 'productionRecords', id));
    const producedUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
    await updateFirestoreStock(record.productName, producedUnits, 'sub', 'produced');
    for (const rm of (record.rawMaterials || [])) {
      const rmSKU = stock.find(s => s.name === rm.name);
      const usedUnits = (Number(rm.quantity) || 0) * (Number(rmSKU?.packSize) || 1);
      await updateFirestoreStock(rm.name, usedUnits, 'sub', 'used');
    }
  };

  const updateProductionRecord = async (id, updatedRecord) => {
    const oldRecord = productionRecords.find(r => r.id === id);
    if (!oldRecord) return;
    // Revert old
    const oldProducedUnits = (Number(oldRecord.quantity) || 0) * (Number(oldRecord.packSize) || 1);
    await updateFirestoreStock(oldRecord.productName, oldProducedUnits, 'sub', 'produced');
    for (const rm of (oldRecord.rawMaterials || [])) {
      const rmSKU = stock.find(s => s.name === rm.name);
      const oldUsedUnits = (Number(rm.quantity) || 0) * (Number(rmSKU?.packSize) || 1);
      await updateFirestoreStock(rm.name, oldUsedUnits, 'sub', 'used');
    }
    // Apply new
    const masterSKU = stock.find(s => s.name === updatedRecord.productName);
    const finalized = { ...updatedRecord, packSize: masterSKU?.packSize || 1 };
    await updateDoc(doc(db, 'productionRecords', id), finalized);
    const newProducedUnits = (Number(updatedRecord.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(updatedRecord.productName, newProducedUnits, 'add', 'produced');
    for (const rm of (updatedRecord.rawMaterials || [])) {
      const rmSKU = stock.find(s => s.name === rm.name);
      const newUsedUnits = (Number(rm.quantity) || 0) * (rmSKU?.packSize || 1);
      await updateFirestoreStock(rm.name, newUsedUnits, 'add', 'used');
    }
  };

  const addStaffMember = async (name) => { await addDoc(collection(db, 'staff'), { name }); };
  const updateStaffMember = async (id, name) => { await updateDoc(doc(db, 'staff', id), { name }); };
  const deleteStaffMember = async (id) => { await deleteDoc(doc(db, 'staff', id)); };
  const addChannel = async (name) => { await addDoc(collection(db, 'channels'), { name }); };
  const updateChannel = async (id, name) => { await updateDoc(doc(db, 'channels', id), { name }); };
  const deleteChannel = async (id) => { await deleteDoc(doc(db, 'channels', id)); };
  const addCourier = async (name) => { await addDoc(collection(db, 'couriers'), { name }); };
  const updateCourier = async (id, name) => { await updateDoc(doc(db, 'couriers', id), { name }); };
  const deleteCourier = async (id) => { await deleteDoc(doc(db, 'couriers', id)); };
  const addVendor = async (data) => { await addDoc(collection(db, 'vendors'), data); };
  const updateVendor = async (id, data) => { await updateDoc(doc(db, 'vendors', id), data); };
  const deleteVendor = async (id) => { await deleteDoc(doc(db, 'vendors', id)); };
  
  const addStandardRecipient = async (data) => { await addDoc(collection(db, 'standardRecipients'), data); };
  const updateStandardRecipient = async (id, data) => { await updateDoc(doc(db, 'standardRecipients', id), data); };
  const deleteStandardRecipient = async (id) => { await deleteDoc(doc(db, 'standardRecipients', id)); };
  const addSKU = async (sku) => {
    const finalized = { ...sku, packSize: sku.isComposite ? 1 : (Number(sku.packSize) || 1) };
    await addDoc(collection(db, 'stock'), { ...finalized, in: 0, out: 0, damage: 0, returned: 0, produced: 0, used: 0, physical: '' });
  };
  const updateSKU = async (id, updates) => {
    const finalized = { ...updates };
    if (updates.isComposite !== undefined) {
      finalized.packSize = updates.isComposite ? 1 : (Number(updates.packSize) || 1);
    }
    await updateDoc(doc(db, 'stock', id), finalized);
  };
  const deleteSKU = async (id) => { await deleteDoc(doc(db, 'stock', id)); };

  const addStore = async (name) => { await addDoc(collection(db, 'stores'), { name }); };
  const updateStore = async (id, name) => { await updateDoc(doc(db, 'stores', id), { name }); };
  const deleteStore = async (id) => { await deleteDoc(doc(db, 'stores', id)); };

  const addStoreSale = async (data, shouldAdjust) => {
    const processedProducts = (data.products || []).map(p => {
      const master = stock.find(s => s.name === p.productName);
      return { ...p, packSize: master?.packSize || 1 };
    });
    const finalized = { ...data, products: processedProducts, deducted: false };
    await addDoc(collection(db, 'storeSales'), finalized);
  };
  const addStoreReminder = async (data) => { await addDoc(collection(db, 'storeReminders'), data); };
  const updateStoreSale = async (id, data, shouldAdjust) => {
    const oldSale = storeSales.find(s => s.id === id);
    if (!oldSale) return;
    // Revert old stock if it was deducted
    if (oldSale.deducted) {
      for (const p of (oldSale.products || [])) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.productName, totalUnits, 'sub', 'out');
      }
    }
    const processedProducts = (data.products || []).map(p => {
      const master = stock.find(s => s.name === p.productName);
      return { ...p, packSize: master?.packSize || 1 };
    });
    const finalized = { ...data, products: processedProducts, deducted: false };
    await updateDoc(doc(db, 'storeSales', String(id)), finalized);
  };
  const deleteStoreSale = async (id) => {
    if (!id) return;
    const sale = storeSales.find(s => s.id === id);
    await deleteDoc(doc(db, 'storeSales', String(id)));
    if (sale && sale.deducted) {
      for (const p of (sale.products || [])) {
        const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        await updateFirestoreStock(p.productName, totalUnits, 'sub', 'out');
      }
    }
  };

  const addReworkRecord = async (record) => { await addDoc(collection(db, 'reworkRecords'), record); };
  const updateReworkRecord = async (id, record) => { await updateDoc(doc(db, 'reworkRecords', id), record); };
  const deleteReworkRecord = async (id) => { await deleteDoc(doc(db, 'reworkRecords', id)); };

  // Amazon Returns CRUD
  const addAmazonReturnRecords = async (records) => {
    const batch = records.map(r => addDoc(collection(db, 'amazonReturnRecords'), r));
    await Promise.all(batch);
  };
  const updateAmazonReturnRecord = async (id, record) => { await updateDoc(doc(db, 'amazonReturnRecords', id), record); };
  const deleteAmazonReturnRecord = async (id) => { await deleteDoc(doc(db, 'amazonReturnRecords', id)); };

  return (
    <GlobalContext.Provider value={{
      stock, addSKU, updateSKU, deleteSKU,
      b2bShipments, addB2BShipment, deleteB2BShipment, updateB2BShipment,
      b2cShipments, addB2CShipment, deleteB2CShipment, updateB2CShipment,
      damageRecords, addDamageRecord, deleteDamageRecord, updateDamageRecord,
      returnRecords, addReturnRecord, deleteReturnRecord, updateReturnRecord,
      purchaseRecords, addPurchaseRecord, deletePurchaseRecord, updatePurchaseRecord,
      qcRecords, addQCRecord, updateQCRecord, deleteQCRecord,
      replacementRecords, addReplacementRecord, updateReplacementRecord, deleteReplacementRecord,
      productionRecords, addProductionRecord, updateProductionRecord, deleteProductionRecord,
      staff, addStaffMember, updateStaffMember, deleteStaffMember,
      channels, addChannel, updateChannel, deleteChannel,
      couriers, addCourier, updateCourier, deleteCourier,
      vendors, addVendor, updateVendor, deleteVendor,
      reworkRecords, addReworkRecord, updateReworkRecord, deleteReworkRecord,
      amazonReturnRecords, addAmazonReturnRecords, updateAmazonReturnRecord, deleteAmazonReturnRecord,
      stores, addStore, updateStore, deleteStore,
      storeSales, addStoreSale, updateStoreSale, deleteStoreSale,
      storeReminders, addStoreReminder,
      standardRecipients, addStandardRecipient, updateStandardRecipient, deleteStandardRecipient,
      monthlyStockData, saveMonthlyStock: async (month, productId, updates) => {
        const id = `${month}_${productId}`;
        await setDoc(doc(db, 'monthlyStockData', id), { ...updates, month, productId }, { merge: true });
      },
      getAvailableStock,
      currentUser, logout, loading, authLoading, drafts, updateDraft, clearDraft,
      uploadQCImages: async (files) => {
        const urls = [];
        for (const file of files) {
          if (!file) continue;
          if (typeof file === 'string') { urls.push(file); continue; }
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
          } catch (e) { console.warn("Primary proxy failed, trying secondary..."); }
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
      {children}
    </GlobalContext.Provider>
  );
};
