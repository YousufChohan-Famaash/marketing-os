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
  | 'call-me'
  | null;

/** Lifecycle of a mid-chat "Call me" request (chat-in-call-button guide §4). */
export type ChatCallPhase = 'idle' | 'calling' | 'connected' | 'failed';

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
  /** Mid-chat "Call me" lifecycle. Drives the composer read-only state on
   *  `connected` and the calling/failed banners. See chat-in-call-button guide. */
  chatCallPhase: ChatCallPhase;
  /** True once the visitor has asked for a human and is waiting on staff. While
   *  set, we hide the "Call me" button — offering an AI callback then reads as
   *  ignoring the request (guide §7). Cleared on reset / new intake. */
  humanRequested: boolean;
  /**
   * Shared sound preference for every video in the widget. Videos autoplay
   * muted; the first time the visitor unmutes any video this flips true and all
   * subsequent videos start unmuted (and vice-versa). One toggle, one memory.
   */
  videoSoundOn: boolean;
  /** Bumped when the agent asks to start a fresh intake (start_new_intake). App
   * watches this and runs the same reset as the "New chat" button. */
  newIntakeNonce: number;
  /**
   * Multi-tab: true when THIS tab owns the single LiveKit connection (the
   * leader) or when multi-tab sync is off (a lone tab is always its own leader).
   * A follower tab sets this false so it defers agent-driven "new chat" to the
   * leader (avoids every tab minting its own fresh conversation).
   */
  isSessionLeader: boolean;

  setBootStatus: (status: BootStatus, error?: string | null) => void;
  requestNewIntake: () => void;
  setSessionLeader: (isLeader: boolean) => void;
  setVideoSoundOn: (on: boolean) => void;
  setConnectView: (view: ConnectView) => void;
  setConversationStarted: (started: boolean) => void;
  dismissCinematic: () => void;
  /** Mark a message undoable for the configured grace window, then auto-clear. */
  setUndoable: (id: string) => void;
  clearUndoable: () => void;
  setConnectCallStatus: (status: ConnectCallStatus | null) => void;
  setChatCallPhase: (phase: ChatCallPhase) => void;
  setHumanRequested: (requested: boolean) => void;
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
  chatCallPhase: 'idle',
  humanRequested: false,
  videoSoundOn: false,
  newIntakeNonce: 0,
  isSessionLeader: true,

  setBootStatus: (status, error = null) => set({ bootStatus: status, bootError: error }),
  requestNewIntake: () => set((s) => ({ newIntakeNonce: s.newIntakeNonce + 1 })),
  setSessionLeader: (isLeader) => set({ isSessionLeader: isLeader }),
  setVideoSoundOn: (on) => set({ videoSoundOn: on }),
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
  setChatCallPhase: (phase) => set({ chatCallPhase: phase }),
  setHumanRequested: (requested) => set({ humanRequested: requested }),
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
