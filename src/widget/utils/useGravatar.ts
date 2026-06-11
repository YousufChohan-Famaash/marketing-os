import { useEffect, useState } from 'react';
import type { CapturedField, Message } from '../types/domain';

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

// Hash → URL is stable, so cache across the whole session to avoid re-hashing.
const cache = new Map<string, string>();

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Find the lead's email. Prefers a captured field, but the backend doesn't
 * always emit a `field_captured` for it, so we fall back to scanning the
 * conversation text (in intake the only email present is the lead's). Scans
 * newest-first so a corrected email wins.
 */
export function findLeadEmail(
  capturedFields: Record<string, CapturedField>,
  messages?: Message[],
): string | undefined {
  for (const f of Object.values(capturedFields)) {
    if (!f.value) continue;
    if (f.type === 'email' || EMAIL_RE.test(f.value.trim())) {
      const m = f.value.trim().match(EMAIL_RE);
      if (m) return m[0];
    }
  }
  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i].content?.match(EMAIL_RE);
      if (m) return m[0];
    }
  }
  return undefined;
}

/**
 * Resolve a Gravatar URL for an email. Gravatar accepts a SHA-256 hash of the
 * lowercased, trimmed email (computed here via SubtleCrypto, so no md5 dep).
 * `d=404` makes it 404 when the person has no Gravatar — the <Avatar> then
 * falls back (or renders nothing), so we only ever show a real photo.
 * Returns undefined until the hash resolves or when there's no email.
 */
export function useGravatar(email?: string | null, size = 64): string | undefined {
  const normalized = email?.trim().toLowerCase() ?? '';
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!normalized || typeof crypto === 'undefined' || !crypto.subtle) {
      setUrl(undefined);
      return;
    }
    const build = (hash: string) =>
      `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;

    const cached = cache.get(normalized);
    if (cached) {
      setUrl(build(cached));
      return;
    }

    let active = true;
    void sha256Hex(normalized)
      .then((hash) => {
        cache.set(normalized, hash);
        if (active) setUrl(build(hash));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [normalized, size]);

  return url;
}
