import type { StateCreator } from 'zustand';
import type { WidgetStore } from '../widgetStore';

/** Safety timeouts so the dots can never stick on if the backend goes quiet. */
const AWAIT_REPLY_MS = 30000; // user acted → waiting for the AI's first message
const STREAM_IDLE_MS = 6000; // mid-stream gap between chunks

let typingTimer: ReturnType<typeof setTimeout> | null = null;

export interface StreamingSlice {
  /** True while the AI is composing — drives the typing-dots indicator. */
  isAiTyping: boolean;
  /** The id of the message currently streaming, if any. */
  streamingMessageId: string | null;
  /** Show the dots right after a user action, while we wait for the AI's reply. */
  beginTyping: () => void;
  /** A message is actively streaming (scaffold / chunk). */
  setStreaming: (id: string) => void;
  /** Reply finished (or stalled / conversation ended) — hide the dots. */
  endStreaming: () => void;
}

export const createStreamingSlice: StateCreator<
  WidgetStore,
  [],
  [],
  StreamingSlice
> = (set, get) => {
  const arm = (ms: number) => {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingTimer = null;
      get().endStreaming();
    }, ms);
  };

  return {
    isAiTyping: false,
    streamingMessageId: null,
    beginTyping: () => {
      set({ isAiTyping: true });
      arm(AWAIT_REPLY_MS);
    },
    setStreaming: (id) => {
      set({ isAiTyping: true, streamingMessageId: id });
      arm(STREAM_IDLE_MS);
    },
    endStreaming: () => {
      if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
      }
      set({ isAiTyping: false, streamingMessageId: null });
    },
  };
};
