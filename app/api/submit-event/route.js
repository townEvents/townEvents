import { Resend } from "resend";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyTurnstile } from "../../../lib/turnstile";
import { cleanSubmission } from "../../../lib/submission";
import { todayStrEastern } from "../../../lib/dates";

// Public submissions go into their own table (event_submissions), never the
// live events table - they only reach the site after being reviewed by hand.
// The table has no public access at all; this route (using the server-side
// key) is the only way in. Each submission is saved first, then the site owner
// is emailed about it, so nothing is lost if the email step fails.

const MAX_BODY_CHARS = 10000;
const MAX_PER_HOUR = 20; // site-wide, so a flood can't fill the table or the email quota
const MAX_UNREVIEWED = 300;

export async function POST(request) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return Response.json({ error: "That submission is too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch (err) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Hidden "honeypot" field: real visitors never see or fill it in, bots that
  // auto-fill every field do. Pretend it worked so they don't adapt.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return Response.json({ success: true });
  }

  const cleaned = cleanSubmission(body, todayStrEastern());
  if (!cleaned.ok) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verified = await verifyTurnstile(body.turnstileToken, ip, "event_submission");
  if (!verified) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: "Submissions aren't available right now." }, { status: 500 });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: recent }, { count: unreviewed }] = await Promise.all([
    supabaseAdmin.from("event_submissions").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
    supabaseAdmin.from("event_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if ((recent || 0) >= MAX_PER_HOUR || (unreviewed || 0) >= MAX_UNREVIEWED) {
    return Response.json({ error: "We're getting a lot of submissions right now. Please try again later." }, { status: 429 });
  }

  const { data: saved, error } = await supabaseAdmin.from("event_submissions").insert(cleaned.value).select("id").single();
  if (error || !saved) {
    return Response.json({ error: "Couldn't save your submission. Please try again in a moment." }, { status: 500 });
  }

  // Tell the site owner. Plain text only, with the submitter (if they left an
  // email) as reply-to. If this fails the submission is still saved, so the
  // visitor still gets a success; `notified` stays false to show it.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.CONTACT_TO_EMAIL) {
    try {
      const s = cleaned.value;
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: process.env.CONTACT_TO_EMAIL,
        ...(s.contact_email ? { replyTo: s.contact_email } : {}),
        subject: `New event submission: ${s.title}`,
        text: [
          "A new event was submitted and is waiting for your review.",
          "",
          `Event: ${s.title}`,
          `Date: ${s.event_date}`,
          `Location: ${s.location}`,
          `Link (unverified): ${s.url}`,
          "",
          "Description:",
          s.description || "(none)",
          "",
          "Submitter details (all optional):",
          `Name: ${s.contact_name || "(not given)"}`,
          `Email: ${s.contact_email || "(not given)"}`,
          `Phone: ${s.contact_phone || "(not given)"}`,
          "",
          "--",
          "Saved in the event_submissions table. It is not on the site until you approve it.",
        ].join("\n"),
      });
      if (sendError) {
        console.error("Submission email failed:", sendError.message);
      } else {
        await supabaseAdmin.from("event_submissions").update({ notified: true }).eq("id", saved.id);
      }
    } catch (err) {
      console.error("Submission email failed:", err.message);
    }
  } else {
    console.error("Submission email not sent: missing RESEND_API_KEY, RESEND_FROM_EMAIL or CONTACT_TO_EMAIL");
  }

  return Response.json({ success: true });
}
