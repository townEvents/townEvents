import { Resend } from "resend";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_AUDIENCE_ID) {
    return Response.json({ error: "Email signup isn't configured yet." }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.contacts.create({
    email,
    unsubscribed: false,
    audienceId: process.env.RESEND_AUDIENCE_ID,
  });

  if (error) {
    // Resend returns an error if the contact already exists - treat that
    // as a friendly "you're already on the list" rather than a failure.
    const message = (error.message || "").toLowerCase();
    if (message.includes("already exists") || message.includes("duplicate")) {
      return Response.json({ duplicate: true });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
