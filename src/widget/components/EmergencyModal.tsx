import { useWidgetStore } from '../store/widgetStore';
import { AlertIcon } from '../utils/icons';
import { Modal } from './Modal';

/**
 * Per spec: do not mention 911 directly — calm de-escalation copy only.
 * Surface routes to local emergency services without prescribing a specific
 * country/region's number.
 */
export function EmergencyModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  return (
    <Modal
      title="If you're in immediate danger"
      onClose={() => setActiveModal(null)}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-ink">
          <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          <p>
            Please contact your local emergency services right away. We're here
            when you're safe — this conversation will be waiting for you.
          </p>
        </div>
        <ul className="space-y-1.5 text-[13px]">
          <li>
            <a
              href="tel:911"
              className="flex items-center justify-between rounded-md border border-hairline bg-white px-3 py-2 no-underline text-ink hover:bg-subtle"
            >
              <span className="font-medium">Call emergency services</span>
              <span className="text-[11px] text-muted">tap to call</span>
            </a>
          </li>
          <li>
            <a
              href="https://www.who.int/health-topics/emergency-care"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-md border border-hairline bg-white px-3 py-2 no-underline text-ink hover:bg-subtle"
            >
              <span className="font-medium">Find a hotline by region</span>
              <span className="text-[11px] text-muted">external</span>
            </a>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setActiveModal(null)}
          className="w-full rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-white hover:opacity-95"
        >
          I'm safe — go back
        </button>
      </div>
    </Modal>
  );
}
