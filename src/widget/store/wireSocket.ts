import type { ConversationSocket } from '../types/protocol';
import { useWidgetStore } from './widgetStore';

/**
 * Wire socket events to the store. Returns an unsubscribe function that
 * detaches all handlers. Pair with `socket.disconnect()` in the same cleanup.
 */
export function wireSocketToStore(socket: ConversationSocket): () => void {
  const store = useWidgetStore;

  const offs: Array<() => void> = [
    socket.on('message_complete', (e) => {
      store.getState().upsertMessage(e.message);
      if (e.message.isStreaming) {
        store.getState().setStreaming(e.messageId);
      } else if (store.getState().streamingMessageId === e.messageId) {
        store.getState().endStreaming();
      }
      if (!store.getState().isWidgetOpen) {
        store.getState().incrementUnread();
      }
    }),

    socket.on('message_chunk', (e) => {
      store.getState().appendToMessage(e.messageId, e.chunk);
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

    socket.on('agent_takeover', (e) => {
      store.getState().setAgentTakeover({
        agentName: e.agentName,
        agentTitle: e.agentTitle,
      });
    }),

    socket.on('conversation_ended', () => {
      store.getState().endStreaming();
    }),
  ];

  return () => {
    for (const off of offs) off();
  };
}
