/**
 * REST client for the real widget backend.
 *
 * Base path comes from `getApiBase()` (env/query configurable). All endpoints
 * are public (no auth header) per the backend handoff — the LiveKit room token
 * returned by POST /token is the only credential, and it's data-channel scoped.
 *
 * Shapes mirror `prompts/chat-widget-guide.md` and `CHAT_BACKEND_HANDOFF.md`.
 */

import type {
  CapturedField,
  Message,
  ScopeChip,
  UploadedFile,
  WidgetBootConfig,
} from '../types/domain';
import { getApiBase, getVisitorId } from '../config/env';

// ─────────────────────────────────────────────────────────────────────
// Response DTOs (exactly what the backend returns)
// ─────────────────────────────────────────────────────────────────────

/** POST /token — creates/resumes a conversation and returns a LiveKit join token. */
export interface ConversationTokenResponse {
  conversation_id: string;
  room_name: string;
  livekit_url: string;
  token: string;
  lead_id: string;
  lead_number: string;
  stage_name: string;
  server_topic: string; // 'widget'
  client_topic: string; // 'widget.client'
}

/** One presigned upload slot from POST /uploads/sign. */
export interface UploadSlot {
  fileId: string;
  uploadUrl: string; // presigned PUT
  publicUrl: string; // GET url to hand back in `file_uploaded`
  fileKey?: string; // S3 key — echoed back in `file_uploaded` / `mark-uploaded`
}

export interface UploadSignResponse {
  uploads: UploadSlot[];
}

/** POST /esign/session — fresh embedded signing URL for a document. */
export interface EsignSessionResponse {
  envelopeId: string;
  signingUrl: string;
  itemId?: string;
  isRetainer?: boolean;
}

/** One document in the document-collection state (signing or upload list). */
export interface DocumentItem {
  itemId: string;
  name: string;
  documentType: string;
  status: 'pending' | 'sent' | 'signed' | 'uploaded' | 'declined' | 'error' | 'reviewed' | string;
  isRequired: boolean;
  isRetainer: boolean;
  signedAt: string | null;
  documentUrl: string | null;
}

/** GET /documents — full document-collection state for a conversation. */
export interface DocumentsResponse {
  signing: DocumentItem[];
  upload: DocumentItem[];
  portalUrl: string | null;
  dropboxSignClientId: string | null;
}

/** POST /documents/upload — backend-proxied upload (no browser→S3, no CORS). */
export interface DocumentUploadResponse {
  itemId: string;
  status: string;
  leadDocumentId: string;
  fileName: string;
  documentUrl: string | null;
}

/** POST /media/upload — lead voice/video note (proxy upload, like documents). */
export interface MediaUploadResponse {
  mediaId: string;
  kind: 'audio' | 'video';
  url: string;
  mimeType?: string;
  durationMs?: number;
  /** Server-side transcript so the AI can act on the recording (optional). */
  transcript?: string | null;
}

/** GET /conversations/{id}/messages — cold-load rehydration. */
export interface ConversationHistoryResponse {
  conversationId: string;
  status: 'active' | 'ended';
  messages: Message[];
  fields: CapturedField[];
  chips: ScopeChip[];
  agentTakeover: { agentName: string; agentTitle?: string } | null;
}

export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

// ─────────────────────────────────────────────────────────────────────
// Low-level fetch helper
// ─────────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`, detail);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /video-event — public attorney-video analytics (fire-and-forget).
 * `play` on first play, `complete` on ended. Feeds the dashboard's plays /
 * completion pills. No auth; failures are swallowed.
 */
