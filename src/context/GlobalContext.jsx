import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from './firebase';
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
  const [loading, setLoading] = useState(true);

  // Real-time Listeners
  useEffect(() => {
    const unsubStock = onSnapshot(collection(db, 'stock'), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubB2B = onSnapshot(query(collection(db, 'b2bShipments'), orderBy('date', 'desc')), (snapshot) => {
      setB2bShipments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubB2C = onSnapshot(query(collection(db, 'b2cShipments'), orderBy('date', 'desc')), (snapshot) => {
      setB2cShipments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDamage = onSnapshot(query(collection(db, 'damageRecords'), orderBy('date', 'desc')), (snapshot) => {
      setDamageRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubReturns = onSnapshot(query(collection(db, 'returnRecords'), orderBy('date', 'desc')), (snapshot) => {
      setReturnRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubChannels = onSnapshot(collection(db, 'channels'), (snapshot) => {
      setChannels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCouriers = onSnapshot(collection(db, 'couriers'), (snapshot) => {
      setCouriers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubStock(); unsubB2B(); unsubB2C(); unsubDamage(); 
      unsubReturns(); unsubStaff(); unsubChannels(); unsubCouriers();
    };
  }, []);

  // API Methods
  const updateFirestoreStock = async (productName, quantity, operation = 'add', type = 'out') => {
    const sku = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());
    if (sku) {
      const skuRef = doc(db, 'stock', sku.id);
      const qty = Number(quantity) || 0;
      const currentVal = Number(sku[type]) || 0;
      const newVal = operation === 'add' ? currentVal + qty : Math.max(0, currentVal - qty);
      await updateDoc(skuRef, { [type]: newVal });
    }
  };

  const addB2BShipment = async (shipment) => {
    await addDoc(collection(db, 'b2bShipments'), shipment);
    for (const p of shipment.products) {
      await updateFirestoreStock(p.name, p.quantity, 'add', 'out');
    }
  };

  const deleteB2BShipment = async (id) => {
    const shipment = b2bShipments.find(s => s.id === id);
    if (shipment) {
      await deleteDoc(doc(db, 'b2bShipments', id));
      for (const p of shipment.products) {
        await updateFirestoreStock(p.name, p.quantity, 'sub', 'out');
      }
    }
  };

  const addB2CShipment = async (shipment) => {
    await addDoc(collection(db, 'b2cShipments'), shipment);
    for (const p of shipment.products) {
      await updateFirestoreStock(p.name, p.quantity, 'add', 'out');
    }
  };

  const deleteB2CShipment = async (id) => {
    const shipment = b2cShipments.find(s => s.id === id);
    if (shipment) {
      await deleteDoc(doc(db, 'b2cShipments', id));
      for (const p of shipment.products) {
        await updateFirestoreStock(p.name, p.quantity, 'sub', 'out');
      }
    }
  };

  const addDamageRecord = async (record) => {
    await addDoc(collection(db, 'damageRecords'), record);
    await updateFirestoreStock(record.productName, record.quantity, 'add', 'damage');
  };

  const deleteDamageRecord = async (id) => {
    const record = damageRecords.find(r => r.id === id);
    if (record) {
      await deleteDoc(doc(db, 'damageRecords', id));
      await updateFirestoreStock(record.productName, record.quantity, 'sub', 'damage');
    }
  };

  const addReturnRecord = async (record) => {
    await addDoc(collection(db, 'returnRecords'), record);
    await updateFirestoreStock(record.productName, record.quantity, 'add', 'returned');
  };

  const deleteReturnRecord = async (id) => {
    const record = returnRecords.find(r => r.id === id);
    if (record) {
      await deleteDoc(doc(db, 'returnRecords', id));
      await updateFirestoreStock(record.productName, record.quantity, 'sub', 'returned');
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

  if (loading && stock.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium">Connecting to Cloud Storage...</p>
      </div>
    );
  }

  return (
    <GlobalContext.Provider value={{ 
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
