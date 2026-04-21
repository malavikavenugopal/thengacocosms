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
