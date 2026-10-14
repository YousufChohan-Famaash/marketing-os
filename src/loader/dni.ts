/**
 * Dynamic number insertion (t102224): the host site's phone numbers switch to
 * the number assigned to the visitor's source, so every call says which
 * channel sent it. Runs in the loader, on the host page, before the widget.
 *
 * Three parts, each on its own:
 *   1. classify the visit (ads params, UTMs, referrer) → a source key;
 *   2. remember it in a first-party cookie (latest non-direct visit wins,
 *      30 days by default) so later pages and return visits keep the number;
 *   3. swap every tagged number (`data-dni="phone"`, `data-dni="scan"`, and
 *      any `tel:` link to the main number) to the source's number, keeping
 *      the site's own formatting. Structured data is never touched.
 *
 * The number map comes from the firm's /config (`dni` block) and is cached so
 * the second page swaps at once. Anything missing or failing leaves the main
 * number: a broken number is never acceptable.
 */

export interface DniConfig {
  enabled?: boolean;
  /** The firm's main number, what the site shows today. */
  default?: string | null;
  /** source key → number. A missing key keeps the default. */
  sources?: Record<string, string | null | undefined> | null;
  /** "last_non_direct" (default): the latest non-direct visit wins. "first": the first visit wins for the cookie's life. */
  attribution?: 'first' | 'last_non_direct' | null;
  ttl_days?: number | null;
  /** Run the swap and draw no chat launcher. */
  dni_only?: boolean;
}

/** The source keys the classifier produces. Ali maps each tracking number's lead_source to one of these. */
export const DNI_SOURCE_KEYS = [
  'google_ads', 'bing_ads', 'facebook_ads', 'gbp', 'email', 'google_organic', 'organic_search', 'social', 'directory', 'referral', 'other',
] as const;
export type DniSource = (typeof DNI_SOURCE_KEYS)[number] | 'direct';

const COOKIE = 'fl_src';
const COOKIE_AT = 'fl_src_at';
const TEST_PARAM = 'fl_test';
const WAIT_CLASS = 'dni-wait';
const DONE_ATTR = 'data-dni-done';
const CACHE_PREFIX = 'famaash_dni_';
const CACHE_TTL_MS = 10 * 60_000;
const DEFAULT_TTL_DAYS = 30;

const PAID = /^(cpc|ppc|paid|paid_social|paidsocial|display|retarget(ing)?|sem)$/i;
const SEARCH_HOSTS = /(^|\.)(bing\.com|yahoo\.[a-z.]+|duckduckgo\.com|ecosia\.org|search\.brave\.com|ask\.com|aol\.com)$/i;
const GOOGLE_HOSTS = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/i;
const SOCIAL_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|x\.com|twitter\.com|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|reddit\.com|nextdoor\.com|threads\.net)$/i;
const DIRECTORY_HOSTS = /(^|\.)(avvo\.com|justia\.com|findlaw\.com|yelp\.com|superlawyers\.com|lawyers\.com|martindale\.com|nolo\.com|bbb\.org|lawinfo\.com|hg\.org)$/i;
const DIRECTORY_SOURCES = /^(avvo|justia|findlaw|yelp|superlawyers|lawyers|martindale|nolo|bbb)$/i;

const digitsOf = (s: string | null | undefined): string => (s ?? '').replace(/\D/g, '');
/** The last ten digits: the national number, without a country code. */
const national = (s: string | null | undefined): string => digitsOf(s).slice(-10);

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}
/** The referrer is the site itself (internal navigation), with or without www. */
function sameSite(refHost: string, host: string): boolean {
  const strip = (h: string) => h.replace(/^www\./, '');
  return !!refHost && strip(refHost) === strip(host);
}

/** Where this visit came from. Checked in order; the first match wins. */
export function classifyVisit(loc: { search: string; hostname: string }, referrer: string): DniSource {
  const q = new URLSearchParams(loc.search);
  const src = (q.get('utm_source') ?? '').trim().toLowerCase();
  const med = (q.get('utm_medium') ?? '').trim().toLowerCase();
  const paid = PAID.test(med);
  if (q.has('gclid') || q.has('gbraid') || q.has('wbraid') || q.has('gad_source')) return 'google_ads';
  if (/^(google|adwords|googleads)$/.test(src) && paid) return 'google_ads';
  if (q.has('msclkid') || (/^(bing|microsoft|msn)$/.test(src) && paid)) return 'bing_ads';
  if (/^(facebook|instagram|meta|fb|ig)$/.test(src) && paid) return 'facebook_ads';
  if (/^(gbp|google_business|google_my_business|gmb|googlemybusiness)$/.test(src)) return 'gbp';
  if (/^(email|sms|text|newsletter)$/.test(med)) return 'email';
  if (src) {
    if (/^(google)$/.test(src) && /^(organic)$/.test(med)) return 'google_organic';
    if (DIRECTORY_SOURCES.test(src)) return 'directory';
    if (/^(facebook|instagram|meta|fb|ig|twitter|x|linkedin|tiktok|youtube)$/.test(src)) return 'social';
    if (paid) return 'other';
    return 'other';
  }
  const ref = hostOf(referrer);
  if (!ref || sameSite(ref, loc.hostname)) return 'direct';
  if (GOOGLE_HOSTS.test(ref)) return 'google_organic';
  if (SEARCH_HOSTS.test(ref)) return 'organic_search';
  if (SOCIAL_HOSTS.test(ref)) return 'social';
  if (DIRECTORY_HOSTS.test(ref)) return 'directory';
  return 'referral';
}

