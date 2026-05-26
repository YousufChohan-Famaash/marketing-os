export type MessageRole = 'ai' | 'lead' | 'system' | 'agent';

export type MessageType =
  | 'text'
  | 'quick_reply'
  | 'file_upload'
  | 'retainer'
  | 'video_intro'
  | 'video_message'
  | 'voice_clip'
  | 'link_card'
  | 'rich_text';

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
  files?: UploadedFile[];
  retainerStatus?: 'pending' | 'signing' | 'signed';
  video?: VideoPayload;
  linkCard?: LinkCardPayload;
  hasMarkdown?: boolean;
  isStreaming?: boolean;
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
  /** Origins permitted to embed this widget. Loader + iframe validate against this list. */
  allowedOrigins?: string[];
}
