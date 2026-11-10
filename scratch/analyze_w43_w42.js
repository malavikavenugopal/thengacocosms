import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
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

async function analyze() {
  const snap = await getDocs(collection(db, "monthlyStockData"));
  
  const w43Docs = [];
  const w42Docs = [];

  snap.forEach(d => {
    const data = d.data();
    const month = data.month;
    const isW43 = month === "2026-W43" || d.id.startsWith("2026-W43_");
    const isW42 = month === "2026-W42" || d.id.startsWith("2026-W42_");

    if (isW43) {
      w43Docs.push({ id: d.id, ...data });
    }
    if (isW42) {
      w42Docs.push({ id: d.id, ...data });
    }
  });

  console.log(`=== WEEK 43 DOCS (Count: ${w43Docs.length}) ===`);
  const w43WithPhysical = w43Docs.filter(d => d.physical !== undefined && d.physical !== "" && d.physical !== null);
  console.log(`Docs with physical stock entered: ${w43WithPhysical.length}`);
  w43WithPhysical.forEach(d => {
    console.log(`  [W43] ID: ${d.id} | Product: ${d.productId} | Physical: ${d.physical} | Expected: ${d.expected}`);
  });

  console.log(`\n=== WEEK 42 DOCS (Count: ${w42Docs.length}) ===`);
  const w42WithPhysical = w42Docs.filter(d => d.physical !== undefined && d.physical !== "" && d.physical !== null);
  console.log(`Docs with physical stock entered: ${w42WithPhysical.length}`);
  w42Docs.forEach(d => {
    console.log(`  [W42] ID: ${d.id} | Product: ${d.productId} | Physical: ${d.physical} | Expected: ${d.expected}`);
  });

  // Check expected stock request for W43
  const reqSnap = await getDocs(collection(db, "expectedStockRequests"));
  console.log(`\n=== EXPECTED STOCK REQUESTS ===`);
  reqSnap.forEach(d => {
    const data = d.data();
    if (data.period === "2026-W43" || data.period === "2026-W42") {
      console.log(`  ID: ${d.id} | Period: ${data.period} | Status: ${data.status} | Items: ${data.items ? data.items.length : 0}`);
    }
  });

  process.exit(0);
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
