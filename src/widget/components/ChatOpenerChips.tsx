import { useEffect, useRef, useState } from "react";
import { useWidgetStore } from "../store/widgetStore";
import { generateId } from "../utils/id";
import { ChevronDownIcon } from "../utils/icons";
import { practiceIconFor } from "./BrandAssets";
import { useT } from "../i18n";

const DEFAULT_PRACTICE_AREAS = [
  "Car / motor vehicle accident",
  "Truck or commercial vehicle",
  "Slip & fall / premises",
  "Something else",
];

/** Max rows of pills shown in the on-video overlay before a "More" reveals the rest. */
const OVERLAY_MAX_ROWS = 3;

/**
 * The case-type options as tappable chips INSIDE the chat (the opener), replacing
 * the old separate selection screen. Shown once, under the greeting, until the
 * lead picks a type — the pick drops a lead bubble and starts the agent flow
 * (same behavior the former opener screen had).
 */
export function ChatOpenerChips({
  variant = "grid",
  onMore,
}: { variant?: "grid" | "overlay"; onMore?: () => void } = {}) {
  const caseTypes = useWidgetStore((s) => s.caseTypes);
  const branding = useWidgetStore((s) => s.branding);
  const setCaseTypePicked = useWidgetStore((s) => s.setCaseTypePicked);
  const setPendingCaseType = useWidgetStore((s) => s.setPendingCaseType);
  const t = useT();

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
    return <OverlayChips options={options} pick={pick} onMore={onMore} />;
  }

  // Same rounded-pill structure as the on-video overlay, but light: white pills
  // with black text + icons. (No row cap here — the chat list scrolls.)
  return (
    <div className="mt-4">
      <p className="mb-2.5 text-[12px] font-bold tracking-[-0.01em] text-ink">
        {t('What happened?')}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const icon = practiceIconFor(opt, 17);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-ink transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
            >
              {icon && (
                <span className="flex shrink-0 items-center text-ink">{icon}</span>
              )}
              {t(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The overlay pills (glassy rounded, over the video — Figma 4883:14688). Capped to
 * OVERLAY_MAX_ROWS; when they overflow, the extra rows are clipped and a "More"
 * button reveals the rest (via onMore). Row count is measured, so the cap lands
 * exactly on a row boundary regardless of how the labels wrap.
 */
function OverlayChips({
  options,
  pick,
  onMore,
}: {
  options: string[];
  pick: (label: string) => void;
  onMore?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const t = useT();
  // maxHeight (px) that shows exactly OVERLAY_MAX_ROWS rows; undefined = all fit.
  const [cap, setCap] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const GAP = 8; // gap-2
    const measure = () => {
      const first = el.children[0] as HTMLElement | undefined;
      if (!first) return;
      const pillH = first.offsetHeight;
      if (!pillH) return;
      // Height that shows exactly OVERLAY_MAX_ROWS rows of pills.
      const capH = OVERLAY_MAX_ROWS * pillH + (OVERLAY_MAX_ROWS - 1) * GAP;
      // scrollHeight is the full content height even when clipped, so this stays
      // accurate after the cap is applied (no dependence on offsetTop grouping).
      setCap(el.scrollHeight > capH + 4 ? capH : undefined);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Re-measure once webfonts land (they change pill widths → how many wrap per
    // row), and a couple of backstops for late layout. Without this the cap can
    // be computed against the fallback font and end up a row off.
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(measure).catch(() => undefined);
    const timers = [window.setTimeout(measure, 200), window.setTimeout(measure, 600)];
    return () => {
      ro.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [options.join("|")]);

  return (
    <div>
      <p className="mb-2.5 text-[12px] font-bold tracking-[-0.01em] text-white">
        {t('What happened?')}
      </p>
      <div
        ref={wrapRef}
        className="flex flex-wrap gap-2 overflow-hidden"
        style={{ maxHeight: cap }}
      >
        {options.map((opt) => {
          const icon = practiceIconFor(opt, 18);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-3 text-[13.5px] font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {icon && (
                <span className="flex shrink-0 items-center text-white">
                  {icon}
                </span>
              )}
              {t(opt)}
            </button>
          );
        })}
      </div>
      {cap !== undefined && onMore && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-3.5 py-2 text-[12px] font-semibold text-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          {t('More')}
          <ChevronDownIcon size={14} />
        </button>
      )}
    </div>
  );
}
