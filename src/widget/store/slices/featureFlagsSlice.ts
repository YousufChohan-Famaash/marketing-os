import type { StateCreator } from 'zustand';
import type {
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
  allowedOrigins: [],
  setBootConfig: (config) =>
    set({
      firmId: config.firmId,
      firmName: config.firmName,
      plan: config.plan,
      flags: config.features,
      branding: config.branding,
      compliance: config.compliance,
      allowedOrigins: config.allowedOrigins ?? [],
    }),
});
