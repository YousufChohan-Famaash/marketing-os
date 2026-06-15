/**
 * Famaash Chat Widget loader.
 *
 * Host-side script. Injects a launcher button and the widget iframe, sets up
 * Penpal RPC, and exposes a tiny `window.Famaash` API for programmatic control.
 *
 * Security:
 *   - The iframe is created with sandbox="allow-scripts allow-forms allow-popups allow-same-origin".
 *   - Penpal connects with an explicit childOrigin (the widget's origin).
 *   - The iframe origin is read from the script tag's src attribute.
 */

import { connectToChild, type Connection, type Methods } from 'penpal';

interface IframeMethods {
  open(): Promise<void>;
  close(): Promise<void>;
  minimize(): Promise<void>;
  setView(view: string): Promise<void>;
  setContext(metadata: Record<string, unknown>): Promise<void>;
  identify(user: { id: string; email: string; name?: string }): Promise<void>;
}

interface HostMethods {
  requestClose(): void;
  requestMinimize(): void;
  requestExpand(): void;
  requestShrink(): void;
  requestCompact(): void;
  getHostContext(): { url: string; referrer: string; utm: Record<string, string> };
  notifyEvent(event: { type: string; data: unknown }): void;
}

const LAUNCHER_ID = 'famaash-launcher';
const DOCK_ID = 'famaash-dock';
const IFRAME_ID = 'famaash-iframe';
const Z_INDEX = '2147483647';
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-same-origin';
const FALLBACK_ACCENT = '#534FEB';

