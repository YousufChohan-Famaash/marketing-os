import type { StateCreator } from 'zustand';
import type { WidgetStore } from '../widgetStore';
import { cleanContact, type LeadContact } from '../../services/leadContact';

export interface LeadContactSlice {
  /** Contact details the visitor shared THIS chat, so quick actions auto-fill.
   *  In-memory only — a page refresh clears it (nothing is persisted). */
  leadContact: LeadContact;
  /** Merge in newly-known details (non-empty wins) for the current session. */
  rememberContact: (patch: LeadContact) => void;
}

export const createLeadContactSlice: StateCreator<
  WidgetStore,
  [],
  [],
  LeadContactSlice
> = (set) => ({
  leadContact: {},
  rememberContact: (patch) =>
    set((state) => ({ leadContact: { ...state.leadContact, ...cleanContact(patch) } })),
});
