import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { CallbackForm } from './CallbackForm';
import { Modal } from './Modal';

/**
 * "Text me" → collect a phone number and shift the conversation to SMS. We send
 * the request as a lead_message (which the agent, having SMS capability, acts
 * on) and mirror it in the transcript so the handoff is visible.
 */
export function TextHandoffModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const socket = useSocket();

  const submit = (phone: string) => {
    const content = `Please continue this conversation by text at ${phone}.`;
    useWidgetStore.getState().addMessage({
      id: generateId('msg_lead'),
      role: 'lead',
      type: 'text',
      content,
      timestamp: Date.now(),
      status: 'sent',
    });
    socket?.send({ type: 'lead_message', content, clientMessageId: generateId('msg_lead') });
    setActiveModal(null);
  };

  return (
    <Modal title="Continue over text" onClose={() => setActiveModal(null)}>
      <CallbackForm
        variant="brand"
        heading="Pick up this chat by text"
        body="Enter your number and we’ll text you so you can continue this conversation from your phone."
        cta="Text me"
        onSubmit={submit}
      />
    </Modal>
  );
}