const styles = `
#${DOCK_ID} {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: ${Z_INDEX};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  --fa-accent: ${FALLBACK_ACCENT};
}
#${DOCK_ID}.is-hidden { display: none; }

/* ---- expressive teaser (shared) ---- */
.fa-teaser {
  max-width: calc(100vw - 32px);
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 22px;
  box-shadow: 0 24px 56px -18px rgba(15, 23, 42, 0.44), 0 5px 16px -7px rgba(15, 23, 42, 0.2);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  position: relative;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease;
}
.fa-teaser:hover { transform: translateY(-3px); }
.fa-teaser:focus-visible { outline: 3px solid var(--fa-accent); outline-offset: 3px; }
.fa-teaser.is-min { display: none; }

/* minimize button (overlaps the video on large, sits in the corner on small) */
.fa-min {
  position: absolute; top: 11px; right: 11px; z-index: 5;
  width: 28px; height: 28px; border: none; border-radius: 9px; cursor: pointer;
  display: grid; place-items: center; backdrop-filter: blur(3px);
}
.fa-min svg { width: 15px; height: 15px; }
.fa-min.on-vid { background: rgba(18, 12, 5, 0.42); color: rgba(255, 255, 255, 0.92); }
.fa-min.on-vid:hover { background: rgba(18, 12, 5, 0.62); }
.fa-min.on-card { background: transparent; color: #94a3b8; }
.fa-min.on-card:hover { background: #f1f5f9; color: #0f172a; }

/* video surface (CSS-only; the real clip plays inside the panel on open) */
.fa-vid { position: relative; overflow: hidden; background: linear-gradient(158deg, #3a5560 0%, #21343d 48%, #122229 100%); }
.fa-vid::after { content: ""; position: absolute; inset: 0; background: radial-gradient(48% 60% at 30% 24%, rgba(255, 255, 255, 0.32), transparent 60%); }
.fa-vlive { position: absolute; left: 11px; top: 11px; z-index: 3; display: inline-flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #fff; background: rgba(8, 10, 14, 0.5); padding: 4px 8px; border-radius: 20px; }
.fa-vlive i { width: 5px; height: 5px; border-radius: 50%; background: #5BD6A0; display: inline-block; }
.fa-vplay { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; display: grid; place-items: center; border-radius: 50%; background: rgba(8, 10, 14, 0.36); border: 1.5px solid rgba(255, 255, 255, 0.42); color: #fff; backdrop-filter: blur(4px); }
.fa-vplay svg { width: 17px; height: 17px; margin-left: 2px; }
.fa-vcap { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 26px 14px 12px; background: linear-gradient(180deg, transparent, rgba(8, 6, 3, 0.74)); }
.fa-vcap b { display: block; font-size: 15px; font-weight: 700; color: #fff; line-height: 1.1; }
.fa-vcap span { display: block; font-size: 10.5px; color: rgba(255, 255, 255, 0.82); margin-top: 2px; }

/* headline + channels + status */
.fa-h { font-size: 17px; font-weight: 700; color: #0f172a; line-height: 1.2; letter-spacing: -0.01em; }
.fa-h em { font-style: normal; color: var(--fa-accent); }
.fa-ways { display: flex; gap: 7px; }
.fa-way { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 2px 8px; border-radius: 12px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.1); transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
.fa-teaser:hover .fa-way { border-color: rgba(15, 23, 42, 0.16); }
.fa-way svg { width: 18px; height: 18px; color: var(--fa-accent); }
.fa-way span { font-size: 11px; font-weight: 600; color: #334155; }
.fa-status { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: #16a34a; }
.fa-status i { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; display: inline-block; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.16); }

/* ---- LARGE: hero video on top, stacked ---- */
.fa-teaser.fa-lg { width: 344px; }
.fa-teaser.fa-lg .fa-vid { aspect-ratio: 16 / 9; }
.fa-teaser.fa-lg .fa-vplay { width: 52px; height: 52px; }
.fa-teaser.fa-lg .fa-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 13px; }
.fa-teaser.fa-lg .fa-foot { display: flex; align-items: center; gap: 7px; padding-top: 12px; border-top: 1px solid rgba(15, 23, 42, 0.08); }

/* ---- SMALL: compact card, video tile on the left ---- */
.fa-teaser.fa-sm { width: 372px; padding: 14px; }
.fa-teaser.fa-sm .fa-sm-row { display: flex; gap: 13px; align-items: stretch; }
.fa-teaser.fa-sm .fa-vid { flex: 0 0 96px; width: 96px; align-self: stretch; min-height: 96px; border-radius: 14px; }
.fa-teaser.fa-sm .fa-vplay { width: 38px; height: 38px; }
.fa-teaser.fa-sm .fa-vplay svg { width: 13px; height: 13px; }
.fa-teaser.fa-sm .fa-vlive { left: 8px; top: 8px; }
.fa-teaser.fa-sm .fa-sm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 11px; }
.fa-teaser.fa-sm .fa-sm-head { display: flex; align-items: flex-start; gap: 8px; }
.fa-teaser.fa-sm .fa-min { position: static; }
.fa-teaser.fa-sm .fa-status { margin-top: 12px; }
.fa-teaser.fa-sm .fa-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(15, 23, 42, 0.08); font-size: 10.5px; color: #94a3b8; }
.fa-teaser.fa-sm .fa-foot b { color: #64748b; font-weight: 600; }

/* ---- minimized bubble ---- */
.fa-bubble {
  display: none; width: 60px; height: 60px; border-radius: 18px; background: var(--fa-accent);
  border: none; cursor: pointer; position: relative; place-items: center;
  box-shadow: 0 12px 28px -8px rgba(15, 23, 42, 0.4);
  transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
.fa-bubble.show { display: grid; }
.fa-bubble:hover { transform: scale(1.05); }
.fa-bubble:focus-visible { outline: 3px solid var(--fa-accent); outline-offset: 3px; }
.fa-bubble svg { width: 26px; height: 26px; color: #fff; }
.fa-bubble .fa-bdot { position: absolute; right: -2px; bottom: -2px; width: 14px; height: 14px; border-radius: 50%; background: #22C55E; border: 3px solid #fff; }

#${IFRAME_ID} {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 410px;
  height: 650px;
  max-height: calc(100vh - 110px);
  border: none;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  background: white;
  z-index: ${Z_INDEX};
  color-scheme: light;
}
#${IFRAME_ID}.is-hidden { display: none; }
#${IFRAME_ID}.is-expanded {
  width: min(680px, calc(100vw - 40px));
  height: min(80vh, 800px);
}
/* Small-mode home: a compact panel that expands (to the rules above) the moment
   a conversation or channel opens. */
#${IFRAME_ID}.is-compact {
  width: 372px;
  height: 384px;
}
/* On phones the widget is always full-screen — this overrides the expanded /
   compact sizes too (declared last + equal-or-higher specificity). 100dvh
   tracks the dynamic viewport so the bottom isn't hidden behind browser chrome. */
@media (max-width: 640px) {
  #${IFRAME_ID},
  #${IFRAME_ID}.is-expanded,
  #${IFRAME_ID}.is-compact {
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }
  .fa-teaser { width: 300px; }
}
@media (prefers-reduced-motion: reduce) {
  .fa-teaser, .fa-bubble { transition: none; }
  .fa-teaser:hover, .fa-bubble:hover { transform: none; }
}
`;

