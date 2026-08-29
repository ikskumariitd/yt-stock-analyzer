/**
 * Singapore Time (SGT / Asia/Singapore / UTC+8) Utility
 */

export function parseUtcDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  let str = input.toString().trim();

  // If already has timezone indicator, parse directly
  if (str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str)) {
    return new Date(str);
  }

  // If 8-digit string format "YYYYMMDD" (e.g. from yt-dlp 20260816)
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const day = str.slice(6, 8);
    return new Date(`${y}-${m}-${day}T00:00:00Z`);
  }

  // If pure date format "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str + 'T00:00:00Z');
  }

  // If SQLite UTC timestamp format "YYYY-MM-DD HH:MM:SS" or ISO without Z
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (str.includes('T') && !str.endsWith('Z') && !str.includes('+')) {
    str = str + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatSingaporeDateTime(dateInput, includeSeconds = false) {
  if (!dateInput) return '—';
  try {
    const d = parseUtcDate(dateInput);
    if (!d) return dateInput;

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
    const d = parseUtcDate(dateInput);
    if (!d) return dateInput;

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
    const d = parseUtcDate(dateInput);
    if (!d) return dateInput;

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
