import { cleanBlock, cleanContactEmail } from "./submission";

// The public "Contact" form: just an email address (so a reply is possible)
// and a message - no name. Cleaned with the same rules as event submissions:
// wrong types rejected, HTML/control/invisible characters stripped, lengths
// enforced.

export const CONTACT_LIMITS = { message: 2000 };

// Returns { ok: true, value } with cleaned fields, or { ok: false, error }
// with a message that's safe to show the visitor.
export function cleanContact(body) {
  const input = body && typeof body === "object" ? body : {};

  const email = cleanContactEmail(input.email);
  if (!email.ok || !email.value) return { ok: false, error: "Please enter a valid email address so we can reply." };

  const message = cleanBlock(input.message);
  if (!message) return { ok: false, error: "Please enter a message." };
  if (message.length > CONTACT_LIMITS.message) {
    return { ok: false, error: `Messages must be ${CONTACT_LIMITS.message} characters or fewer.` };
  }

  return { ok: true, value: { email: email.value, message } };
}