function injectStyles(): void {
  if (document.getElementById('famaash-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'famaash-styles';
  tag.textContent = styles;
  document.head.appendChild(tag);
}

function parseUtm(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith('utm_')) utm[key] = value;
  });
  return utm;
}

interface DetectedTheme {
  primary?: string;
  ink?: string;
  surface?: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Normalize any CSS color string to {r,g,b,a}; the browser does the parsing. */
function parseColor(input: string | null): Rgb | null {
  if (!input) return null;
  const s = input.trim();
  if (!s || s === 'transparent' || s === 'currentColor') return null;
  let rgb = s;
  if (!/^rgba?\(/i.test(s)) {
    // hex / named / hsl — let the browser resolve it to rgb()
    try {
      const probe = document.createElement('span');
      probe.style.color = s;
      document.body.appendChild(probe);
      rgb = getComputedStyle(probe).color;
      probe.remove();
    } catch {
      return null;
    }
  }
  const m = rgb.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const p = m[1].split(/[,/]/).map((x) => Number.parseFloat(x));
  if (p.length < 3 || p.some((n, i) => i < 3 && !Number.isFinite(n))) return null;
  return { r: p[0], g: p[1], b: p[2], a: Number.isFinite(p[3]) ? p[3] : 1 };
}

function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Saturation + lightness (0..1) from rgb, for ranking "how brand-like" a color is. */
function satLight({ r, g, b }: Rgb): { s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * Sniff the embedding site's brand color. Heuristic: collect colors from the
 * <meta theme-color>, button/CTA backgrounds, and link text, then pick the most
 * saturated mid-tone one (skipping grays, near-white, near-black). Best-effort
 * and fully wrapped — any failure just yields no theme (widget keeps defaults).
 */
function detectHostTheme(): DetectedTheme | null {
  try {
    const candidates: Array<{ c: Rgb; weight: number; explicit: boolean }> = [];
    const add = (str: string | null, weight: number, explicit: boolean) => {
      const c = parseColor(str);
      if (c) candidates.push({ c, weight, explicit });
    };

    // 1) Declared brand CSS variables — the strongest signal, present on most
    //    modern sites / frameworks (Bootstrap, Ionic, Tailwind themes, etc.).
    const BRAND_VARS = [
      '--primary', '--color-primary', '--primary-color', '--brand', '--brand-color',
      '--color-brand', '--brand-primary', '--accent', '--accent-color', '--color-accent',
      '--theme-color', '--bs-primary', '--ion-color-primary', '--p-primary-color',
      '--chakra-colors-brand-500', '--mantine-primary-color-filled',
    ];
    for (const scope of [document.documentElement, document.body]) {
      const cs = getComputedStyle(scope);
      for (const v of BRAND_VARS) add(cs.getPropertyValue(v), 8, true);
    }

    // 2) <meta name="theme-color"> — an intentional brand declaration.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) add(meta.getAttribute('content'), 7, true);

    // 3) Inferred from CTA / button backgrounds + link colors.
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, .btn, .button, [class*="cta" i], [class*="btn" i], [role="button"]',
      ),
    ).slice(0, 120);
    for (const el of els) {
      const cs = getComputedStyle(el);
      add(cs.backgroundColor, 2, false);
      add(cs.color, 1, false);
    }

    const freq = new Map<string, number>();
    let best: Rgb | null = null;
    let bestScore = -1;
    for (const { c, weight, explicit } of candidates) {
      if (c.a < 0.6) continue;
      const { s, l } = satLight(c);
      // Declared brand values are trusted even when muted; inferred ones must be
      // clearly saturated so we don't mistake body text/borders for the brand.
      const minSat = explicit ? 0.06 : 0.18;
      if (s < minSat || l > 0.95 || l < 0.04) continue;
      const key = `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`;
      const seen = (freq.get(key) ?? 0) + 1;
      freq.set(key, seen);
      const score = (explicit ? 3 : 1) * s * weight * (1 - Math.abs(l - 0.45)) + seen * 0.04;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) return null;

    const bodyCs = getComputedStyle(document.body);
    const ink = parseColor(bodyCs.color);
    const surface = parseColor(bodyCs.backgroundColor);
    return {
      primary: toHex(best),
      ink: ink && ink.a >= 0.6 ? toHex(ink) : undefined,
      surface: surface && surface.a >= 0.6 ? toHex(surface) : undefined,
    };
  } catch {
    return null;
  }
}

let cachedTheme: DetectedTheme | null | undefined;
function getHostTheme(): DetectedTheme | null {
  if (cachedTheme === undefined) cachedTheme = detectHostTheme();
  return cachedTheme;
}

// Inline SVGs for the teaser (host-page DOM, so no React/icon imports here).
const SVG = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
};

