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

async function checkNonPhysical() {
  const snap = await getDocs(collection(db, "monthlyStockData"));
  const w43 = [];
  snap.forEach(d => {
    if (d.data().month === "2026-W43" || d.id.startsWith("2026-W43_")) {
      w43.push({ id: d.id, ...d.data() });
    }
  });

  const withoutPhysical = w43.filter(d => d.physical === undefined || d.physical === "" || d.physical === null);
  console.log(`W43 total: ${w43.length}, without physical: ${withoutPhysical.length}`);
  console.log("Sample without physical (first 5):", JSON.stringify(withoutPhysical.slice(0, 5), null, 2));

  process.exit(0);
}

checkNonPhysical().catch(console.error);
