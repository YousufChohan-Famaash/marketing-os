export type MessageRole = 'ai' | 'lead' | 'system' | 'agent';

export type MessageType =
  | 'text'
  | 'quick_reply'
  | 'date_picker'
  | 'name_input'
  | 'phone_input'
  | 'email_input'
  | 'number_input'
  | 'file_upload'
  | 'retainer'
  | 'document_sign'
  | 'document_upload'
  | 'video_intro'
  | 'video_message'
  | 'voice_clip'
  | 'media'
  | 'link_card'
  | 'rich_text';

/** A document referenced by a `document_sign` or `document_upload` card. */
export interface DocumentRef {
  itemId: string;
  name: string;
  isRetainer?: boolean;
  status?: string;
  /** Upload docs: the document type slug (e.g. `police_report`). */
  documentType?: string;
  /** `document_upload`: show a Skip button. */
  allowSkip?: boolean;
  /** `document_sign`: offer "text me the link instead" (defer). */
  allowDefer?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnail?: string;
  status: 'uploading' | 'uploaded' | 'failed';
  progress: number;
}

export interface VideoPayload {
  url: string;
  posterUrl?: string;
  duration?: number;
  autoplay?: boolean;
  caption?: string;
}

export interface LinkCardPayload {
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  domain: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  options?: string[];
  selectedOption?: string;
  /** For `date_picker` messages: tunes the calendar's initial view. 'birthday' opens decades back; 'recent' opens on the current month. Future dates are always blocked. */
  datePickerMode?: 'birthday' | 'recent';
  /** For `quick_reply` messages: when true the lead may pick several chips; the answer is sent comma-joined (e.g. "neck, lower back"). */
  multiSelect?: boolean;
  /** Internal field name the AI is asking for (e.g. `police_called`). Informational — for captured-field labels. Not sent back. */
  fieldName?: string;
  /** Dotted storage path of the field (e.g. `accident_details.police_called`). Informational. */
  storagePath?: string;
  files?: UploadedFile[];
  retainerStatus?: 'pending' | 'signing' | 'signed';
  /** For `retainer` cards: contingency fee % from the `retainer_present` event. */
  contingencyPercent?: number;
  /** For `document_sign` cards: the document to review & sign. */
  document?: DocumentRef;
  video?: VideoPayload;
  linkCard?: LinkCardPayload;
  /** For `media` (lead voice/video note): playback URL + kind + duration. */
  mediaKind?: 'audio' | 'video';
  mediaUrl?: string;
  mediaDurationMs?: number;
  /** Server transcript of a voice note (audio only; shown under the bubble). */
  mediaTranscript?: string;
  hasMarkdown?: boolean;
  isStreaming?: boolean;
  /** Client-assigned arrival order for the transcript (see store/seq.ts). */
  seq?: number;
}

export type FieldType =
  | 'text'
  | 'date'
  | 'select'
  | 'number'
  | 'phone'
  | 'email'
  | 'currency'
  | 'file_ref';

export interface CapturedField {
  id: string;
  name: string;
  displayName: string;
  type: FieldType;
  value: string | null;
  required: boolean;
  sectionId: string;
  editedByLead?: boolean;
  capturedAt: number;
}

export interface Section {
  id: string;
  name: string;
  fields: CapturedField[];
  isComplete: boolean;
}

export type ScopeChipKind =
  | 'tcpa_captured'
  | 'sol_passed'
  | 'section_complete'
  | 'commercial_detected'
  | 'conflict_passed'
  | 'retainer_presented'
  | 'retainer_signed'
  | 'cms_pushed'
  | 'attorney_joining';

export interface ScopeChip {
  id: string;
  kind: ScopeChipKind;
  label: string;
  timestamp: number;
  /** Client-assigned arrival order for the transcript (see store/seq.ts). */
  seq?: number;
}

/** A case-type chip offered in the opener (from boot config). */
export interface CaseType {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
}

/** TCPA (or similar) consent prompt the agent sends after capturing the phone. */
export interface ConsentModal {
  kind: string; // e.g. 'tcpa'
  phone: string;
  title: string;
  body: string;
  agreeLabel: string;
  declineLabel: string;
}

