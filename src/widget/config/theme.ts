/**
 * Runtime theming. The whole widget is painted from a small set of CSS custom
 * properties (`--famaash-brand*`, mapped into Tailwind as the `famaash` color),
 * so re-theming is just overriding those vars on the document root.
 *
 * Two sources feed it, in order of precedence:
 *   1. Admin override — the firm sets explicit colors in the Branding Studio
 *      (Law App), delivered as `branding.primaryColor` with
 *      `branding.themeSource === 'custom'`.
 *   2. Host inheritance (default) — the loader sniffs the colors of the site
 *      the widget is embedded on and passes them via the `?theme=` query param,
 *      so the widget visually belongs to the firm's site out of the box.
 */

export interface ThemeColors {
  /** Brand / primary accent (buttons, links, selected states). */
  primary?: string | null;
  /** Secondary accent (currently feeds the practice-area icon tint). */
  accent?: string | null;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Accept `#abc`, `#aabbcc`, or `rgb()/rgba()`; return a `#rrggbb` hex or null. */
function normalizeHex(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    const rgb = hexToRgb(s);
    return rgb ? rgbToHex(rgb) : null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map((x) => Number.parseFloat(x));
    if (p.length >= 3 && p.every((n, i) => i > 2 || Number.isFinite(n))) {
      return rgbToHex({ r: p[0], g: p[1], b: p[2] });
    }
  }
  return null;
}

function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  return c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})` : hex;
}

/** Mix a color toward white by `amount` (0..1) — used for the light surface tint. */
function lighten(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return rgbToHex({ r: mix(c.r), g: mix(c.g), b: mix(c.b) });
}

/** WCAG relative luminance, for picking readable text on the brand color. */
function luminance(hex: string): number {
  const c = hexToRgb(hex);
  if (!c) return 1;
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Black or white, whichever is readable on the given brand color. */
function onColor(hex: string): string {
  return luminance(hex) > 0.55 ? '#0F172A' : '#FFFFFF';
}

/**
 * Override the brand CSS vars so the whole widget repaints in `colors.primary`.
 * No-op when there's no usable primary (keeps the Famaash default).
 */
export function applyTheme(colors: ThemeColors): boolean {
  if (typeof document === 'undefined') return false;
  const primary = normalizeHex(colors.primary);
  if (!primary) return false;

  const root = document.documentElement;
  root.style.setProperty('--famaash-brand', primary);
  root.style.setProperty('--famaash-brand-light', lighten(primary, 0.9));
  root.style.setProperty('--famaash-brand-soft', rgba(primary, 0.08));
  root.style.setProperty('--famaash-brand-border', rgba(primary, 0.22));
  root.style.setProperty('--famaash-brand-stroke', rgba(primary, 0.4));
  root.style.setProperty('--famaash-on-brand', onColor(primary));

  const accent = normalizeHex(colors.accent);
  root.style.setProperty('--practice-accent', accent ?? primary);
  return true;
}

/**
 * Apply the firm's font across the widget. We override the UI + message font
 * vars, keeping the existing stack as the fallback so a name the browser can't
 * resolve degrades gracefully. No-op when unset.
 */
export function applyFont(font?: string | null): void {
  if (typeof document === 'undefined' || !font || !font.trim()) return;
  const root = document.documentElement;
  const family = `"${font.trim()}", 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  root.style.setProperty('--font-ui', family);
  root.style.setProperty('--font-message', family);
}

/** Read the host-site palette the loader passed via `?theme=<json>`. */
export function parseHostThemeFromQuery(): ThemeColors | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('theme');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    return {
      primary: typeof parsed.primary === 'string' ? parsed.primary : null,
      accent: typeof parsed.accent === 'string' ? parsed.accent : null,
    };
  } catch {
    return null;
  }
}
