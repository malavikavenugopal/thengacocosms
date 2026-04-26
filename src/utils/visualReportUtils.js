import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

/**
 * Generates a colorful visual report for all modules.
 * @param {Array} shipments - Filtered data
 * @param {String} type - 'B2B', 'B2C', 'Damage', 'QC', 'Return', or 'Replacement'
 * @param {String} title - Title of the report
 * @param {Object} dateRange - { startDate, endDate }
 */
export const generateVisualReport = async (shipments, type, title, dateRange = {}) => {
  if (!shipments || shipments.length === 0) return;

  const fileName = `${type}_Report_${new Date().toISOString().split('T')[0]}`;

  // Count total product rows to decide between Image and PDF
  const totalRows = shipments.reduce((acc, s) => acc + (s.products?.length || 1), 0);
  const useImage = totalRows <= 10; // Keep images short and crisp

  if (useImage) {
    await downloadAsImage(shipments, type, title, fileName, dateRange);
  } else {
    await downloadAsPDF(shipments, type, title, fileName, dateRange);
  }
};

const downloadAsPDF = async (shipments, type, title, fileName, dateRange) => {
  const doc = new jsPDF();
  
  const themes = {
    B2B: { color: [6, 95, 70] },
    B2C: { color: [6, 95, 70] },
    Damage: { color: [6, 95, 70] },
    QC: { color: [6, 95, 70] },
    Return: { color: [6, 95, 70] },
    Replacement: { color: [6, 95, 70] }
  };
  const theme = themes[type] || themes.B2B;

  // Header
  try {
    const logoBase64 = await getProxyImageBase64('/logo.jpg');
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', 15, 10, 15, 15);
    }
  } catch (e) {
    console.warn("Could not add logo to PDF", e);
  }

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(6, 78, 59); // Dark Green
  doc.text("ThengaCoco", 35, 18);
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(title, 35, 26);
  
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  let dateText = `Generated: ${new Date().toLocaleString()}`;
  if (dateRange.startDate) {
    dateText += ` | From: ${dateRange.startDate}`;
    if (dateRange.endDate) dateText += ` To: ${dateRange.endDate}`;
  }
  doc.text(dateText, 35, 33);

  let headers, body = [];
  if (type === 'B2B' || type === 'B2C') {
    headers = [['Date', type === 'B2B' ? 'Client' : 'Channel', type === 'B2B' ? 'Courier' : 'Parceled By', 'Product', 'Qty', 'Pack', 'Total']];
    shipments.forEach(s => {
      const products = s.products || [];
      if (products.length === 0) {
        const row = [s.date, type === 'B2B' ? s.clientName : s.channel, type === 'B2B' ? s.courierName : s.whoParceled, '-', '-', '-', '-'];
        row._isFirst = true;
        body.push(row);
      } else {
        products.forEach((p, pIdx) => {
          const row = [
            s.date,
            type === 'B2B' ? s.clientName : s.channel,
            type === 'B2B' ? (s.courierName || '-') : (Array.isArray(s.whoParceled) ? s.whoParceled.join(', ') : (s.whoParceled || '-')),
            p.name,
            p.quantity,
            p.packSize || 1,
            Number(p.quantity) * (Number(p.packSize) || 1)
          ];
          // Attach metadata for the drawing hooks
          row._isFirst = (pIdx === 0);
          body.push(row);
        });
      }
    });
  } else if (type === 'Damage') {
    headers = [['Date', 'Product', 'Quantity', 'Reason', 'Recorded By']];
    body = shipments.map(s => [s.date, s.productName, s.quantity, s.reason, s.staffName]);
  } else if (type === 'QC') {
    headers = [['Date', 'Vendor', 'Product', 'Checked', 'Rejected', 'Damaged', 'Approved']];
    body = shipments.map(s => {
      const approved = Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0);
      return [
        s.date, 
        s.vendorName, 
        s.productName,
        s.checked,
        s.rejected || 0,
        s.damaged,
        approved
      ];
    });
  } else if (type === 'Return') {
    headers = [['Date', 'Channel', 'Condition', 'Product', 'Qty', 'Reason']];
    body = shipments.map(s => [s.date, s.channel, s.isReusable ? 'GOOD' : 'DAMAGED', s.productName, s.quantity, s.reason]);
  } else if (type === 'Replacement') {
    headers = [['Date', 'Type', 'Target', 'Product', 'Qty', 'Reason']];
    body = shipments.map(s => [
      s.date, 
      s.type, 
      s.type === 'B2B' ? (s.clientName || 'B2B Order') : s.channel, 
      s.productName, 
      s.quantity, 
      s.reason
    ]);
  }

  autoTable(doc, {
    startY: 45,
    head: headers,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: theme.color, fontSize: 11, halign: 'center', font: 'times', cellPadding: 3 },
    styles: { fontSize: 10, cellPadding: 3, valign: 'middle', font: 'times', overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 50 } // Product column
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      if ((type === 'B2B' || type === 'B2C') && data.section === 'body' && [0, 1, 2].includes(data.column.index)) {
        const isFirst = data.row.raw._isFirst !== false;
        
        // Track the first row of each page to ensure text repeats on page break
        // data.pageNumber is available and reliable
        if (!data.table._lastPageNum || data.table._lastPageNum !== data.pageNumber) {
          data.table._lastPageNum = data.pageNumber;
          data.table._firstRowOnPage = data.row.index;
        }

        const isFirstOnPage = data.row.index === data.table._firstRowOnPage;
        
        if (!isFirst && !isFirstOnPage) {
          data.cell.text = []; // Completely remove text instead of making it white
        }
      }
    },
    didDrawCell: (data) => {
      if ((type === 'B2B' || type === 'B2C') && data.section === 'body' && [0, 1, 2].includes(data.column.index)) {
        const isFirst = data.row.raw._isFirst !== false;
        const isFirstOnPage = data.row.index === data.table._firstRowOnPage;

        if (!isFirst && !isFirstOnPage) {
          // Use the row's background color to hide the border, not just white
          const fillColor = (data.row.index % 2 === 1) ? [245, 247, 250] : [255, 255, 255];
          doc.setDrawColor(fillColor[0], fillColor[1], fillColor[2]); 
          doc.setLineWidth(0.4);
          doc.line(data.cell.x + 0.1, data.cell.y, data.cell.x + data.cell.width - 0.1, data.cell.y);
        }
      }
    }
  });

  // Add Images for QC PDF Summary
  if (type === 'QC') {
    const allImages = shipments.flatMap(s => s.images || []);
    if (allImages.length > 0) {
      doc.addPage();
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor(theme.color[0], theme.color[1], theme.color[2]);
      doc.text("Inspection Photos", 15, 20);
      doc.line(15, 25, 195, 25);
      
      let x = 15;
      let y = 35;
      const imgWidth = 85;
      const imgHeight = 85;
      const margin = 10;
      
      for (let i = 0; i < allImages.length; i++) {
        try {
          const imgBase64 = await getProxyImageBase64(allImages[i]);
          if (imgBase64 && (imgBase64.startsWith('data:image') || imgBase64.startsWith('http'))) {
            const format = imgBase64.includes('png') ? 'PNG' : 'JPEG';
            doc.addImage(imgBase64, format, x, y, imgWidth, imgHeight);
            x += imgWidth + margin;
            if (x + imgWidth > 195) { x = 15; y += imgHeight + margin; }
            if (y + imgHeight > 280 && i < allImages.length - 1) {
              doc.addPage();
              x = 15; y = 20;
            }
          }
        } catch (e) {
          console.warn("Failed to add image to PDF report", e);
        }
      }
    }
  }

  doc.save(`${fileName}.pdf`);
};

