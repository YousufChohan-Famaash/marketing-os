import { useWidgetStore } from "../store/widgetStore";
import { MessageSquareIcon, PhoneIcon } from "../utils/icons";

export function SafetyButtons() {
  const flags = useWidgetStore((s) => s.flags);
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);

  if (!flags) return null;

  return (
    <div
      role="toolbar"
      aria-label="Safety and assistance options"
      className="flex shrink-0 items-center gap-2 px-3"
    >
      {(flags.voice || flags.human_takeover) && (
        <button
          type="button"
          onClick={() => setActiveModal("human-takeover")}
          className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-[#EAEEF3] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F8FB]"
        >
          <PhoneIcon size={13} aria-hidden="true" />
          Talk to a human
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveModal("text-handoff")}
        className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-[#EAEEF3] bg-[#F8F8F8] px-3 py-1.5 text-[11.5px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F8FB]"
      >
        <MessageSquareIcon size={13} aria-hidden="true" />
        Text me
      </button>
    </div>
  );
}
