import { Resend } from "resend";

async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // Not configured yet - skip verification rather than blocking every
    // signup. Add TURNSTILE_SECRET_KEY to actually enforce this.
    return true;
  }
  if (!token) return false;

  try {
    const params = new URLSearchParams();
    params.append("secret", process.env.TURNSTILE_SECRET_KEY);
    params.append("response", token);
    if (ip) params.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    // If Cloudflare's own verification service is unreachable, fail open
    // rather than blocking real signups over an outage on their end.
    return true;
  }
}

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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const verified = await verifyTurnstile(body.turnstileToken, ip);
  if (!verified) {
    return Response.json({ error: "Verification failed. Please try again." }, { status: 400 });
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
