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

async function simulateChains() {
  const stock = (await getDocs(collection(db, "stock"))).docs.map(d => ({ ...d.data(), id: d.id }));
  const monthlyStockData = (await getDocs(collection(db, "monthlyStockData"))).docs.map(d => ({ ...d.data(), id: d.id }));
  
  // Look at 2026-W43 docs
  const w43Docs = monthlyStockData.filter(d => d.month === "2026-W43");
  console.log(`Found ${w43Docs.length} docs in 2026-W43`);

  // Let's check some items: product name, opening, expected in W43 doc
  const sampleItems = stock.filter(s => !s.isComposite).slice(0, 5);
  for (const s of sampleItems) {
    const doc43 = w43Docs.find(d => d.productId === s.id);
    console.log(`Product: ${s.name} (${s.sku || s.id})`);
    console.log(`  Initial Stock openingStock: ${s.openingStock}`);
    if (doc43) {
      console.log(`  W43 doc: opening=${doc43.opening}, expected=${doc43.expected}, physical=${doc43.physical}`);
    }
  }

  process.exit(0);
}

simulateChains().catch(console.error);
