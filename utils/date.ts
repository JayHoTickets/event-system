export const formatInTimeZone = (iso?: string | null, timeZone?: string, options: Intl.DateTimeFormatOptions = {}) => {
  if (!iso) return '';
  const d = new Date(iso);
  try {
    // If a timezone is provided, include it in options; otherwise let Intl use the runtime default.
    const opts: Intl.DateTimeFormatOptions = { ...options };
    if (timeZone) (opts as any).timeZone = timeZone;
    return new Intl.DateTimeFormat(undefined, opts).format(d as any);
  } catch (e) {
    // Fallback: respect the requested options when possible, otherwise use toLocaleString
    try {
      const opts: Intl.DateTimeFormatOptions = { ...options };
      return new Intl.DateTimeFormat(undefined, opts).format(d as any);
    } catch (e2) {
      return d.toLocaleString();
    }
  }
};

export const formatDateInTimeZone = (iso?: string | null, timeZone?: string) =>
  formatInTimeZone(iso, timeZone, { year: 'numeric', month: 'long', day: 'numeric' });

export const formatTimeInTimeZone = (iso?: string | null, timeZone?: string) =>
  formatInTimeZone(iso, timeZone, { hour: '2-digit', minute: '2-digit' });

// Convert an ISO instant into a string suitable for <input type="datetime-local" />
// representing the wall-clock time in the given IANA timezone.
export const toLocalDatetimeInput = (iso?: string | null, timeZone?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (!timeZone) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d as any);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type && p.value) map[p.type] = p.value;
    }
    const yyyy = map.year;
    const MM = map.month;
    const dd = map.day;
    const hh = map.hour;
    const mm = map.minute;
    if (yyyy && MM && dd && hh && mm) return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  } catch (e) {
    // fallback
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
