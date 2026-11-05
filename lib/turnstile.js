export async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // Not configured yet - skip verification rather than blocking every
    // request. Add TURNSTILE_SECRET_KEY to actually enforce this.
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
    // rather than blocking real visitors over an outage on their end.
    return true;
  }
}
