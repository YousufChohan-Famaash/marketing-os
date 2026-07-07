/**
 * Remembering the visitor's contact details (phone / name / email) so the quick
 * contact actions — "Call me now", "I need help now", "Text me", "Schedule a
 * callback" — auto-fill instead of asking for the number again.
 *
 * Within a session the details come straight from what the chat has captured
 * (contactFromFields). Across a reload they're cached in sessionStorage, keyed
 * per firm so one firm's visitors never leak into another's on a shared widget
 * origin. sessionStorage (not localStorage) mirrors the conversation-id policy
 * and keeps a phone number off the device once the tab closes.
 */

export interface LeadContact {
  phone?: string;
  name?: string;
  email?: string;
}

const STORAGE_PREFIX = 'famaash_contact_';
const storageKey = (firmId: string) => `${STORAGE_PREFIX}${firmId}`;

const PHONE_RE = /\+?\d[\d\s()-]{6,}/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function trimmed(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Drop empties + trim so we never persist or merge blank values. */
export function cleanContact(c: LeadContact): LeadContact {
  const out: LeadContact = {};
  const phone = trimmed(c.phone);
  const name = trimmed(c.name);
  const email = trimmed(c.email);
  if (phone) out.phone = phone;
  if (name) out.name = name;
  if (email) out.email = email;
  return out;
}

/** Read the remembered contact for a firm. Best-effort; storage may be blocked. */
export function loadLeadContact(firmId: string | null | undefined): LeadContact {
  if (!firmId || typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(storageKey(firmId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return cleanContact({ phone: trimmed(parsed.phone), name: trimmed(parsed.name), email: trimmed(parsed.email) });
  } catch {
    return {};
  }
}

/** Persist the (already-merged) contact for a firm. No-op when empty or blocked. */
export function persistLeadContact(firmId: string | null | undefined, contact: LeadContact): void {
  if (!firmId || typeof sessionStorage === 'undefined') return;
  const clean = cleanContact(contact);
  if (!clean.phone && !clean.name && !clean.email) return;
  try {
    sessionStorage.setItem(storageKey(firmId), JSON.stringify(clean));
  } catch {
    /* storage blocked (strict iframe / private mode) — auto-fill just won't survive reloads */
  }
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
    const label = `${id} ${f.name ?? ''}`;
    if (!out.phone && (f.type === 'phone' || PHONE_RE.test(value))) out.phone = value;
    else if (!out.email && (f.type === 'email' || EMAIL_RE.test(value))) out.email = value;
    else if (!out.name && (f.type === 'name' || /name/i.test(label))) out.name = value;
  }
  return out;
}
