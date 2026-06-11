import { useWidgetStore } from '../store/widgetStore';
import { AlertIcon, MessageSquareIcon, PhoneIcon } from '../utils/icons';

export function SafetyButtons() {
  const flags = useWidgetStore((s) => s.flags);
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);

  if (!flags) return null;

  return (
    <div
      role="toolbar"
      aria-label="Safety and assistance options"
      className="flex shrink-0 items-center gap-2 border-t border-hairline-soft bg-white px-3 py-2"
    >
      {(flags.voice || flags.human_takeover) && (
        <button
          type="button"
          onClick={() => setActiveModal('human-takeover')}
          className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-[#EAEEF3] bg-[#F8F8F8] px-2.5 py-1.5 text-[11px] font-medium text-[#1A1A1A] hover:bg-[#F5F8FB]"
        >
          <PhoneIcon size={12} aria-hidden="true" />
          Talk to a human
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveModal('text-handoff')}
        className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-[#EAEEF3] bg-[#F8F8F8] px-2.5 py-1.5 text-[11px] font-medium text-[#1A1A1A] hover:bg-[#F5F8FB]"
      >
        <MessageSquareIcon size={12} aria-hidden="true" />
        Text me
      </button>
      <button
        type="button"
        onClick={() => setActiveModal('emergency')}
        className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-[#F9E2E2] bg-[#FFEFEF] px-2.5 py-1.5 text-[11px] font-medium text-[#1A1A1A] hover:bg-[#FCE4E4]"
      >
        <AlertIcon size={12} className="text-[#F86669]" aria-hidden="true" />
        I need help now
      </button>
    </div>
  );
}
