/**
 * Remembering the visitor's contact details (phone / name / email) so the quick
 * contact actions — "Call me now", "I need help now", "Text me", "Schedule a
 * callback" — auto-fill instead of asking for the number again.
 *
 * IN-MEMORY ONLY, for the current chat: the details come from what the chat has
 * captured (contactFromFields) plus what the visitor typed this session, and
 * live in the store. Nothing is persisted, so a page refresh forgets the number.
 */

export interface LeadContact {
  phone?: string;
  name?: string;
  email?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// A date like "2026-05-14" is all digits + hyphens, so it slips past a naive
// phone check — exclude ISO dates explicitly.
const ISO_DATE_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
const PHONE_CHARS_RE = /^[+(]?[\d\s().-]{6,}$/;

/** A value that's actually phone-shaped: 7-15 digits, phone-only chars, no date. */
function looksLikePhone(v: string): boolean {
  const s = v.trim();
  if (!s || ISO_DATE_RE.test(s) || !PHONE_CHARS_RE.test(s)) return false;
  const digits = s.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
}

function trimmed(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Drop empties + trim so we never merge blank values. */
export function cleanContact(c: LeadContact): LeadContact {
  const out: LeadContact = {};
  const phone = trimmed(c.phone);
  const name = trimmed(c.name);
  const email = trimmed(c.email);
  // Guard the phone so a date or garbage never gets remembered as one.
  if (phone && looksLikePhone(phone)) out.phone = phone;
  if (name) out.name = name;
  if (email) out.email = email;
  return out;
}

/**
 * Derive the visitor's contact from what the chat has captured so far. Matches
 * by field type first, then falls back to a shape check on the value / field id
 * so an AI-captured "phone number" is recognised even without a typed field.
 */
export function contactFromFields(
  fields: Record<string, { type?: string; value: string | null; name?: string }>,
): LeadContact {
  const out: LeadContact = {};
  for (const [id, f] of Object.entries(fields)) {
    const value = trimmed(f.value);
    if (!value) continue;
    const type = (f.type ?? '').toLowerCase();
    // Only sniff free-text fields by shape. Typed fields (date, number, select,
    // currency, file_ref) are never contact details, so a captured accident date
    // can't masquerade as a phone.
    const generic = type === '' || type === 'text';
    const label = `${id} ${f.name ?? ''}`;

    if (!out.phone && (type === 'phone' || (generic && looksLikePhone(value)))) {
      out.phone = value;
    } else if (!out.email && (type === 'email' || (generic && EMAIL_RE.test(value)))) {
      out.email = value;
    } else if (!out.name && generic && /name/i.test(label) && !looksLikePhone(value) && !EMAIL_RE.test(value)) {
      out.name = value;
    }
  }
  return out;
}
