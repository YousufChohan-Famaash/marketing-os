import type { StateCreator } from 'zustand';
import type { Message } from '../../types/domain';
import type { WidgetStore } from '../widgetStore';
import { nextSeq } from '../seq';

export interface ConversationSlice {
  messages: Message[];
  addMessage: (msg: Message) => void;
  /** Patch a subset of fields on an existing message. */
  updateMessage: (id: string, updates: Partial<Message>) => void;
  /** Create or replace a message in full (used by message_complete events). */
  upsertMessage: (msg: Message) => void;
  removeMessage: (id: string) => void;
  /** Append a chunk to a message's content. Creates the message lazily if missing. */
  appendToMessage: (id: string, chunk: string) => void;
  resetConversation: () => void;
}

export const createConversationSlice: StateCreator<
  WidgetStore,
  [],
  [],
  ConversationSlice
> = (set) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, { ...msg, seq: msg.seq ?? nextSeq() }],
    })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  upsertMessage: (msg) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === msg.id);
      if (idx === -1) {
        return { messages: [...state.messages, { ...msg, seq: msg.seq ?? nextSeq() }] };
      }
      const next = state.messages.slice();
      // Preserve the original arrival order across the streaming scaffold→final
      // replacement, so a finalized message doesn't jump to the bottom.
      next[idx] = { ...msg, seq: state.messages[idx].seq ?? msg.seq ?? nextSeq() };
      return { messages: next };
    }),
  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
  appendToMessage: (id, chunk) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx === -1) {
        // Lazy create — defensive fallback if a chunk arrives before scaffold.
        return {
          messages: [
            ...state.messages,
            {
              id,
              role: 'ai',
              type: 'text',
              content: chunk,
              timestamp: Date.now(),
              status: 'delivered',
              isStreaming: true,
              seq: nextSeq(),
            } as Message,
          ],
        };
      }
      const next = state.messages.slice();
      next[idx] = { ...next[idx], content: next[idx].content + chunk };
      return { messages: next };
    }),
  resetConversation: () => set({ messages: [] }),
});
