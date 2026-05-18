import * as XLSX from 'xlsx';

/**
 * Utility to export data to Excel with Styles
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file to download
 * @param {string} sheetName - Optional sheet name
 */
export const exportToExcel = (data, fileName = 'export.xlsx', sheetName = 'Sheet1') => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  
  // Define styles
  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
      th { 
        background-color: #4f46e5; 
        color: #ffffff; 
        font-weight: bold; 
        padding: 12px 8px; 
        border: 1px solid #e2e8f0; 
        text-align: left;
        text-transform: uppercase;
        font-size: 12px;
      }
      td { 
        padding: 8px 8px; 
        border: 1px solid #e2e8f0; 
        font-size: 13px;
        color: #1e293b;
      }
      tr:nth-child(even) { background-color: #f8fafc; }
      .number { text-align: center; }
      .total { background-color: #eef2ff; font-weight: bold; }
    </style>
  `;

  let tableHtml = `<table><thead><tr>`;
  headers.forEach(h => {
    tableHtml += `<th>${h.replace(/([A-Z])/g, ' $1').trim()}</th>`;
  });
  tableHtml += `</tr></thead><tbody>`;

  data.forEach((row, idx) => {
    tableHtml += `<tr>`;
    headers.forEach(header => {
      let val = row[header];
      const isNumber = typeof val === 'number';
      const isTotal = header.toLowerCase() === 'total';
      
      let className = isNumber ? 'number' : '';
      if (isTotal) className += ' total';

      tableHtml += `<td class="${className}">${val !== undefined ? val : ''}</td>`;
    });
    tableHtml += `</tr>`;
  });

  tableHtml += `</tbody></table>`;

  const excelFile = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${sheetName}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      ${styles}
    </head>
    <body>
      ${tableHtml}
    </body>
    </html>
  `;

  const table = document.createElement('table');
  table.innerHTML = tableHtml;
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, fileName);
};

