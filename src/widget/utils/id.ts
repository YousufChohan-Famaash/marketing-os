/**
 * Lightweight client-side ID generator. Uses crypto.randomUUID when available
 * (modern browsers + iframe contexts) and falls back to a counter+timestamp.
 */

let counter = 0;

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}
