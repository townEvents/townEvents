// Every "what day is it" calculation in this project should go through
// here, rather than raw `new Date()` - the site can be viewed from any
// device timezone, and the cron jobs run on Vercel's servers (UTC), but
// this is a town's local calendar - "today" should always mean today in
// Rutherford, NJ, regardless of where the code happens to be running.

export function todayStrEastern() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Adds/subtracts whole days from a YYYY-MM-DD string. Treats the string as
// a plain calendar date (not a specific moment in time), so this stays
// correct regardless of what timezone the code runs in.
export function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Whole-day difference between two YYYY-MM-DD strings (b - a).
export function daysBetween(aStr, bStr) {
  const a = new Date(aStr + "T00:00:00Z");
  const b = new Date(bStr + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}