// ── the memory ──
function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}
function writeCookie(name: string, value: string, days: number): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.round(days * 86400)}; SameSite=Lax${secure}`;
  } catch { /* cookies blocked */ }
}
function session(name: string, value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(name);
    if (value === null) sessionStorage.removeItem(name); else sessionStorage.setItem(name, value);
    return value;
  } catch { return null; }
}
export function readStoredSource(): { source: DniSource; at: number } | null {
  const v = (readCookie(COOKIE) ?? session(COOKIE)) as DniSource | null;
  if (!v || v === 'direct') return null;
  const at = Number(readCookie(COOKIE_AT) ?? session(COOKIE_AT) ?? 0);
  return { source: v, at: Number.isFinite(at) ? at : 0 };
}
function remember(source: DniSource, attribution: 'first' | 'last_non_direct', ttlDays: number): DniSource {
  const stored = readStoredSource();
  if (source === 'direct') return stored?.source ?? 'direct';
  if (attribution === 'first' && stored) return stored.source;
  writeCookie(COOKIE, source, ttlDays);
  writeCookie(COOKIE_AT, String(Date.now()), ttlDays);
  session(COOKIE, source); session(COOKIE_AT, String(Date.now()));
  return source;
}

// ── the swap ──
/** Rewrite one phone string: the national digits of the old number become the new ones, in the same shape.
 *  "(973) 400-5519" → "(973) 555-0142", "+1 973 400 5519" → "+1 973 555 0142". */
export function rewriteNumber(text: string, oldNational: string, newNational: string): string {
  if (!oldNational || !newNational || oldNational.length !== 10 || newNational.length !== 10) return text;
  return text.replace(/\+?[\d(][\d\s().\- ‑‒–]{7,}\d/g, (m) => {
    const d = digitsOf(m);
    if (!d.endsWith(oldNational) || d.length > 11) return m;
    let i = d.length; // digits remaining, counted from the end
    return m.replace(/\d/g, (ch) => { i -= 1; return i < 10 ? newNational[9 - i] : ch; });
  });
}
function rewriteTel(href: string, oldNational: string, newNational: string): string {
  const d = digitsOf(href);
  if (!d.endsWith(oldNational)) return href;
  return href.replace(/\d[\d\s().\-]*\d/, (m) => rewriteNumber(m, oldNational, newNational));
}
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT']);
function swapTextNodes(root: Node, oldN: string, newN: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && (SKIP.has(n.parentElement.tagName) || n.parentElement.closest('script,style,[type="application/ld+json"]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const t of nodes) {
    const v = t.nodeValue ?? '';
    if (!/\d{3}/.test(v)) continue;
    const next = rewriteNumber(v, oldN, newN);
    if (next !== v) t.nodeValue = next;
  }
}
function swapLinks(root: ParentNode, oldN: string, newN: string, only?: (a: HTMLAnchorElement) => boolean): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href^="tel:" i]');
  links.forEach((a) => {
    if (only && !only(a)) return;
    const href = a.getAttribute('href') ?? '';
    const next = rewriteTel(href, oldN, newN);
    if (next !== href) a.setAttribute('href', next);
  });
  if (root instanceof HTMLAnchorElement) {
    const href = root.getAttribute('href') ?? '';
    if (/^tel:/i.test(href)) { const next = rewriteTel(href, oldN, newN); if (next !== href) root.setAttribute('href', next); }
  }
}
/** The number a tagged element holds: the configured main number when it's there, else the first
 *  ten-digit number in it. A tag is the firm's word that this is their phone, so a main number set
 *  wrong on the Law App (it happened twice on day one) must not stop the swap. */
function heldNumber(el: HTMLElement, mainN: string): string | null {
  const text = `${Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="tel:" i]')).map((a) => a.getAttribute('href')).join(' ')} ${el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? '' : ''} ${el.textContent ?? ''}`;
  const d = digitsOf(text);
  if (mainN && d.includes(mainN)) return mainN;
  const m = text.match(/\+?[\d(][\d\s().\- ‑‒–]{7,}\d/);
  const first = national(m ? m[0] : '');
  return first.length === 10 ? first : null;
}
function applySwap(root: ParentNode, mainN: string, newN: string): number {
  let n = 0;
  const tagged = root.querySelectorAll<HTMLElement>('[data-dni="phone"], [data-dni="scan"]');
  const list: HTMLElement[] = Array.from(tagged);
  if (root instanceof HTMLElement && (root.getAttribute('data-dni') === 'phone' || root.getAttribute('data-dni') === 'scan')) list.unshift(root);
  for (const el of list) {
    if (el.getAttribute(DONE_ATTR) === newN) continue;
    const oldN = heldNumber(el, mainN);
    if (!oldN || oldN === newN) { el.setAttribute(DONE_ATTR, newN); continue; }
    swapLinks(el, oldN, newN);
    swapTextNodes(el, oldN, newN);
    el.setAttribute(DONE_ATTR, newN);
    n += 1;
  }
  // The safety net: a tel: link to the main number that nobody tagged. Links only, never text.
  swapLinks(root, mainN, newN, (a) => !a.closest('[data-dni]') && !a.closest('[itemprop="telephone"]'));
  return n;
}
function reveal(): void {
  try { document.documentElement.classList.remove(WAIT_CLASS); } catch { /* fine */ }
}

