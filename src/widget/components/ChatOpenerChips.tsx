import { useWidgetStore } from "../store/widgetStore";
import { generateId } from "../utils/id";
import { practiceIconFor } from "./BrandAssets";

const DEFAULT_PRACTICE_AREAS = [
  "Car / motor vehicle accident",
  "Truck or commercial vehicle",
  "Slip & fall / premises",
  "Something else",
];

/**
 * The case-type options as tappable chips INSIDE the chat (the opener), replacing
 * the old separate selection screen. Shown once, under the greeting, until the
 * lead picks a type — the pick drops a lead bubble and starts the agent flow
 * (same behavior the former opener screen had).
 */
export function ChatOpenerChips() {
  const caseTypes = useWidgetStore((s) => s.caseTypes);
  const branding = useWidgetStore((s) => s.branding);
  const setCaseTypePicked = useWidgetStore((s) => s.setCaseTypePicked);
  const setPendingCaseType = useWidgetStore((s) => s.setPendingCaseType);

  const options = caseTypes.length
    ? caseTypes.map((c) => c.label)
    : (branding?.practiceAreas ?? DEFAULT_PRACTICE_AREAS);

  const pick = (label: string) => {
    // Optimistic lead bubble so the selection shows in the transcript.
    useWidgetStore.getState().addMessage({
      id: generateId("msg_lead"),
      role: "lead",
      type: "text",
      content: label,
      timestamp: Date.now(),
      status: "sent",
    });
    const caseType = caseTypes.find((c) => c.label === label);
    const event = caseType
      ? {
          type: "case_type_selected" as const,
          slug: caseType.slug,
          label: caseType.label,
          case_type_id: caseType.id,
        }
      : { type: "practice_area_selected" as const, value: label };
    // App flushes this the moment the socket exists (queued until the agent's
    // `ready`), so an early tap is never lost.
    setPendingCaseType(event);
    setCaseTypePicked(true);
    useWidgetStore.getState().setConversationStarted(true);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((opt) => {
        const icon = practiceIconFor(opt, 16);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => pick(opt)}
            className="inline-flex items-center gap-2 rounded-pill border border-famaash-stroke bg-white px-4 py-2.5 text-[14px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F8FB]"
          >
            {icon && (
              <span className="flex shrink-0 items-center text-[color:var(--practice-accent)]">
                {icon}
              </span>
            )}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