export type LauncherPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface FirmBranding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  /**
   * Where the widget's theme comes from (set in the Branding Studio / Law App):
   *   'inherit' (default) — adopt the host site's detected colors
   *   'custom'            — use `primaryColor` / `accentColor` verbatim
   */
  themeSource?: 'inherit' | 'custom';
  launcherPosition: LauncherPosition;
  launcherIcon?: string;
  greetingMessage: string;
  offlineMessage?: string;
  introVideoUrl?: string;
  introVideoPoster?: string;
  introVideoCaption?: string;
  /** Practice-area options offered on the intro screen. First chip is the default focus target. */
  practiceAreas?: string[];
  outroVideoUrl?: string;
  outroVideoPoster?: string;
  /** Display name for the AI assistant, shown on its avatar / fallback initials. */
  assistantName?: string;
  /** Headshot/photo for the AI assistant's chat avatar. Falls back to initials. */
  assistantAvatarUrl?: string;
  /** Dedicated launcher / mini-bubble photo (independent of the video poster). */
  launcherImageUrl?: string;
  /** Background color for the launcher bubble / avatar tile (distinct from brand accent). */
  bubbleBgColor?: string;
  /** Firm font family applied across the widget UI (falls back to the default stack). */
  fontFamily?: string;
  /** Launcher offset from the screen edges, in px (default 24 each). */
  launcherOffsetX?: number;
  launcherOffsetY?: number;
}

export interface FeatureFlags {
  voice: boolean;
  video_intro: boolean;
  video_record: boolean;
  file_upload: boolean;
  esign: boolean;
  human_takeover: boolean;
  scheduling: boolean;
  multi_language: boolean;
}

export type Plan = 'chat_only' | 'chat_plus_voice' | 'full';

/**
 * One authored compliance template (TCPA consent copy or a UPL disclaimer),
 * written in the Law App's Compliance tab. `version` is server-minted — display
 * it and echo it back when recording consent so the exact copy is provable in
 * the audit log. Mirrors the backend's TemplateItem (compliance_service.py).
 */
