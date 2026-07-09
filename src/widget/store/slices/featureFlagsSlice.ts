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
   * (resolveTcpa). Defaults to 'en'; the language picker (coming soon) sets it.
   */
  language: string;
  setLanguage: (language: string) => void;
  setBootConfig: (config: WidgetBootConfig) => void;
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
  setLanguage: (language) => set({ language }),
  setBootConfig: (config) =>
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
    }),
});
