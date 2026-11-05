import { Resend } from "resend";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { verifyTurnstile } from "../../../lib/turnstile";
import { cleanContact } from "../../../lib/contact";

// Contact form: every message is saved to contact_messages (a table with no
// public access) and then emailed to the site owner. The save comes first, so
// a message is never lost if the email step fails. Messages are capped
// site-wide per hour so a flood can't use up the email quota that the weekly
// newsletter also depends on.

const MAX_BODY_CHARS = 10000;
const MAX_PER_HOUR = 10;
const MAX_UNHANDLED = 200;

export async function POST(request) {
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return Response.json({ error: "That message is too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch (err) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Hidden honeypot field: real visitors never fill it in, bots do.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return Response.json({ success: true });
  }

  const cleaned = cleanContact(body);
  if (!cleaned.ok) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verified = await verifyTurnstile(body.turnstileToken, ip);
  if (!verified) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: "Messages aren't available right now." }, { status: 500 });
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: recent }, { count: unhandled }] = await Promise.all([
    supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
    supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if ((recent || 0) >= MAX_PER_HOUR || (unhandled || 0) >= MAX_UNHANDLED) {
    return Response.json({ error: "We're getting a lot of messages right now. Please try again later." }, { status: 429 });
  }

  const { data: saved, error } = await supabaseAdmin.from("contact_messages").insert(cleaned.value).select("id").single();
  if (error || !saved) {
    return Response.json({ error: "Couldn't send your message. Please try again in a moment." }, { status: 500 });
  }

  // Email it to the site owner. Plain text only, with the visitor as the
  // reply-to so "Reply" goes straight to them. If this step fails the message
  // is still safely saved, so the visitor still gets a success.
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.CONTACT_TO_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: process.env.CONTACT_TO_EMAIL,
        replyTo: cleaned.value.email,
        subject: `Website contact from ${cleaned.value.email}`,
        text: [
          cleaned.value.message,
          "",
          "--",
          `Name: ${cleaned.value.name || "(not given)"}`,
          `Email: ${cleaned.value.email}`,
          `Phone: ${cleaned.value.phone || "(not given)"}`,
          "Sent through the Rutherford Bulletin contact form. Reply to this email to answer the sender.",
        ].join("\n"),
      });
      if (sendError) {
        console.error("Contact email failed:", sendError.message);
      } else {
        await supabaseAdmin.from("contact_messages").update({ emailed: true }).eq("id", saved.id);
      }
    } catch (err) {
      console.error("Contact email failed:", err.message);
    }
  } else {
    console.error("Contact email not sent: missing RESEND_API_KEY, RESEND_FROM_EMAIL or CONTACT_TO_EMAIL");
  }

  return Response.json({ success: true });
}