export interface TemplateItem {
  text: string;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Contact channel a consent string applies to (call/SMS/booking/web form). */
export type ConsentChannel = 'call' | 'sms' | 'booking' | 'form';

export interface ComplianceConfig {
  /** Legacy single-string AI disclosure. Fallback when no per-language template. */
  aiDisclosure: string;
  /**
   * Per-language AI disclosure templates keyed by language code, authored in the
   * Compliance tab. Resolve with `resolveAiDisclosure()`, which falls back to the
   * 'en' template, then the legacy `aiDisclosure`, then a built-in default.
   */
  aiDisclosureTemplates?: Record<string, TemplateItem>;
  /**
   * Legacy single-string TCPA consent. Kept as the fallback for firms that
   * haven't authored per-language templates in the Compliance tab.
   */
  tcpaConsent: string;
  /**
   * Per-language TCPA consent templates keyed by language code (e.g. 'en',
   * 'es', 'ar'), authored in the Law App's Compliance tab. Resolve with
   * `resolveTcpa()` — it picks the lead's language and falls back to
   * `tcpaConsent`. Empty ({}) for firms that never touched the tab.
   */
  tcpaTemplates?: Record<string, TemplateItem>;
  /**
   * Optional per-channel consent, so a call/booking screen shows call consent
   * and a text screen shows SMS consent instead of one string reused
   * everywhere (SMS "reply STOP" wording must not sit on a call screen). Keyed
   * by channel then language, mirroring `tcpaTemplates`. When a channel/language
   * is absent, resolution falls back to `tcpaTemplates` -> `tcpaConsent` -> a
   * compliant default. Populated by the backend from the Compliance tab.
   */
  tcpaByChannel?: Partial<Record<ConsentChannel, Record<string, TemplateItem>>>;
  privacyUrl: string;
  termsUrl: string;
}

/** A contact channel offered on the Connect launcher home menu. */
export type ConnectChannel = 'call' | 'chat' | 'text' | 'schedule' | 'email';

/**
 * Admin-selectable presentation size:
 *   large  — hero video + stacked channel cards
 *   medium — compact card (video tile + channel row)
 *   small  — picture-only launcher (attorney photo + greeting bubble)
 */
export type WidgetSize = 'small' | 'medium' | 'large';

/** Which attorney video plays on the launcher (or none → branded avatar). */
export type VideoMode = 'intro' | 'story' | 'none';

/**
 * A surface inside the widget that can play its own short video:
 *   menu        — the cinematic home (the current intro/story clip)
 *   call        — "Call me now" (explains: leave name + number, we'll ring you)
 *   text        — "Text me"
 *   schedule    — "Book a call"
 *   chat_intro  — the "Chat with us" opener (case-type option pills)
 *   chat        — inside the live chat conversation
 * Each surface can show a purpose-built clip; a missing one falls back to the
 * firm's intro/cinematic video, so nothing is blank until the firm authors them.
 */
export type VideoView = 'menu' | 'call' | 'text' | 'schedule' | 'chat_intro' | 'chat';

/** A per-view video authored in the dashboard (Branding Studio). */
export interface ViewVideo {
  url: string;
  poster?: string;
  /** Optional short caption chip shown over the video. */
  caption?: string;
}

/**
 * Connect launcher configuration. Owned by the Branding Studio (Law App) and
 * delivered on the boot config; the widget resolves it with defaults + URL
 * overrides (see config/connect.ts).
 */
export interface ConnectSettings {
  size: WidgetSize;
  /** Enabled channels in admin order. UI still demotes 'email' to a link. */
  channels: ConnectChannel[];
  videoMode: VideoMode;
  /** Autoplay the launcher video muted (true) vs. show it paused (false). */
  autoplay: boolean;
  /** Open into a full-screen video that settles into the panel. */
  fullscreenOpen: boolean;
  /** Text methods offered under the Text channel. */
  textMethods: Array<'sms' | 'whatsapp'>;
  /** Local business hours [open, close) in 24h; used for time-aware ranking. */
  businessHours?: { open: number; close: number };
  /** Firm phone (tap-to-call) and email (demoted email link). */
  phone?: string;
  email?: string;
  /** Optional second "story" video URL/poster when videoMode === 'story'. */
  storyVideoUrl?: string;
  storyVideoPoster?: string;
  /**
   * Per-view videos, one optional clip per surface (see VideoView). Each entry
   * overrides the intro video on that surface; a missing entry falls back to the
   * intro/cinematic clip. Authored in the Branding Studio, delivered on /config.
   */
  channelVideos?: Partial<Record<VideoView, ViewVideo>>;
  /** Grace window (ms) to undo a just-sent message. default 5000. */
  undoWindowMs?: number;
  /** Allow leads to record voice / video notes (gated until backend ships). */
  allowVoiceNotes?: boolean;
  allowVideoNotes?: boolean;
}

export interface WidgetBootConfig {
  firmId: string;
  firmName: string;
  plan: Plan;
  features: FeatureFlags;
  branding: FirmBranding;
  /**
   * Ordered list of language codes the firm offers, already narrowed by the
   * backend to languages that have consent copy. `languages[0]` is the default.
   * Absent or single-entry means no language picker. Drives the language UI.
   */
  languages?: string[];
  /** Connect launcher settings (size, channels, video). Resolved with defaults. */
  connect?: Partial<ConnectSettings>;
  flowId: string;
  compliance: ComplianceConfig;
  /** Case-type chips for the opener. Falls back to branding.practiceAreas when empty. */
  caseTypes?: CaseType[];
  /** Dropbox Sign embedded client id — present only when e-sign is configured. */
  dropboxSignClientId?: string | null;
  /** Pass to the embedded SDK's open({ testMode }); true on sandbox/test apps. */
  dropboxSignTestMode?: boolean;
  /** Origins permitted to embed this widget. Loader + iframe validate against this list. */
  allowedOrigins?: string[];
  /** Transport the backend speaks. The backend returns 'livekit'. */
  transport?: 'livekit' | 'websocket';
  /** Informational LiveKit URL. Use the per-session url from POST /token to actually connect. */
  livekitUrl?: string;
}
