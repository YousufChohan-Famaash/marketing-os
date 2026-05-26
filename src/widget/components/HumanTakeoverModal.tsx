import { useWidgetStore } from '../store/widgetStore';
import { PhoneIcon, UsersIcon, VideoIcon } from '../utils/icons';
import { Modal } from './Modal';

const OPTIONS = [
  {
    id: 'call' as const,
    icon: PhoneIcon,
    title: 'Call me now',
    body: 'A team member will call you within 60 seconds.',
  },
  {
    id: 'live' as const,
    icon: UsersIcon,
    title: 'Connect to a live chat',
    body: 'Sarah from the intake team will jump into this conversation.',
  },
  {
    id: 'video' as const,
    icon: VideoIcon,
    title: 'Schedule a video consult',
    body: 'Pick a time in the next 24 hours.',
  },
];

export function HumanTakeoverModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const setAgentTakeover = useWidgetStore((s) => s.setAgentTakeover);
  const addChip = useWidgetStore((s) => s.addChip);

  const choose = (id: 'call' | 'live' | 'video') => {
    if (id === 'live') {
      setAgentTakeover({
        agentName: 'Sarah Mendelson',
        agentTitle: 'Intake specialist',
      });
      addChip({
        id: `chip_handoff_${Date.now()}`,
        kind: 'attorney_joining',
        label: 'Sarah Mendelson joining call · warm handoff queued for 2:34 PM',
        timestamp: Date.now(),
      });
    }
    setActiveModal(null);
  };

  return (
    <Modal title="Talk to a human" onClose={() => setActiveModal(null)}>
      <ul className="space-y-2">
        {OPTIONS.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => choose(opt.id)}
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
