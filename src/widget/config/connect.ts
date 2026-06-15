import type {
  ConnectChannel,
  ConnectSettings,
  VideoMode,
  WidgetBootConfig,
  WidgetSize,
} from '../types/domain';

/**
 * Connect launcher settings live in the Branding Studio (Law App) and arrive on
 * the boot config. The widget only *consumes* them — there is no in-widget
 * admin UI. Here we resolve config over sensible defaults, then allow URL
 * overrides purely for local testing (?size=, ?video=, ?channels=, ?autoplay=).
 */

const DEFAULTS: ConnectSettings = {
  size: 'large',
  channels: ['call', 'chat', 'text', 'schedule', 'email'],
  videoMode: 'intro',
  autoplay: true,
  fullscreenOpen: false,
  textMethods: ['sms', 'whatsapp'],
  businessHours: { open: 9, close: 18 },
};

const ALL_CHANNELS: ConnectChannel[] = ['call', 'chat', 'text', 'schedule', 'email'];

function query(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function resolveConnectSettings(config?: WidgetBootConfig | null): ConnectSettings {
  const merged: ConnectSettings = { ...DEFAULTS, ...(config?.connect ?? {}) };

  // ── URL overrides (testing only) ─────────────────────────────────────────
  const size = query('size');
  if (size === 'large' || size === 'small') merged.size = size;

  const video = query('video');
  if (video === 'intro' || video === 'story' || video === 'none') merged.videoMode = video;

  const autoplay = query('autoplay');
  if (autoplay === '0' || autoplay === 'false') merged.autoplay = false;
  if (autoplay === '1' || autoplay === 'true') merged.autoplay = true;

  const cine = query('cine');
  if (cine === '0' || cine === 'false') merged.fullscreenOpen = false;
  if (cine === '1' || cine === 'true') merged.fullscreenOpen = true;

  const channels = query('channels');
  if (channels) {
    const wanted = channels
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c): c is ConnectChannel => (ALL_CHANNELS as string[]).includes(c));
    if (wanted.length) merged.channels = wanted;
  }

  return merged;
}

// ── Channel metadata + intent ranking ───────────────────────────────────────

export interface ChannelMeta {
  id: ConnectChannel;
  label: string;
  sublabel: string;
  /** Lower = higher intent / shown first by default. */
  rank: number;
}

export const CHANNEL_META: Record<ConnectChannel, ChannelMeta> = {
  call: { id: 'call', label: 'Call me now', sublabel: "We'll ring you in under 60 seconds", rank: 0 },
  chat: { id: 'chat', label: 'Start a conversation', sublabel: 'Message us now, we reply in seconds', rank: 1 },
  text: { id: 'text', label: 'Text me', sublabel: 'SMS or WhatsApp, on your phone', rank: 2 },
  schedule: { id: 'schedule', label: 'Schedule a callback', sublabel: 'Pick a time that works for you', rank: 3 },
  email: { id: 'email', label: 'Send us an email', sublabel: 'We reply within one business day', rank: 4 },
};

export function isBusinessHours(s: ConnectSettings, now = new Date()): boolean {
  if (!s.businessHours) return true;
  const h = now.getHours();
  return h >= s.businessHours.open && h < s.businessHours.close;
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 480;
}

/**
 * Order the enabled primary channels by intent, then nudge by context:
 *  - business hours → Call leads; after hours → Chat / Schedule lead.
 *  - mobile → Call (tap-to-call) is emphasized.
 * 'email' is always handled separately as a demoted link, never ranked here.
 */
export function rankChannels(
  settings: ConnectSettings,
  ctx: { businessHours: boolean; mobile: boolean } = {
    businessHours: isBusinessHours(settings),
    mobile: isMobileViewport(),
  },
): ConnectChannel[] {
  const primary = settings.channels.filter((c) => c !== 'email');
  return [...primary].sort((a, b) => score(a, ctx) - score(b, ctx));
}

function score(c: ConnectChannel, ctx: { businessHours: boolean; mobile: boolean }): number {
  let s = CHANNEL_META[c].rank;
  if (c === 'call') s -= ctx.businessHours ? 1 : -2; // call leads in hours, demoted after
  if (c === 'call' && ctx.mobile) s -= 2; // tap-to-call on mobile
  if ((c === 'chat' || c === 'schedule') && !ctx.businessHours) s -= 1.5; // after-hours self-serve
  return s;
}

export const SIZE = {
  isSmall: (s: ConnectSettings): boolean => s.size === 'small',
} as const;

/**
 * Whether the cinematic full-screen video open should play: admin opted in,
 * there's a video, we're on the home menu, and it hasn't already run / been
 * dismissed for this open.
 */
export function shouldShowCinematic(
  s: ConnectSettings,
  ctx: { connectView: string; conversationStarted: boolean; cinematicDismissed: boolean },
): boolean {
  return (
    s.fullscreenOpen &&
    s.videoMode !== 'none' &&
    ctx.connectView === 'home' &&
    !ctx.conversationStarted &&
    !ctx.cinematicDismissed
  );
}

export type { ConnectChannel, ConnectSettings, VideoMode, WidgetSize };