const CHANNELS_HTML = `
  <span class="fa-way" data-channel="call">${SVG.phone}<span>Call</span></span>
  <span class="fa-way" data-channel="chat">${SVG.chat}<span>Chat</span></span>
  <span class="fa-way" data-channel="text">${SVG.text}<span>Text</span></span>
  <span class="fa-way" data-channel="schedule">${SVG.calendar}<span>Book</span></span>`;

function videoSurfaceHTML(name: string, large: boolean, poster?: string): string {
  const caption = large
    ? `<div class="fa-vcap"><b>Meet ${name}</b><span>A quick hello, tap to watch</span></div>`
    : '';
  // A real thumbnail when the embed provides one, dimmed for text legibility;
  // otherwise the CSS gradient surface from the stylesheet.
  const style = poster
    ? ` style="background-image:linear-gradient(rgba(8,6,3,.18),rgba(8,6,3,.5)),url('${poster.replace(/'/g, "%27")}');background-size:cover;background-position:center"`
    : '';
  return `
    <div class="fa-vid"${style}>
      <span class="fa-vlive"><i></i>LIVE</span>
      <span class="fa-vplay">${SVG.play}</span>
      ${caption}
    </div>`;
}

const MIN_STORAGE_KEY = 'famaash:launcher-min';

/**
 * Build the collapsed launcher: an expressive teaser card (live presence +
 * channel teasers) that minimizes to a small bubble. Both open the widget.
 * Themed to the host site's accent via the --fa-accent var on the dock.
 */
function makeDock(
  onOpen: (view?: string) => void,
  opts: { size: 'large' | 'small'; name: string; poster?: string },
): {
  dock: HTMLDivElement;
  setHidden: (hidden: boolean) => void;
  applyConfig: (cfg: { poster?: string | null; name?: string | null }) => void;
} {
  const dock = document.createElement('div');
  dock.id = DOCK_ID;

  const accent = getHostTheme()?.primary;
  if (accent) dock.style.setProperty('--fa-accent', accent);

  const large = opts.size !== 'small';
  const teaser = document.createElement('div');
  teaser.className = `fa-teaser ${large ? 'fa-lg' : 'fa-sm'}`;
  teaser.setAttribute('role', 'button');
  teaser.setAttribute('tabindex', '0');
  teaser.setAttribute('aria-haspopup', 'dialog');
  teaser.setAttribute('aria-label', 'Open contact options');

  const headline = `<div class="fa-h">Hurt? Talk to us <em>your way.</em></div>`;
  const minBtnHTML = (cls: string) =>
    `<button class="fa-min ${cls}" type="button" aria-label="Minimize">${SVG.minimize}</button>`;

  teaser.innerHTML = large
    ? `
      ${minBtnHTML('on-vid')}
      ${videoSurfaceHTML(opts.name, true, opts.poster)}
      <div class="fa-body">
        ${headline}
        <div class="fa-ways">${CHANNELS_HTML}</div>
        <div class="fa-foot"><span class="fa-status"><i></i>We answer in seconds, day or night</span></div>
      </div>`
    : `
      <div class="fa-sm-row">
        ${videoSurfaceHTML(opts.name, false, opts.poster)}
        <div class="fa-sm-main">
          <div class="fa-sm-head">${headline}${minBtnHTML('on-card')}</div>
          <div class="fa-ways">${CHANNELS_HTML}</div>
        </div>
      </div>
      <div class="fa-status"><i></i>A real person in ~60 sec &middot; 24/7</div>
      <div class="fa-foot"><span><b>Powered by Famaash</b></span><span>Available 24/7</span></div>`;

  const bubble = document.createElement('button');
  bubble.className = 'fa-bubble';
  bubble.id = LAUNCHER_ID;
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open contact options');
  bubble.innerHTML = `${SVG.chat}<span class="fa-bdot"></span>`;

  const minBtn = teaser.querySelector<HTMLButtonElement>('.fa-min');

  const showBubble = (minimized: boolean) => {
    teaser.classList.toggle('is-min', minimized);
    bubble.classList.toggle('show', minimized);
  };

  // Minimize → bubble (remembered for the session so we don't nag on every page).
  minBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    showBubble(true);
    try {
      sessionStorage.setItem(MIN_STORAGE_KEY, '1');
    } catch {
      /* storage may be blocked */
    }
  });

  const open = (view?: string) => onOpen(view);

  // Tapping a channel chip deep-links straight into that channel's view.
  teaser.querySelectorAll<HTMLElement>('.fa-way[data-channel]').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      open(chip.dataset.channel);
    });
  });
  // Anywhere else on the teaser (or the video) opens the home menu.
  teaser.addEventListener('click', () => open());
  teaser.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  bubble.addEventListener('click', () => open());

  let startMinimized = false;
  try {
    startMinimized = sessionStorage.getItem(MIN_STORAGE_KEY) === '1';
  } catch {
    /* ignore */
  }
  showBubble(startMinimized);

  dock.appendChild(teaser);
  dock.appendChild(bubble);

  return {
    dock,
    setHidden: (hidden: boolean) => dock.classList.toggle('is-hidden', hidden),
    // Upgrade the teaser with the firm's real config (poster, attorney name)
    // once /config resolves, so the embed snippet doesn't have to hardcode them.
    applyConfig: ({ poster, name }) => {
      if (poster) {
        const vid = teaser.querySelector<HTMLElement>('.fa-vid');
        if (vid) {
          vid.style.backgroundImage = `linear-gradient(rgba(8,6,3,.18),rgba(8,6,3,.5)),url('${poster.replace(/'/g, '%27')}')`;
          vid.style.backgroundSize = 'cover';
          vid.style.backgroundPosition = 'center';
        }
      }
      if (name) {
        const cap = teaser.querySelector<HTMLElement>('.fa-vcap b');
        if (cap) cap.textContent = `Meet ${name}`;
      }
    },
  };
}

