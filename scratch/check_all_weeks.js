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

async function checkWeeks() {
  const snap = await getDocs(collection(db, "monthlyStockData"));
  const weekCounts = {};
  const weekPhysicalCounts = {};

  snap.forEach(d => {
    const data = d.data();
    const month = data.month || (d.id.includes("_") ? d.id.split("_")[0] : "unknown");
    weekCounts[month] = (weekCounts[month] || 0) + 1;
    if (data.physical !== undefined && data.physical !== "" && data.physical !== null) {
      weekPhysicalCounts[month] = (weekPhysicalCounts[month] || 0) + 1;
    }
  });

  console.log("Week summary (totalDocs / withPhysical):");
  Object.keys(weekCounts).sort().forEach(w => {
    console.log(`  ${w}: ${weekCounts[w]} docs (${weekPhysicalCounts[w] || 0} with physical)`);
  });

  process.exit(0);
}

checkWeeks().catch(console.error);
