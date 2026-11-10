import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const envPath = "./.env";
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, '');
    envVars[key] = val;
  }
});

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID,
  measurementId: envVars.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

const getWeekStr = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const getPeriodSequence = (startPeriod, endPeriod) => {
  const seq = [];
  let curr = startPeriod;
  let safety = 0;
  while (curr <= endPeriod && safety < 100) {
    seq.push(curr);
    if (curr === endPeriod) break;
    const [y, w] = curr.split('-W').map(Number);
    const d = getIsoWeekMonday(y, w);
    d.setDate(d.getDate() + 7);
    curr = getWeekStr(d);
    safety++;
  }
  return seq;
};

const calculateExpected = (opening, legacyIn, purchased, produced, returned, out, replacement, damage, rejected, used, qcAccepted) => {
  return Number(opening || 0) + 
    Number(legacyIn || 0) + 
    Number(purchased || 0) + 
    Number(produced || 0) + 
    Number(qcAccepted || 0) + 
    Number(returned || 0) - 
    Number(out || 0) - 
    Number(replacement || 0) - 
    Number(damage || 0) - 
    Number(rejected || 0) - 
    Number(used || 0);
};

async function testChain() {
  const stock = (await getDocs(collection(db, "stock"))).docs.map(d => ({ ...d.data(), id: d.id }));
  const monthlyStockData = (await getDocs(collection(db, "monthlyStockData"))).docs.map(d => ({ ...d.data(), id: d.id }));
  const expectedStockRequests = (await getDocs(collection(db, "expectedStockRequests"))).docs.map(d => ({ ...d.data(), id: d.id }));

  const b2bShipments = (await getDocs(collection(db, "b2bShipments"))).docs.map(d => d.data());
  const b2cShipments = (await getDocs(collection(db, "b2cShipments"))).docs.map(d => d.data());
  const damageRecords = (await getDocs(collection(db, "damageRecords"))).docs.map(d => d.data());
  const returnRecords = (await getDocs(collection(db, "returnRecords"))).docs.map(d => d.data());
  const qcRecords = (await getDocs(collection(db, "qcRecords"))).docs.map(d => d.data());
  const purchaseRecords = (await getDocs(collection(db, "purchaseRecords"))).docs.map(d => d.data());
  const replacementRecords = (await getDocs(collection(db, "replacementRecords"))).docs.map(d => d.data());
  const productionRecords = (await getDocs(collection(db, "productionRecords"))).docs.map(d => d.data());
  const reworkRecords = (await getDocs(collection(db, "reworkRecords"))).docs.map(d => d.data());

  const getWeekForDate = (dateStr) => {
    if (!dateStr) return null;
    return getWeekStr(new Date(dateStr));
  };

  const getMovementsForWeek = (wStr) => {
    const movements = {};
    stock.forEach(item => {
      movements[item.id] = {
        out: 0, stockDeduction: 0, returned: 0, damage: 0, rejected: 0,
        replacement: 0, purchased: 0, produced: 0, used: 0, qcAcceptedOrPurchase: 0
      };
    });

    b2bShipments.forEach(s => {
      if (getWeekForDate(s.dispatchDate || s.createdAt || s.date) === wStr) {
        if (s.items && Array.isArray(s.items)) {
          s.items.forEach(it => {
            if (it.productId && movements[it.productId]) {
              movements[it.productId].out += Number(it.quantity || 0);
              movements[it.productId].stockDeduction += Number(it.quantity || 0);
            }
          });
        }
      }
    });

    b2cShipments.forEach(s => {
      if (getWeekForDate(s.orderDate || s.createdAt || s.date) === wStr) {
        if (s.items && Array.isArray(s.items)) {
          s.items.forEach(it => {
            if (it.productId && movements[it.productId]) {
              movements[it.productId].out += Number(it.quantity || 0);
              movements[it.productId].stockDeduction += Number(it.quantity || 0);
            }
          });
        }
      }
    });

    damageRecords.forEach(d => {
      if (getWeekForDate(d.date || d.createdAt) === wStr && d.productId && movements[d.productId]) {
        movements[d.productId].damage += Number(d.quantity || 0);
      }
    });

    returnRecords.forEach(r => {
      if (getWeekForDate(r.date || r.createdAt) === wStr && r.productId && movements[r.productId]) {
        movements[r.productId].returned += Number(r.quantity || 0);
      }
    });

    qcRecords.forEach(q => {
      if (getWeekForDate(q.date || q.createdAt) === wStr && q.productId && movements[q.productId]) {
        movements[q.productId].qcAcceptedOrPurchase += Number(q.accepted || 0);
        movements[q.productId].rejected += Number(q.rejected || 0);
      }
    });

    purchaseRecords.forEach(p => {
      if (getWeekForDate(p.date || p.createdAt) === wStr && p.productId && movements[p.productId]) {
        movements[p.productId].purchased += Number(p.quantity || 0);
      }
    });

    replacementRecords.forEach(rep => {
      if (getWeekForDate(rep.date || rep.createdAt) === wStr && rep.productId && movements[rep.productId]) {
        movements[rep.productId].replacement += Number(rep.quantity || 0);
      }
    });

    productionRecords.forEach(pr => {
      if (getWeekForDate(pr.date || pr.createdAt) === wStr && pr.productId && movements[pr.productId]) {
        movements[pr.productId].produced += Number(pr.quantity || 0);
      }
    });

    return movements;
  };

  const periodList = getPeriodSequence("2026-W35", "2026-W43");
  console.log("Period list:", periodList);

  const monthlyDataMap = {};
  monthlyStockData.forEach(d => {
    if (d.month && d.productId) {
      monthlyDataMap[`${d.month}_${d.productId}`] = d;
    }
  });

  const approvedReqMap = {};
  expectedStockRequests.forEach(r => {
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
        opening = Number(item?.openingStock) || 0;
      }

      let expected;
      if (approvedExpected !== undefined) {
        expected = approvedExpected;
      } else if (doc?.isCorrected && doc?.expected !== undefined && doc?.expected !== '') {
        expected = Number(doc.expected);
      } else {
        const m = mData[item.id] || {};
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
      chains[item.id][pStr] = { opening, expected };
    }
  }

  // Check candle product (oNM1HrCBKVirsjU6D13o) in W42 and W43
  const candle = chains["oNM1HrCBKVirsjU6D13o"];
  console.log("Candle (oNM1HrCBKVirsjU6D13o) chains:", candle);

  const shaker = chains["24SPctjzaeb6Ohx1ncDc"];
  console.log("Shaker (24SPctjzaeb6Ohx1ncDc) chains:", shaker);

  process.exit(0);
}

testChain().catch(console.error);
