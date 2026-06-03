import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { CalendarIcon, PhoneIcon } from '../utils/icons';
import { Modal } from './Modal';

const OPTIONS = [
  {
    id: 'call' as const,
    icon: PhoneIcon,
    title: 'Call me now',
    body: 'A team member will call you within 60 seconds.',
  },
  {
    id: 'schedule' as const,
    icon: CalendarIcon,
    title: 'Schedule a call',
    body: 'Pick a time that works for you.',
  },
];

export function HumanTakeoverModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const socket = useSocket();

  const choose = (_id: 'call' | 'schedule') => {
    // Tell the backend a human was requested; it replies with `agent_takeover`.
    socket?.send({ type: 'request_human' });
    setActiveModal(null);
  };

  return (
    <Modal title="Talk to a human" onClose={() => setActiveModal(null)}>
      <ul className="space-y-2">
        {OPTIONS.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => choose(opt.id as 'call' | 'schedule')}
              className="flex w-full items-start gap-3 rounded-md border border-hairline bg-white p-3 text-left transition-colors hover:border-famaash-border hover:bg-famaash-light/40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-famaash-light text-famaash">
                <opt.icon size={16} aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-ink">
                  {opt.title}
                </span>
                <span className="block text-[12px] text-muted">{opt.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
