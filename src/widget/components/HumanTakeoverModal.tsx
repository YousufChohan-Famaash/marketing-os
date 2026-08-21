import { useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ClockIcon,
  PhoneIcon,
} from '../utils/icons';
import { Modal } from './Modal';
import { CallbackForm } from './CallbackForm';

type View = 'menu' | 'immediate' | 'delayed';

const DELAY_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
];

export function HumanTakeoverModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const setConnectView = useWidgetStore((s) => s.setConnectView);
  const setHumanRequested = useWidgetStore((s) => s.setHumanRequested);
  const socket = useSocket();

  const [view, setView] = useState<View>('menu');
  const [delay, setDelay] = useState<number | null>(null);

  const close = () => setActiveModal(null);

  const backToMenu = () => {
    setDelay(null);
    setView('menu');
  };

  const requestHuman = (payload: {
    method: 'immediate' | 'delayed' | 'scheduled';
    phone: string;
    delayMinutes?: number;
    scheduledAt?: string;
  }) => {
    socket?.send({ type: 'request_human', ...payload });
    // The visitor is now waiting on a person — hide the AI "Call me" button (§7).
    setHumanRequested(true);
    close();
  };

  return (
    <Modal title="Talk to a human" onClose={close}>
      {view !== 'menu' && (
        <button
          type="button"
          onClick={backToMenu}
          className="mb-3 -ml-1 inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink"
        >
          <ChevronLeftIcon size={14} aria-hidden="true" />
          Back
        </button>
      )}

      {view === 'menu' && (
        <ul className="space-y-2.5">
          <li>
            <OptionCard
              icon={<PhoneIcon size={18} />}
              title="Call me immediately"
              subtitle="A team member will call you within 60 seconds."
              onClick={() => setView('immediate')}
            />
          </li>
          <li>
            <OptionCard
              icon={<ClockIcon size={18} />}
              title="Call me in 15 minutes"
              subtitle="Select 15, 30, 45 min or 1 hour."
              onClick={() => setView('delayed')}
            />
          </li>
          <li>
            <OptionCard
              icon={<CalendarIcon size={18} />}
              title="Book a call"
              subtitle="Pick a specific date and time."
              onClick={() => {
                // Reuse the real Book screen (live calendar availability) rather
                // than a separate in-modal scheduler.
                close();
                setConnectView('schedule');
              }}
            />
          </li>
        </ul>
      )}

      {view === 'immediate' && (
        <CallbackForm
          heading="We're here to help"
          body="Please provide your phone number so we can call you immediately."
          cta="Call me now"
          onSubmit={(phone) => requestHuman({ method: 'immediate', phone })}
        />
      )}

      {view === 'delayed' && delay === null && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted">When should we call you back?</p>
          <div className="grid grid-cols-2 gap-2">
            {DELAY_OPTIONS.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setDelay(opt.minutes)}
                className="rounded-pill border border-[#EAEEF3] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F8FB]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'delayed' && delay !== null && (
        <CallbackForm
          heading="We're here to help"
          body={`Share your number and we'll call you in ${delay} minutes.`}
          cta={`Call me in ${delay} min`}
          onSubmit={(phone) =>
            requestHuman({ method: 'delayed', phone, delayMinutes: delay })
          }
        />
      )}
    </Modal>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-white p-3 text-left transition-colors hover:border-famaash-border hover:bg-famaash-light/40"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-famaash-soft text-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="block text-[12px] text-muted">{subtitle}</span>
      </span>
      <ArrowRightIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}
