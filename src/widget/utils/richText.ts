/**
 * Tiny markdown-light parser for AI messages.
 *
 * Supports exactly three syntaxes:
 *   **bold**            -> strong
 *   *italic*            -> em
 *   [text](url)         -> a (new tab, rel=noopener)
 *
 * Also auto-linkifies bare http(s):// URLs.
 *
 * SECURITY (critical-tier per spec):
 *   Rejects `javascript:`, `data:`, and `vbscript:` URL schemes (and variants
 *   with whitespace, case mixing, HTML entities). Allowed: https, http,
 *   mailto, sms, tel. Unsafe URLs are rendered as plain text so the user sees
 *   the raw payload rather than a clickable trap.
 */

export type RichTextNode =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: RichTextNode[] }
  | { kind: 'italic'; children: RichTextNode[] }
  | { kind: 'link'; href: string; children: RichTextNode[] };

const ALLOWED_SCHEMES = ['https:', 'http:', 'mailto:', 'sms:', 'tel:'];

/**
 * Match every C0 control character (U+0000 - U+001F) plus DEL (U+007F).
 * Built via RegExp() with explicit code points so no literal control bytes
 * appear in the source file (which would otherwise be invisible in editors).
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/**
 * Returns the URL as-is if its scheme is on the allow-list, otherwise null.
 * Defends against `javascript:`, `data:`, `vbscript:`, whitespace tricks,
 * case-mixed schemes, and HTML-entity-encoded scheme prefixes.
 */
export function sanitizeUrl(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const decoded = decodeHtmlEntities(raw).trim();
  if (decoded.length === 0) return null;

  const stripped = decoded.replace(CONTROL_CHARS, '');

  // Protocol-relative (`//example.com`) and absolute paths/fragments are safe.
  if (stripped.startsWith('//') || stripped.startsWith('/') || stripped.startsWith('#')) {
    return stripped;
  }

  // If there's no `:` in the URL it's relative — treat as safe.
  const colonIdx = stripped.indexOf(':');
  if (colonIdx === -1) return stripped;

  const scheme = stripped.slice(0, colonIdx + 1).toLowerCase();
  if (!ALLOWED_SCHEMES.includes(scheme)) return null;

  return stripped;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// ─────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const BOLD_RE = /\*\*([^*]+)\*\*/;
const ITALIC_RE = /(?<![*\w])\*([^*\n]+)\*(?!\w)/;
const URL_RE = /\b(https?:\/\/[^\s<>]+[^\s<>.,;:!?])/;

/**
 * Parse a markdown-light string into a node tree. Plain text passes through
 * unchanged; unmatched syntaxes (e.g. an unclosed `**`) are treated as text.
 */
export function parseRichText(input: string): RichTextNode[] {
  if (!input) return [];
  return parseInline(input);
}

function parseInline(input: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    const linkMatch = LINK_RE.exec(remaining);
    const boldMatch = BOLD_RE.exec(remaining);
    const italicMatch = ITALIC_RE.exec(remaining);
    const urlMatch = URL_RE.exec(remaining);

    const candidates: Array<{
      index: number;
      kind: 'link' | 'bold' | 'italic' | 'url';
      match: RegExpExecArray;
    }> = [];
    if (linkMatch) candidates.push({ index: linkMatch.index, kind: 'link', match: linkMatch });
    if (boldMatch) candidates.push({ index: boldMatch.index, kind: 'bold', match: boldMatch });
    if (italicMatch) candidates.push({ index: italicMatch.index, kind: 'italic', match: italicMatch });
    if (urlMatch) candidates.push({ index: urlMatch.index, kind: 'url', match: urlMatch });

    if (candidates.length === 0) {
      nodes.push({ kind: 'text', value: remaining });
      break;
    }

    candidates.sort((a, b) => a.index - b.index);
    const next = candidates[0];

    if (next.index > 0) {
      nodes.push({ kind: 'text', value: remaining.slice(0, next.index) });
    }

    if (next.kind === 'link') {
      const [whole, label, rawUrl] = next.match;
      const safe = sanitizeUrl(rawUrl);
      if (safe) {
        nodes.push({ kind: 'link', href: safe, children: parseInline(label) });
      } else {
        // Unsafe URL: render the whole [label](url) literally as text so the
        // user sees it instead of a clickable trap.
        nodes.push({ kind: 'text', value: whole });
      }
      remaining = remaining.slice(next.index + whole.length);
    } else if (next.kind === 'bold') {
      const [whole, inner] = next.match;
      nodes.push({ kind: 'bold', children: parseInline(inner) });
      remaining = remaining.slice(next.index + whole.length);
    } else if (next.kind === 'italic') {
      const [whole, inner] = next.match;
      nodes.push({ kind: 'italic', children: parseInline(inner) });
      remaining = remaining.slice(next.index + whole.length);
    } else {
      // bare URL
      const [whole] = next.match;
      const safe = sanitizeUrl(whole);
      if (safe) {
        nodes.push({
          kind: 'link',
          href: safe,
          children: [{ kind: 'text', value: whole }],
        });
      } else {
        nodes.push({ kind: 'text', value: whole });
      }
      remaining = remaining.slice(next.index + whole.length);
    }
  }

  return nodes;
}
