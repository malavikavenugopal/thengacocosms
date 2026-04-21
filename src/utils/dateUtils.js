/**
 * Checks if a record is within the editable time window (e.g., 5 days).
 * @param {string} dateStr - The date of the record in YYYY-MM-DD format.
 * @returns {boolean} - True if the record was created within the last 5 days.
 */
export const isRecordEditable = (dateStr) => {
  if (!dateStr) return false;
  
  // Parse the record date
  const recordDate = new Date(dateStr);
  recordDate.setHours(0, 0, 0, 0);
  
  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate difference in time
  const diffTime = today - recordDate;
  
  // Convert time to days
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Editable if record is today or within the last 5 days
  return diffDays <= 5;
};
