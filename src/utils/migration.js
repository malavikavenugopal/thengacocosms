import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const COLLECTIONS = [
  'stock',
  'b2bShipments',
  'b2cShipments',
  'damageRecords',
  'returnRecords',
  'staff',
  'channels',
  'couriers'
];

export const migrateLocalStorageToFirebase = async () => {
  let migratedCount = 0;
  let skippedCount = 0;
  let errors = [];

  const toastId = toast.loading('Starting migration from LocalStorage...');

  try {
    for (const key of COLLECTIONS) {
      const localData = localStorage.getItem(key);
      if (!localData) continue;

      let items;
      try {
        items = JSON.parse(localData);
      } catch (e) {
        console.error(`Failed to parse data for ${key}:`, e);
        errors.push(`Invalid JSON in ${key}`);
        continue;
      }

      if (!Array.isArray(items)) {
        console.warn(`Data for ${key} is not an array, skipping.`);
        continue;
      }

      toast.loading(`Migrating ${items.length} items for ${key}...`, { id: toastId });

      for (const item of items) {
        try {
          // Remove ID if it exists to let Firebase generate a new one, 
          // or keep it if we want to preserve exactly. 
          // Usually, for migration, we want to avoid duplicates.
          // A simple check: if we can find a unique field, use it.
          
          let dataToUpload = { ...item };
          const { id, ...cleanedData } = dataToUpload;
          dataToUpload = cleanedData;

          // Add default fields for stock if missing
          if (key === 'stock') {
            dataToUpload = {
              in: 0, out: 0, damage: 0, returned: 0, physical: '',
              ...dataToUpload
            };
          }
          
          // Simple duplicate check for master data like staff, channels, couriers
          if (['staff', 'channels', 'couriers', 'stock'].includes(key)) {
            const field = 'name';
            const q = query(collection(db, key), where(field, '==', dataToUpload[field]));
            const existing = await getDocs(q);
            if (!existing.empty) {
              skippedCount++;
              continue;
            }
          }

          await addDoc(collection(db, key), dataToUpload);
          migratedCount++;
        } catch (itemErr) {
          console.error(`Error migrating item in ${key}:`, itemErr);
          errors.push(`Error in ${key}: ${itemErr.message}`);
        }
      }
    }

    if (migratedCount > 0) {
      toast.success(`Successfully migrated ${migratedCount} items! ${skippedCount} items skipped (duplicates).`, { id: toastId });
      // We don't clear localStorage automatically to be safe, but we could.
      // localStorage.clear(); 
    } else if (skippedCount > 0) {
      toast.success(`Migration complete. No new items found (${skippedCount} duplicates skipped).`, { id: toastId });
    } else {
      toast.error('No local data found to migrate.', { id: toastId });
    }

    return { success: true, migratedCount, skippedCount, errors };
  } catch (err) {
    console.error('Migration failed:', err);
    toast.error('Migration failed: ' + err.message, { id: toastId });
    return { success: false, error: err.message };
  }
};
