import type {
  CapturedField,
  ConsentModal,
  LinkCardPayload,
  Message,
  ScopeChip,
  UploadedFile,
  VideoPayload,
} from './domain';

/**
 * Wire protocol between the widget client and the backend. The backend speaks
 * these exact shapes over the LiveKit room data channel; `RealSocket` adapts
 * them to the `ConversationSocket` interface below.
 */

// ─────────────────────────────────────────────────────────────────────
// Server → client events
// ─────────────────────────────────────────────────────────────────────

/** The agent has joined the room and attached its handler — safe to send the first ClientEvent. */
export interface ReadyEvent {
  type: 'ready';
}

/** TCPA consent prompt shown as a blocking modal after the phone is captured. */
export interface ConsentModalEvent {
  type: 'consent_modal';
  consent: ConsentModal;
}

export interface MessageChunkEvent {
  type: 'message_chunk';
  messageId: string;
  chunk: string;
}

export interface MessageCompleteEvent {
  type: 'message_complete';
  messageId: string;
  /** Final message shape with any post-stream metadata (hasMarkdown, video, linkCard, etc.) */
  message: Message;
}

export interface FieldCapturedEvent {
  type: 'field_captured';
  field: CapturedField;
}

export interface FieldEditedEvent {
  type: 'field_edited';
  fieldId: string;
  value: string;
}

export interface ScopeChipAddedEvent {
  type: 'scope_chip_added';
  chip: ScopeChip;
}

export interface QuickReplyOptionsEvent {
  type: 'quick_reply_options';
  messageId: string;
  options: string[];
}

export interface FileUploadRequestEvent {
  type: 'file_upload_request';
  messageId: string;
  prompt: string;
  /** Comma-separated MIME types or extensions; null = any */
  accept?: string;
  maxFiles?: number;
}

export interface RetainerPresentEvent {
  type: 'retainer_present';
  messageId: string;
  contingencyPercent: number;
  envelopeId: string;
}

export interface AgentTakeoverEvent {
  type: 'agent_takeover';
  agentName: string;
  agentTitle?: string;
}

export interface ConversationEndedEvent {
  type: 'conversation_ended';
  reason: 'completed' | 'abandoned' | 'escalated';
}

export interface VideoMessageEvent {
  type: 'video_message';
  messageId: string;
  video: VideoPayload;
  role?: 'ai' | 'agent' | 'system';
}

export interface LinkCardEvent {
  type: 'link_card';
  messageId: string;
  card: LinkCardPayload;
}

export interface FileUploadAckEvent {
  type: 'file_upload_ack';
  fileId: string;
  status: UploadedFile['status'];
  progress: number;
}

export type ServerEvent =
  | ReadyEvent
  | ConsentModalEvent
  | MessageChunkEvent
  | MessageCompleteEvent
  | FieldCapturedEvent
  | FieldEditedEvent
  | ScopeChipAddedEvent
  | QuickReplyOptionsEvent
  | FileUploadRequestEvent
  | RetainerPresentEvent
  | AgentTakeoverEvent
  | ConversationEndedEvent
  | VideoMessageEvent
  | LinkCardEvent
  | FileUploadAckEvent;

// ─────────────────────────────────────────────────────────────────────
// Client → server events
// ─────────────────────────────────────────────────────────────────────

export interface LeadMessageEvent {
  type: 'lead_message';
  content: string;
  /** Optimistic id assigned client-side so the UI can match acks. */
  clientMessageId: string;
}

export interface QuickReplySelectedEvent {
  type: 'quick_reply_selected';
  messageId: string;
  selectedOption: string;
}

export interface PracticeAreaSelectedClientEvent {
  type: 'practice_area_selected';
  value: string;
}

/** The opening case-type chip — the first user message that starts the flow. */
export interface CaseTypeSelectedClientEvent {
  type: 'case_type_selected';
  slug: string;
  label: string;
  case_type_id: string;
}

/** Response to a `consent_modal` (TCPA). */
export interface ConsentResponseClientEvent {
  type: 'consent_response';
  agree: boolean;
}

export interface FieldEditClientEvent {
  type: 'field_edit';
  fieldId: string;
  value: string;
}

