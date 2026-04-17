import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
  const [staff, setStaff] = useState([]);
  const [channels, setChannels] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

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

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubChannels = onSnapshot(collection(db, 'channels'), (snapshot) => {
      setChannels(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snapshot) => {
      setCouriers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    });

    return () => {
      unsubStock(); unsubB2B(); unsubB2C(); unsubDamage(); 
      unsubReturns(); unsubStaff(); unsubChannels(); unsubCouriers();
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

  const addDamageRecord = async (record) => {
    // Inject packSize from Master Data
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { ...record, packSize: masterSKU?.packSize || 1 };
    
    await addDoc(collection(db, 'damageRecords'), finalizedRecord);
    const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
    await updateFirestoreStock(record.productName, totalUnits, 'add', 'damage');
  };

  const deleteDamageRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = damageRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'damageRecords', docId));
        const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
        await updateFirestoreStock(record.productName, totalUnits, 'sub', 'damage');
      } catch (err) {
        console.error("Firebase Damage Delete Error:", err);
      }
    }
  };

  const addReturnRecord = async (record) => {
    // Inject packSize from Master Data
    const masterSKU = stock.find(s => s.name === record.productName);
    const finalizedRecord = { ...record, packSize: masterSKU?.packSize || 1 };

    await addDoc(collection(db, 'returnRecords'), finalizedRecord);
    const totalUnits = (Number(record.quantity) || 0) * (masterSKU?.packSize || 1);
    
    // LOGIC: ONLY add to stock if it is REUSABLE (SELLABLE). 
    // If damaged/waste, we keep the history but it stays OUT of inventory.
    if (record.isReusable) {
      await updateFirestoreStock(record.productName, totalUnits, 'add', 'returned');
    }
  };

  const deleteReturnRecord = async (id) => {
    if (!id) return;
    const docId = String(id);
    const record = returnRecords.find(r => r.id === docId);
    if (record) {
      try {
        await deleteDoc(doc(db, 'returnRecords', docId));
        const totalUnits = (Number(record.quantity) || 0) * (Number(record.packSize) || 1);
        
        if (record.isReusable) {
          await updateFirestoreStock(record.productName, totalUnits, 'sub', 'returned');
        }
      } catch (err) {
        console.error("Firebase Return Delete Error:", err);
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

  // SKU Management
  const addSKU = async (sku) => {
    await addDoc(collection(db, 'stock'), {
      ...sku,
      in: 0, out: 0, damage: 0, returned: 0, physical: ''
    });
  };
  
  const updateSKU = async (id, updates) => {
    await updateDoc(doc(db, 'stock', id), updates);
  };

  const deleteSKU = async (id) => {
    await deleteDoc(doc(db, 'stock', id));
  };

  if (currentUser && loading && stock.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium tracking-wide">Syncing data...</p>
      </div>
    );
  }

  return (
    <GlobalContext.Provider value={{ 
      currentUser, logout, authLoading,
      stock, addSKU, updateSKU, deleteSKU,
      b2bShipments, addB2BShipment, deleteB2BShipment,
      b2cShipments, addB2CShipment, deleteB2CShipment,
      damageRecords, addDamageRecord, deleteDamageRecord,
      returnRecords, addReturnRecord, deleteReturnRecord,
      staff, addStaffMember, updateStaffMember, deleteStaffMember,
      channels, addChannel, updateChannel, deleteChannel,
      couriers, addCourier, updateCourier, deleteCourier
    }}>
      {children}
    </GlobalContext.Provider>
  );
};
