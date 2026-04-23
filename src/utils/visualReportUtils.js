import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

/**
 * Generates a colorful visual report for all modules.
 * @param {Array} shipments - Filtered data
 * @param {String} type - 'B2B', 'B2C', 'Damage', or 'QC'
 * @param {String} title - Title of the report
 * @param {Object} dateRange - { startDate, endDate }
 */
export const generateVisualReport = async (shipments, type, title, dateRange = {}) => {
  if (!shipments || shipments.length === 0) return;

  const fileName = `${type}_Report_${new Date().toISOString().split('T')[0]}`;

  // Use Image for short reports, PDF for long ones
  const limit = type === 'QC' ? 8 : 12;
  const useImage = shipments.length <= limit;

  if (useImage) {
    await downloadAsImage(shipments, type, title, fileName, dateRange);
  } else {
    downloadAsPDF(shipments, type, title, fileName, dateRange);
  }
};

const downloadAsPDF = (shipments, type, title, fileName, dateRange) => {
  const doc = new jsPDF();
  
  const themes = {
    B2B: { color: [6, 95, 70] },
    B2C: { color: [6, 95, 70] },
    Damage: { color: [6, 95, 70] },
    QC: { color: [6, 95, 70] }
  };
  const theme = themes[type] || themes.B2B;

  // Header
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(6, 78, 59); // Dark Green
  doc.text("ThengaCoco", 15, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(title, 15, 28);
  
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  let dateText = `Generated: ${new Date().toLocaleString()}`;
  if (dateRange.startDate) {
    dateText += ` | From: ${dateRange.startDate}`;
    if (dateRange.endDate) dateText += ` To: ${dateRange.endDate}`;
  }
  doc.text(dateText, 15, 35);

  let headers, body;
  if (type === 'B2B') {
    headers = [['Date', 'Client', 'Courier', 'Products', 'Total Units']];
    body = shipments.map(s => [
      s.date, s.clientName, s.courierName, 
      s.products.map(p => `${p.name} (${p.quantity})`).join('\n'),
      s.products.reduce((acc, curr) => acc + (Number(curr.quantity) * (Number(curr.packSize) || 1)), 0)
    ]);
  } else if (type === 'B2C') {
    headers = [['Date', 'Channel', 'Parceled By', 'Products', 'Total Units']];
    body = shipments.map(s => [
      s.date, s.channel, s.whoParceled, 
      s.products.map(p => `${p.name} (${p.quantity})`).join('\n'),
      s.products.reduce((acc, curr) => acc + (Number(curr.quantity) * (Number(curr.packSize) || 1)), 0)
    ]);
  } else if (type === 'Damage') {
    headers = [['Date', 'Product', 'Quantity', 'Reason', 'Recorded By']];
    body = shipments.map(s => [s.date, s.productName, s.quantity, s.reason, s.staffName]);
  } else if (type === 'QC') {
    headers = [['Date', 'Vendor', 'Product Details']];
    body = shipments.map(s => [
      s.date, s.vendorName, 
      `• ${s.productName}: C:${s.checked} R:${s.rejected || 0} D:${s.damaged}`
    ]);
  }

  autoTable(doc, {
    startY: 45,
    head: headers,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: theme.color, fontSize: 10, halign: 'center', font: 'times' },
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle', font: 'times' },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  doc.save(`${fileName}.pdf`);
};

const downloadAsImage = async (shipments, type, title, fileName, dateRange) => {
  const container = document.createElement('div');
  container.id = 'report-capture-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 Width at 96 DPI
  container.style.minHeight = '1123px'; // A4 Height
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '50px';
  container.style.fontFamily = '"Times New Roman", Times, serif';
  
  const themes = {
    B2B: { color: '#065f46' },
    B2C: { color: '#065f46' },
    Damage: { color: '#065f46' },
    QC: { color: '#065f46' }
  };
  const theme = themes[type] || themes.B2B;

  const dateFrom = dateRange.startDate ? `<span style="margin-right: 15px;"><b>From:</b> ${dateRange.startDate}</span>` : '';
  const dateTo = dateRange.endDate ? `<span><b>To:</b> ${dateRange.endDate}</span>` : '';

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 10px;">
      <img src="/logo.jpg" style="height: 60px; width: 60px; object-fit: contain;" alt="Logo" onerror="this.style.display='none'"/>
      <div style="text-align: left;">
        <h1 style="color: #064e3b; margin: 0; font-size: 16px; text-transform: uppercase; font-weight: bold;">ThengaCoco</h1>
        <h2 style="color: #334155; margin: 2px 0; font-size: 14px; font-weight: bold;">${title}</h2>
        <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
          ${dateFrom} ${dateTo}
        </div>
        <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
    
    <div style="border-bottom: 2px solid ${theme.color}; margin-bottom: 30px;"></div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background-color: ${theme.color}; color: white; text-align: left;">
          <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
          ${type === 'B2B' ? '<th style="padding: 10px; border: 1px solid #ddd;">Client</th>' : ''}
          ${type === 'B2C' ? '<th style="padding: 10px; border: 1px solid #ddd;">Channel</th>' : ''}
          ${type === 'Damage' ? '<th style="padding: 10px; border: 1px solid #ddd;">Product</th>' : ''}
          ${type === 'QC' ? '<th style="padding: 10px; border: 1px solid #ddd;">Vendor</th>' : ''}
          <th style="padding: 10px; border: 1px solid #ddd;">Details</th>
          ${type !== 'QC' ? `<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">${type === 'Damage' ? 'Qty' : 'Units'}</th>` : ''}
        </tr>
      </thead>
      <tbody>
        ${shipments.map((s, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px; border: 1px solid #ddd; white-space: nowrap;">${s.date}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
              ${type === 'B2B' ? s.clientName : type === 'B2C' ? s.channel : type === 'Damage' ? s.productName : s.vendorName}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${type === 'QC' 
                ? `• ${s.productName}: C:${s.checked} R:${s.rejected || 0} D:${s.damaged}`
                : type === 'Damage' 
                  ? `Reason: ${s.reason} (By: ${s.staffName || 'System'})`
                  : (s.products || []).map(p => `• ${p.name} (${p.quantity})`).join('<br/>')
              }
            </td>
            ${type !== 'QC' ? `
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
              ${type === 'Damage' ? s.quantity : (s.products || []).reduce((acc, curr) => acc + (Number(curr.quantity) * (Number(curr.packSize) || 1)), 0)}
            </td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div style="position: absolute; bottom: 50px; left: 50px; right: 50px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #eee; pt: 10px;">
      © ThengaCoco - Internal Inventory Report
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Capture failed", err);
    throw err; // Re-throw so UI can show error
  } finally {
    document.body.removeChild(container);
  }
};
