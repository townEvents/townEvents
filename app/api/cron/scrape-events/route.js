import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { todayStrEastern } from "../../../../lib/dates";

// Give the job room to run — web search + reading results takes longer
// than a typical API route. Vercel's Hobby plan currently allows function
// durations well into this range; check Vercel's current docs if you see
// timeouts and need to raise or lower this.
export const maxDuration = 120;

const TOWNS = ["Rutherford", "East Rutherford", "Carlstadt", "Lyndhurst", "North Arlington", "Wallington"];
const CATEGORIES = ["Music", "Market", "Kids & Family", "Meeting / Civic", "Sports & Rec", "Arts & Culture", "Other"];

// Backup filter — the prompt already tells Claude to skip adult content,
// but this catches anything that slips through before it ever reaches the
// database. Deliberately conservative wording; extend this list if
// something inappropriate gets through despite it.
const BLOCKED_KEYWORDS = [
  "adult film", "porn", "xxx", "strip club", "strippers", "burlesque",
  "erotic", "swingers", "gentlemen's club",
];

function containsBlockedContent(candidate) {
  const text = `${candidate.title || ""} ${candidate.description || ""} ${candidate.location || ""}`.toLowerCase();
  return BLOCKED_KEYWORDS.some((word) => text.includes(word));
}

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
  const configuredSecret = process.env.CRON_SECRET;

  // TEMPORARY DEBUG LOGGING — remove once auth is confirmed working.
  // Doesn't log the full secret, just enough to diagnose a mismatch.
  console.log("[cron debug] CRON_SECRET is set:", Boolean(configuredSecret));
  console.log("[cron debug] CRON_SECRET length:", configuredSecret ? configuredSecret.length : 0);
  console.log("[cron debug] CRON_SECRET first 3 chars:", configuredSecret ? configuredSecret.slice(0, 3) : "n/a");
  console.log("[cron debug] Authorization header received:", authHeader ? `${authHeader.slice(0, 10)}...` : "none");

  if (!configuredSecret || authHeader !== `Bearer ${configuredSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const todayStr = todayStrEastern();

  const prompt = `You are researching community events for a local town bulletin.
Search the web for real, upcoming public events happening in the next 30 days
(starting ${todayStr}) in these New Jersey towns: ${TOWNS.join(", ")}.

PRIORITY SOURCES — check these specifically, every run, in addition to
general search, since Rutherford is this bulletin's main town:
- ${"https://www.rutherfordboronj.com/resident/calendar"} — Rutherford
  Borough's official events calendar. Pull in every event listed there
  that falls in the search window.
- ${"https://www.rutherfordboronj.com/government/news/"} — Rutherford
  Borough's government news page. Include any events, public meetings, or
  sign-up opportunities (registrations, deadlines, civic participation)
  announced there.
Search specifically for content from these two pages (e.g. a query like
"rutherfordboronj.com calendar events" or "rutherfordboronj.com news"), not
just Rutherford in general, to make sure these specific sources get covered.

RECURRING EVENTS: some things you find won't be a single one-off date -
a farmers market every Wednesday and Saturday for a season, a weekly
storytime, a monthly meeting on a fixed schedule. For these, create a
SEPARATE entry in the JSON array for each individual occurrence date that
falls within this search window - don't summarize a recurring schedule as
one vague entry. For example, a market running "every Wed & Sat, July
through October" should produce one entry per Wednesday and one per
Saturday that falls within the next 30 days, each with its own correct
"date", all sharing the same title/description/location/category.

Also check other sources like each town's official website, public
libraries, recreation departments, chambers of commerce, school district and
PTA pages, churches and civic organizations, Patch.com town pages, and public
event listings (Facebook, Eventbrite, etc). Include things like farmers
markets, town council or board meetings, concerts, kids' programs, sports
leagues, community fairs, and anything residents might want to sign up for.
Skip anything private or not open to the public.

Beyond the towns listed above, also include larger public fairs, festivals,
and community events happening anywhere in the broader Meadowlands region
of NJ (e.g. Meadowlands-area fairs, public events at MetLife Stadium or the
American Dream complex, county-level Meadowlands events) even if they're in
a nearby town not in the main list — use the event's actual town/venue name
in the "town" field for these.

This is a general community bulletin. Adult-audience events are completely
fine to include — bars, breweries, wine tastings, 21+ nights, comedy shows,
and similar are all normal community events, include them. The only thing
to exclude is events centered on sexual or explicit adult content — for
example, adult film screenings/expos, strip club or burlesque events, or
similar. Everything else stays in, regardless of the audience it's aimed at.

Also note if any event — including a normally recurring one — has been
explicitly reported as cancelled or postponed.

Respond with ONLY a JSON array (no other text, no markdown code fences) of
objects with exactly these fields:
- "title": string
- "description": one or two plain sentences
- "date": "YYYY-MM-DD"
- "time": string like "7:00 PM", or "" if unknown
- "town": one of ${TOWNS.map((t) => `"${t}"`).join(", ")} — or, for a
  broader Meadowlands-area event as described above, the actual town or
  venue name (e.g. "Secaucus", "MetLife Stadium")
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
    .select("id, title, date, town, status, time, description, location, category, source_url, source")
    .gte("date", todayStr);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  let inserted = 0;
  let cancelled = 0;
  let enriched = 0;
  let skipped = 0;
  let filtered = 0;
  const errors = [];

  for (const c of candidates) {
    if (!c.title || !c.date || !c.town) {
      skipped++;
      continue;
    }

    if (containsBlockedContent(c)) {
      filtered++;
      continue;
    }

    const match = (existing || []).find(
      (e) => e.town === c.town && e.date === c.date && titlesLikelySame(e.title, c.title)
    );

    if (match) {
      const patch = {};

      // Cancellation takes priority and overrides other fields below.
      if (c.status === "cancelled" && match.status !== "cancelled") {
        patch.status = "cancelled";
      }

      // Fill in / correct fields on matched events. AI-found events can be
      // fully overwritten if a later pass finds different info (e.g. a
      // time that changes from 7pm to 8pm) — that's the AI correcting
      // itself. Manually-added events (Table Editor or the /add form) are
      // only ever filled in where blank, never overwritten, so a human's
      // entry can't get silently replaced by a possibly-wrong AI guess.
      const protectExisting = match.source === "manual";
      const fillable = ["time", "description", "location", "category", "source_url"];
      for (const field of fillable) {
        const existingValue = (match[field] || "").toString().trim();
        const candidateValue = (c[field] || "").toString().trim();
        if (!candidateValue) continue;
        if (protectExisting) {
          if (!existingValue) patch[field] = candidateValue;
        } else if (candidateValue !== existingValue) {
          patch[field] = candidateValue;
        }
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await supabaseAdmin.from("events").update(patch).eq("id", match.id);
        if (error) {
          errors.push(error.message);
        } else if (patch.status === "cancelled") {
          cancelled++;
        } else {
          enriched++;
        }
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
    enriched,
    skipped,
    filtered,
    errors,
  });
}
