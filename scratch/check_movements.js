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

// Helper from TwoWeekStockCheck
function getIsoWeekMonday(y, w) {
  const simple = new Date(y, 0, 1 + (w - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

function getWeekStr(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

async function checkMovements() {
  const b2b = (await getDocs(collection(db, "b2bShipments"))).docs.map(d => d.data());
  const b2c = (await getDocs(collection(db, "b2cShipments"))).docs.map(d => d.data());
  const prod = (await getDocs(collection(db, "productionRecords"))).docs.map(d => d.data());

  const getWeekForDate = (dateStr) => {
    if (!dateStr) return null;
    return getWeekStr(new Date(dateStr));
  };

  const b2bW42 = b2b.filter(r => getWeekForDate(r.date || r.dispatchDate || r.createdAt) === "2026-W42");
  const b2bW43 = b2b.filter(r => getWeekForDate(r.date || r.dispatchDate || r.createdAt) === "2026-W43");

  console.log(`B2B Shipments in W42: ${b2bW42.length}, W43: ${b2bW43.length}`);

  const b2cW42 = b2c.filter(r => getWeekForDate(r.date || r.orderDate || r.createdAt) === "2026-W42");
  const b2cW43 = b2c.filter(r => getWeekForDate(r.date || r.orderDate || r.createdAt) === "2026-W43");

  console.log(`B2C Shipments in W42: ${b2cW42.length}, W43: ${b2cW43.length}`);

  const prodW42 = prod.filter(r => getWeekForDate(r.date || r.createdAt) === "2026-W42");
  const prodW43 = prod.filter(r => getWeekForDate(r.date || r.createdAt) === "2026-W43");

  console.log(`Production records in W42: ${prodW42.length}, W43: ${prodW43.length}`);

  process.exit(0);
}

checkMovements().catch(console.error);
