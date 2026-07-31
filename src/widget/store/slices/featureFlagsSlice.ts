import type { StateCreator } from 'zustand';
import type {
  CaseType,
  ComplianceConfig,
  ConnectSettings,
  FeatureFlags,
  FirmBranding,
  Plan,
  WidgetBootConfig,
} from '../../types/domain';
import { resolveConnectSettings } from '../../config/connect';
import type { WidgetStore } from '../widgetStore';

export interface FeatureFlagsSlice {
  firmId: string | null;
  firmName: string | null;
  plan: Plan | null;
  flags: FeatureFlags | null;
  branding: FirmBranding | null;
  compliance: ComplianceConfig | null;
  caseTypes: CaseType[];
  /** Dropbox Sign embedded client id (null when e-sign isn't configured). */
  dropboxSignClientId: string | null;
  dropboxSignTestMode: boolean;
  allowedOrigins: string[];
  /** Resolved Connect launcher settings (size, channels, video). */
  connect: ConnectSettings;
  /**
   * Active conversation language code ('en' | 'es' | 'ar'). Single source of
   * truth for both the /token language and per-language compliance copy
   * (resolveTcpa / resolveAiDisclosure). Auto-picked at boot from the browser
   * language intersected with `languages`; the picker updates it.
   */
  language: string;
  /** Ordered languages the firm offers (from /config; [] = no picker). */
  languages: string[];
  setLanguage: (language: string) => void;
  setBootConfig: (config: WidgetBootConfig) => void;
  /** Re-apply the config-derived, language-varying fields (branding videos +
   * posters + captions, connect channel videos, compliance copy) WITHOUT
   * touching the visitor's chosen `language`/`languages`. Used when the language
   * picker changes and we re-fetch /config?language= to swap the video. */
  applyLanguageConfig: (config: WidgetBootConfig) => void;
}

export const createFeatureFlagsSlice: StateCreator<
  WidgetStore,
  [],
  [],
  FeatureFlagsSlice
> = (set) => ({
  firmId: null,
  firmName: null,
  plan: null,
  flags: null,
  branding: null,
  compliance: null,
  caseTypes: [],
  dropboxSignClientId: null,
  dropboxSignTestMode: false,
  allowedOrigins: [],
  connect: resolveConnectSettings(null),
  language: 'en',
  languages: [],
  setLanguage: (language) => set({ language }),
  setBootConfig: (config) => {
    // Auto-greet in the visitor's language when the firm offers it, else the
    // firm default (languages[0]). Sent on /token, so the agent replies in it.
    const offered = config.languages?.length ? config.languages : ['en'];
    const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
    const language = offered.includes(nav) ? nav : offered[0];
    set({
      firmId: config.firmId,
      firmName: config.firmName,
      plan: config.plan,
      flags: config.features,
      branding: config.branding,
      compliance: config.compliance,
      caseTypes: config.caseTypes ?? [],
      dropboxSignClientId: config.dropboxSignClientId ?? null,
      dropboxSignTestMode: config.dropboxSignTestMode ?? false,
      allowedOrigins: config.allowedOrigins ?? [],
      connect: resolveConnectSettings(config),
      languages: config.languages ?? [],
      language,
    });
  },
  applyLanguageConfig: (config) =>
    set({
      branding: config.branding,
      compliance: config.compliance,
      connect: resolveConnectSettings(config),
      // language / languages intentionally preserved — the picker owns them.
    }),
});
