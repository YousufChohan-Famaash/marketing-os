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
import { getApiBase } from '../config/env';

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
}

export interface UploadSignResponse {
  uploads: UploadSlot[];
}

/** POST /esign/session — fresh embedded signing URL for the retainer. */
export interface EsignSessionResponse {
  envelopeId: string;
  signingUrl: string;
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

/** GET /config?firm_id=... — boot config + transport hints. */
export function fetchWidgetConfig(
  firmId: string,
  signal?: AbortSignal,
): Promise<WidgetBootConfig> {
  return request<WidgetBootConfig>(
    `/config?firm_id=${encodeURIComponent(firmId)}`,
    undefined,
    signal,
  );
}

/** POST /token — create/resume conversation, get a LiveKit room token. */
export function createConversationToken(
  body: {
    firm_id: string;
    conversation_id: string;
    language?: string;
    practice_area?: string;
    case_type_id?: string;
  },
  signal?: AbortSignal,
): Promise<ConversationTokenResponse> {
  return request<ConversationTokenResponse>(
    '/token',
    { method: 'POST', body: JSON.stringify({ language: 'en', ...body }) },
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

/** POST /esign/session — embedded retainer signing URL (fetch just-in-time). */
export function createEsignSession(
  conversationId: string,
  signal?: AbortSignal,
): Promise<EsignSessionResponse> {
  return request<EsignSessionResponse>(
    '/esign/session',
    { method: 'POST', body: JSON.stringify({ conversationId }) },
    signal,
  );
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
