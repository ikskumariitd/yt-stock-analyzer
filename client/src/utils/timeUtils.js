/**
 * Singapore Time (SGT / Asia/Singapore / UTC+8) Utility
 */

export function formatSingaporeDateTime(dateInput, includeSeconds = false) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;

    return d.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    }) + ' SGT';
  } catch (e) {
    return dateInput;
  }
}

export function formatSingaporeDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;

    return d.toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateInput;
  }
}

export function formatSingaporeAuditTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;

    return d.toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' SGT';
  } catch (e) {
    return dateInput;
  }
}
