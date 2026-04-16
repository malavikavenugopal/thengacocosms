/**
 * Utility to export data to CSV
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Optional headers mapping { key: 'Display Name' }
 * @param {string} fileName - Name of the file to download
 */
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
