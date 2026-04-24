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
    QC: { color: [6, 95, 70] },
    Return: { color: [6, 95, 70] },
    Replacement: { color: [6, 95, 70] }
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
    headers = [['Date', 'Client', 'Courier', 'Product', 'Qty', 'Pack', 'Total']];
    body = shipments.map(s => [
      s.date, 
      s.clientName, 
      s.courierName, 
      (s.products || []).map(p => p.name).join('\n'),
      (s.products || []).map(p => p.quantity).join('\n'),
      (s.products || []).map(p => p.packSize || 1).join('\n'),
      (s.products || []).map(p => (Number(p.quantity) * (Number(p.packSize) || 1))).join('\n')
    ]);
  } else if (type === 'B2C') {
    headers = [['Date', 'Channel', 'Parceled By', 'Product', 'Qty', 'Pack', 'Total']];
    body = shipments.map(s => [
      s.date, 
      s.channel, 
      s.whoParceled, 
      (s.products || []).map(p => p.name).join('\n'),
      (s.products || []).map(p => p.quantity).join('\n'),
      (s.products || []).map(p => p.packSize || 1).join('\n'),
      (s.products || []).map(p => (Number(p.quantity) * (Number(p.packSize) || 1))).join('\n')
    ]);
  } else if (type === 'Damage') {
    headers = [['Date', 'Product', 'Quantity', 'Reason', 'Recorded By']];
    body = shipments.map(s => [s.date, s.productName, s.quantity, s.reason, s.staffName]);
  } else if (type === 'QC') {
    headers = [['Date', 'Vendor', 'Product Details']];
    body = shipments.map(s => [
      s.date, s.vendorName, 
      `• ${s.productName}\n  Checked: ${s.checked}\n  Rejected: ${s.rejected || 0}\n  Damaged: ${s.damaged}\n  Baseless: ${s.baseless || 0}\n  Approved: ${Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)}`
    ]);
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
    headStyles: { fillColor: theme.color, fontSize: 12, halign: 'center', font: 'times' },
    styles: { fontSize: 11, cellPadding: 4, valign: 'middle', font: 'times' },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

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

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background-color: ${theme.color}; color: white; text-align: left;">
          <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
          <th style="padding: 10px; border: 1px solid #ddd;">${type === 'QC' ? 'Vendor' : type === 'Damage' ? 'Product' : type === 'B2B' ? 'Client' : 'Channel'}</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Details / Product</th>
          ${type === 'B2B' || type === 'B2C' ? `
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Qty</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Pack</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total</th>
          ` : `
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Units</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${shipmentsWithBase64.map((s, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px; border: 1px solid #ddd; white-space: nowrap;">${s.date}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
              ${type === 'B2B' ? s.clientName : type === 'B2C' ? s.channel : type === 'Damage' ? s.productName : type === 'Return' ? s.channel : type === 'Replacement' ? (s.type === 'B2B' ? s.clientName : s.channel) : s.vendorName}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd; font-size: 14px;">
              ${type === 'QC' 
                ? `• <b>${s.productName}</b><br/>
                   <div style="margin-left: 10px; margin-top: 5px; font-size: 12px;">
                     Checked: ${s.checked} | Rejected: ${s.rejected || 0} | Damaged: ${s.damaged} | Baseless: ${s.baseless || 0}<br/>
                     <span style="color: #059669; font-weight: bold;">Approved: ${Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)}</span>
                   </div>`
                : type === 'Damage' 
                  ? `Reason: ${s.reason}`
                  : type === 'Return'
                    ? `Product: ${s.productName}<br/>Condition: ${s.isReusable ? 'GOOD' : 'DAMAGED'}<br/>Reason: ${s.reason}`
                    : type === 'Replacement'
                      ? `Product: ${s.productName}<br/>Reason: ${s.reason}`
                      : (s.products || []).map(p => `• ${p.name}`).join('<br/>')
              }
            </td>
            ${type === 'B2B' || type === 'B2C' ? `
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(s.products || []).map(p => p.quantity).join('<br/>')}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(s.products || []).map(p => p.packSize || 1).join('<br/>')}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${(s.products || []).map(p => (Number(p.quantity) * (Number(p.packSize) || 1))).join('<br/>')}</td>
            ` : `
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
                ${type === 'QC' ? (Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)) : (type === 'Return' ? `+${s.quantity}` : (type === 'Replacement' ? `-${s.quantity}` : s.quantity))}
              </td>
            `}
          </tr>
        `).join('')}
      </tbody>
    </table>
    
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

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background-color: ${themeColor}; color: white; text-align: left;">
          <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Target</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Details</th>
          ${type === 'B2B' || type === 'B2C' ? `
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Qty</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Pack</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Total</th>
          ` : `
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Units</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${shipmentsWithBase64.map((s, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px; border: 1px solid #ddd;">${s.date}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">
              ${type === 'B2B' ? s.clientName : type === 'B2C' ? s.channel : type === 'Damage' ? s.productName : type === 'Return' ? s.channel : type === 'Replacement' ? (s.type === 'B2B' ? s.clientName : s.channel) : s.vendorName}
            </td>
            <td style="padding: 10px; border: 1px solid #ddd;">
              ${type === 'QC' 
                ? `• ${s.productName}<br/>Approved: ${Number(s.checked) - Number(s.damaged) - (Number(s.rejected) || 0) - (Number(s.baseless) || 0)}`
                : type === 'Damage' ? `Reason: ${s.reason}` : type === 'Return' ? `Product: ${s.productName}` : type === 'Replacement' ? `Product: ${s.productName}` : (s.products || []).map(p => `• ${p.name}`).join('<br/>')}
            </td>
            ${type === 'B2B' || type === 'B2C' ? `
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(s.products || []).map(p => p.quantity).join('<br/>')}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(s.products || []).map(p => p.packSize || 1).join('<br/>')}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${(s.products || []).map(p => (Number(p.quantity) * (Number(p.packSize) || 1))).join('<br/>')}</td>
            ` : `
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
                 ${type === 'Return' ? `+${s.quantity}` : type === 'Replacement' ? `-${s.quantity}` : s.quantity}
              </td>
            `}
          </tr>
        `).join('')}
      </tbody>
    </table>
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
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) { continue; }
  }
  return url; 
};
