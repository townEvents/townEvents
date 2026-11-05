import { cleanBlock, cleanContactEmail, cleanContactName, cleanContactPhone, LIMITS } from "./submission";

// The public "Contact" form: an email address (required, so a reply is
// possible), a message, and an optional name and phone number. Cleaned with
// the same rules as event submissions: wrong types rejected, HTML/control/
// invisible characters stripped, lengths and formats enforced.

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

  const name = cleanContactName(input.name);
  if (!name.ok) return { ok: false, error: `Your name must be ${LIMITS.name} characters or fewer. It's optional, so you can leave it blank.` };

  const phone = cleanContactPhone(input.phone);
  if (!phone.ok) return { ok: false, error: "That phone number doesn't look right. It's optional, so you can leave it blank." };

  return { ok: true, value: { email: email.value, message, name: name.value, phone: phone.value } };
}
