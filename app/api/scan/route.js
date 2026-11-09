import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { cleanScanCode } from "../../../lib/scanCodes";

// Counts one visit for a flyer's store-click code (?sc=business0007). The
// visitor's browser calls this once when the page opens. Only an exact
// business0001-business9999 code is ever stored; anything else is rejected.
// Nothing about the visitor is saved, just a counter per code.

const MAX_BODY_CHARS = 200;

// Link-preview and crawler traffic shouldn't count as a person scanning a flyer.
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|curl|wget|python-requests/i;

export async function POST(request) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return Response.json({ error: "invalid" }, { status: 413 });
    body = JSON.parse(text);
  } catch (err) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const code = cleanScanCode(body && typeof body === "object" ? body.code : null);
  if (!code) return Response.json({ error: "invalid" }, { status: 400 });

  const userAgent = request.headers.get("user-agent") || "";
  if (!userAgent || NOT_A_PERSON.test(userAgent)) return Response.json({ ok: true, counted: false });

  try {
    const { error } = await getSupabaseAdmin().rpc("record_scan", { p_code: code, p_kind: "visit" });
    if (error) {
      console.error("Scan count failed:", error.message);
      return Response.json({ ok: false }, { status: 500 });
    }
  } catch (err) {
    console.error("Scan count failed:", err.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true, counted: true });
}
