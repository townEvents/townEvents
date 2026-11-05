// Server-side check of a Cloudflare Turnstile token. A request only passes if
// Cloudflare confirms the token is real and unused, it was issued for the
// expected form (action), and it came from this site (hostname). Anything
// else - including Cloudflare being unreachable - is a failure, so bots can't
// get through by breaking the check.
//
// If TURNSTILE_SECRET_KEY isn't set at all (local development and preview
// deployments) the check is skipped, because there is no widget to produce a
// token there. In production that is logged loudly, since it means the forms
// have no bot protection.

const DEFAULT_HOSTNAMES = ["www.rutherfordbulletin.com", "rutherfordbulletin.com"];

export async function verifyTurnstile(token, ip, expectedAction) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is not set: form submissions are not being checked for bots.");
    }
    return true;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const hostnames = (process.env.TURNSTILE_HOSTNAMES || DEFAULT_HOSTNAMES.join(","))
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  try {
    const params = new URLSearchParams();
    params.append("secret", process.env.TURNSTILE_SECRET_KEY);
    params.append("response", token);
    if (ip) params.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;

    const data = await res.json();
    if (data.success !== true) return false;
    if (expectedAction && data.action !== expectedAction) return false;
    return hostnames.includes(String(data.hostname).toLowerCase());
  } catch (err) {
    return false;
  }
}
