import type { StateCreator } from 'zustand';
import type { ConsentModal } from '../../types/domain';
import type { ClientEvent } from '../../types/protocol';
import type { WidgetStore } from '../widgetStore';

/** A document the lead is signing inline (drives the SigningSheet). */
export interface ActiveSigning {
  /** Item id to sign; omit to let the backend auto-resolve the retainer. */
  itemId?: string;
  name: string;
  /** Source card message id, so the card can flip to "signed". */
  messageId?: string;
}

/**
 * UI / ephemeral state.
 *
 * Note: the spec describes 5 slices; this 6th slice was added to keep
 * modal/drawer/boot-status state out of the domain slices. Future moves
 * (deferred per spec) — XState for flow, analytics taxonomy — can fold in here.
 */

export type ActiveModal =
  | 'voice'
  | 'video'
  | 'human-takeover'
  | 'emergency'
  | 'text-handoff'
  | null;

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AgentTakeover {
  agentName: string;
  agentTitle?: string;
}

export interface UiSlice {
  bootStatus: BootStatus;
  bootError: string | null;
  isWidgetOpen: boolean;
  /** Whether the chat is in its larger expanded size (default) vs the compact panel. */
  isExpanded: boolean;
  isCaptureDrawerOpen: boolean;
  activeModal: ActiveModal;
  unreadCount: number;
  agentTakeover: AgentTakeover | null;
  /** Active conversation id — needed by REST calls (uploads, e-sign). */
  conversationId: string | null;
  /** True once the opener case-type chip has been picked (the first user message). */
  caseTypePicked: boolean;
  /** The opener pick, held until a socket exists to send it (then App flushes it). */
  pendingCaseType: ClientEvent | null;
  /** Pending TCPA consent prompt (blocking modal) from the agent, if any. */
  consent: ConsentModal | null;
  /** Document currently being signed inline (drives the SigningSheet). */
  activeSigning: ActiveSigning | null;

  setBootStatus: (status: BootStatus, error?: string | null) => void;
  setExpanded: (expanded: boolean) => void;
  setConversationId: (id: string | null) => void;
  setCaseTypePicked: (picked: boolean) => void;
  setPendingCaseType: (event: ClientEvent | null) => void;
  setConsent: (consent: ConsentModal | null) => void;
  setActiveSigning: (signing: ActiveSigning | null) => void;
  openWidget: () => void;
  closeWidget: () => void;
  toggleCaptureDrawer: () => void;
  setCaptureDrawerOpen: (open: boolean) => void;
  setActiveModal: (modal: ActiveModal) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
  setAgentTakeover: (takeover: AgentTakeover | null) => void;
}

export const createUiSlice: StateCreator<WidgetStore, [], [], UiSlice> = (
  set,
) => ({
  bootStatus: 'idle',
  bootError: null,
  isWidgetOpen: false,
  isExpanded: true,
  isCaptureDrawerOpen: false,
  activeModal: null,
  unreadCount: 0,
  agentTakeover: null,
  conversationId: null,
  caseTypePicked: false,
  pendingCaseType: null,
  consent: null,
  activeSigning: null,

  setBootStatus: (status, error = null) => set({ bootStatus: status, bootError: error }),
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setConversationId: (id) => set({ conversationId: id }),
  setCaseTypePicked: (picked) => set({ caseTypePicked: picked }),
  setPendingCaseType: (event) => set({ pendingCaseType: event }),
  setConsent: (consent) => set({ consent }),
  setActiveSigning: (signing) => set({ activeSigning: signing }),
  openWidget: () => set({ isWidgetOpen: true, unreadCount: 0 }),
  closeWidget: () => set({ isWidgetOpen: false, activeModal: null, isCaptureDrawerOpen: false }),
  toggleCaptureDrawer: () =>
    set((state) => ({ isCaptureDrawerOpen: !state.isCaptureDrawerOpen })),
  setCaptureDrawerOpen: (open) => set({ isCaptureDrawerOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  setAgentTakeover: (takeover) => set({ agentTakeover: takeover }),
});
