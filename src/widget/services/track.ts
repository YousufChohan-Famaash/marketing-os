import type { AnalyticsEvent, MarketingEventType } from '../types/protocol';

/**
 * Marketing events for Google Tag Manager (Faisal, Sep 30 2026).
 *
 * ⚠️ The widget is a sandboxed iframe on widget.famaash.com, so a
 * `window.dataLayer.push` in here never reaches the host page's GTM. Every
 * event goes over the Penpal bridge instead, and the LOADER (which runs on the
 * host page) does the push with `lead_source: 'widget'`. Nothing here talks to
 * GTM directly.
 *
 * Rules from the brief:
 *   - `call_me_now`, `schedule_a_call`, `send_your_details` fire in the SUCCESS
 *     callback of the request, never on the button press.
 *   - `chat_started` fires once per session, on the visitor's first outgoing
 *     message, not when the widget opens.
 *   - `click_to_call` / `contact_via_email` carry the number or address so the
 *     tracking line can be told apart.
 */

type Sink = (event: AnalyticsEvent) => void;
let sink: Sink | null = null;

/** App registers the host bridge here once it is connected. */
export function setTrackSink(next: Sink | null): void {
  sink = next;
}

export function track(type: MarketingEventType, data: Record<string, unknown> = {}): void {
  try {
    sink?.({ type, data });
  } catch {
    /* analytics must never break the widget */
  }
}

const CHAT_STARTED_KEY = 'famaash_chat_started_fired';
// Fallback when sessionStorage is unavailable (private mode, blocked storage).
let chatStartedThisLoad = false;

/** Once per browser session, on the first message the visitor sends. */
export function trackFirstChatMessage(): void {
  let fired = chatStartedThisLoad;
  try {
    fired = fired || sessionStorage.getItem(CHAT_STARTED_KEY) === '1';
  } catch {
    /* storage blocked: the module flag carries it for this page load */
  }
  if (fired) return;
  chatStartedThisLoad = true;
  try {
    sessionStorage.setItem(CHAT_STARTED_KEY, '1');
  } catch {
    /* same */
  }
  track('chat_started');
}

/**
 * A click on a link inside the widget: `tel:` is a click-to-call, `mailto:` a
 * contact-by-email. Anything else is ignored. Safe to call for every anchor.
 */
export function trackLinkClick(href: string | null | undefined): void {
  if (!href) return;
  const h = href.trim();
  if (/^tel:/i.test(h)) {
    const raw = h.replace(/^tel:/i, '').trim();
    const digits = raw.replace(/\D/g, '');
    track('click_to_call', { phone: digits || raw });
  } else if (/^mailto:/i.test(h)) {
    track('contact_via_email', { email: h.replace(/^mailto:/i, '').split('?')[0] });
  }
}
