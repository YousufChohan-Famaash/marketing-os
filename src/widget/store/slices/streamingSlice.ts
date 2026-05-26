import type { StateCreator } from 'zustand';
import type { WidgetStore } from '../widgetStore';

export interface StreamingSlice {
  /** True iff at least one AI message is currently streaming. */
  isAiTyping: boolean;
  /** The id of the message currently streaming, if any. */
  streamingMessageId: string | null;
  setStreaming: (id: string) => void;
  endStreaming: () => void;
}

export const createStreamingSlice: StateCreator<
  WidgetStore,
  [],
  [],
  StreamingSlice
> = (set) => ({
  isAiTyping: false,
  streamingMessageId: null,
  setStreaming: (id) => set({ isAiTyping: true, streamingMessageId: id }),
  endStreaming: () => set({ isAiTyping: false, streamingMessageId: null }),
});
