// Store-click codes: the "sc" value on the links printed on flyers, e.g.
// https://www.rutherfordbulletin.com/?sc=business0007
//
// Only one exact shape is ever accepted: the word "business" followed by four
// digits, business0001 through business9999. Anything else - wrong word, wrong
// number of digits, extra characters, business0000, non-text values - comes back
// as null and is never stored. Shared by the browser and the server routes, so
// both apply the same rule (the database applies it a third time).

export function cleanScanCode(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (s.length !== 12) return null;
  const m = /^business(\d{4})$/.exec(s);
  if (!m || m[1] === "0000") return null;
  return s;
}
