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
  /** For `document_sign` cards: the document to review & sign. */
  document?: DocumentRef;
  video?: VideoPayload;
  linkCard?: LinkCardPayload;
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

export interface ComplianceConfig {
  aiDisclosure: string;
  tcpaConsent: string;
  privacyUrl: string;
  termsUrl: string;
}

export interface WidgetBootConfig {
  firmId: string;
  firmName: string;
  plan: Plan;
  features: FeatureFlags;
  branding: FirmBranding;
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
