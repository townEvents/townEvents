import { addDaysToDateStr } from "./dates";

// Everything a visitor types into the public "submit an event" form passes
// through here before it gets anywhere near the database. Nothing is trusted:
// wrong types are rejected, invisible/control characters and anything that
// looks like HTML are stripped, lengths and formats are enforced, and the link
// must be a plain http(s) address. (The database also has its own length and
// format checks, and the insert itself is parameterized, so this is one layer
// of several, not the only one.)

export const LIMITS = { title: 120, location: 160, description: 1000, url: 500, email: 254, name: 100, phone: 30 };

const MAX_DAYS_AHEAD = 365;

// Control characters (except tab/newline, handled separately), plus the
// invisible zero-width and text-direction characters used to disguise text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function base(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(CONTROL_CHARS, "")
    .replace(INVISIBLE_CHARS, "")
    .replace(/<[^>]*>/g, " ") // whole tags like <script>...</script> or <b>
    .replace(/[<>]/g, ""); // any stray angle brackets left over
}

export function cleanLine(value) {
  return base(value).replace(/\s+/g, " ").trim();
}

export function cleanBlock(value) {
  return base(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ") // runs of spaces/tabs -> one space
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanDate(value, todayStr) {
  const s = cleanLine(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
  if (s < todayStr || s > addDaysToDateStr(todayStr, MAX_DAYS_AHEAD)) return null;
  return s;
}

function cleanUrl(value) {
  let s = cleanLine(value);
  if (!s || s.length > LIMITS.url || /\s/.test(s)) return null;

  // People often paste a bare address like www.example.com. Anything without
  // a "://" gets https:// added; risky forms such as javascript:alert(1) then
  // fail to parse as a web address below and are rejected like any other.
  if (!s.includes("://")) s = `https://${s}`;

  let u;
  try {
    u = new URL(s);
  } catch (err) {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;

  // Must look like a real public website, not an internal or raw-IP address.
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.includes(":")) return null;
  if (/^\d+(\.\d+){3}$/.test(host)) return null;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;

  const href = u.href;
  return href.length <= LIMITS.url ? href : null;
}

// The contact email is optional: blank means "none given" (null), but anything
// typed has to be a plausible single email address.
export function cleanContactEmail(value) {
  const s = cleanLine(value).toLowerCase();
  if (!s) return { ok: true, value: null };
  if (s.length > LIMITS.email || !/^[^\s@,;<>()[\]\\:"]+@[^\s@,;<>()[\]\\:"]+\.[^\s@,;<>()[\]\\:"]+$/.test(s)) return { ok: false };
  return { ok: true, value: s };
}

// Optional name: blank means "none given" (null).
export function cleanContactName(value) {
  const s = cleanLine(value);
  if (!s) return { ok: true, value: null };
  if (s.length > LIMITS.name) return { ok: false };
  return { ok: true, value: s };
}

// Optional phone number: blank means "none given" (null). Anything typed can
// only contain digits and the usual phone punctuation, with 7-15 digits.
export function cleanContactPhone(value) {
  const s = cleanLine(value);
  if (!s) return { ok: true, value: null };
  const digits = s.replace(/\D/g, "").length;
  if (s.length > LIMITS.phone || !/^[+\d\s().-]+$/.test(s) || digits < 7 || digits > 15) return { ok: false };
  return { ok: true, value: s };
}

// Returns { ok: true, value } with cleaned fields, or { ok: false, error }
// with a message that's safe to show the visitor.
export function cleanSubmission(body, todayStr) {
  const input = body && typeof body === "object" ? body : {};

  const title = cleanLine(input.title);
  if (!title || !/[\p{L}\p{N}]/u.test(title)) return { ok: false, error: "Please enter the name of the event." };
  if (title.length > LIMITS.title) return { ok: false, error: `The event name must be ${LIMITS.title} characters or fewer.` };

  const date = cleanDate(input.date, todayStr);
  if (!date) return { ok: false, error: "Please choose a valid date, from today up to a year from now." };

  const location = cleanLine(input.location);
  if (!location) return { ok: false, error: "Please enter where the event is happening." };
  if (location.length > LIMITS.location) return { ok: false, error: `The location must be ${LIMITS.location} characters or fewer.` };

  const description = cleanBlock(input.description);
  if (description.length > LIMITS.description) {
    return { ok: false, error: `The description must be ${LIMITS.description} characters or fewer.` };
  }

  const url = cleanUrl(input.url);
  if (!url) return { ok: false, error: "Please enter a valid web link to the public post, such as www.example.com or https://www.example.com." };

  const contact = cleanContactEmail(input.contact_email);
  if (!contact.ok) return { ok: false, error: "That email address doesn't look right. It's optional, so you can leave it blank." };

  const contactName = cleanContactName(input.contact_name);
  if (!contactName.ok) return { ok: false, error: `Your name must be ${LIMITS.name} characters or fewer. It's optional, so you can leave it blank.` };

  const contactPhone = cleanContactPhone(input.contact_phone);
  if (!contactPhone.ok) return { ok: false, error: "That phone number doesn't look right. It's optional, so you can leave it blank." };

  return {
    ok: true,
    value: {
      title,
      event_date: date,
      location,
      description,
      url,
      contact_email: contact.value,
      contact_name: contactName.value,
      contact_phone: contactPhone.value,
    },
  };
}