// ── the cache ──
function readCache(firmId: string): DniConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + firmId);
    if (!raw) return null;
    const { cfg, at } = JSON.parse(raw) as { cfg: DniConfig; at: number };
    return Date.now() - at < CACHE_TTL_MS ? cfg : cfg; // stale is still better than a wait; refreshed by /config
  } catch { return null; }
}
function writeCache(firmId: string, cfg: DniConfig | null): void {
  try {
    if (cfg) localStorage.setItem(CACHE_PREFIX + firmId, JSON.stringify({ cfg, at: Date.now() }));
    else localStorage.removeItem(CACHE_PREFIX + firmId);
  } catch { /* storage blocked */ }
}

export interface Dni {
  /** The visit's source after the memory rule: what the lead carries. */
  source: DniSource;
  /** The source of this page load alone, before the cookie. */
  visit: DniSource;
  /** Apply (or re-apply) the firm's number map. null = no config: show the main number. */
  apply(cfg: DniConfig | null | undefined): void;
  /** The number the site shows right now for this visitor. */
  number(): string | null;
}

/**
 * Classify, remember, and swap as soon as a number map is known: from the
 * cache now, from /config when it lands. Exposed as `window.FamaashDNI`.
 */
export function initDni(firmId: string): Dni {
  const params = new URLSearchParams(location.search);
  const test = params.get(TEST_PARAM);
  const visit = classifyVisit(location, document.referrer);
  let cfg: DniConfig | null = readCache(firmId);
  const attribution = cfg?.attribution === 'first' ? 'first' : 'last_non_direct';
  const ttl = cfg?.ttl_days && cfg.ttl_days > 0 ? cfg.ttl_days : DEFAULT_TTL_DAYS;
  // A test link forces a source for this page only; it is never remembered.
  const source: DniSource = test && (DNI_SOURCE_KEYS as readonly string[]).includes(test) ? (test as DniSource) : remember(visit, attribution, ttl);
  let applied = false;
  let observer: MutationObserver | null = null;
  let current: string | null = null;

  const run = () => {
    if (!cfg || cfg.enabled === false || !cfg.default) { reveal(); return; }
    const mainN = national(cfg.default);
    // A number set to "organic" on the Law App answers both search keys (Ali, Oct 14).
    const target = cfg.sources?.[source] ?? ((source === 'google_organic' || source === 'organic_search') ? cfg.sources?.organic : undefined);
    const newN = national(target);
    if (!target || !newN || newN === mainN) { current = cfg.default; reveal(); return; }
    current = target;
    const go = () => { try { applySwap(document, mainN, newN); } catch { /* never break the page */ } reveal(); };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
    if (!observer && typeof MutationObserver !== 'undefined') {
      // Numbers added later (a mobile menu, a tab, an interaction) get swapped too.
      let pending = false;
      observer = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => { pending = false; try { applySwap(document, mainN, newN); } catch { /* fine */ } }, 50);
      });
      const start = () => observer?.observe(document.body, { childList: true, subtree: true });
      if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  };

  const api: Dni = {
    source, visit,
    apply(next) {
      applied = true;
      cfg = next && typeof next === 'object' ? next : null;
      writeCache(firmId, cfg);
      run();
    },
    number: () => current,
  };
  // The cached map swaps now; a page with no cache shows the main number until /config lands or 1.5 s passes.
  if (cfg) run();
  setTimeout(() => { if (!applied) reveal(); }, 1500);
  try { (window as unknown as { FamaashDNI: Dni }).FamaashDNI = api; } catch { /* fine */ }
  return api;
}

/** The ad click ids worth carrying onto a lead, from the landing URL. */
export function clickIds(search: string): { gclid?: string; msclkid?: string; fbclid?: string } {
  const q = new URLSearchParams(search);
  const out: { gclid?: string; msclkid?: string; fbclid?: string } = {};
  const g = q.get('gclid') || q.get('gbraid') || q.get('wbraid'); if (g) out.gclid = g;
  const m = q.get('msclkid'); if (m) out.msclkid = m;
  const f = q.get('fbclid'); if (f) out.fbclid = f;
  return out;
}
