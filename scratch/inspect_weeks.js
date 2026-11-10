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

async function inspectData() {
  console.log("Fetching monthlyStockData...");
  const snap = await getDocs(collection(db, "monthlyStockData"));
  console.log(`Total docs in monthlyStockData: ${snap.size}`);

  const week43Docs = [];
  const week42Docs = [];
  const otherWeeks = new Set();

  snap.forEach(d => {
    const data = d.data();
    const month = data.month || "";
    if (month.includes("W43") || d.id.includes("W43")) {
      week43Docs.push({ id: d.id, ...data });
    } else if (month.includes("W42") || d.id.includes("W42")) {
      week42Docs.push({ id: d.id, ...data });
    } else {
      otherWeeks.add(month || d.id.split('_')[0]);
    }
  });

  console.log(`\nWeek 43 docs found: ${week43Docs.length}`);
  week43Docs.forEach(d => {
    console.log(`  ID: ${d.id}, month: ${d.month}, productId: ${d.productId}, physical: ${d.physical}, expected: ${d.expected}`);
  });

  console.log(`\nWeek 42 docs found: ${week42Docs.length}`);
  week42Docs.forEach(d => {
    console.log(`  ID: ${d.id}, month: ${d.month}, productId: ${d.productId}, physical: ${d.physical}, expected: ${d.expected}`);
  });

  console.log(`\nOther weeks present:`, Array.from(otherWeeks).slice(0, 15));

  // Also check expectedStockRequests
  const reqSnap = await getDocs(collection(db, "expectedStockRequests"));
  console.log(`\nTotal docs in expectedStockRequests: ${reqSnap.size}`);
  reqSnap.forEach(d => {
    const data = d.data();
    if (data.period && (data.period.includes("W43") || data.period.includes("W42"))) {
      console.log(`  Req ID: ${d.id}, period: ${data.period}, status: ${data.status}`);
    }
  });

  process.exit(0);
}

inspectData().catch(err => {
  console.error("Error inspecting data:", err);
  process.exit(1);
});
