/**
 * Famaash Chat Widget loader.
 *
 * Host-side script. Injects a launcher button and the widget iframe, sets up
 * Penpal RPC, and exposes a tiny `window.Famaash` API for programmatic control.
 *
 * Security:
 *   - The iframe is created with sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin".
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
  requestTall(): void;
  requestHome(): void;
  getHostContext(): { url: string; referrer: string; utm: Record<string, string> };
  notifyEvent(event: { type: string; data: unknown }): void;
  notifyReady(): void;
}

const LAUNCHER_ID = 'famaash-launcher';
const DOCK_ID = 'famaash-dock';
const IFRAME_ID = 'famaash-iframe';
const Z_INDEX = '2147483647';
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads allow-same-origin';
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
  --fa-bubble: var(--fa-accent);
}
#${DOCK_ID}.is-hidden { display: none; }
#${DOCK_ID}.fa-pos-left { right: auto; left: 24px; align-items: flex-start; }
#${DOCK_ID}.fa-pos-center { right: auto; left: 50%; transform: translateX(-50%); align-items: center; }
#${IFRAME_ID}.fa-pos-left { right: auto; left: 20px; }
#${IFRAME_ID}.fa-pos-center { right: auto; left: 50%; transform: translateX(-50%); }

/* ---- expressive teaser (shared) ---- */
.fa-teaser {
  max-width: calc(100vw - 32px);
  background: #fff; /* fallback when color-mix is unsupported */
  /* Subtle gradient tinted by the inherited host brand color. */
  background: linear-gradient(135deg, #fff 0%, color-mix(in srgb, var(--fa-accent) 16%, #fff) 100%);
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
/* The card background fades onto the bottom of the photo (matches the teaser's
   tinted bg so there's no white seam against the brand-colored card). */
.fa-vfade {
  position: absolute; left: 0; right: 0; bottom: 0; height: 48%; z-index: 2; pointer-events: none;
  background: linear-gradient(180deg, transparent, #fff);
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--fa-accent) 12%, #fff));
}
.fa-vplay { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3; display: grid; place-items: center; border-radius: 50%; background: rgba(8, 10, 14, 0.36); border: 1.5px solid rgba(255, 255, 255, 0.42); color: #fff; backdrop-filter: blur(4px); }
.fa-vplay svg { width: 17px; height: 17px; margin-left: 2px; }

/* headline + channels + status */
.fa-h { font-size: 17px; font-weight: 700; color: #0f172a; line-height: 1.2; letter-spacing: -0.01em; }
.fa-h em { font-style: normal; color: var(--fa-accent); }
.fa-ways { display: flex; gap: 7px; }
.fa-way { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 2px 8px; border-radius: 12px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.1); transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
.fa-way:hover { border-color: var(--fa-accent); background: color-mix(in srgb, var(--fa-accent) 10%, #fff); transform: translateY(-1px); }
.fa-way svg { width: 18px; height: 18px; color: var(--fa-accent); }
.fa-way span { font-size: 11px; font-weight: 600; color: #334155; }
.fa-lbl { white-space: nowrap; }
/* Long label, collapsed everywhere by default; the medium teaser expands it on hover. */
.fa-lbl-full { display: inline-block; max-width: 0; opacity: 0; overflow: hidden; white-space: nowrap; }
.fa-status { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: #16a34a; }
.fa-status i { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; display: inline-block; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.16); }

/* ---- LARGE: portrait video, headline overlapping, icon+label pills ---- */
.fa-teaser.fa-lg { width: 344px; }
.fa-teaser.fa-lg .fa-vid { aspect-ratio: 16 / 9; }
.fa-teaser.fa-lg .fa-vplay { width: 52px; height: 52px; }
/* Pull the body up so the headline overlaps the video's faded bottom. */
.fa-teaser.fa-lg .fa-body { position: relative; z-index: 2; margin-top: -30px; padding: 0 16px 14px; display: flex; flex-direction: column; gap: 10px; }
/* Channels as a single row of icon + label pills (no wrap), with the same accordion hover as the medium teaser. */
.fa-teaser.fa-lg .fa-ways { flex-wrap: nowrap; gap: 6px; }
.fa-teaser.fa-lg .fa-way { flex: 1 1 0; min-width: 0; flex-direction: row; align-items: center; justify-content: center; gap: 0; padding: 8px 4px; border-radius: 20px; overflow: hidden; transition: flex-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1), background 0.15s ease, border-color 0.15s ease; }
.fa-teaser.fa-lg .fa-way svg { width: 14px; height: 14px; flex-shrink: 0; }
.fa-teaser.fa-lg .fa-way span { font-size: 11.5px; color: #0f172a; }
.fa-teaser.fa-lg .fa-lbl { margin-left: 5px; max-width: 70px; opacity: 1; transition: max-width 0.45s ease, opacity 0.3s ease, margin-left 0.45s ease; }
.fa-teaser.fa-lg .fa-lbl-full { transition: max-width 0.45s ease, opacity 0.4s ease 0.1s, margin-left 0.45s ease; }
/* Hover any pill: the others ease down to even icon-chips, the hovered one takes a fair share and reveals its full label. */
.fa-teaser.fa-lg .fa-ways:hover .fa-way { flex-grow: 1; }
.fa-teaser.fa-lg .fa-ways:hover .fa-way .fa-lbl { max-width: 0; opacity: 0; margin-left: 0; }
.fa-teaser.fa-lg .fa-ways:hover .fa-way:hover { flex-grow: 5; }
.fa-teaser.fa-lg .fa-ways:hover .fa-way:hover .fa-lbl-full { max-width: 150px; opacity: 1; margin-left: 5px; }
.fa-teaser.fa-lg .fa-foot { display: flex; justify-content: center; padding-top: 10px; border-top: 1px solid rgba(15, 23, 42, 0.08); font-size: 10.5px; color: #94a3b8; }
.fa-teaser.fa-lg .fa-foot b { color: #64748b; font-weight: 600; }

/* ---- MEDIUM: a pill that collapses to just the video thumbnail while the page
       scrolls, shows the "Talk to us your way." text at rest, and grows on hover
       to reveal four (show-only) quick-action icons. Any click opens the panel. ---- */
.fa-teaser.fa-sm {
  display: inline-flex; align-items: center; width: auto; padding: 8px; background: #fff; border-radius: 999px;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease, border-radius 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.fa-teaser.fa-sm .fa-t-row { display: flex; align-items: center; gap: 13px; }
.fa-teaser.fa-sm .fa-t-thumb { position: relative; flex: 0 0 auto; line-height: 0; }
.fa-teaser.fa-sm .fa-vid {
  flex: 0 0 auto; width: 68px; height: 68px; border-radius: 50%; margin: 0; min-height: 0;
  transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1), height 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
/* Green "online" dot on the thumbnail's top-right (percentage keeps it on the
   circle as the thumbnail scales on hover). */
.fa-teaser.fa-sm .fa-t-dot { position: absolute; top: 7%; right: 7%; width: 13px; height: 13px; border-radius: 50%; background: #22c55e; border: 2px solid #fff; z-index: 3; }
.fa-teaser.fa-sm .fa-vfade { display: none; }
/* Live video preview inside the thumbnail (a person talking), muted + looping. */
.fa-teaser.fa-sm .fa-vid video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; }
.fa-teaser.fa-sm .fa-vid.has-video .fa-vplay { display: none; }
.fa-teaser.fa-sm .fa-vplay { width: 26px; height: 26px; }
.fa-teaser.fa-sm .fa-vplay svg { width: 11px; height: 11px; margin-left: 1px; }
.fa-teaser.fa-sm .fa-t-main {
  display: flex; flex-direction: column; gap: 3px; padding-right: 16px; overflow: hidden; max-width: 340px; opacity: 1;
  transition: max-width 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease, padding 0.35s;
}
.fa-teaser.fa-sm .fa-t-title { font-size: 17px; font-weight: 700; color: #0f172a; white-space: nowrap; letter-spacing: -0.01em; }
.fa-teaser.fa-sm .fa-t-title em { font-style: normal; font-weight: 500; color: #64748b; }
.fa-teaser.fa-sm .fa-t-status { font-size: 12.5px; font-weight: 500; color: #475569; white-space: nowrap; }
/* The four action icons are collapsed to zero width at rest so they never widen
   the resting pill; hover expands both their height and width. */
.fa-teaser.fa-sm .fa-t-actions {
  display: flex; gap: 8px; max-height: 0; max-width: 0; opacity: 0; margin-top: 0; overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), max-width 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease, margin-top 0.35s;
}
.fa-teaser.fa-sm .fa-t-act { width: 42px; height: 42px; border-radius: 50%; background: #eef2f7; color: #0f172a; display: grid; place-items: center; }
.fa-teaser.fa-sm .fa-t-act svg { width: 18px; height: 18px; }
/* Hover: enlarge the thumbnail and reveal the actions (grows the pill taller).
   The pill and thumbnail both stay fully round. */
.fa-teaser.fa-sm:hover { border-radius: 999px; }
.fa-teaser.fa-sm:hover .fa-vid { width: 96px; height: 96px; border-radius: 50%; }
.fa-teaser.fa-sm:hover .fa-t-actions { max-height: 52px; max-width: 240px; opacity: 1; margin-top: 6px; }
/* Scrolling: collapse to the thumbnail alone. */
.fa-teaser.fa-sm.is-scrolling .fa-t-main { max-width: 0; opacity: 0; padding-right: 0; }
.fa-teaser.fa-sm.is-scrolling .fa-t-row { gap: 0; }

/* ---- SMALL: picture-only launcher (attorney photo + greeting bubble) ---- */
.fa-pic { display: flex; align-items: center; gap: 10px; cursor: pointer; background: none; border: none; padding: 0; }
.fa-pic:focus-visible { outline: 3px solid var(--fa-accent); outline-offset: 4px; border-radius: 40px; }
.fa-pic-bubble {
  background: #fff; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 16px; padding: 10px 14px;
  box-shadow: 0 14px 32px -14px rgba(15, 23, 42, 0.4); font-size: 14px; font-weight: 600; color: #0f172a;
  position: relative; white-space: nowrap;
}
.fa-pic-bubble::after {
  content: ""; position: absolute; right: -5px; top: 50%; width: 11px; height: 11px; background: #fff;
  border-right: 1px solid rgba(15, 23, 42, 0.08); border-top: 1px solid rgba(15, 23, 42, 0.08);
  transform: translateY(-50%) rotate(45deg);
}
.fa-pic-ava {
  width: 60px; height: 60px; border-radius: 18px; flex-shrink: 0; position: relative;
  background: var(--fa-bubble) center/cover no-repeat; color: #fff; display: grid; place-items: center;
  box-shadow: 0 16px 34px -12px rgba(15, 23, 42, 0.5); transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
.fa-pic:hover .fa-pic-ava { transform: scale(1.05); }
.fa-pic-ava svg { width: 26px; height: 26px; }
.fa-pic-ava .fa-bdot { position: absolute; right: -3px; bottom: -3px; width: 15px; height: 15px; border-radius: 50%; background: #22C55E; border: 3px solid #fff; }

/* ---- minimized bubble ---- */
.fa-bubble {
  display: none; width: 60px; height: 60px; border-radius: 18px; background: var(--fa-bubble);
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
  bottom: 20px;
  right: 20px;
  width: 410px;
  /* Every view is a 9:16 (TikTok) portrait now that a video sits on each screen
     (410 x 16/9 = 729). Sits near the corner (the launcher is hidden while open,
     so we don't reserve space for it). */
  height: 729px;
  max-height: calc(100vh - 36px);
  border: none;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  background: white;
  z-index: ${Z_INDEX};
  color-scheme: light;
  /* Animate size changes between views so switching surfaces glides instead of
     snapping (anchored bottom-right, so it grows up/left). */
  transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1), height 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
#${IFRAME_ID}.is-hidden { display: none; }
/* One gentle spring entrance the first time the panel opens (no hard pop-in);
   disabled for reduced-motion. Reopen after minimize is instant. */
@keyframes fa-panel-in {
  from { opacity: 0; transform: translateY(10px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: no-preference) {
  #${IFRAME_ID}.is-entering { animation: fa-panel-in 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
}
/* Conversations + channel views: same 9:16 portrait as everything else. */
#${IFRAME_ID}.is-tall {
  height: min(729px, calc(100vh - 36px));
}
/* Home / cinematic: a full 9:16 (TikTok) portrait at the panel's 410px width
   (410 x 16/9 = 729), so the looping hero video fills a tall vertical frame and
   the contact options sit over its faded base. */
#${IFRAME_ID}.is-home {
  height: min(729px, calc(100vh - 36px));
}
/* Opt-in wide mode via the header expand control. */
#${IFRAME_ID}.is-expanded {
  width: min(680px, calc(100vw - 40px));
  height: min(80vh, 800px);
}
/* Medium/small home: a compact 9:16 portrait (372 x 16/9 = 661). */
#${IFRAME_ID}.is-compact {
  width: 372px;
  height: min(661px, calc(100vh - 36px));
}
/* On phones the widget is always full-screen — this overrides every size above
   (declared last + equal-or-higher specificity). 100dvh tracks the dynamic
   viewport so the bottom isn't hidden behind browser chrome. */
@media (max-width: 640px) {
  #${IFRAME_ID},
  #${IFRAME_ID}.is-tall,
  #${IFRAME_ID}.is-expanded,
  #${IFRAME_ID}.is-compact,
  #${IFRAME_ID}.is-home {
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }
  .fa-teaser { width: 300px; }
}
/* ---- loading placeholder: a branded skeleton of the chat panel, so a cold
       boot on a heavy host page reads as "the app is materializing", never a
       blank white box with a lonely spinner. Mirrors the widget's own
       ConnectingState so the swap on reveal is seamless. ---- */
#famaash-loading {
  position: fixed; bottom: 20px; right: 20px; width: 410px; height: 540px;
  max-height: calc(100vh - 36px);
  border: none; border-radius: 16px; background: #fff;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  z-index: ${Z_INDEX}; display: none; overflow: hidden;
}
#famaash-loading.show { display: block; }
#famaash-loading.fa-pos-left { right: auto; left: 20px; }
#famaash-loading.fa-pos-center { right: auto; left: 50%; transform: translateX(-50%); }
.fa-sk { display: flex; flex-direction: column; height: 100%; width: 100%; }
.fa-sk-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(2,6,23,0.06); }
.fa-sk-av { width: 36px; height: 36px; border-radius: 50%; flex: none; background: rgba(2,6,23,0.08); }
.fa-sk-hl { display: flex; flex-direction: column; gap: 7px; }
.fa-sk-hl > i { display: block; border-radius: 5px; background: rgba(2,6,23,0.08); }
.fa-sk-hl > i:nth-child(1) { width: 118px; height: 9px; }
.fa-sk-hl > i:nth-child(2) { width: 64px; height: 8px; }
.fa-sk-body { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.fa-sk-bub { max-width: 78%; border-radius: 16px 16px 16px 6px; padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; background: rgba(2,6,23,0.04); }
.fa-sk-bub > i { display: block; height: 9px; border-radius: 5px; background: rgba(2,6,23,0.09); }
.fa-sk-bub:not(.fa-sk-b2) > i:nth-child(1) { width: 152px; }
.fa-sk-bub:not(.fa-sk-b2) > i:nth-child(2) { width: 104px; }
.fa-sk-b2 > i { width: 120px; }
.fa-sk-typing { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.fa-sk-typing .fa-d { width: 6px; height: 6px; border-radius: 50%; background: var(--fa-accent, ${FALLBACK_ACCENT}); animation: fa-sk-dot 1.1s ease-in-out infinite; }
.fa-sk-typing .fa-d:nth-child(2) { animation-delay: .16s; }
.fa-sk-typing .fa-d:nth-child(3) { animation-delay: .32s; }
.fa-sk-txt { font: 500 12.5px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #64748B; }
.fa-sk-composer { margin: 12px; height: 44px; border-radius: 14px; flex: none; background: rgba(2,6,23,0.05); }
/* Neutral form/menu skeleton (Call / Text / Schedule / Email / home) */
.fa-sk-form { gap: 12px; }
.fa-sk-row { height: 46px; border-radius: 12px; background: rgba(2,6,23,0.05); }
.fa-sk-row-sm { height: 14px; width: 62%; border-radius: 6px; }
.fa-sk-av, .fa-sk-hl > i, .fa-sk-bub, .fa-sk-composer, .fa-sk-row { animation: fa-sk-pulse 1.5s ease-in-out infinite; }
@keyframes fa-sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes fa-sk-dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-3px); opacity: 1; } }
@media (max-width: 640px) {
  #famaash-loading { inset: 0; width: 100vw; height: 100dvh; max-height: none; border-radius: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-teaser, .fa-bubble, .fa-way, .fa-lbl, .fa-lbl-full { transition: none; }
  .fa-teaser:hover, .fa-bubble:hover { transform: none; }
  #${IFRAME_ID} { transition: none; }
  .fa-sk-av, .fa-sk-hl > i, .fa-sk-bub, .fa-sk-composer, .fa-sk-row, .fa-sk-typing .fa-d { animation: none !important; }
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
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="10.5" y1="18" x2="13.5" y2="18"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
};

// Teaser "ways" (quick-contact chips). Which appear and their order are driven
// by the firm's connect.channels config; falls back to all four when unset.
const WAY: Record<string, { icon: string; short: string; full: string }> = {
  call: { icon: SVG.phone, short: 'Call', full: 'Call me now' },
  chat: { icon: SVG.chat, short: 'Chat', full: 'Start a conversation' },
  text: { icon: SVG.text, short: 'Text', full: 'Text me on my phone' },
  schedule: { icon: SVG.calendar, short: 'Book', full: 'Schedule a call' },
};
const WAY_ORDER = ['call', 'chat', 'text', 'schedule'];
function channelsHtml(channels?: string[]): string {
  const picked = (channels ?? []).filter((k) => k in WAY);
  const use = picked.length ? picked : WAY_ORDER;
  return use
    .map((k) => {
      const w = WAY[k];
      return `<span class="fa-way" data-channel="${k}">${w.icon}<span class="fa-lbl">${w.short}</span><span class="fa-lbl-full">${w.full}</span></span>`;
    })
    .join('');
}

function videoSurfaceHTML(large: boolean, poster?: string): string {
  // A real thumbnail when the embed provides one (lightly dimmed); otherwise the
  // CSS gradient surface from the stylesheet.
  const style = poster
    ? ` style="background-image:linear-gradient(rgba(8,6,3,.12),rgba(8,6,3,.28)),url('${poster.replace(/'/g, "%27")}');background-size:cover;background-position:center"`
    : '';
  // Large gets a bottom fade so the headline can overlap the photo.
  const fade = large ? '<span class="fa-vfade"></span>' : '';
  return `
    <div class="fa-vid"${style}>
      <span class="fa-vplay">${SVG.play}</span>
      ${fade}
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
  opts: { size: 'small' | 'medium' | 'large'; name: string; poster?: string; channels?: string[]; video?: string },
): {
  dock: HTMLDivElement;
  setHidden: (hidden: boolean) => void;
  applyConfig: (cfg: { poster?: string | null; channels?: string[]; video?: string | null }) => void;
} {
  const dock = document.createElement('div');
  dock.id = DOCK_ID;

  const accent = getHostTheme()?.primary;
  if (accent) dock.style.setProperty('--fa-accent', accent);

  const setHidden = (hidden: boolean) => dock.classList.toggle('is-hidden', hidden);

  // ── SMALL: just the attorney's photo + a greeting bubble ──────────────────
  if (opts.size === 'small') {
    const pic = document.createElement('button');
    pic.className = 'fa-pic';
    pic.id = LAUNCHER_ID;
    pic.type = 'button';
    pic.setAttribute('aria-haspopup', 'dialog');
    pic.setAttribute('aria-label', 'Open chat');
    const avaStyle = opts.poster
      ? ` style="background-image:url('${opts.poster.replace(/'/g, '%27')}')"`
      : '';
    pic.innerHTML = `
      <span class="fa-pic-bubble">Hurt? Talk to us your way.</span>
      <span class="fa-pic-ava"${avaStyle}>${opts.poster ? '' : SVG.chat}<span class="fa-bdot"></span></span>`;
    pic.addEventListener('click', () => onOpen());
    dock.appendChild(pic);
    return {
      dock,
      setHidden,
      applyConfig: ({ poster }) => {
        if (!poster) return;
        const ava = pic.querySelector<HTMLElement>('.fa-pic-ava');
        if (ava) {
          ava.style.backgroundImage = `url('${poster.replace(/'/g, '%27')}')`;
          ava.innerHTML = '<span class="fa-bdot"></span>';
        }
      },
    };
  }

  const large = opts.size === 'large';
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
      ${videoSurfaceHTML(true, opts.poster)}
      <div class="fa-body">
        ${headline}
        <div class="fa-status"><i></i>A real person in ~60 sec &middot; 24/7</div>
        <div class="fa-ways">${channelsHtml(opts.channels)}</div>
        <div class="fa-foot"><span>Powered by <b>Famaash</b></span></div>
      </div>`
    : `
      <div class="fa-t-row">
        <span class="fa-t-thumb">${videoSurfaceHTML(false, opts.poster)}<i class="fa-t-dot"></i></span>
        <div class="fa-t-main">
          <div class="fa-t-title">Talk to us <em>your way.</em></div>
          <div class="fa-t-status">Online now</div>
          <div class="fa-t-actions" aria-hidden="true">
            <span class="fa-t-act">${SVG.phone}</span>
            <span class="fa-t-act">${SVG.chat}</span>
            <span class="fa-t-act">${SVG.text}</span>
            <span class="fa-t-act">${SVG.calendar}</span>
          </div>
        </div>
      </div>`;

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

  const open = (view?: string) => {
    // Re-engaging clears the minimized state: after opening the chat, minimizing
    // or closing it brings back the full teaser (not straight back to the small
    // bubble). Minimizing the teaser itself still collapses to the bubble.
    showBubble(false);
    try {
      sessionStorage.removeItem(MIN_STORAGE_KEY);
    } catch {
      /* storage may be blocked */
    }
    onOpen(view);
  };

  // Tapping a channel chip deep-links straight into that channel's view.
  // Re-run after the ways are rebuilt from /config so the new chips are wired.
  const bindWays = () => {
    teaser.querySelectorAll<HTMLElement>('.fa-way[data-channel]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        open(chip.dataset.channel);
      });
    });
  };
  bindWays();

  // Play the firm's intro clip (muted + looping) inside the medium teaser's
  // thumbnail so a live person is visible before the user even hovers. Called on
  // build and again from applyConfig once /config resolves the real video URL.
  const mountThumbVideo = (url?: string | null) => {
    if (!url || large) return;
    const vid = teaser.querySelector<HTMLElement>('.fa-vid');
    if (!vid || vid.querySelector('video')) return;
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto';
    vid.classList.add('has-video');
    vid.appendChild(v);
    void v.play().catch(() => undefined);
  };
  mountThumbVideo(opts.video);

  // Anywhere else on the teaser (or the video) opens the home menu.
  teaser.addEventListener('click', () => open());
  teaser.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  bubble.addEventListener('click', () => open());

  // Medium teaser: collapse to just the round thumbnail while the page is
  // scrolling, then hold it small for a beat after scrolling stops before easing
  // the "Talk to us your way." text back (so a quick pause doesn't flip it open).
  if (!large) {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener(
      'scroll',
      () => {
        teaser.classList.add('is-scrolling');
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => teaser.classList.remove('is-scrolling'), 1100);
      },
      { passive: true },
    );
  }

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
    setHidden,
    // Upgrade the teaser with the firm's real config (poster, attorney name)
    // once /config resolves, so the embed snippet doesn't have to hardcode them.
    applyConfig: ({ poster, channels, video }) => {
      if (poster) {
        const vid = teaser.querySelector<HTMLElement>('.fa-vid');
        if (vid) {
          vid.style.backgroundImage = `linear-gradient(rgba(8,6,3,.18),rgba(8,6,3,.5)),url('${poster.replace(/'/g, '%27')}')`;
          vid.style.backgroundSize = 'cover';
          vid.style.backgroundPosition = 'center';
        }
      }
      // Once /config resolves, play the real intro clip in the thumbnail.
      mountThumbVideo(video);
      // Rebuild the quick-contact chips from the firm's configured channels.
      if (channels && channels.length) {
        const ways = teaser.querySelector<HTMLElement>('.fa-ways');
        if (ways) {
          ways.innerHTML = channelsHtml(channels);
          bindWays();
        }
      }
    },
  };
}

