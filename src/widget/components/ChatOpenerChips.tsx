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
export function ChatOpenerChips({ variant = "grid" }: { variant?: "grid" | "overlay" } = {}) {
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

  if (variant === "overlay") {
    // Compact glassy tiles laid over the lower part of the (edge-to-edge) video.
    // The parent supplies the scrim + max height; scrolls internally if needed.
    return (
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/80">
          What happened?
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {options.map((opt) => {
            const icon = practiceIconFor(opt, 16);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => pick(opt)}
                className="flex flex-col items-center justify-start gap-1 rounded-xl bg-white/15 px-1 py-2 text-center text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25"
              >
                {icon && <span className="flex items-center text-white">{icon}</span>}
                <span className="text-[11px] font-semibold leading-tight">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
        What happened?
      </p>
      {/* Three-up grid of stacked tiles (icon on top, centered label): the icon in
          a soft well, the label with the full tile width to wrap cleanly. Calm and
          scannable rather than a jagged wrap of pills. */}
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const icon = practiceIconFor(opt, 18);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className="group flex flex-col items-center justify-start gap-1.5 rounded-2xl border border-hairline bg-white px-1.5 py-3 text-center transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
            >
              {icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-famaash-soft text-[color:var(--practice-accent)] transition-colors group-hover:bg-white">
                  {icon}
                </span>
              )}
              <span className="text-[11px] font-semibold leading-tight text-ink">
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