function readScriptConfig(): {
  firmId: string;
  widgetOrigin: string;
  size: 'large' | 'small';
  name: string;
  poster?: string;
  cine: boolean;
  apiBase: string;
} {
  const script = (document.currentScript ?? document.querySelector('script[data-firm-id]')) as
    | HTMLScriptElement
    | null;
  if (!script) {
    throw new Error('[famaash] loader could not locate its script tag');
  }
  const firmId = script.getAttribute('data-firm-id') ?? 'firm_demo';
  const widgetOrigin = new URL(script.src, window.location.href).origin;
  // Launcher presentation hints from the embed snippet (set by the Law App to
  // match the firm's Branding Studio settings). The widget panel reads its own
  // size/video from /config; these style the host-page teaser and forward a
  // cinematic-open hint for testing.
  const sizeAttr = script.getAttribute('data-size');
  const size = sizeAttr === 'small' ? 'small' : 'large';
  const name = script.getAttribute('data-name') ?? 'our team';
  const poster = script.getAttribute('data-poster') ?? undefined;
  const cineAttr = script.getAttribute('data-cine');
  const cine = cineAttr === '1' || cineAttr === 'true';
  const apiBase = (script.getAttribute('data-api-base') ?? 'https://api.catafleet.com/api/v1/widget').replace(/\/+$/, '');
  return { firmId, widgetOrigin, size, name, poster, cine, apiBase };
}

