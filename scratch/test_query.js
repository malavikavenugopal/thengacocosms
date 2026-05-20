import fs from 'fs';

async function run() {
  const url = 'https://firestore.googleapis.com/v1/projects/thengacocosms/databases/(default)/documents/b2cShipments?pageSize=1000';
  console.log('Fetching B2C shipments from:', url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.documents) {
      console.log('No documents found or error:', data);
      return;
    }
    
    // Parse documents
    const shipments = data.documents.map(doc => {
      const fields = doc.fields || {};
      const id = doc.name.split('/').pop();
      
      // Parse products array
      const productsVal = fields.products?.arrayValue?.values || [];
      const products = productsVal.map(p => {
        const pFields = p.mapValue?.fields || {};
        return {
          name: pFields.name?.stringValue || '',
          quantity: Number(pFields.quantity?.stringValue || pFields.quantity?.integerValue || 0),
          packSize: Number(pFields.packSize?.stringValue || pFields.packSize?.integerValue || 1)
        };
      });
      
      return {
        id,
        date: fields.date?.stringValue || '',
        channel: fields.channel?.stringValue || '',
        products
      };
    });

    console.log(`Fetched ${shipments.length} B2C shipments.`);
    
    // Let's filter for Soap Dish in the date range 2026-04-18 to 2026-05-16
    const startDate = '2026-04-18';
    const endDate = '2026-05-16';
    const targetProduct = 'Soap Dish';
    
    console.log(`\n--- Filtering Soap Dish between ${startDate} and ${endDate} ---`);
    let totalDirect = 0;
    let totalBundle = 0;
    
    shipments.forEach(s => {
      const inRange = s.date >= startDate && s.date <= endDate;
      if (!inRange) return;
      
      s.products.forEach(p => {
        if (p.name === targetProduct) {
          const qty = p.quantity * p.packSize;
          totalDirect += qty;
          console.log(`Order ${s.date} [Direct]: Qty=${p.quantity}, Pack=${p.packSize}, Total=${qty}, Channel=${s.channel}`);
        } else {
          // Let's print bundles as well to see if any bundle contains Soap Dish
          // (We will retrieve master stock in another fetch if needed, but let's log all composite products first)
          if (p.name.toLowerCase().includes('combo') || p.name.toLowerCase().includes('bundle') || p.name.toLowerCase().includes('set')) {
            console.log(`Order ${s.date} [Potential Bundle]: ${p.name}, Qty=${p.quantity}, Pack=${p.packSize}`);
          }
        }
      });
    });
    
    console.log(`\nTotal Direct Soap Dish Units: ${totalDirect}`);
  } catch (err) {
    console.error('Error fetching or processing:', err);
  }
}

run();
