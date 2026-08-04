import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Give the job room to run — web search + reading results takes longer
// than a typical API route. Vercel's Hobby plan currently allows function
// durations well into this range; check Vercel's current docs if you see
// timeouts and need to raise or lower this.
export const maxDuration = 120;

const TOWNS = ["Rutherford", "East Rutherford", "Carlstadt", "Lyndhurst", "North Arlington", "Wallington"];
const CATEGORIES = ["Music", "Market", "Kids & Family", "Meeting / Civic", "Sports & Rec", "Arts & Culture", "Other"];

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Simple word-overlap similarity — good enough to catch "Farmers Market"
// vs "Rutherford Farmers Market" without needing a real fuzzy-match library.
function titlesLikelySame(a, b) {
  const wa = new Set(normalize(a).split(" ").filter(Boolean));
  const wb = new Set(normalize(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared++;
  });
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const todayStr = new Date().toISOString().slice(0, 10);

  const prompt = `You are researching community events for a local town bulletin.
Search the web for real, upcoming public events happening in the next 30 days
(starting ${todayStr}) in these New Jersey towns: ${TOWNS.join(", ")}.

Check sources like each town's official website and events calendar, public
libraries, recreation departments, chambers of commerce, school district and
PTA pages, churches and civic organizations, Patch.com town pages, and public
event listings (Facebook, Eventbrite, etc). Include things like farmers
markets, town council or board meetings, concerts, kids' programs, sports
leagues, and community fairs. Skip anything private or not open to the
public.

Also note if any event — including a normally recurring one — has been
explicitly reported as cancelled or postponed.

Respond with ONLY a JSON array (no other text, no markdown code fences) of
objects with exactly these fields:
- "title": string
- "description": one or two plain sentences
- "date": "YYYY-MM-DD"
- "time": string like "7:00 PM", or "" if unknown
- "town": one of ${TOWNS.map((t) => `"${t}"`).join(", ")}
- "location": venue name/address, or "" if unknown
- "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}
- "status": "approved" normally, or "cancelled" if you found explicit
  evidence it was cancelled or postponed
- "source_url": the URL where you found this event

If you find no qualifying events, respond with exactly: []`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });
  } catch (err) {
    return Response.json({ error: `Anthropic API call failed: ${err.message}` }, { status: 500 });
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  let candidates;
  try {
    candidates = JSON.parse(text);
  } catch (err) {
    return Response.json({ error: "Could not parse model output as JSON", raw: text.slice(0, 2000) }, { status: 500 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("events")
    .select("id, title, date, town, status")
    .gte("date", todayStr);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  let inserted = 0;
  let cancelled = 0;
  let skipped = 0;
  const errors = [];

  for (const c of candidates) {
    if (!c.title || !c.date || !c.town) {
      skipped++;
      continue;
    }

    const match = (existing || []).find(
      (e) => e.town === c.town && e.date === c.date && titlesLikelySame(e.title, c.title)
    );

    if (match) {
      // Already on the board. Only act if this run found a cancellation
      // that isn't reflected yet — applied automatically, since getting a
      // cancellation wrong is low-risk (an event just shows as cancelled).
      if (c.status === "cancelled" && match.status !== "cancelled") {
        const { error } = await supabaseAdmin.from("events").update({ status: "cancelled" }).eq("id", match.id);
        if (error) errors.push(error.message);
        else cancelled++;
      } else {
        skipped++;
      }
      continue;
    }

    // Brand new event — publishes immediately. (Earlier versions held new
    // AI-found events as "pending" for a human glance first; that's been
    // turned off for now. To bring it back later, change "approved" below
    // to "pending" and filter it out on the public site again.)
    const { error } = await supabaseAdmin.from("events").insert({
      title: c.title,
      description: c.description || "",
      date: c.date,
      time: c.time || "",
      town: c.town,
      location: c.location || "",
      category: CATEGORIES.includes(c.category) ? c.category : "Other",
      status: c.status === "cancelled" ? "cancelled" : "approved",
      source: "ai",
      source_url: c.source_url || null,
    });
    if (error) errors.push(error.message);
    else inserted++;
  }

  return Response.json({
    found: candidates.length,
    inserted,
    cancelled,
    skipped,
    errors,
  });
}