export const exportToCSV = (data, fileName = 'export.csv') => {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(fieldName => {
        let value = row[fieldName];
        // Handle strings with commas
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        // Handle products array if present (convert to string)
        if (Array.isArray(value)) {
          value = `"${value.map(p => `${p.name} (${p.quantity})`).join('; ')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Specialized Formatted Export for B2B/B2C dispatch logs
 */
export const exportFormattedShipments = (shipments, type = 'B2C', fileName = 'Log.xlsx') => {
  if (!shipments || !shipments.length) return;

  const title = type === 'B2B' ? 'B2B SHIPMENTS — DISPATCH LOG' : 'B2C SALES — DISPATCH LOG';
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Define Channel/Client specific colors
  const getChannelColor = (name) => {
    const colors = {
      'Amazon': '#ea580c', // Orange
      'Flipkart': '#2563eb', // Blue
      'Shopify': '#10b981', // Emerald
      'Amala Earth': '#4d7c0f', // Lime/Green
      'BROWN LIVING': '#78350f', // Brown
      'Samples': '#64748b', // Slate/Gray
      'Custom': '#4f46e5' // Indigo
    };
    return colors[name] || '#14532d'; // Default Dark Green
  };

  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
      .header-main { 
        background-color: #14532d; 
        color: #ffffff; 
        font-size: 18px; 
        font-weight: bold; 
        text-align: center; 
        padding: 20px; 
        border: 1px solid #064e3b;
      }
      .header-sub {
        background-color: #f1f5f9;
        color: #64748b;
        font-size: 11px;
        text-align: center;
        font-style: italic;
        padding: 5px;
        border: 1px solid #cbd5e1;
      }
      .col-header {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        padding: 10px;
        border: 1px solid #166534;
        text-align: center;
        font-size: 12px;
      }
      td { 
        padding: 10px 8px; 
        border: 1px solid #e2e8f0; 
        font-size: 12px;
        color: #1e293b;
        text-align: center;
      }
      .channel-badge {
        color: #ffffff;
        font-weight: bold;
        text-transform: uppercase;
      }
      .product-name { text-align: left; }
      .grand-total {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        text-align: right;
        padding: 10px;
        font-size: 14px;
      }
      .total-value {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        text-align: center;
      }
    </style>
  `;

  let tableHtml = `<table>`;
  
  // Row 1: Title
  const totalColSpan = type === 'B2B' ? 11 : 8;
  tableHtml += `
    <tr>
      <th colspan="${totalColSpan}" class="header-main">${title}</th>
    </tr>
  `;

  // Row 2: Metadata
  tableHtml += `
    <tr>
      <th colspan="${totalColSpan}" class="header-sub">Generated: ${timestamp}</th>
    </tr>
  `;

  // Row 3: Headers
  const headers = type === 'B2B' 
    ? ['Packed Date', 'Dispatch Date', 'Client Name', 'Courier', 'Parceled By', 'Boxes', 'Product Name', 'Order Qty', 'Pack Size', 'Total Units', 'Item Status']
    : ['Date', 'Sales Channel', 'Orders', 'Parceled By', 'Product Name', 'Order Qty', 'Pack Size', 'Total Units'];
  
  tableHtml += `<tr>`;
  headers.forEach(h => {
    tableHtml += `<th class="col-header">${h}</th>`;
  });
  tableHtml += `</tr>`;

  // Body
  let grandTotalUnits = 0;

  shipments.forEach(s => {
    const products = s.products;
    const rowCount = products.length;
    const channelColor = getChannelColor(type === 'B2B' ? 'Custom' : s.channel);

    products.forEach((p, idx) => {
      tableHtml += `<tr>`;
      
      // Product specific packed date (only B2B)
      if (type === 'B2B') {
        tableHtml += `<td>${p.packedDate || s.date}</td>`;
      } else if (idx === 0) {
        tableHtml += `<td rowspan="${rowCount}">${s.date}</td>`;
      }

      // Shared Shipment columns (only on first row)
      if (idx === 0) {
        if (type === 'B2B') {
          tableHtml += `<td rowspan="${rowCount}">${s.dispatchDate || '-'}</td>`;
        }
        if (type === 'B2C') {
          tableHtml += `<td rowspan="${rowCount}" class="channel-badge" style="background-color: ${channelColor}">${s.channel}</td>`;
          tableHtml += `<td rowspan="${rowCount}">${s.orderCount || '1'}</td>`;
        } else {
          tableHtml += `<td rowspan="${rowCount}">${s.clientName}</td>`;
          tableHtml += `<td rowspan="${rowCount}">${s.courierName}</td>`;
        }
        tableHtml += `<td rowspan="${rowCount}">${Array.isArray(s.whoParceled) ? s.whoParceled.join(', ') : s.whoParceled}</td>`;
        if (type === 'B2B') {
          tableHtml += `<td rowspan="${rowCount}">${s.boxes}</td>`;
        }
      }

      // Product specific columns
      const effectivePackSize = Number(p.packSize) || 1;

      const totalUnits = (Number(p.quantity) || 0) * effectivePackSize;
      grandTotalUnits += totalUnits;

      tableHtml += `<td class="product-name">${p.name}</td>`;
      tableHtml += `<td>${p.quantity}</td>`;
      tableHtml += `<td>${effectivePackSize}</td>`;
      tableHtml += `<td>${totalUnits}</td>`;
      if (type === 'B2B') {
        tableHtml += `<td>${p.isPacked !== false ? 'Packed' : 'Pending'}</td>`;
      }
      
      tableHtml += `</tr>`;
    });
  });

  // Footer: Grand Total
  const footerColSpan = type === 'B2B' ? 9 : 7;
  tableHtml += `
    <tr>
      <td colspan="${footerColSpan}" class="grand-total text-right">GRAND TOTAL</td>
      <td class="total-value">${grandTotalUnits}</td>
      ${type === 'B2B' ? '<td></td>' : ''}
    </tr>
  `;

  tableHtml += `</table>`;

  const excelFile = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      ${styles}
    </head>
    <body>
      ${tableHtml}
    </body>
    </html>
  `;

  const table = document.createElement('table');
  table.innerHTML = tableHtml;
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, fileName);
};

/**
 * Specialized Formatted Export for ROP Planning
 */
export const exportFormattedROP = (products, type = 'ROP', fileName = 'ROP_Planning.xlsx') => {
  if (!products || !products.length) return;

  const title = 'REORDER POINT (ROP) PLANNING & SAFETY STOCK ANALYSIS';
  const timestamp = new Date().toISOString().split('T')[0];
  
  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
      .header-main { 
        background-color: #14532d; 
        color: #ffffff; 
        font-size: 18px; 
        font-weight: bold; 
        text-align: center; 
        padding: 20px; 
        border: 1px solid #064e3b;
      }
      .header-sub {
        background-color: #f1f5f9;
        color: #64748b;
        font-size: 11px;
        text-align: center;
        font-style: italic;
        padding: 5px;
        border: 1px solid #cbd5e1;
      }
      .col-header {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        padding: 10px;
        border: 1px solid #166534;
        text-align: center;
        font-size: 11px;
        text-transform: uppercase;
      }
      td { 
        padding: 8px 6px; 
        border: 1px solid #e2e8f0; 
        font-size: 11px;
        color: #1e293b;
        text-align: center;
      }
      .product-name { text-align: left; font-weight: bold; }
      .rop-active { background-color: #eef2ff; color: #4f46e5; font-weight: bold; }
      .low-stock { color: #e11d48; font-weight: bold; background-color: #fff1f2; }
      .healthy { color: #059669; font-weight: bold; }
      .shortage-badge { background-color: #e11d48; color: #ffffff; font-weight: bold; }
    </style>
  `;

  let tableHtml = `<table>`;
  
  // Row 1: Title
  tableHtml += `
    <tr>
      <th colspan="21" class="header-main">${title}</th>
    </tr>
  `;

  // Row 2: Metadata
  tableHtml += `
    <tr>
      <th colspan="21" class="header-sub">Generated: ${timestamp}</th>
    </tr>
  `;

  // Row 3: Headers
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const headers = [
    'Product / SKU', 
    ...months,
    'LT', 'SS', 'ROP 1 (J-J)', 'ROP 2 (J-D)', 
    'Current Stock', 'Status', 'Shortage'
  ];
  
  tableHtml += `<tr>`;
  headers.forEach(h => {
    tableHtml += `<th class="col-header">${h}</th>`;
  });
  tableHtml += `</tr>`;

  // Body: passed products already have required calculated fields from the component
  products.forEach(p => {
    tableHtml += `<tr>`;
    tableHtml += `<td class="product-name">${p.name} (${p.sku || 'N/A'})</td>`;
    
    // Monthly columns
    p.monthly.forEach(m => {
      tableHtml += `<td>${m > 0 ? m : '-'}</td>`;
    });

    // Strategy columns
    tableHtml += `<td>${p.leadTime || 0}</td>`;
    tableHtml += `<td>${p.safetyStock || 0}</td>`;
    tableHtml += `<td class="${p.isFirstHalf ? 'rop-active' : ''}">${p.ropJanJun || 0}</td>`;
    tableHtml += `<td class="${!p.isFirstHalf ? 'rop-active' : ''}">${p.ropJulDec || 0}</td>`;
    
    // Status columns
    tableHtml += `<td class="${p.isLow ? 'low-stock' : 'healthy'}">${p.totalStock}</td>`;
    tableHtml += `<td class="${p.isLow ? 'low-stock' : 'healthy'}">${p.isLow ? 'ORDER NOW' : 'HEALTHY'}</td>`;
    tableHtml += `<td class="${p.shortageAmt > 0 ? 'shortage-badge' : ''}">${p.shortageAmt > 0 ? `+${p.shortageAmt}` : '-'}</td>`;
    
    tableHtml += `</tr>`;
  });

  tableHtml += `</table>`;

  const excelFile = `
    <html>
    <head><meta charset="UTF-8">${styles}</head>
    <body>${tableHtml}</body>
    </html>
  `;

  const table = document.createElement('table');
  table.innerHTML = tableHtml;
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, fileName);
};

/**
 * Specialized Formatted Export for Monthly Stock Check
 */
export const exportFormattedStockCheck = (data, period, fileName = 'Stock_Check.xlsx', analytics = null) => {
  if (!data || !data.length) return;

  const isWeekly = period.includes('-W');
  const title = `${isWeekly ? 'WEEKLY' : 'MONTHLY'} INVENTORY RECONCILIATION — ${period.toUpperCase()}`;
  const timestamp = new Date().toISOString().split('T')[0];
  
  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
      .header-main { 
        background-color: #14532d; 
        color: #ffffff; 
        font-size: 18px; 
        font-weight: bold; 
        text-align: center; 
        padding: 20px; 
        border: 1px solid #064e3b;
      }
      .header-sub {
        background-color: #f1f5f9;
        color: #64748b;
        font-size: 11px;
        text-align: center;
        font-style: italic;
        padding: 5px;
        border: 1px solid #cbd5e1;
      }
      .col-header {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        padding: 10px;
        border: 1px solid #166534;
        text-align: center;
        font-size: 11px;
        text-transform: uppercase;
      }
      td { 
        padding: 8px 6px; 
        border: 1px solid #e2e8f0; 
        font-size: 11px;
        color: #1e293b;
        text-align: center;
      }
      .product-name { text-align: left; font-weight: bold; }
      .diff-pos { background-color: #fef3c7; color: #92400e; font-weight: bold; }
      .diff-neg { background-color: #fee2e2; color: #b91c1c; font-weight: bold; }
      .diff-match { background-color: #ecfdf5; color: #065f46; font-weight: bold; }
      .num-bold { font-weight: bold; }
      .expected-col { background-color: #f8fafc; color: #1e293b; font-weight: bold; }
    </style>
  `;

  let tableHtml = `<table>`;
  
  // Row 1: Title
  tableHtml += `
    <tr>
      <th colspan="16" class="header-main">${title}</th>
    </tr>
  `;

  // Row 2: Metadata
  tableHtml += `
    <tr>
      <th colspan="16" class="header-sub">Generated: ${timestamp}</th>
    </tr>
  `;

  if (analytics) {
    const maxLen = Math.max(analytics.perfectMatch.length, analytics.highDifference.length, analytics.notAudited.length);
    
    tableHtml += `
      <tr><th colspan="16" style="height: 20px; border: none;"></th></tr>
      <tr>
        <th colspan="16" style="background-color: #f8fafc; color: #334155; font-size: 14px; padding: 10px; text-align: center; border: 1px solid #cbd5e1;">📊 ANALYTICS DASHBOARD</th>
      </tr>
      <tr>
        <th colspan="5" style="background-color: #ecfdf5; color: #065f46; font-weight: bold; border: 1px solid #10b981; text-align: center;">✅ ACCURATE STOCK (${analytics.perfectMatch.length})</th>
        <th colspan="1" style="background-color: #ffffff; border: none;"></th>
        <th colspan="5" style="background-color: #fff1f2; color: #e11d48; font-weight: bold; border: 1px solid #f43f5e; text-align: center;">⚠️ HIGH DISCREPANCY (${analytics.highDifference.length})</th>
        <th colspan="1" style="background-color: #ffffff; border: none;"></th>
        <th colspan="4" style="background-color: #fffbeb; color: #b45309; font-weight: bold; border: 1px solid #f59e0b; text-align: center;">⏳ PENDING AUDIT (${analytics.notAudited.length})</th>
      </tr>
      <tr>
        <td colspan="5" style="background-color: #ecfdf5; color: #047857; text-align: center; border: 1px solid #10b981; font-size: 10px;">Products with no difference</td>
        <td colspan="1" style="border: none;"></td>
        <td colspan="5" style="background-color: #fff1f2; color: #be123c; text-align: center; border: 1px solid #f43f5e; font-size: 10px;">Largest stock differences</td>
        <td colspan="1" style="border: none;"></td>
        <td colspan="4" style="background-color: #fffbeb; color: #92400e; text-align: center; border: 1px solid #f59e0b; font-size: 10px;">Missing physical count</td>
      </tr>
    `;

    for (let i = 0; i < maxLen; i++) {
      const pm = analytics.perfectMatch[i];
      const hd = analytics.highDifference[i];
      const na = analytics.notAudited[i];
      
      tableHtml += `<tr>`;
      // Accurate
      if (pm) {
        tableHtml += `<td colspan="5" style="border: 1px solid #a7f3d0; background-color: #ffffff; text-align: left;">${pm.name} (${pm.sku || '-'})</td>`;
      } else {
        tableHtml += `<td colspan="5" style="border: 1px solid #a7f3d0; background-color: #ffffff;"></td>`;
      }
      
      tableHtml += `<td colspan="1" style="border: none;"></td>`;
      
      // Discrepancy
      if (hd) {
        tableHtml += `<td colspan="4" style="border: 1px solid #fecdd3; border-right: none; background-color: #ffffff; text-align: left;">${hd.item.name} (${hd.item.sku || '-'})</td>`;
        tableHtml += `<td colspan="1" style="border: 1px solid #fecdd3; border-left: none; background-color: #ffffff; font-weight: bold; text-align: right; color: ${hd.diff < 0 ? '#e11d48' : '#d97706'}">${hd.diff > 0 ? '+'+hd.diff : hd.diff}</td>`;
      } else {
        tableHtml += `<td colspan="5" style="border: 1px solid #fecdd3; background-color: #ffffff;"></td>`;
      }
      
      tableHtml += `<td colspan="1" style="border: none;"></td>`;

      // Pending
      if (na) {
        tableHtml += `<td colspan="4" style="border: 1px solid #fde68a; background-color: #ffffff; text-align: left;">${na.name} (${na.sku || '-'})</td>`;
      } else {
        tableHtml += `<td colspan="4" style="border: 1px solid #fde68a; background-color: #ffffff;"></td>`;
      }
      tableHtml += `</tr>`;
    }

    tableHtml += `<tr><th colspan="16" style="height: 30px; border: none;"></th></tr>`;
  }

  // Row 3: Headers
  const headers = [
    'SKU Code', 'SKU Name', 'Period', 'Opening', 'Stock In', 'Returns', 'Out', 'Packed', 'Dispatched', 'Replacement', 'Damage', 'Rejected', 'Used', 'Expected', 'Physical', 'Difference'
  ];
  
  tableHtml += `<tr>`;
  headers.forEach(h => {
    tableHtml += `<th class="col-header">${h}</th>`;
  });
  tableHtml += `</tr>`;

  // Body
  data.forEach(row => {
    let diff = row.Difference;
    if (diff === undefined) {
      diff = (Number(row.Physical || 0) - Number(row.Expected || 0));
    }
    let diffClass = 'diff-match';
    if (diff === 'N/A') diffClass = 'diff-match';
    else if (Number(diff) < 0) diffClass = 'diff-neg';
    else if (Number(diff) > 0) diffClass = 'diff-pos';

    tableHtml += `<tr>`;
    tableHtml += `<td>${row.SKU || row.SKU_Code || '-'}</td>`;
    tableHtml += `<td class="product-name">${row.Name || row.SKU_Name}</td>`;
    tableHtml += `<td>${row.Period || period}</td>`;
    tableHtml += `<td>${row.Opening || 0}</td>`;
    tableHtml += `<td>${row['Stock In'] || row.StockIn || 0}</td>`;
    tableHtml += `<td>${row.Returns || 0}</td>`;
    tableHtml += `<td>${row.Dispatch || row.Out || 0}</td>`;
    tableHtml += `<td>${row.Packed || 0}</td>`;
    tableHtml += `<td>${row.Dispatched || 0}</td>`;
    tableHtml += `<td>${row.Replacement || 0}</td>`;
    tableHtml += `<td>${row.Damage || 0}</td>`;
    tableHtml += `<td>${row.Rejected || 0}</td>`;
    tableHtml += `<td>${row.Used || 0}</td>`;
    tableHtml += `<td class="expected-col">${row.Expected || 0}</td>`;
    tableHtml += `<td class="num-bold">${row.Physical !== undefined ? row.Physical : 0}</td>`;
    let diffText = diff;
    if (diff !== 'N/A' && Number(diff) > 0) diffText = `+${diff}`;
    tableHtml += `<td class="${diffClass}">${diffText}</td>`;
    tableHtml += `</tr>`;
  });

  tableHtml += `</table>`;

  const table = document.createElement('table');
  table.innerHTML = tableHtml;
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, fileName);
};

/**
 * Generic Formatted Export for all other reports
 */
export const exportFormattedGeneric = (data, titleSuffix = 'REPORT', fileName = 'Report.xlsx') => {
  if (!data || !data.length) return;

  const title = titleSuffix.toUpperCase();
  const timestamp = new Date().toISOString().split('T')[0];
  const headers = Object.keys(data[0]);
  
  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
      .header-main { 
        background-color: #14532d; 
        color: #ffffff; 
        font-size: 18px; 
        font-weight: bold; 
        text-align: center; 
        padding: 20px; 
        border: 1px solid #064e3b;
      }
      .header-sub {
        background-color: #f1f5f9;
        color: #64748b;
        font-size: 11px;
        text-align: center;
        font-style: italic;
        padding: 5px;
        border: 1px solid #cbd5e1;
      }
      .col-header {
        background-color: #14532d;
        color: #ffffff;
        font-weight: bold;
        padding: 10px;
        border: 1px solid #166534;
        text-align: center;
        font-size: 11px;
        text-transform: uppercase;
      }
      td { 
        padding: 10px 8px; 
        border: 1px solid #e2e8f0; 
        font-size: 11px;
        color: #101827;
        text-align: center;
      }
      .text-left { text-align: left; }
      .num-bold { font-weight: bold; }
    </style>
  `;

  let tableHtml = `<table>`;
  
  // Row 1: Title
  tableHtml += `
    <tr>
      <th colspan="${headers.length}" class="header-main">${title}</th>
    </tr>
  `;

  // Row 2: Metadata
  tableHtml += `
    <tr>
      <th colspan="${headers.length}" class="header-sub">Generated: ${timestamp}</th>
    </tr>
  `;

  // Row 3: Headers
  tableHtml += `<tr>`;
  headers.forEach(h => {
    tableHtml += `<th class="col-header">${h.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}</th>`;
  });
  tableHtml += `</tr>`;

  // Body
  data.forEach(row => {
    tableHtml += `<tr>`;
    headers.forEach(h => {
      const val = row[h];
      const isNum = typeof val === 'number';
      const isLarge = isNum && val > 0;
      tableHtml += `<td class="${!isNum ? 'text-left' : ''} ${isLarge ? 'num-bold' : ''}">${val !== undefined ? val : '-'}</td>`;
    });
    tableHtml += `</tr>`;
  });

  tableHtml += `</table>`;

  const excelFile = `
    <html>
    <head><meta charset="UTF-8">${styles}</head>
    <body>${tableHtml}</body>
    </html>
  `;

  const table = document.createElement('table');
  table.innerHTML = tableHtml;
  const wb = XLSX.utils.table_to_book(table);
  XLSX.writeFile(wb, fileName);
};