const downloadAsImage = async (shipments, type, title, fileName, dateRange) => {
  const shipmentsWithBase64 = await Promise.all(shipments.map(async s => {
    const base64Images = s.images ? await Promise.all(s.images.map(img => getProxyImageBase64(img))) : [];
    return { ...s, base64Images };
  }));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; 
  container.style.minHeight = '1123px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '50px';
  container.style.fontFamily = '"Times New Roman", Times, serif';
  
  const themes = {
    B2B: { color: '#312e81' }, 
    B2C: { color: '#065f46' }, 
    Damage: { color: '#9f1239' }, 
    QC: { color: '#134e4a' },
    Return: { color: '#065f46' },
    Replacement: { color: '#4338ca' }
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

    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: ${theme.color}; color: white; text-align: left;">
          <th style="padding: 12px; border: 1px solid #ddd;">Date</th>
          <th style="padding: 12px; border: 1px solid #ddd;">${type === 'QC' ? 'Vendor' : type === 'Damage' ? 'Product' : type === 'B2B' ? 'Client' : 'Channel'}</th>
          <th style="padding: 12px; border: 1px solid #ddd;">Product Details</th>
          ${type === 'B2B' || type === 'B2C' ? `
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; width: 50px;">Qty</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; width: 50px;">Pack</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; width: 60px;">Total</th>
          ` : `
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Units</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${shipmentsWithBase64.map((s, idx) => {
          const products = s.products || [];
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#fcfcfc';
          
          if ((type === 'B2B' || type === 'B2C') && products.length > 0) {
            return products.map((p, pIdx) => `
              <tr style="background-color: ${rowBg};">
                <td style="padding: 12px; border: 1px solid #ddd; white-space: nowrap; font-size: 11px;">${pIdx === 0 ? s.date : ''}</td>
                <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">
                  ${pIdx === 0 ? (type === 'B2B' ? s.clientName : s.channel) : ''}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd;">• ${p.name}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${p.quantity}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${p.packSize || 1}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: ${theme.color};">
                  ${Number(p.quantity) * (Number(p.packSize) || 1)}
                </td>
              </tr>
            `).join('');
          }

          return `
            <tr style="background-color: ${rowBg};">
              <td style="padding: 12px; border: 1px solid #ddd; white-space: nowrap; font-size: 11px;">${s.date}</td>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">
                ${type === 'B2B' ? s.clientName : type === 'B2C' ? s.channel : type === 'Damage' ? s.productName : type === 'Return' ? s.channel : type === 'Replacement' ? (s.type === 'B2B' ? s.clientName : s.channel) : s.vendorName}
              </td>
              <td style="padding: 12px; border: 1px solid #ddd;">
                ${type === 'QC' 
                  ? `• <b>${s.productName}</b><br/>
                     <div style="margin-left: 10px; margin-top: 5px; font-size: 11px; color: #64748b;">
                       Checked: ${s.checked} | Rejected: ${s.rejected || 0} | Damaged: ${s.damaged}<br/>
                       <span style="color: #059669; font-weight: bold;">Approved: ${Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)}</span>
                     </div>`
                  : type === 'Damage' 
                    ? `Reason: ${s.reason}`
                    : type === 'Return'
                      ? `Product: ${s.productName}<br/>Condition: ${s.isReusable ? 'GOOD' : 'DAMAGED'}<br/>Reason: ${s.reason}`
                      : type === 'Replacement'
                        ? `Product: ${s.productName}<br/>Reason: ${s.reason}`
                        : '-'
                }
              </td>
              <td colspan="${type === 'B2B' || type === 'B2C' ? '3' : '1'}" style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
                ${type === 'QC' ? (Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)) : (type === 'Return' ? `+${s.quantity}` : (type === 'Replacement' ? `-${s.quantity}` : s.quantity))}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    
    ${shipmentsWithBase64.some(s => s.base64Images && s.base64Images.length > 0) ? `
      <div style="margin-top: 30px; page-break-before: auto;">
        <h3 style="color: ${theme.color}; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid ${theme.color}; padding-bottom: 5px;">Inspection Photos</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${shipmentsWithBase64.flatMap(s => s.base64Images.map(img => `
            <div style="width: 170px; height: 170px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: #f8fafc;">
              <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          `)).join('')}
        </div>
      </div>
    ` : ''}

    <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #eee; padding-top: 15px;">
      © ThengaCoco - Internal Inventory Report
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const imgs = container.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error("Capture failed", err);
  } finally {
    document.body.removeChild(container);
  }
};