export function postVideoEvent(
  firmId: string,
  // Home hero reports intro/story; per-view surfaces report their own view code
  // so plays/completions attribute per screen (backend keys analytics by kind).
  kind: 'intro' | 'story' | 'call' | 'text' | 'schedule' | 'chat_intro' | 'chat',
  event: 'play' | 'complete',
): void {
  try {
    void fetch(`${getApiBase()}/video-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firm_id: firmId, kind, event }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never block playback on analytics */
  }
}

/** POST /connect/call-now — places an immediate outbound AI voice call. */
export interface CallNowResponse {
  ok: boolean;
  status: string; // 'calling'
  chip?: { kind: string; label: string };
  call_id?: string;
  room_name?: string;
}

export function placeCallNow(args: {
  conversationId: string;
  /** Lets the backend create-or-resume the conversation when the visitor reached
   *  this straight from the launcher (Option B defers the socket that would
   *  otherwise register it), instead of 404ing on an unknown conversation. */
  firmId?: string;
  phone: string;
  name?: string;
  consentText?: string;
  copyVersion?: string;
}): Promise<CallNowResponse> {
  return request<CallNowResponse>('/connect/call-now', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: args.conversationId,
      firmId: args.firmId,
      phone: args.phone,
      name: args.name,
      consent: {
        agreed: true,
        copyVersion: args.copyVersion ?? 'v1',
        text: args.consentText,
      },
    }),
  });
}

/**
 * GET /connect/call-status — the persisted live state of the outbound call.
 * Public, pollable. Works for launcher-direct calls (no chat session, so the
 * data-channel `connect_call_status` never fires) and survives a reload. Returns
 * 'unknown' on any network/HTTP error so the caller's poll loop never needs
 * error special-casing (guide: call-status-polling-frontend-guide.md).
 */
export async function fetchCallStatus(conversationId: string): Promise<string> {
  try {
    const res = await fetch(
      `${getApiBase()}/connect/call-status?conversationId=${encodeURIComponent(conversationId)}`,
    );
    if (!res.ok) return 'unknown';
    const data = (await res.json()) as { status?: string };
    return data?.status ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** POST /connect/text — hand the intake off to the visitor's phone (WhatsApp/SMS). */
export interface TextConnectResponse {
  ok: boolean;
  status: string; // 'texting'
  channel: 'whatsapp' | 'sms';
  conversationId: string;
  /** WhatsApp only, no template configured → open this so the visitor sends the first message. */
  waMeLink?: string | null;
  /** WhatsApp only → true when we messaged them directly (approved template); waMeLink is null. */
  whatsappMessaged?: boolean;
}

export function connectText(args: {
  conversationId: string;
  /** Lets the backend create-or-resume the conversation when the visitor reached
   *  this straight from the launcher (Option B defers the socket that would
   *  otherwise register it), instead of 404ing on an unknown conversation. */
  firmId?: string;
  phone: string;
  channel: 'whatsapp' | 'sms';
  name?: string;
  caseTypeId?: string;
  consentText?: string;
  copyVersion?: string;
}): Promise<TextConnectResponse> {
  return request<TextConnectResponse>('/connect/text', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: args.conversationId,
      firmId: args.firmId,
      phone: args.phone,
      channel: args.channel,
      name: args.name,
      caseTypeId: args.caseTypeId,
      consent: {
        agreed: true,
        copyVersion: args.copyVersion ?? 'tcpa-v1',
        text: args.consentText,
      },
    }),
  });
}

/** GET /forms/config — options for the "Send your details" wizard (web_form module). */
export interface WebFormOption {
  value: string;
  label: string;
}
export interface WebFormConfig {
  firmName: string;
  caseTypes: { id: string; label: string }[];
  injurySeverityOptions: WebFormOption[];
  incidentTimingOptions: WebFormOption[];
  consentRequired: boolean;
  consentText: string;
  consentVersion: string;
}

export function fetchWebFormConfig(firmId: string, signal?: AbortSignal): Promise<WebFormConfig> {
  return request<WebFormConfig>(`/forms/config?firm_id=${encodeURIComponent(firmId)}`, undefined, signal);
}

/** POST /forms/submit — the "Send your details" lead-capture form (web_form module). */
export interface WebFormSubmitResponse {
  ok: boolean;
  status: string; // 'received'
  leadId: string;
  leadNumber: string; // e.g. "#0B30"
}

export function submitWebForm(args: {
  firmId: string;
  name: string; // full name, one field — backend splits it
  phone: string; // any format — backend normalizes to +E.164
  email?: string;
  caseTypeId?: string;
  accidentType?: string;
  injurySeverity?: string; // chosen injurySeverityOptions[].value
  incidentTiming?: string; // chosen incidentTimingOptions[].value
  description?: string; // optional free text; backend composes one if omitted
  consentText?: string;
  copyVersion?: string;
  /** Honeypot — the hidden field's value; empty for humans, filled by bots. */
  website?: string;
  utm?: Record<string, string>;
}): Promise<WebFormSubmitResponse> {
  return request<WebFormSubmitResponse>('/forms/submit', {
    method: 'POST',
    body: JSON.stringify({
      firmId: args.firmId,
      name: args.name,
      phone: args.phone,
      email: args.email,
      caseTypeId: args.caseTypeId,
      accidentType: args.accidentType,
      injurySeverity: args.injurySeverity,
      incidentTiming: args.incidentTiming,
      description: args.description,
      consent: { agreed: true, text: args.consentText, copyVersion: args.copyVersion ?? 'web_form_v1' },
      website: args.website ?? '',
      utm: args.utm,
    }),
  });
}

/** GET /connect/availability — the firm's real, hour-filtered calendar slots. */
export interface AvailabilitySlot {
  start: string; // UTC ISO
  end: string;
}
export interface AvailabilityResponse {
  available: boolean;
  reason: string | null; // 'not_configured' | 'unavailable' | null
  tz: string | null;
  slots: AvailabilitySlot[];
}

export function fetchAvailability(
  firmId: string,
  opts: { from?: string; days?: number; tz: string },
  signal?: AbortSignal,
): Promise<AvailabilityResponse> {
  const p = new URLSearchParams({ firm_id: firmId, tz: opts.tz });
  if (opts.from) p.set('from', opts.from);
  if (opts.days) p.set('days', String(opts.days));
  return request<AvailabilityResponse>(`/connect/availability?${p.toString()}`, undefined, signal);
}

/** POST /connect/schedule-callback — books a slot; the AI calls at that time. */
export interface ScheduleCallbackResponse {
  ok: boolean;
  status: string; // 'scheduled'
  chip?: { kind: string; label: string };
  slotStart?: string;
  booking_id?: string;
  /** The number the firm's AI will call from, so we can tell the lead to save it
   *  ("we'll call from ..."). Optional: only shown when the backend provides it,
   *  never hardcoded per firm. */
  callFromNumber?: string;
}

export function scheduleCallback(args: {
  conversationId: string;
  /** Lets the backend create-or-resume the conversation when the visitor reached
   *  this straight from the launcher (Option B defers the socket that would
   *  otherwise register it), instead of 404ing on an unknown conversation. */
  firmId?: string;
  name?: string;
  phone: string;
  email: string;
  slotStart: string;
  timezone: string;
  consentText?: string;
  copyVersion?: string;
}): Promise<ScheduleCallbackResponse> {
  return request<ScheduleCallbackResponse>('/connect/schedule-callback', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: args.conversationId,
      firmId: args.firmId,
      name: args.name,
      phone: args.phone,
      email: args.email,
      slotStart: args.slotStart,
      timezone: args.timezone,
      consent: { agreed: true, copyVersion: args.copyVersion ?? 'v1', text: args.consentText },
    }),
  });
}

/** Pull the human-readable `detail` out of an ApiError's JSON body, if present. */
export function errorDetail(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.detail) return null;
  try {
    const parsed = JSON.parse(err.detail) as { detail?: unknown };
    return typeof parsed.detail === 'string' ? parsed.detail : null;
  } catch {
    return null;
  }
}

/**
 * GET /config?firm_id=...[&language=..] — boot config + transport hints.
 * Passing the visitor's interface language returns the language-matched intro /
 * channel videos (+ posters + captions); the response shape is unchanged. The
 * backend falls back (visitor language → firm default → English → any active
 * clip), so you always get a playable video. No language = firm default.
 */
export function fetchWidgetConfig(
  firmId: string,
  language?: string,
  signal?: AbortSignal,
): Promise<WidgetBootConfig> {
  const lang = language ? `&language=${encodeURIComponent(language)}` : '';
  return request<WidgetBootConfig>(
    `/config?firm_id=${encodeURIComponent(firmId)}${lang}`,
    undefined,
    signal,
  );
}

/** POST /token — create/resume conversation, get a LiveKit room token.
 *  Pass `conversation_id` to resume/create-by-id; pass `new_chat: true` (no id)
 *  to have the SERVER mint a fresh conversation_id + new Call+Lead and set the
 *  agent to open a fresh intake. The response always carries `conversation_id`. */
export function createConversationToken(
  body: {
    firm_id: string;
    conversation_id?: string;
    /** Server mints a brand-new conversation (new Call+Lead, fresh intake). */
    new_chat?: boolean;
    /** Durable first-party visitor id (minted by the loader). Lets the server
     *  create-or-resume so a refresh doesn't spawn phantom chats when the
     *  iframe's own storage is partitioned. Injected below, not by callers. */
    visitor_id?: string;
    language?: string;
    practice_area?: string;
    case_type_id?: string;
    // Free Consultation hand-off: the answers the visitor already gave, so the
    // agent's opener acknowledges the accident instead of a cold "describe it".
    accident_type_label?: string;
    injury_severity?: string;
    incident_timing?: string;
    // Marketing attribution forwarded from the host page by the loader — lets the
    // backend attribute the chat lead to a source/campaign (chat-analytics guide).
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referrer?: string;
    landing_path?: string;
  },
  signal?: AbortSignal,
): Promise<ConversationTokenResponse> {
  return request<ConversationTokenResponse>(
    '/token',
    // visitor_id on EVERY /token (cold, new_chat, resume). `?? undefined` drops it
    // from the JSON when absent, exactly like the attribution/ctx fields.
    { method: 'POST', body: JSON.stringify({ language: 'en', visitor_id: getVisitorId() ?? undefined, ...body }) },
    signal,
  );
}

/** POST /uploads/sign — presigned S3 PUT urls for evidence files. */
export function signUploads(
  conversationId: string,
  files: FileMeta[],
  signal?: AbortSignal,
): Promise<UploadSignResponse> {
  return request<UploadSignResponse>(
    '/uploads/sign',
    { method: 'POST', body: JSON.stringify({ conversationId, files }) },
    signal,
  );
}

/**
 * POST /esign/session — fresh embedded signing URL for a document (fetch
 * just-in-time on tap). Pass `itemId` from the card; omit to auto-resolve the
 * most recent unsigned retainer.
 */
export function createEsignSession(
  conversationId: string,
  itemId?: string,
  signal?: AbortSignal,
): Promise<EsignSessionResponse> {
  const body: Record<string, string> = { conversationId };
  if (itemId) body.itemId = itemId;
  return request<EsignSessionResponse>(
    '/esign/session',
    { method: 'POST', body: JSON.stringify(body) },
    signal,
  );
}

/** GET /documents?conversation_id=... — document-collection state for a panel/re-sync. */
export function fetchDocuments(
  conversationId: string,
  signal?: AbortSignal,
): Promise<DocumentsResponse> {
  return request<DocumentsResponse>(
    `/documents?conversation_id=${encodeURIComponent(conversationId)}`,
    undefined,
    signal,
  );
}

/**
 * POST /documents/upload — upload an evidence file THROUGH the backend
 * (multipart). Replaces the presigned direct-to-S3 PUT (which hit CORS). Uses
 * XHR so we can show upload progress; the browser sets the multipart boundary.
 */
export function uploadDocument(
  conversationId: string,
  itemId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<DocumentUploadResponse> {
  return new Promise<DocumentUploadResponse>((resolve, reject) => {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    fd.append('itemId', itemId);
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/documents/upload`, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as DocumentUploadResponse);
        } catch {
          reject(new ApiError(xhr.status, 'upload response was not JSON', xhr.responseText));
        }
      } else {
        reject(new ApiError(xhr.status, `POST /documents/upload → ${xhr.status}`, xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'document upload network error'));
    xhr.send(fd);
  });
}

