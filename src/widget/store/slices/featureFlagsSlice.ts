import type { StateCreator } from 'zustand';
import type {
  CaseType,
  ComplianceConfig,
  FeatureFlags,
  FirmBranding,
  Plan,
  WidgetBootConfig,
} from '../../types/domain';
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
    }),
});
