import type { Message } from '../types/domain';
import type { ConversationSocket } from '../types/protocol';
import { useWidgetStore } from './widgetStore';

/**
 * Wire socket events to the store. Returns an unsubscribe function that
 * detaches all handlers. Pair with `socket.disconnect()` in the same cleanup.
 */
export function wireSocketToStore(socket: ConversationSocket): () => void {
  const store = useWidgetStore;

  // Typing-indicator lifecycle. The dots are driven by `isAiTyping`. The store
  // owns the safety timer (see streamingSlice): `setStreaming` keeps them alive
  // while chunks flow, `endStreaming` clears them, and either way they can't
  // stick on if the backend goes quiet. User actions arm them via `beginTyping`.
  const armTyping = (id: string) => store.getState().setStreaming(id);
  const stopTyping = () => store.getState().endStreaming();

  /**
   * Patch a message by id, creating it if absent. Used by the standalone
   * affordance events (quick_reply_options, retainer_present, …) which augment
   * a question bubble whether or not its `message_complete` arrived first.
   */
  const mergeMessage = (id: string, patch: Partial<Message>) => {
    const s = store.getState();
    const existing = s.messages.find((m) => m.id === id);
    s.upsertMessage({
      role: 'ai',
      type: 'text',
      content: '',
      timestamp: Date.now(),
      status: 'delivered',
      ...existing,
      ...patch,
      id,
    } as Message);
  };

  const offs: Array<() => void> = [
    socket.on('message_complete', (e) => {
      store.getState().upsertMessage(e.message);
      // Streaming scaffold → show dots; any finalized message → clear them
      // (regardless of id, so a non-matching final can't leave them stuck).
      if (e.message.isStreaming) {
        armTyping(e.messageId);
      } else {
        stopTyping();
      }
      if (!store.getState().isWidgetOpen) {
        store.getState().incrementUnread();
      }
    }),

    socket.on('message_chunk', (e) => {
      store.getState().appendToMessage(e.messageId, e.chunk);
      // Keep the dots alive while chunks flow; the idle timer clears them after.
      armTyping(e.messageId);
    }),

    socket.on('field_captured', (e) => {
      store.getState().captureField(e.field);
    }),

    socket.on('field_edited', (e) => {
      store.getState().confirmEdit(e.fieldId, e.value);
    }),

    socket.on('scope_chip_added', (e) => {
      store.getState().addChip(e.chip);
      if (e.chip.kind === 'section_complete') {
        // Best-effort: mark the relevant section complete based on chip label heuristic.
        // The flow could carry sectionId on chips if needed; keeping coupling loose for now.
        const label = e.chip.label.toLowerCase();
        const sectionId = label.includes('identity')
          ? 'identity'
          : label.includes('evidence')
            ? 'evidence'
            : label.includes('accident')
              ? 'accident'
              : null;
        if (sectionId) store.getState().setSectionComplete(sectionId, true);
      }
    }),

    // Standalone affordance events — used when the backend delivers a question's
    // options/upload/retainer/card separately instead of embedded in the message.
    socket.on('quick_reply_options', (e) => {
      mergeMessage(e.messageId, { type: 'quick_reply', options: e.options });
    }),

    socket.on('file_upload_request', (e) => {
      mergeMessage(e.messageId, { type: 'file_upload', content: e.prompt });
    }),

    socket.on('retainer_present', (e) => {
      mergeMessage(e.messageId, { type: 'retainer', retainerStatus: 'pending', contingencyPercent: e.contingencyPercent });
    }),

    socket.on('link_card', (e) => {
      mergeMessage(e.messageId, {
        type: 'link_card',
        linkCard: e.card,
        content: e.card.title,
      });
    }),

    socket.on('video_message', (e) => {
      mergeMessage(e.messageId, {
        type: 'video_message',
        video: e.video,
        role: e.role ?? 'ai',
      });
    }),

    socket.on('consent_modal', (e) => {
      // Agent is waiting on the user now — not composing.
      stopTyping();
      store.getState().setConsent(e.consent);
    }),

    socket.on('agent_takeover', (e) => {
      // Defensive: never store an undefined name (a mis-shaped event would then
      // crash the header's `.charAt`). Fall back to a safe label.
      store.getState().setAgentTakeover({
        agentName: e.agentName || 'Specialist',
        agentTitle: e.agentTitle,
      });
    }),

    socket.on('conversation_ended', () => {
      stopTyping();
      store.getState().setConversationEnded(true);
    }),

    // Live "Call now" status (connecting → connected / couldn't-reach).
    socket.on('connect_call_status', (e) => {
      store.getState().setConnectCallStatus(e.status);
    }),

    // Agent detected "start a new chat" → signal App to reset to a fresh intake.
    socket.on('start_new_intake', () => {
      store.getState().requestNewIntake();
    }),
  ];

  return () => {
    store.getState().endStreaming();
    for (const off of offs) off();
  };
}
