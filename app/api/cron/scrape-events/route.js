import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { todayStrEastern } from "../../../../lib/dates";

// Give the job room to run - even split into smaller batches, this does
// real web search work. 300 seconds is the current ceiling on Vercel's
// Hobby plan (via Fluid Compute); check Vercel's docs if this number
// changes or you're on a different plan.
export const maxDuration = 300;

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

const RSS_FEEDS = [
  "https://rss.app/feeds/4mgZbfatseC8yIMR.xml",
  "https://rss.app/feeds/HB7hy8830AVx0zlk.xml",
  "https://rss.app/feeds/8FOcP0cBulilBU2S.xml",
];

// Fetches raw feed content directly, rather than hoping web search finds
// the same content indirectly. Never throws - a feed that's down or
// removed just gets skipped, not treated as a fatal error.
async function fetchFeedText(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; RutherfordBulletinBot/1.0)" } });
    if (!res.ok) return null;
    const text = await res.text();
    // Keep prompts a reasonable size - feeds can be long, and we mainly
    // need the most recent items anyway.
    return text.slice(0, 20000);
  } catch (err) {
    return null;
  }
}

const SCHEMA_INSTRUCTIONS = (todayStr) => `
Respond with ONLY a JSON array (no other text, no markdown code fences) of
objects with exactly these fields:
- "title": string
- "description": one or two plain sentences
- "date": "YYYY-MM-DD"
- "time": string like "7:00 PM", or "" if unknown
- "town": the town or venue name (e.g. "Rutherford", "Secaucus", "MetLife Stadium")
- "location": venue name/address, or "" if unknown
- "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}
- "status": "approved" normally, or "cancelled" if you found explicit
  evidence it was cancelled or postponed
- "source_url": the URL where you found this event

RECURRING EVENTS: some things you find won't be a single one-off date -
a farmers market every Wednesday and Saturday for a season, a weekly
storytime, a monthly meeting on a fixed schedule. For these, create a
SEPARATE entry in the array for each individual occurrence date that falls
within the next 30 days from ${todayStr} - don't summarize a recurring
schedule as one vague entry.

This is a general community bulletin. Adult-audience events are completely
fine to include — bars, breweries, wine tastings, 21+ nights, comedy shows,
and similar are all normal community events, include them. The only thing
to exclude is events centered on sexual or explicit adult content. Skip
anything private or not open to the public.

If you find no qualifying events, respond with exactly: []`;