(function boot() {
  const { firmId, widgetOrigin, size, name, poster, cine, apiBase } = readScriptConfig();
  injectStyles();

  let iframe: HTMLIFrameElement | null = null;
  let setDockHidden: (hidden: boolean) => void = () => undefined;
  let iframeRemote: IframeMethods | null = null;
  let connection: Connection<IframeMethods> | null = null;
  let iframeReady: Promise<IframeMethods> | null = null;

  const hostMethods: HostMethods = {
    requestClose: () => {
      iframe?.classList.add('is-hidden');
      setDockHidden(false);
    },
    requestMinimize: () => {
      iframe?.classList.add('is-hidden');
      setDockHidden(false);
    },
    requestExpand: () => {
      iframe?.classList.add('is-expanded');
      iframe?.classList.remove('is-compact');
    },
    requestShrink: () => {
      iframe?.classList.remove('is-expanded');
      iframe?.classList.remove('is-compact');
    },
    requestCompact: () => {
      iframe?.classList.add('is-compact');
      iframe?.classList.remove('is-expanded');
    },
    getHostContext: () => ({
      url: window.location.href,
      referrer: document.referrer,
      utm: parseUtm(),
    }),
    notifyEvent: (event) => {
      if (window.console && typeof window.console.debug === 'function') {
        // eslint-disable-next-line no-console
        console.debug('[famaash:event]', event);
      }
    },
  };

  function ensureIframe(view?: string): Promise<IframeMethods> {
    if (iframeReady) return iframeReady;

    const el = document.createElement('iframe');
    el.id = IFRAME_ID;
    el.title = 'Famaash chat widget';
    el.setAttribute('sandbox', SANDBOX);
    el.setAttribute('allow', 'microphone; camera; clipboard-write');
    // Inherit the host site's colors: pass the detected palette so the widget
    // can theme itself before first paint (admin override happens server-side).
    const theme = getHostTheme();
    const themeParam = theme
      ? `&theme=${encodeURIComponent(JSON.stringify(theme))}`
      : '';
    // Deep-link the very first open (before the bridge handshake is ready).
    const viewParam = view && view !== 'home' ? `&view=${encodeURIComponent(view)}` : '';
    const cineParam = cine ? '&cine=1' : '';
    el.src = `${widgetOrigin}/embed.html?firm_id=${encodeURIComponent(firmId)}${themeParam}${viewParam}${cineParam}`;
    document.body.appendChild(el);
    iframe = el;

    connection = connectToChild<IframeMethods>({
      iframe: el,
      methods: hostMethods as unknown as Methods,
      childOrigin: widgetOrigin,
      timeout: 10000,
    });

    iframeReady = connection.promise
      .then((remote: IframeMethods) => {
        iframeRemote = remote;
        return remote;
      })
      .catch((err: unknown) => {
        console.warn('[famaash] iframe connection failed', err);
        throw err;
      });

    return iframeReady;
  }

  function openWidget(view?: string): void {
    // The panel opens where the teaser sits, so hide the dock while open.
    setDockHidden(true);
    const firstOpen = !iframeReady;
    ensureIframe(view)
      .then((remote) => {
        iframe?.classList.remove('is-hidden');
        // On re-open the iframe is cached, so route via the bridge instead of src.
        if (view && view !== 'home' && !firstOpen) {
          remote.setView(view).catch(() => undefined);
        }
        return remote.open();
      })
      .catch(() => {
        iframe?.classList.add('is-hidden');
        setDockHidden(false);
      });
  }

  function closeWidget(): void {
    iframe?.classList.add('is-hidden');
    setDockHidden(false);
    iframeRemote?.close().catch(() => undefined);
  }

  const dockApi = makeDock(openWidget, { size, name, poster });
  setDockHidden = dockApi.setHidden;
  document.body.appendChild(dockApi.dock);

  // Forward the firm's real launcher media from /config (non-blocking): the
  // teaser renders instantly with the embed defaults, then upgrades its
  // thumbnail + attorney name once the Law App's config arrives. Skip when the
  // embed already hardcodes a poster.
  if (!poster) {
    fetch(`${apiBase}/config?firm_id=${encodeURIComponent(firmId)}`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: { branding?: { introVideoPoster?: string; assistantName?: string; name?: string } } | null) => {
        if (!cfg?.branding) return;
        dockApi.applyConfig({
          poster: cfg.branding.introVideoPoster,
          name: cfg.branding.assistantName ?? cfg.branding.name,
        });
      })
      .catch(() => undefined);
  }

  type FamaashApi = {
    open(): void;
    close(): void;
    identify(user: { id: string; email: string; name?: string }): void;
    setContext(data: Record<string, unknown>): void;
  };
  const api: FamaashApi = {
    open: () => openWidget(),
    close: () => closeWidget(),
    identify: (user) => {
      ensureIframe()
        .then((remote) => remote.identify(user))
        .catch(() => undefined);
    },
    setContext: (data) => {
      ensureIframe()
        .then((remote) => remote.setContext(data))
        .catch(() => undefined);
    },
  };
  (window as unknown as { Famaash: FamaashApi }).Famaash = api;
})();