/**
 * POST /media/upload — backend-proxied voice/video note upload (no browser→S3,
 * no CORS). Returns a playable URL (and optionally a transcript for the AI).
 */
export function uploadMedia(
  conversationId: string,
  kind: 'audio' | 'video',
  blob: Blob,
  durationMs?: number,
): Promise<MediaUploadResponse> {
  return new Promise<MediaUploadResponse>((resolve, reject) => {
    const fd = new FormData();
    fd.append('conversation_id', conversationId);
    fd.append('kind', kind);
    if (durationMs != null) fd.append('durationMs', String(Math.round(durationMs)));
    fd.append('file', blob, `note-${kind}.webm`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/media/upload`, true);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MediaUploadResponse);
        } catch {
          reject(new ApiError(xhr.status, 'media upload response was not JSON', xhr.responseText));
        }
      } else {
        reject(new ApiError(xhr.status, `POST /media/upload → ${xhr.status}`, xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'media upload network error'));
    xhr.send(fd);
  });
}

/** GET /conversations/{id}/messages — transcript + fields + chips for cold load. */
export function fetchConversationHistory(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationHistoryResponse> {
  return request<ConversationHistoryResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    undefined,
    signal,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Direct-to-S3 upload (PUT with progress via XHR — fetch lacks upload progress)
// ─────────────────────────────────────────────────────────────────────

/**
 * PUT one file to a presigned URL, reporting 0–100 progress. Resolves when the
 * upload completes (2xx), rejects otherwise.
 */
export function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(xhr.status, `upload PUT failed → ${xhr.status}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'upload PUT network error'));
    xhr.send(file);
  });
}

/** Build the `UploadedFile` the widget sends in `file_uploaded` after a PUT. */
export function uploadedFileFromSlot(
  slot: UploadSlot,
  file: File,
): UploadedFile {
  return {
    id: slot.fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    url: slot.publicUrl,
    thumbnail: file.type.startsWith('image/') ? slot.publicUrl : undefined,
    status: 'uploaded',
    progress: 100,
  };
}
