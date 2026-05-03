
import React from 'react';
import { db } from './src/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function analyze() {
  const b2cSnap = await getDocs(collection(db, 'b2cShipments'));
  const b2bSnap = await getDocs(collection(db, 'b2bShipments'));
  const stockSnap = await getDocs(collection(db, 'stock'));
  
  const b2c = b2cSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const b2b = b2bSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const stock = stockSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  
  const targetProduct = "Coconut Wood Spoon";
  const targetWeek = "2026-W18"; // Assuming this is the week in the screenshot based on today's date in metadata
  
  const getWeekStr = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const temp = new Date(d);
    temp.setDate(temp.getDate() + 1);
    const dateForCalc = temp;
    dateForCalc.setDate(dateForCalc.getDate() + 4 - (dateForCalc.getDay() || 7));
    const year = dateForCalc.getFullYear();
    const week = Math.ceil((((dateForCalc - new Date(year, 0, 1)) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  console.log(`Analyzing ${targetProduct} for week ${targetWeek}...`);
  
  let b2cTotal = 0;
  b2c.forEach(s => {
    if (getWeekStr(s.date) === targetWeek) {
      s.products.forEach(p => {
        const qty = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
        if (p.name === targetProduct) {
          b2cTotal += qty;
          console.log(`  B2C Order: ${s.date}, Channel: ${s.channel}, Qty: ${p.quantity}, Pack: ${p.packSize}, Total: ${qty}`);
        } else {
          const bundle = stock.find(item => item.name === p.name);
          if (bundle?.isComposite && bundle.components) {
            const comp = bundle.components.find(c => c.name === targetProduct);
            if (comp) {
              const compQty = qty * (Number(comp.quantity) || 1);
              b2cTotal += compQty;
              console.log(`  B2C Bundle: ${s.date}, Bundle: ${p.name}, Qty: ${p.quantity}, CompQty: ${compQty}`);
            }
          }
        }
      });
    }
  });
  
  console.log(`Total B2C for ${targetProduct}: ${b2cTotal}`);
}
