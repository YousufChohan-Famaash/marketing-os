import { useWidgetStore } from '../store/widgetStore';
import { MessageSquareIcon, PhoneIcon } from '../utils/icons';

export function SafetyButtons() {
  const flags = useWidgetStore((s) => s.flags);
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);

  if (!flags) return null;

  return (
    <div
      role="toolbar"
      aria-label="Safety and assistance options"
      className="flex shrink-0 items-center justify-center gap-1.5 px-3 pt-2"
    >
      {(flags.voice || flags.human_takeover) && (
        <button
          type="button"
          onClick={() => setActiveModal('human-takeover')}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <PhoneIcon size={14} aria-hidden="true" />
          Talk to a human
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveModal('text-handoff')}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
      >
        <MessageSquareIcon size={14} aria-hidden="true" />
        Text me
      </button>
    </div>
  );
}
