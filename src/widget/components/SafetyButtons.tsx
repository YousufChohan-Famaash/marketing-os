import { useWidgetStore } from '../store/widgetStore';
import { AlertIcon, PhoneIcon, UsersIcon } from '../utils/icons';

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
      {flags.voice && (
        <button
          type="button"
          onClick={() => setActiveModal('voice')}
          className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-subtle"
        >
          <PhoneIcon size={12} aria-hidden="true" />
          Call me in 60s
        </button>
      )}
      {flags.human_takeover && (
        <button
          type="button"
          onClick={() => setActiveModal('human-takeover')}
          className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-subtle"
        >
          <UsersIcon size={12} aria-hidden="true" />
          Talk to a human
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveModal('emergency')}
        className="ml-auto inline-flex items-center gap-1 rounded-pill border border-danger/30 bg-danger-soft px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger/15"
      >
        <AlertIcon size={12} aria-hidden="true" />
        I need help now
      </button>
    </div>
  );
}
