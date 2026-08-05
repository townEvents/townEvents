import { Resend } from "resend";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import WeeklyDigest from "../../../../emails/WeeklyDigest";

export const maxDuration = 60;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShort(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "1";

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 6); // Monday through Sunday
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const { data: events, error: fetchError } = await supabaseAdmin
    .from("events")
    .select("*")
    .in("status", ["approved", "cancelled"])
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true });

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const grouped = [];
  const byDate = new Map();
  (events || []).forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach((entry) => grouped.push(entry));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rutherfordbulletin.com";
  const subject = `This Week in Rutherford & Nearby — ${formatShort(start)}–${formatShort(end)}`;

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return Response.json({ error: "Missing RESEND_API_KEY or RESEND_FROM_EMAIL" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const emailElement = WeeklyDigest({ grouped, siteUrl });

  if (isTest) {
    if (!process.env.TEST_EMAIL_ADDRESS) {
      return Response.json({ error: "Set TEST_EMAIL_ADDRESS to use test mode" }, { status: 500 });
    }
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.TEST_EMAIL_ADDRESS,
      subject: `[TEST] ${subject}`,
      react: emailElement,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ mode: "test", sentTo: process.env.TEST_EMAIL_ADDRESS, eventCount: (events || []).length, id: data?.id });
  }

  if (!process.env.RESEND_AUDIENCE_ID) {
    return Response.json({ error: "Missing RESEND_AUDIENCE_ID" }, { status: 500 });
  }

  // Resend's docs currently show broadcasts targeted by "segmentId", while
  // contacts are added to an "audienceId" (see app/api/subscribe/route.js).
  // In practice these are often the same ID from the same Audience in your
  // dashboard, but Resend has been evolving this naming. Passing both here
  // as a safe bet — if the API rejects one as an unrecognized field, drop it.
  const { data, error } = await resend.broadcasts.create({
    audienceId: process.env.RESEND_AUDIENCE_ID,
    segmentId: process.env.RESEND_AUDIENCE_ID,
    from: process.env.RESEND_FROM_EMAIL,
    subject,
    react: emailElement,
    send: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ mode: "broadcast", eventCount: (events || []).length, broadcastId: data?.id });
}