// Runs one focused search. Never throws - on any failure (API error,
// unparseable response), returns an empty candidate list plus error info,
// so one bad batch doesn't take down the other batches running alongside it.
async function runSearchBatch(anthropic, label, promptBody, maxTokens, useWebSearch = true) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: promptBody }],
      ...(useWebSearch ? { tools: [{ type: "web_search_20250305", name: "web_search" }] } : {}),
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    const firstBracket = rawText.indexOf("[");
    const lastBracket = rawText.lastIndexOf("]");
    const text = firstBracket !== -1 && lastBracket !== -1 ? rawText.slice(firstBracket, lastBracket + 1) : rawText;

    const candidates = JSON.parse(text);
    return { label, candidates, error: null };
  } catch (err) {
    return {
      label,
      candidates: [],
      error: { message: err.message, raw: (err.rawText || "").slice(0, 1000) },
    };
  }
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const configuredSecret = process.env.CRON_SECRET;

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
  const schema = SCHEMA_INSTRUCTIONS(todayStr);

  const priorityPrompt = `You are researching community events for a local town bulletin.
Rutherford, NJ is this bulletin's main town. Check these specific sources
and pull in every event that falls in the next 30 days from ${todayStr}:

- ${"https://www.rutherfordboronj.com/resident/calendar"} — Rutherford
  Borough's official events calendar.
- ${"https://www.rutherfordboronj.com/government/news/"} — Rutherford
  Borough's government news page. Include events, public meetings, or
  sign-up opportunities (registrations, deadlines, civic participation).
- ${"https://www.rutherfordboronj.com/resident/farmers-market"} —
  Rutherford's farmers market page. Find its current recurring schedule
  (e.g. Wednesdays and Saturdays) and follow the RECURRING EVENTS
  instructions below to list each individual market day in the window.
- ${"https://www.instagram.com/rutherfordartscouncil_nj/"} — the
  Rutherford Arts Council's Instagram (public account, but Instagram
  limits what's searchable — include anything found, don't worry if empty).
- ${"https://rutherfordartscouncil.org/"} — the Rutherford Arts Council's
  own website — check for an events/calendar page.

Search specifically for content from these pages (e.g. "rutherfordboronj.com
calendar events", "rutherfordboronj.com farmers market"), not just
Rutherford in general, to make sure these specific sources get covered.
${schema}`;

  const generalPrompt = `You are researching community events for a local town bulletin.
Search the web for real, upcoming public events happening in the next 30 days
from ${todayStr} in these New Jersey towns: ${TOWNS.join(", ")}.

Check sources like each town's official website, public libraries,
recreation departments, chambers of commerce, school district and PTA
pages, churches and civic organizations, Patch.com town pages, and public
event listings (Facebook, Eventbrite, etc). Include farmers markets, town
council or board meetings, concerts, kids' programs, sports leagues,
community fairs, and anything residents might want to sign up for.
${schema}`;

  const meadowlandsPrompt = `You are researching community events for a local town bulletin
covering Rutherford, NJ and nearby towns (${TOWNS.join(", ")}).

Beyond those specific towns, search for larger public fairs, festivals,
and community events happening anywhere in the broader Meadowlands region
of NJ in the next 30 days from ${todayStr} — e.g. Meadowlands-area fairs,
public events at MetLife Stadium or the American Dream complex, county-level
Meadowlands events. Use the event's actual town or venue name in the "town"
field (e.g. "Secaucus", "MetLife Stadium").
${schema}`;

  const feedTexts = await Promise.all(RSS_FEEDS.map(fetchFeedText));
  const feedSections = feedTexts
    .map((text, i) => (text ? `--- FEED ${i + 1} (${RSS_FEEDS[i]}) ---\n${text}` : null))
    .filter(Boolean);

  const rssPrompt =
    feedSections.length > 0
      ? `You are extracting community events for a local town bulletin covering
Rutherford, NJ and nearby towns from raw RSS feed content below. This
content comes from social media accounts local to the area, already
fetched directly - read through it and pull out anything that describes a
real, upcoming public event happening in the next 30 days from ${todayStr}.
Ignore items that aren't event announcements (general updates, photos with
no event info, etc). If a post doesn't give a clear date, do your best to
infer it from context (e.g. "posted" date plus "this Saturday"), and skip
it if you genuinely can't determine a date.

${feedSections.join("\n\n")}
${schema}`
      : null;

  const batchPromises = [
    runSearchBatch(anthropic, "priority-sources", priorityPrompt, 10000),
    runSearchBatch(anthropic, "general-towns", generalPrompt, 8000),
    runSearchBatch(anthropic, "meadowlands", meadowlandsPrompt, 6000),
  ];
  if (rssPrompt) {
    // No web_search needed here - the content's already been fetched directly.
    batchPromises.push(runSearchBatch(anthropic, "rss-feeds", rssPrompt, 6000, false));
  }

  const batchResults = await Promise.all(batchPromises);

  const allCandidates = batchResults.flatMap((b) => b.candidates);
  const batchErrors = batchResults.filter((b) => b.error).map((b) => ({ batch: b.label, ...b.error }));
  const feedsFetched = feedSections.length;
  const feedsFailed = RSS_FEEDS.length - feedsFetched;

  const { data: existingRows, error: fetchError } = await supabaseAdmin
    .from("events")
    .select("id, title, date, town, status, time, description, location, category, source_url, source")
    .gte("date", todayStr);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  // Mutable working copy — grows as we insert, so duplicates found later
  // in this same run (whether from the same batch or a different one) get
  // correctly recognized instead of inserted twice.
  const existing = [...(existingRows || [])];

  let inserted = 0;
  let cancelled = 0;
  let enriched = 0;
  let skipped = 0;
  let filtered = 0;
  const errors = [];

  for (const c of allCandidates) {
    if (!c.title || !c.date || !c.town) {
      skipped++;
      continue;
    }

    if (containsBlockedContent(c)) {
      filtered++;
      continue;
    }

    const match = existing.find(
      (e) => e.town === c.town && e.date === c.date && titlesLikelySame(e.title, c.title)
    );

    if (match) {
      const patch = {};

      if (c.status === "cancelled" && match.status !== "cancelled") {
        patch.status = "cancelled";
      }

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
        } else {
          Object.assign(match, patch); // keep our in-memory copy in sync too
          if (patch.status === "cancelled") cancelled++;
          else enriched++;
        }
      } else {
        skipped++;
      }
      continue;
    }

    const { data: insertedRow, error } = await supabaseAdmin
      .from("events")
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      errors.push(error.message);
    } else {
      inserted++;
      existing.push(insertedRow); // so later duplicates in this same run get caught
    }
  }

  return Response.json({
    found: allCandidates.length,
    inserted,
    cancelled,
    enriched,
    skipped,
    filtered,
    errors,
    batchErrors,
    feedsFetched,
    feedsFailed,
  });
}
