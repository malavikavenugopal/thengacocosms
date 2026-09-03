import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
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

async function checkAndMigrate() {
  console.log("Fetching monthlyStockData...");
  const snap = await getDocs(collection(db, "monthlyStockData"));
  console.log(`Total docs in monthlyStockData: ${snap.size}`);

  const week36Docs = [];
  const week35Docs = [];

  snap.forEach(d => {
    const data = d.data();
    if (data.month === "2026-W36" || d.id.startsWith("2026-W36")) {
      week36Docs.push({ id: d.id, ...data });
    }
    if (data.month === "2026-W35" || d.id.startsWith("2026-W35")) {
      week35Docs.push({ id: d.id, ...data });
    }
  });

  console.log("Week 36 docs count:", week36Docs.length);
  console.log("Week 36 docs sample:", JSON.stringify(week36Docs.slice(0, 5), null, 2));
  console.log("Week 35 docs count:", week35Docs.length);
  console.log("Week 35 docs sample:", JSON.stringify(week35Docs.slice(0, 5), null, 2));

  if (week36Docs.length > 0) {
    console.log("\nMigrating Week 36 documents to Week 35...");
    for (const doc36 of week36Docs) {
      const productId = doc36.productId || doc36.id.replace("2026-W36_", "");
      const newId = `2026-W35_${productId}`;
      
      const newDocData = {
        ...doc36,
        month: "2026-W35",
        productId: productId
      };
      delete newDocData.id;

      console.log(`Copying doc ${doc36.id} -> ${newId} (physical stock: ${doc36.physical})`);
      await setDoc(doc(db, "monthlyStockData", newId), newDocData, { merge: true });
      
      console.log(`Deleting old doc ${doc36.id}`);
      await deleteDoc(doc(db, "monthlyStockData", doc36.id));
    }
    console.log("Migration finished successfully!");
  } else {
    console.log("No Week 36 docs found to migrate.");
  }
  process.exit(0);
}

checkAndMigrate().catch(err => {
  console.error("Error in checkAndMigrate:", err);
  process.exit(1);
});
