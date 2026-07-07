import { create } from 'zustand';
import {
  createCaptureSlice,
  type CaptureSlice,
} from './slices/captureSlice';
import {
  createConversationSlice,
  type ConversationSlice,
} from './slices/conversationSlice';
import {
  createFeatureFlagsSlice,
  type FeatureFlagsSlice,
} from './slices/featureFlagsSlice';
import {
  createLeadContactSlice,
  type LeadContactSlice,
} from './slices/leadContactSlice';
import {
  createScopeSlice,
  type ScopeSlice,
} from './slices/scopeSlice';
import {
  createStreamingSlice,
  type StreamingSlice,
} from './slices/streamingSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

export type WidgetStore = ConversationSlice &
  CaptureSlice &
  ScopeSlice &
  StreamingSlice &
  FeatureFlagsSlice &
  LeadContactSlice &
  UiSlice;

export const useWidgetStore = create<WidgetStore>()((...a) => ({
  ...createConversationSlice(...a),
  ...createCaptureSlice(...a),
  ...createScopeSlice(...a),
  ...createStreamingSlice(...a),
  ...createFeatureFlagsSlice(...a),
  ...createLeadContactSlice(...a),
  ...createUiSlice(...a),
}));

/** Reset everything for a fresh conversation. Used by tests and "start over". */
export function resetWidgetStore(): void {
  const s = useWidgetStore.getState();
  s.resetConversation();
  s.resetCapture();
  s.resetChips();
  s.endStreaming();
  s.setActiveModal(null);
  s.setCaptureDrawerOpen(false);
  s.clearUnread();
  s.setAgentTakeover(null);
  s.setBootStatus('idle', null);
}