export interface FileUploadedClientEvent {
  type: 'file_uploaded';
  /**
   * For `document_upload` cards: which document was uploaded. The file itself
   * goes via POST /documents/upload, so `itemId` alone advances the flow.
   */
  itemId?: string;
  /** Legacy batch upload zone — the uploaded file list (optional). */
  files?: UploadedFile[];
  /** Legacy presigned flow — S3 key (no longer used by document_upload). */
  fileKey?: string;
}

/** Lead skipped an optional `document_upload` (covered by the portal link later). */
export interface SkipDocumentClientEvent {
  type: 'skip_document';
  itemId: string;
}

/** Lead chose "text me the link instead" on a sign/upload step. */
export interface DeferDocumentsClientEvent {
  type: 'defer_documents';
}

export interface RetainerSignedClientEvent {
  type: 'retainer_signed';
  envelopeId: string;
  signedAt: number;
}

/** A document was signed inline (Dropbox `sign` event). Advances the doc flow. */
export interface DocumentSignedClientEvent {
  type: 'document_signed';
  itemId?: string;
  documentId?: string;
}

/** Lead asked to be connected to a human. Backend responds with `agent_takeover`. */
export interface RequestHumanClientEvent {
  type: 'request_human';
  /** How the lead wants to be reached. */
  method?: 'immediate' | 'delayed' | 'scheduled' | 'emergency';
  /** Callback number the lead entered. */
  phone?: string;
  /** Lead's name, when collected (Call / Schedule). */
  name?: string;
  /** For `delayed`: minutes from now (15 / 30 / 45 / 60). */
  delayMinutes?: number;
  /** For `scheduled`: `YYYY-MM-DD HH:mm` (24h) of the requested call. */
  scheduledAt?: string;
}

export type ClientEvent =
  | LeadMessageEvent
  | QuickReplySelectedEvent
  | PracticeAreaSelectedClientEvent
  | CaseTypeSelectedClientEvent
  | ConsentResponseClientEvent
  | FieldEditClientEvent
  | FileUploadedClientEvent
  | SkipDocumentClientEvent
  | DeferDocumentsClientEvent
  | RetainerSignedClientEvent
  | DocumentSignedClientEvent
  | RequestHumanClientEvent;

// ─────────────────────────────────────────────────────────────────────
// Socket interface — RealSocket implements this
// ─────────────────────────────────────────────────────────────────────

export type ServerEventHandler<T extends ServerEvent['type']> = (
  event: Extract<ServerEvent, { type: T }>,
) => void;

export interface ConversationSocket {
  connect(firmId: string, conversationId: string): Promise<void>;
  send(event: ClientEvent): void;
  on<T extends ServerEvent['type']>(
    eventType: T,
    handler: ServerEventHandler<T>,
  ): () => void;
  disconnect(): void;
}

// ─────────────────────────────────────────────────────────────────────
// Host bridge (iframe ↔ host page via Penpal)
// ─────────────────────────────────────────────────────────────────────

export interface HostContext {
  url: string;
  referrer: string;
  utm: Record<string, string>;
}

export interface IdentifyPayload {
  id: string;
  email: string;
  name?: string;
}

/** Methods the iframe exposes to the host page. */
export interface IframeBridge {
  open(): Promise<void>;
  close(): Promise<void>;
  minimize(): Promise<void>;
  /** Route the panel to a Connect view (e.g. a teaser channel deep-link). */
  setView(view: string): Promise<void>;
  setContext(metadata: Record<string, unknown>): Promise<void>;
  identify(user: IdentifyPayload): Promise<void>;
}

/** Methods the host page exposes to the iframe. */
export interface HostBridge {
  requestClose(): Promise<void>;
  requestMinimize(): Promise<void>;
  requestExpand(): Promise<void>;
  requestShrink(): Promise<void>;
  /** Shrink the iframe to the compact Small-mode home height. */
  requestCompact(): Promise<void>;
  getHostContext(): Promise<HostContext>;
  notifyEvent(event: { type: string; data: unknown }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Analytics event taxonomy
// Currently fired through hostBridge.notifyEvent — analytics provider deferred.
// Document the contract here so the names don't drift.
// ─────────────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | 'widget_opened'
  | 'widget_closed'
  | 'widget_error'
  | 'message_sent'
  | 'tcpa_captured'
  | 'section_complete'
  | 'retainer_presented'
  | 'retainer_signed'
  | 'cms_pushed'
  | 'agent_handoff_requested';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  data: Record<string, unknown>;
}
