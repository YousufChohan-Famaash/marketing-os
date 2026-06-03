import type { StateCreator } from 'zustand';
import type { WidgetStore } from '../widgetStore';

/**
 * UI / ephemeral state.
 *
 * Note: the spec describes 5 slices; this 6th slice was added to keep
 * modal/drawer/boot-status state out of the domain slices. Future moves
 * (deferred per spec) — XState for flow, analytics taxonomy — can fold in here.
 */

export type ActiveModal =
  | 'esign'
  | 'voice'
  | 'video'
  | 'human-takeover'
  | 'emergency'
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
  isCaptureDrawerOpen: boolean;
  activeModal: ActiveModal;
  unreadCount: number;
  agentTakeover: AgentTakeover | null;
  /** Active conversation id — needed by REST calls (uploads, e-sign). */
  conversationId: string | null;

  setBootStatus: (status: BootStatus, error?: string | null) => void;
  setConversationId: (id: string | null) => void;
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
  isCaptureDrawerOpen: false,
  activeModal: null,
  unreadCount: 0,
  agentTakeover: null,
  conversationId: null,

  setBootStatus: (status, error = null) => set({ bootStatus: status, bootError: error }),
  setConversationId: (id) => set({ conversationId: id }),
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
