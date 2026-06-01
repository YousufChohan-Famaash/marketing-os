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
      className="flex shrink-0 items-center gap-1.5 border-t border-hairline-soft bg-white px-3 py-2"
    >
      {(flags.voice || flags.human_takeover) && (
        <button
          type="button"
          onClick={() => setActiveModal('human-takeover')}
          className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-subtle"
        >
          <PhoneIcon size={12} aria-hidden="true" />
          Talk to a human
        </button>
      )}
      <button
        type="button"
        className="mx-auto inline-flex items-center gap-1 rounded-pill border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-subtle"
      >
        <MessageSquareIcon size={12} aria-hidden="true" />
        Text me
      </button>
      <button
        type="button"
        onClick={() => setActiveModal('emergency')}
        className="inline-flex items-center gap-1 rounded-pill border border-danger/30 bg-danger-soft px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger/15"
      >
        <AlertIcon size={12} aria-hidden="true" />
        I need help now
      </button>
    </div>
  );
}
