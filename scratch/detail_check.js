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

async function detailCheck() {
  const snap = await getDocs(collection(db, "monthlyStockData"));
  
  const w43Docs = [];
  const w42Docs = [];

  snap.forEach(d => {
    const data = d.data();
    if (data.month === "2026-W43" || d.id.startsWith("2026-W43_")) {
      w43Docs.push({ id: d.id, ...data });
    }
    if (data.month === "2026-W42" || d.id.startsWith("2026-W42_")) {
      w42Docs.push({ id: d.id, ...data });
    }
  });

  console.log(`Total 2026-W43 docs: ${w43Docs.length}`);
  console.log(`Total 2026-W42 docs: ${w42Docs.length}`);

  // Check fields in w43 docs
  const fieldSet = new Set();
  w43Docs.forEach(d => {
    Object.keys(d).forEach(k => fieldSet.add(k));
  });
  console.log("All field names in W43 docs:", Array.from(fieldSet));

  // Let's see if any W43 docs have isCorrected or fields other than physical, expected, opening, month, productId
  const specialW43 = w43Docs.filter(d => d.isCorrected || d.in || d.out || d.damage);
  console.log(`Special W43 docs count: ${specialW43.length}`);
  if (specialW43.length > 0) {
    console.log("Special W43 docs:", specialW43);
  }

  // W42 docs
  console.log("W42 docs:", w42Docs);

  process.exit(0);
}

detailCheck().catch(console.error);
