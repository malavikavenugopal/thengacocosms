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

async function inspectSamples() {
  const snap = await getDocs(collection(db, "monthlyStockData"));
  
  const samplesByWeek = {};
  snap.forEach(d => {
    const data = d.data();
    const m = data.month;
    if (["2026-W35", "2026-W37", "2026-W39", "2026-W43"].includes(m)) {
      if (!samplesByWeek[m]) samplesByWeek[m] = [];
      if (samplesByWeek[m].length < 3 && data.physical !== undefined && data.physical !== "") {
        samplesByWeek[m].push({ id: d.id, ...data });
      }
    }
  });

  console.log("Samples:", JSON.stringify(samplesByWeek, null, 2));
  process.exit(0);
}

inspectSamples().catch(console.error);
