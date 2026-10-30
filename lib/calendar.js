import { addDaysToDateStr, daysBetween } from "./dates";

// Reads a public Google Calendar (.ics) feed and turns the events inside a
// date window into the same candidate shape the AI batches produce, so they
// go through the exact same duplicate check and insert logic. Never throws -
// a calendar that's down or malformed just yields no candidates.

const EASTERN = "America/New_York";

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function unescapeText(s) {
  return s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
}

function cleanText(s) {
  return unescapeText(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(h, m) {
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Handles the three shapes Google uses: all-day dates (20261205), local times
// (TZID=America/New_York:20261113T190000), and UTC times (20260207T200000Z).
function parseWhen(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, hh, mm, , z] = m;
  if (!hh) return { date: `${y}-${mo}-${d}`, time: "" };
  if (!z) return { date: `${y}-${mo}-${d}`, time: formatTime(Number(hh), Number(mm)) };
  const instant = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)));
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(instant);
  const h = Number(parts.find((p) => p.type === "hour").value) % 24;
  const min = Number(parts.find((p) => p.type === "minute").value);
  return { date, time: formatTime(h, min) };
}

function parseProps(block) {
  const props = {};
  for (const line of unfold(block).split(/\r?\n/)) {
    const m = /^([A-Z-]+)((?:;[^:]*)*):(.*)$/.exec(line);
    if (!m) continue;
    const [, name, , value] = m;
    (props[name] = props[name] || []).push(value);
  }
  return props;
}

function parseRule(rule) {
  const out = {};
  for (const part of rule.split(";")) {
    const [k, v] = part.split("=");
    out[k] = v;
  }
  return out;
}

// Lists the calendar dates (YYYY-MM-DD) an event lands on between startStr and
// endStr. Supports the simple repeat rules (daily, weekly with optional days,
// monthly on the same day, yearly); anything fancier falls back to the first
// occurrence only rather than guessing.
function occurrenceDates(firstDate, rrule, exdates, startStr, endStr) {
  if (!rrule) return firstDate >= startStr && firstDate <= endStr ? [firstDate] : [];

  const rule = parseRule(rrule);
  const interval = Number(rule.INTERVAL || 1);
  const until = rule.UNTIL ? `${rule.UNTIL.slice(0, 4)}-${rule.UNTIL.slice(4, 6)}-${rule.UNTIL.slice(6, 8)}` : null;
  const count = rule.COUNT ? Number(rule.COUNT) : null;
  const weekdayOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
  const byDays = rule.BYDAY ? rule.BYDAY.split(",").map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d)) : [weekdayOf(firstDate)];
  const supported =
    rule.FREQ === "DAILY" || rule.FREQ === "WEEKLY" || rule.FREQ === "YEARLY" || (rule.FREQ === "MONTHLY" && !rule.BYDAY);
  if (!supported || byDays.includes(-1)) {
    return firstDate >= startStr && firstDate <= endStr ? [firstDate] : [];
  }

  const found = [];
  let seen = 0;
  for (let d = firstDate; d <= endStr; d = addDaysToDateStr(d, 1)) {
    const offset = daysBetween(firstDate, d);
    let hit = false;
    if (rule.FREQ === "DAILY") hit = offset % interval === 0;
    else if (rule.FREQ === "WEEKLY") hit = byDays.includes(weekdayOf(d)) && Math.floor(offset / 7) % interval === 0;
    else if (rule.FREQ === "MONTHLY") hit = d.slice(8) === firstDate.slice(8) && (Number(d.slice(5, 7)) - Number(firstDate.slice(5, 7)) + 12 * (Number(d.slice(0, 4)) - Number(firstDate.slice(0, 4)))) % interval === 0;
    else hit = d.slice(5) === firstDate.slice(5) && (Number(d.slice(0, 4)) - Number(firstDate.slice(0, 4))) % interval === 0;
    if (!hit) continue;
    seen++;
    if ((count && seen > count) || (until && d > until)) break;
    if (d >= startStr && !exdates.has(d)) found.push(d);
  }
  return found;
}

const CATEGORY_HINTS = [
  ["Market", /market|thrift|toy shop/i],
  ["Meeting / Civic", /meeting|council|commission|board of|public hearing/i],
  ["Kids & Family", /trunk or treat|kids|family|storytime|children/i],
  ["Music", /concert|music|band\b/i],
  ["Sports & Rec", /\bfc\b|soccer|5k|run\b|sports/i],
  ["Arts & Culture", /art |arts|exhibit|parade|festival|gala|fashion show|film|theat/i],
];

// Empty when nothing matches, so a later match against an existing row
// doesn't overwrite a good category with a generic fallback.
function guessCategory(title) {
  const hit = CATEGORY_HINTS.find(([, re]) => re.test(title));
  return hit ? hit[0] : "";
}

function guessTown(location) {
  const m = /,\s*([A-Za-z][A-Za-z .'-]*?),\s*NJ\b/i.exec(location);
  return m ? m[1].trim() : "Rutherford";
}

export async function fetchCalendarCandidates({ icsUrl, publicUrl }, todayStr, days = 90) {
  try {
    const res = await fetch(icsUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; RutherfordBulletinBot/1.0)" } });
    if (!res.ok) return [];
    const text = await res.text();
    const endStr = addDaysToDateStr(todayStr, days);
    const candidates = [];

    for (const chunk of text.split("BEGIN:VEVENT").slice(1)) {
      const props = parseProps(chunk.split("END:VEVENT")[0]);
      const title = cleanText((props.SUMMARY || [""])[0]);
      const start = parseWhen((props.DTSTART || [""])[0]);
      if (!title || !start) continue;

      const exdates = new Set();
      for (const line of props.EXDATE || []) {
        for (const v of line.split(",")) {
          const w = parseWhen(v);
          if (w) exdates.add(w.date);
        }
      }

      const location = cleanText((props.LOCATION || [""])[0]);
      const description = cleanText((props.DESCRIPTION || [""])[0]).slice(0, 300);
      const dates = occurrenceDates(start.date, (props.RRULE || [])[0], exdates, todayStr, endStr);
      for (const date of dates) {
        candidates.push({
          title,
          description,
          date,
          time: start.time,
          town: guessTown(location),
          location,
          category: guessCategory(title),
          status: (props.STATUS || [""])[0] === "CANCELLED" ? "cancelled" : "approved",
          source_url: (props.URL || [publicUrl])[0],
        });
      }
    }
    return candidates;
  } catch (err) {
    return [];
  }
}
