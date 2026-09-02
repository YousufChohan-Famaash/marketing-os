/**
 * Runtime configuration for the widget transport.
 *
 * The widget talks to the live backend: REST boot/token + a LiveKit room data
 * channel. The only knob is the REST base URL, resolved from (first match):
 *   1. URL query  ?api_base=<url>
 *   2. Build-time env  VITE_WIDGET_API_BASE
 *   3. default (prod API host)
 */

const DEFAULT_API_BASE = 'https://api.catafleet.com/api/v1/widget';

function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** REST base URL for the backend, normalized without a trailing slash. */
export function getApiBase(): string {
  const fromQuery = queryParam('api_base');
  const base = fromQuery ?? import.meta.env.VITE_WIDGET_API_BASE ?? DEFAULT_API_BASE;
  return base.replace(/\/+$/, '');
}

/**
 * Free Consultation hand-off context. When the consultation wizard opens the
 * chat, the loader forwards the visitor's Q1–Q3 answers as a `ctx` query param;
 * we read them here and pass them to POST /token so the agent's opener picks up
 * where the wizard left off (see free-consultation-guide.md §4c).
 */
export interface ConsultationContext {
  case_type_id?: string;
  practice_area?: string;
  accident_type_label?: string;
  injury_severity?: string;
  incident_timing?: string;
}

export function getConsultationContext(): ConsultationContext | null {
  const raw = queryParam('ctx');
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    const ctx: ConsultationContext = {
      case_type_id: str(p.caseTypeId ?? p.case_type_id),
      practice_area: str(p.accidentType ?? p.practice_area),
      accident_type_label: str(p.accidentType ?? p.accident_type_label),
      injury_severity: str(p.injurySeverity ?? p.injury_severity),
      incident_timing: str(p.incidentTiming ?? p.incident_timing),
    };
    return Object.values(ctx).some(Boolean) ? ctx : null;
  } catch {
    return null;
  }
}

/**
 * The UI language the Free Consultation wizard was in when it handed off to chat
 * (carried in the same `ctx` blob as `language`). Applied to the widget before
 * the hand-off POST /token so the agent replies in that language, matching the
 * site the visitor was already reading.
 *
 * Kept separate from ConsultationContext on purpose: language must NOT feed
 * consultationKey(), or switching language would fork a new chat.
 */
export function getHandoffLanguage(): string | null {
  const raw = queryParam('ctx');
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const lang = typeof p.language === 'string' ? p.language.slice(0, 2).toLowerCase() : '';
    return /^[a-z]{2}$/.test(lang) ? lang : null;
  } catch {
    return null;
  }
}

/**
 * Marketing attribution forwarded by the loader from the HOST page (the iframe's
 * own URL can't see the host's UTM/referrer). The loader packs it into an `attr`
 * query param; we read it here and send it on POST /token so the backend can
 * attribute the chat lead to a source/campaign (chat-analytics-frontend-guide).
 */
export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
}

export function getAttribution(): Attribution | null {
  const raw = queryParam('attr');
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    const a: Attribution = {
      utm_source: str(p.utm_source),
      utm_medium: str(p.utm_medium),
      utm_campaign: str(p.utm_campaign),
      referrer: str(p.referrer),
      landing_path: str(p.landing_path),
    };
    return Object.values(a).some(Boolean) ? a : null;
  } catch {
    return null;
  }
}

/**
 * Durable first-party visitor id, minted + persisted by the LOADER on the host
 * page and passed into the iframe as `?vid=`. Sent on every POST /token so the
 * server can create-or-resume the visitor's chat — this survives Safari/iOS
 * third-party-iframe storage partitioning that breaks the iframe's own resume
 * (whatsapp/phantom-chats guide §2). A plain scalar, so no JSON decode.
 */
export function getVisitorId(): string | null {
  const v = queryParam('vid');
  return v && v.trim() ? v : null;
}

/**
 * Whether to persist the conversation id + resume on reopen. ON by default so a
 * visitor who closes the tab and returns continues the same chat (session-
 * persistence guide). Force a fresh conversation for testing with `?persist=0`
 * or `VITE_WIDGET_PERSIST=0`.
 */
export function isPersistenceEnabled(): boolean {
  const fromQuery = queryParam('persist');
  if (fromQuery === '0' || fromQuery === 'false') return false;
  if (fromQuery === '1' || fromQuery === 'true') return true;
  const env = import.meta.env.VITE_WIDGET_PERSIST;
  if (env === '0' || env === 'false') return false;
  return true;
}

/**
 * Whether to coordinate multiple tabs of the SAME conversation so only one holds
 * the LiveKit connection (leader) while the rest mirror it over a
 * BroadcastChannel (followers). Without this, every open tab opens its own
 * connection, LiveKit evicts the duplicate identity, and the backend re-persists
 * inbound messages so a reload shows each one two or three times.
 *
 * Only meaningful when persistence is on (otherwise each tab already has a unique
 * conversation id, so there's nothing to share). Requires BroadcastChannel + the
 * Web Locks API; falls back to per-tab connections where either is unavailable.
 * Force off for debugging with `?multitab=0`.
 */
export function isMultiTabSyncEnabled(): boolean {
  if (!isPersistenceEnabled()) return false;
  const q = queryParam('multitab');
  if (q === '0' || q === 'false') return false;
  if (typeof BroadcastChannel === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  const locks = (navigator as Navigator & { locks?: { request?: unknown } }).locks;
  if (!locks || typeof locks.request !== 'function') return false;
  return true;
}