export const shareVisualReport = async (shipments, type, title, dateRange = {}) => {
  if (!shipments || shipments.length === 0) return null;

  const shipmentsWithBase64 = await Promise.all(shipments.map(async s => {
    const base64Images = s.images ? await Promise.all(s.images.map(img => getProxyImageBase64(img))) : [];
    return { ...s, base64Images };
  }));

  const fileName = `${type}_Report_${new Date().toISOString().split('T')[0]}`;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; 
  container.style.minHeight = '1123px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '50px';
  container.style.fontFamily = '"Times New Roman", Times, serif';
  
  const themes = {
    B2B: { color: '#312e81' }, 
    B2C: { color: '#065f46' }, 
    Damage: { color: '#9f1239' }, 
    QC: { color: '#134e4a' },
    Return: { color: '#065f46' },
    Replacement: { color: '#4338ca' }
  };
  const themeColor = themes[type]?.color || '#065f46';
  const dateFrom = dateRange.startDate ? `<span style="margin-right: 15px;"><b>From:</b> ${dateRange.startDate}</span>` : '';
  const dateTo = dateRange.endDate ? `<span><b>To:</b> ${dateRange.endDate}</span>` : '';

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 10px;">
      <img src="/logo.jpg" style="height: 60px; width: 60px; object-fit: contain;" alt="Logo" onerror="this.style.display='none'"/>
      <div style="text-align: left;">
        <h1 style="color: ${themeColor}; margin: 0; font-size: 18px; text-transform: uppercase; font-weight: bold;">ThengaCoco</h1>
        <h2 style="color: #334155; margin: 2px 0; font-size: 16px; font-weight: bold;">${title}</h2>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">${dateFrom} ${dateTo}</div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 2px;">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
    
    <div style="border-bottom: 2px solid ${themeColor}; margin-bottom: 30px;"></div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background-color: ${themeColor}; color: white; text-align: left;">
          <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
          <th style="padding: 10px; border: 1px solid #ddd;">${type === 'QC' ? 'Vendor' : (type === 'B2B' ? 'Client' : 'Channel')}</th>
          <th style="padding: 10px; border: 1px solid #ddd;">${type === 'QC' ? 'Product' : (type === 'B2B' ? 'Courier' : 'Parceled By')}</th>
          ${type === 'QC' ? `
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Checked</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Rejected</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Damaged</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Approved</th>
          ` : `
            <th style="padding: 10px; border: 1px solid #ddd;">${type === 'B2B' || type === 'B2C' ? 'Product' : 'Details'}</th>
            ${type === 'B2B' || type === 'B2C' ? `
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 40px;">Qty</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 40px;">Pack</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 50px;">Total</th>
            ` : `
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Units</th>
            `}
          `}
        </tr>
      </thead>
      <tbody>
        ${shipmentsWithBase64.map((s, idx) => {
          const products = s.products || [];
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          
          if ((type === 'B2B' || type === 'B2C') && products.length > 0) {
             return products.map((p, pIdx) => `
              <tr style="background-color: ${rowBg};">
                ${pIdx === 0 ? `
                  <td rowspan="${products.length}" style="padding: 10px; border: 1px solid #ddd; font-size: 11px;">${s.date}</td>
                  <td rowspan="${products.length}" style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
                    ${type === 'B2B' ? s.clientName : s.channel}
                  </td>
                  <td rowspan="${products.length}" style="padding: 10px; border: 1px solid #ddd; font-size: 11px;">
                    ${type === 'B2B' ? (s.courierName || '-') : (Array.isArray(s.whoParceled) ? s.whoParceled.join(', ') : (s.whoParceled || '-'))}
                  </td>
                ` : ''}
                <td style="padding: 10px; border: 1px solid #ddd;">• ${p.name}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${p.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${p.packSize || 1}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
                  ${Number(p.quantity) * (Number(p.packSize) || 1)}
                </td>
              </tr>
            `).join('');
          }

          const approved = Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0);

          return `
            <tr style="background-color: ${rowBg};">
              <td style="padding: 10px; border: 1px solid #ddd;">${s.date}</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
                ${type === 'B2B' ? s.clientName : type === 'B2C' ? s.channel : type === 'Damage' ? s.productName : type === 'Return' ? s.channel : type === 'Replacement' ? (s.type === 'B2B' ? s.clientName : s.channel) : s.vendorName}
              </td>
              <td style="padding: 10px; border: 1px solid #ddd;">
                ${type === 'QC' ? s.productName : (type === 'B2B' ? (s.courierName || '-') : (type === 'B2C' ? (Array.isArray(s.whoParceled) ? s.whoParceled.join(', ') : (s.whoParceled || '-')) : '-'))}
              </td>
              ${type === 'QC' ? `
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${s.checked}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${s.rejected || 0}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${s.damaged}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #059669;">${approved}</td>
              ` : `
                <td style="padding: 10px; border: 1px solid #ddd;">
                  ${type === 'Damage' ? `Reason: ${s.reason}` : type === 'Return' ? `Product: ${s.productName}` : type === 'Replacement' ? `Product: ${s.productName}` : '-'}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
                   ${type === 'Return' ? `+${s.quantity}` : type === 'Replacement' ? `-${s.quantity}` : s.quantity}
                </td>
              `}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    ${shipmentsWithBase64.some(s => s.base64Images && s.base64Images.length > 0) ? `
      <div style="margin-top: 30px;">
        <h3 style="color: ${themeColor}; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid ${themeColor}; padding-bottom: 5px;">Inspection Photos</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${shipmentsWithBase64.flatMap(s => (s.base64Images || []).filter(img => img && img.startsWith('data:')).map(img => `
            <div style="width: 170px; height: 170px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: #f8fafc;">
              <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          `)).join('')}
        </div>
      </div>
    ` : ''}

    <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #eee; padding-top: 15px;">
      © ThengaCoco - Internal Inventory Report
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const imgs = container.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { 
        img.onload = resolve; 
        img.onerror = resolve; // Continue even if one image fails
      });
    }));
    // Extra wait for fonts and layout
    await new Promise(resolve => setTimeout(resolve, 800));
    const canvas = await html2canvas(container, { 
      scale: 2, 
      backgroundColor: '#ffffff', 
      useCORS: true,
      logging: false,
      allowTaint: false
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return new File([blob], `${fileName}.png`, { type: 'image/png' });
  } catch (err) {
    console.error("Capture failed", err);
    return null;
  } finally {
    document.body.removeChild(container);
  }
};

const getProxyImageBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  
  // Try direct fetch first (if CORS allowed)
  try {
    const directResp = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (directResp.ok) {
      const blob = await directResp.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) { }

  // Try multiple proxies in order
  const proxies = [
    `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=80`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy);
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        if (base64 && base64.startsWith('data:image')) return base64;
      }
    } catch (e) { continue; }
  }

  return null; // Return null instead of original URL to prevent html2canvas CORS issues
};