function readScriptConfig(): {
  firmId: string;
  widgetOrigin: string;
  size: 'small' | 'medium' | 'large';
  /** True when the embed hardcoded data-size — that wins over the dashboard. */
  sizeExplicit: boolean;
  name: string;
  poster?: string;
  cine: boolean;
  media: boolean;
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
  // Launcher presentation hints from the embed snippet. `data-size` is an
  // optional OVERRIDE — when set it wins; otherwise the teaser size comes from
  // the firm's dashboard (connect.size in /config, applied once it loads).
  const sizeAttr = script.getAttribute('data-size');
  const sizeExplicit = sizeAttr === 'small' || sizeAttr === 'medium' || sizeAttr === 'large';
  const size: 'small' | 'medium' | 'large' = sizeExplicit ? (sizeAttr as 'small' | 'medium' | 'large') : 'large';
  const name = script.getAttribute('data-name') ?? 'our team';
  const poster = script.getAttribute('data-poster') ?? undefined;
  const cineAttr = script.getAttribute('data-cine');
  const cine = cineAttr === '1' || cineAttr === 'true';
  const mediaAttr = script.getAttribute('data-media');
  const media = mediaAttr === '1' || mediaAttr === 'true';
  const apiBase = (script.getAttribute('data-api-base') ?? 'https://api.catafleet.com/api/v1/widget').replace(/\/+$/, '');
  return { firmId, widgetOrigin, size, sizeExplicit, name, poster, cine, media, apiBase };
}

