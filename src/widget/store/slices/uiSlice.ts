import type { StateCreator } from 'zustand';
import type { ConnectChannel, ConsentModal } from '../../types/domain';
import type { ClientEvent, ConnectCallStatus } from '../../types/protocol';
import type { WidgetStore } from '../widgetStore';

/** Which Connect surface is showing: the home menu or a specific channel. */
export type ConnectView = 'home' | ConnectChannel;

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

export type BootStatus = 'idle' | 'loading' | 'ready' | 'error' | 'disabled';

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
  /** Connect launcher view: the home menu, or a channel the lead routed into. */
  connectView: ConnectView;
  /** True once a conversation (chat) has actually begun — drives Small-mode
   * expand and the video shrink-to-avatar. */
  conversationStarted: boolean;
  /** True once the cinematic full-screen open has played / been skipped. */
  cinematicDismissed: boolean;
  /** The just-sent lead message that can still be undone (null = none). */
  undoableMessageId: string | null;
  /** Live status of an in-progress "Call now" outbound call (null = none). */
  connectCallStatus: ConnectCallStatus | null;

  setBootStatus: (status: BootStatus, error?: string | null) => void;
  setConnectView: (view: ConnectView) => void;
  setConversationStarted: (started: boolean) => void;
  dismissCinematic: () => void;
  /** Mark a message undoable for the configured grace window, then auto-clear. */
  setUndoable: (id: string) => void;
  clearUndoable: () => void;
  setConnectCallStatus: (status: ConnectCallStatus | null) => void;
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

let undoTimer: ReturnType<typeof setTimeout> | null = null;

export const createUiSlice: StateCreator<WidgetStore, [], [], UiSlice> = (
  set,
  get,
) => ({
  bootStatus: 'idle',
  bootError: null,
  isWidgetOpen: false,
  isExpanded: false,
  isCaptureDrawerOpen: false,
  activeModal: null,
  unreadCount: 0,
  agentTakeover: null,
  conversationId: null,
  caseTypePicked: false,
  pendingCaseType: null,
  consent: null,
  activeSigning: null,
  connectView: 'home',
  conversationStarted: false,
  cinematicDismissed: false,
  undoableMessageId: null,
  connectCallStatus: null,

  setBootStatus: (status, error = null) => set({ bootStatus: status, bootError: error }),
  setConnectView: (view) => set({ connectView: view }),
  setConversationStarted: (started) => set({ conversationStarted: started }),
  dismissCinematic: () => set({ cinematicDismissed: true }),
  setUndoable: (id) => {
    if (undoTimer) clearTimeout(undoTimer);
    set({ undoableMessageId: id });
    const ms = get().connect?.undoWindowMs ?? 5000;
    undoTimer = setTimeout(() => {
      undoTimer = null;
      set({ undoableMessageId: null });
    }, ms);
  },
  clearUndoable: () => {
    if (undoTimer) {
      clearTimeout(undoTimer);
      undoTimer = null;
    }
    set({ undoableMessageId: null });
  },
  setConnectCallStatus: (status) => set({ connectCallStatus: status }),
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
