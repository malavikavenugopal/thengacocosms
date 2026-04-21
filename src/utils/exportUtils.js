/**
 * Utility to export data to Excel with Styles
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file to download
 * @param {string} sheetName - Optional sheet name
 */
export const exportToExcel = (data, fileName = 'export.xls', sheetName = 'Sheet1') => {
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

  const blob = new Blob([excelFile], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace('.csv', '.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
export const exportFormattedShipments = (shipments, type = 'B2C', fileName = 'Log.xls') => {
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
  const totalColSpan = type === 'B2B' ? 9 : 7;
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
    ? ['Date', 'Client Name', 'Courier', 'Parceled By', 'Boxes', 'Product Name', 'Order Qty', 'Pack Size', 'Total Units']
    : ['Date', 'Sales Channel', 'Parceled By', 'Product Name', 'Order Qty', 'Pack Size', 'Total Units'];
  
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
      
      // Shared Shipment columns (only on first row)
      if (idx === 0) {
        tableHtml += `<td rowspan="${rowCount}">${s.date}</td>`;
        if (type === 'B2C') {
          tableHtml += `<td rowspan="${rowCount}" class="channel-badge" style="background-color: ${channelColor}">${s.channel}</td>`;
        } else {
          tableHtml += `<td rowspan="${rowCount}">${s.clientName}</td>`;
          tableHtml += `<td rowspan="${rowCount}">${s.courierName}</td>`;
        }
        tableHtml += `<td rowspan="${rowCount}">${s.whoParceled}</td>`;
        if (type === 'B2B') {
          tableHtml += `<td rowspan="${rowCount}">${s.boxes}</td>`;
        }
      }

      // Product specific columns
      const totalUnits = (Number(p.quantity) || 0) * (Number(p.packSize) || 1);
      grandTotalUnits += totalUnits;

      tableHtml += `<td class="product-name">${p.name}</td>`;
      tableHtml += `<td>${p.quantity}</td>`;
      tableHtml += `<td>${p.packSize}</td>`;
      tableHtml += `<td>${totalUnits}</td>`;
      
      tableHtml += `</tr>`;
    });
  });

  // Footer: Grand Total
  const footerColSpan = type === 'B2B' ? 8 : 6;
  tableHtml += `
    <tr>
      <td colspan="${footerColSpan}" class="grand-total text-right">GRAND TOTAL</td>
      <td class="total-value">${grandTotalUnits}</td>
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

  const blob = new Blob([excelFile], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace('.csv', '.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
