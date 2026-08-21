import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { CallbackForm } from './CallbackForm';
import { Modal } from './Modal';

/**
 * "I need help now" → urgent callback request. Collects a phone number so the
 * team can call back immediately (Figma callback dialog).
 */
export function EmergencyModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const setHumanRequested = useWidgetStore((s) => s.setHumanRequested);
  const socket = useSocket();

  return (
    <Modal title="Talk to a human" onClose={() => setActiveModal(null)}>
      <CallbackForm
        heading="We're here to help"
        body="Please provide your phone number so we can call you immediately."
        cta="Call me now"
        onSubmit={(phone) => {
          socket?.send({ type: 'request_human', method: 'emergency', phone });
          // Waiting on a person now — hide the AI "Call me" button (§7).
          setHumanRequested(true);
          setActiveModal(null);
        }}
      />
    </Modal>
  );
}