(function boot() {
  const { firmId, widgetOrigin, size, sizeExplicit, name, poster, cine, media, apiBase } = readScriptConfig();
  injectStyles();

  // Marketing attribution from the HOST page (the sandboxed iframe can't read the
  // host's URL / referrer itself). Forwarded to the widget via the iframe src so
  // POST /token can attribute the chat lead, and sent on the funnel beacons
  // below. See chat-analytics-frontend-guide.md.
  const attribution: Record<string, string> = (() => {
    const utm = parseUtm();
    const a: Record<string, string> = {};
    if (utm.utm_source) a.utm_source = utm.utm_source;
    if (utm.utm_medium) a.utm_medium = utm.utm_medium;
    if (utm.utm_campaign) a.utm_campaign = utm.utm_campaign;
    if (document.referrer) a.referrer = document.referrer;
    a.landing_path = window.location.pathname || '/';
    return a;
  })();

  // Top-of-funnel beacon: public, no auth, fire-and-forget. An unknown firm_id is
  // a soft no-op server-side; never let analytics throw into the host page.
  let openBeaconFired = false;
  const postEvent = (eventType: 'page_view' | 'widget_open', extra?: Record<string, unknown>): void => {
    try {
      void fetch(`${apiBase}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firm_id: firmId, event_type: eventType, ...extra }),
        credentials: 'omit',
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* ignore — analytics must never break the page */
    }
  };

  // Page load with the widget present → the funnel's "Visited site" stage + the
  // traffic-source signal.
  postEvent('page_view', attribution);

  let iframe: HTMLIFrameElement | null = null;
  // Whether the current iframe was booted with a consultation `ctx` in its src.
  // Prewarm creates a context-less iframe; a later ctx open must rebuild it.
  let iframeHadCtx = false;
  let setDockHidden: (hidden: boolean) => void = () => undefined;
  let launcherPos: 'bottom-left' | 'bottom-center' | 'bottom-right' | undefined;
  const positionEl = (el: HTMLElement) => {
    if (launcherPos === 'bottom-left') el.classList.add('fa-pos-left');
    else if (launcherPos === 'bottom-center') el.classList.add('fa-pos-center');
  };

  // Loading spinner shown during the panel's first (cold) boot, so opening never
  // flashes a blank panel — it's a branded spinner until the widget is ready.
  let loadingEl: HTMLDivElement | null = null;
  // The placeholder skeleton depends on WHAT is being opened: the chat view gets
  // a conversation skeleton ("Connecting you to…"), but Call / Text / Schedule /
  // Email / the home menu get a neutral form/menu skeleton — showing chat bubbles
  // + "connecting to an agent" there would be misleading.
  const showLoading = (view?: string) => {
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.id = 'famaash-loading';
      loadingEl.setAttribute('aria-hidden', 'true');
      const accent = getHostTheme()?.primary;
      if (accent) loadingEl.style.setProperty('--fa-accent', accent);
      positionEl(loadingEl);
      document.body.appendChild(loadingEl);
    }
    const head =
      '<div class="fa-sk-head"><div class="fa-sk-av"></div><div class="fa-sk-hl"><i></i><i></i></div></div>';
    const bottom = '<div class="fa-sk-composer"></div>';
    if (view === 'chat') {
      loadingEl.innerHTML =
        '<div class="fa-sk">' + head +
          '<div class="fa-sk-body">' +
            '<div class="fa-sk-bub"><i></i><i></i></div>' +
            '<div class="fa-sk-bub fa-sk-b2"><i></i></div>' +
            '<div class="fa-sk-typing"><span class="fa-d"></span><span class="fa-d"></span><span class="fa-d"></span><span class="fa-sk-txt"></span></div>' +
          '</div>' + bottom +
        '</div>';
      const txtEl = loadingEl.querySelector('.fa-sk-txt');
      if (txtEl) txtEl.textContent = name && name !== 'our team' ? `Connecting you to ${name}…` : 'Connecting…';
    } else {
      // Neutral skeleton: a few field/row placeholders + an action bar. Reads as
      // a form or menu loading, not an agent conversation.
      loadingEl.innerHTML =
        '<div class="fa-sk">' + head +
          '<div class="fa-sk-body fa-sk-form">' +
            '<div class="fa-sk-row"></div>' +
            '<div class="fa-sk-row"></div>' +
            '<div class="fa-sk-row fa-sk-row-sm"></div>' +
          '</div>' + bottom +
        '</div>';
    }
    loadingEl.classList.add('show');
  };
  const hideLoading = () => loadingEl?.classList.remove('show');

  // Reveal the panel only once the widget has actually painted (it calls
  // `notifyReady` over the bridge). This closes the gap between the Penpal
  // handshake and the widget's first paint, which otherwise flashed a blank
  // panel. A fallback timer reveals anyway if the signal is ever missed.
  let widgetPainted = false;
  let revealArmed = false;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let panelEntered = false;
  const revealPanel = () => {
    revealArmed = false;
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    hideLoading();
    if (!iframe) return;
    iframe.classList.remove('is-hidden');
    // One gentle entrance per session; a reopen after minimize stays instant.
    if (!panelEntered) {
      panelEntered = true;
      iframe.classList.add('is-entering');
      setTimeout(() => iframe?.classList.remove('is-entering'), 360);
    }
  };
  const armReveal = () => {
    if (widgetPainted) {
      revealPanel();
      return;
    }
    // The branded skeleton covers the wait, so favour showing it over revealing
    // a possibly-still-blank iframe. notifyReady reveals immediately in the
    // normal case; this fallback only matters if that signal is ever missed.
    revealArmed = true;
    revealTimer = setTimeout(revealPanel, 6000);
  };

  // Fast-path reveal: the widget pings the instant its React shell paints — well
  // before /config resolves and the Penpal bridge (which carries notifyReady) is
  // even created. Revealing then shows the widget's own connecting state right
  // away instead of sitting on the skeleton until the bridge handshake. Mirrors
  // notifyReady exactly, and is validated by source identity (the message must
  // come from our own iframe), so it changes nothing about origin security.
  window.addEventListener('message', (e: MessageEvent) => {
    if (!iframe || e.source !== iframe.contentWindow) return;
    if ((e.data as { type?: string } | null)?.type === 'famaash:painted') {
      widgetPainted = true;
      if (revealArmed) revealPanel();
    }
  });

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
      iframe?.classList.remove('is-compact', 'is-tall', 'is-home');
    },
    requestShrink: () => {
      iframe?.classList.remove('is-expanded', 'is-compact', 'is-tall', 'is-home');
    },
    requestCompact: () => {
      iframe?.classList.add('is-compact');
      iframe?.classList.remove('is-expanded', 'is-tall', 'is-home');
    },
    requestTall: () => {
      iframe?.classList.add('is-tall');
      iframe?.classList.remove('is-expanded', 'is-compact', 'is-home');
    },
    requestHome: () => {
      iframe?.classList.add('is-home');
      iframe?.classList.remove('is-expanded', 'is-compact', 'is-tall');
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
    // The widget has painted its first frame — safe to reveal the panel now.
    notifyReady: () => {
      widgetPainted = true;
      if (revealArmed) revealPanel();
    },
  };

  function ensureIframe(view?: string, ctx?: unknown): Promise<IframeMethods> {
    if (iframeReady) return iframeReady;

    const el = document.createElement('iframe');
    el.id = IFRAME_ID;
    // Created hidden; openWidget reveals it once the bridge handshake completes,
    // so a booting (blank) panel is never shown — the loading spinner covers it.
    el.classList.add('is-hidden');
    el.title = 'Chat';
    el.setAttribute('sandbox', SANDBOX);
    // `autoplay` MUST be delegated here: a cross-origin iframe can't autoplay the
    // intro video (even muted) unless the parent grants it via Permissions-Policy.
    // Without it the video loads but never starts on embedded sites (it plays in
    // the dashboard preview, which already grants autoplay).
    el.setAttribute('allow', 'autoplay; microphone; camera; clipboard-write');
    // Inherit the host site's colors: pass the detected palette so the widget
    // can theme itself before first paint (admin override happens server-side).
    const theme = getHostTheme();
    const themeParam = theme
      ? `&theme=${encodeURIComponent(JSON.stringify(theme))}`
      : '';
    // Deep-link the very first open (before the bridge handshake is ready).
    const viewParam = view && view !== 'home' ? `&view=${encodeURIComponent(view)}` : '';
    const cineParam = cine ? '&cine=1' : '';
    const mediaParam = media ? '&media=1' : '';
    // Free Consultation hand-off answers (case type, injury, timing) → the widget
    // reads `ctx` at boot and seeds POST /token so the opener acknowledges them.
    const ctxParam = ctx ? `&ctx=${encodeURIComponent(JSON.stringify(ctx))}` : '';
    // Host-page marketing attribution → the widget reads this at boot and sends
    // it on POST /token so the chat lead is attributed to its source/campaign.
    const attrParam = `&attr=${encodeURIComponent(JSON.stringify(attribution))}`;
    el.src = `${widgetOrigin}/embed.html?firm_id=${encodeURIComponent(firmId)}${themeParam}${viewParam}${cineParam}${mediaParam}${ctxParam}${attrParam}`;
    positionEl(el);
    document.body.appendChild(el);
    iframe = el;
    iframeHadCtx = ctx != null;

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

  function openWidget(view?: string, ctx?: unknown): void {
    // First launcher open this page load → the funnel's "Opened widget" stage.
    if (!openBeaconFired) {
      openBeaconFired = true;
      postEvent('widget_open');
    }
    // The panel opens where the teaser sits, so hide the dock while open.
    setDockHidden(true);
    // A consultation hand-off carries `ctx` (wizard answers) the widget reads
    // from its src at boot. If we prewarmed a context-less iframe, rebuild it
    // with the ctx so the hand-off still seeds the conversation.
    if (ctx != null && iframe && !iframeHadCtx) {
      connection?.destroy();
      iframe.remove();
      iframe = null;
      iframeReady = null;
      iframeRemote = null;
      widgetPainted = false;
    }
    const firstOpen = !iframeReady;
    // Show the skeleton unless the (prewarmed) widget has already painted — that
    // way an open mid-prewarm still shows the branded skeleton, never a blank gap.
    if (firstOpen || !widgetPainted) showLoading(view);
    // Arm the reveal. armReveal reveals immediately when the widget has already
    // painted — which is the norm now that we prewarm the iframe in the
    // background on page load, so a click opens instantly. On a cold open the
    // paint ping / notifyReady reveals the moment the shell mounts, with the
    // fallback timer as a backstop.
    armReveal();
    ensureIframe(view, ctx)
      .then((remote) => {
        // The iframe may have been prewarmed on 'home'; route it to the tapped
        // view over the bridge (the src-based view only applies to a cold open).
        if (view && view !== 'home') {
          remote.setView(view).catch(() => undefined);
        }
        void remote.open();
      })
      .catch(() => {
        revealArmed = false;
        if (revealTimer) {
          clearTimeout(revealTimer);
          revealTimer = null;
        }
        hideLoading();
        iframe?.classList.add('is-hidden');
        setDockHidden(false);
      });
  }

  function closeWidget(): void {
    iframe?.classList.add('is-hidden');
    setDockHidden(false);
    iframeRemote?.close().catch(() => undefined);
  }

  let dockApi = makeDock(openWidget, { size, name, poster });
  let currentSize = size;
  setDockHidden = dockApi.setHidden;
  document.body.appendChild(dockApi.dock);

  // Prewarm the panel in the background so opening is instant: create the hidden
  // iframe early so the widget bundle downloads, mounts, and fetches /config
  // before the user clicks — then the reveal shows already-rendered content, not
  // a 5-7s skeleton. Fire on the FIRST sign of activity (a mouse move / touch /
  // scroll usually happens seconds before the click) or a short idle fallback,
  // whichever comes first — NOT full idle, which a heavy host page (e.g. a big
  // hero video hogging bandwidth) can push out several seconds. Safe to do
  // eagerly now that the LiveKit connection is deferred to the case-type pick:
  // prewarming creates no room or lead, just the bundle + config. ensureIframe is
  // idempotent, so opening first is a no-op.
  let prewarmed = false;
  const prewarmEvents = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'scroll'] as const;
  const prewarm = () => {
    if (prewarmed) return;
    prewarmed = true;
    prewarmEvents.forEach((ev) => window.removeEventListener(ev, prewarm, true));
    if (!iframeReady) void ensureIframe().catch(() => undefined);
  };
  prewarmEvents.forEach((ev) => window.addEventListener(ev, prewarm, { once: true, passive: true, capture: true }));
  const win = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
  if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(prewarm, { timeout: 800 });
  else setTimeout(prewarm, 600);

  // Hydrate the launcher from /config (non-blocking): the teaser renders
  // instantly with the embed defaults, then upgrades its thumbnail, attorney
  // name, and position once the Law App's config arrives. Also fail closed if
  // the firm lacks the chat_widget module (403).
  fetch(`${apiBase}/config?firm_id=${encodeURIComponent(firmId)}`, { credentials: 'omit' })
    .then((r) => {
      if (r.status === 403) {
        // Module not enabled — don't show the launcher at all.
        setDockHidden(true);
        return null;
      }
      return r.ok ? r.json() : null;
    })
    .then(
      (
        cfg: {
          branding?: {
            introVideoPoster?: string;
            introVideoUrl?: string;
            launcherImageUrl?: string;
            assistantName?: string;
            name?: string;
            primaryColor?: string;
            themeSource?: 'inherit' | 'custom';
            bubbleBgColor?: string;
            fontFamily?: string;
            launcherOffsetX?: number;
            launcherOffsetY?: number;
            launcherPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right';
          };
          connect?: {
            size?: 'small' | 'medium' | 'large';
            channels?: string[];
            videoMode?: 'intro' | 'story' | 'none';
            storyVideoUrl?: string;
          };
        } | null,
      ) => {
        // The intro clip to preview in the medium teaser's thumbnail — the same
        // video the panel plays (story video in story mode, else the intro),
        // unless the firm turned video off.
        const vmode = cfg?.connect?.videoMode;
        const thumbVideo =
          vmode === 'none'
            ? undefined
            : vmode === 'story'
              ? cfg?.connect?.storyVideoUrl || cfg?.branding?.introVideoUrl
              : cfg?.branding?.introVideoUrl;

        // Teaser size from the dashboard (connect.size) — unless the embed
        // hardcoded data-size. Rebuild the dock if it differs from what we drew.
        const cfgSize = cfg?.connect?.size;
        if (!sizeExplicit && (cfgSize === 'small' || cfgSize === 'medium' || cfgSize === 'large') && cfgSize !== currentSize) {
          const wasHidden = dockApi.dock.classList.contains('is-hidden');
          dockApi.dock.remove();
          dockApi = makeDock(openWidget, { size: cfgSize, name, poster, channels: cfg?.connect?.channels, video: thumbVideo });
          currentSize = cfgSize;
          setDockHidden = dockApi.setHidden;
          document.body.appendChild(dockApi.dock);
          setDockHidden(wasHidden);
        }

        const b = cfg?.branding;
        if (!b) return;
        launcherPos = b.launcherPosition;
        positionEl(dockApi.dock);
        if (iframe) positionEl(iframe);
        // Custom theme → repaint the teaser in the firm's brand color (overrides
        // the host-site color detected at boot). 'inherit' keeps the host color.
        if (b.themeSource === 'custom' && b.primaryColor) {
          dockApi.dock.style.setProperty('--fa-accent', b.primaryColor);
        }
        // Dedicated bubble/avatar-tile color (distinct from the brand accent).
        if (b.bubbleBgColor) {
          dockApi.dock.style.setProperty('--fa-bubble', b.bubbleBgColor);
        }
        // Firm font on the host-page teaser (the panel themes itself from /config).
        if (b.fontFamily) {
          dockApi.dock.style.fontFamily = `"${b.fontFamily}", -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`;
        }
        // Launcher offsets from the screen edges (default 24px). Respect the side.
        if (typeof b.launcherOffsetY === 'number') {
          const y = `${b.launcherOffsetY}px`;
          dockApi.dock.style.bottom = y;
          if (iframe) iframe.style.bottom = y;
        }
        if (typeof b.launcherOffsetX === 'number' && launcherPos !== 'bottom-center') {
          const x = `${b.launcherOffsetX}px`;
          const side = launcherPos === 'bottom-left' ? 'left' : 'right';
          dockApi.dock.style[side] = x;
          if (iframe) iframe.style[side] = x;
        }
        // Real launcher / mini-bubble photo from config (falls back to the video
        // poster). Skip the poster when the embed snippet hardcoded one, but still
        // apply the configured poster + channels.
        const img = b.launcherImageUrl ?? b.introVideoPoster;
        dockApi.applyConfig({
          poster: poster ? undefined : img,
          channels: cfg?.connect?.channels,
          video: thumbVideo,
        });
      },
    )
    .catch(() => undefined);

  type FamaashApi = {
    // `ctx` is the Free Consultation hand-off payload (case type, injury, timing);
    // it's only honored on the first open (it seeds the widget's /token at boot).
    open(view?: string, ctx?: unknown): void;
    close(): void;
    identify(user: { id: string; email: string; name?: string }): void;
    setContext(data: Record<string, unknown>): void;
  };
  const api: FamaashApi = {
    open: (view, ctx) => openWidget(view, ctx),
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
