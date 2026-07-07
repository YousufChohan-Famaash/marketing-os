import type { StateCreator } from 'zustand';
import type { WidgetStore } from '../widgetStore';
import { cleanContact, loadLeadContact, persistLeadContact, type LeadContact } from '../../services/leadContact';

export interface LeadContactSlice {
  /** Contact details the visitor has shared, remembered so quick actions auto-fill. */
  leadContact: LeadContact;
  /** Merge in newly-known details (non-empty wins) and persist them for this firm. */
  rememberContact: (patch: LeadContact) => void;
  /** Seed from storage once the firm id is known (boot). Keeps anything already set. */
  hydrateLeadContact: (firmId: string) => void;
}

export const createLeadContactSlice: StateCreator<
  WidgetStore,
  [],
  [],
  LeadContactSlice
> = (set, get) => ({
  leadContact: {},
  rememberContact: (patch) =>
    set((state) => {
      const next = { ...state.leadContact, ...cleanContact(patch) };
      persistLeadContact(get().firmId, next);
      return { leadContact: next };
    }),
  hydrateLeadContact: (firmId) =>
    set((state) => ({ leadContact: { ...loadLeadContact(firmId), ...state.leadContact } })),
});
