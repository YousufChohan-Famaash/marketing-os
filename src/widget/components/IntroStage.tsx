import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveIntroPoster, resolveIntroVideo } from '../config/demoMedia';
import { generateId } from '../utils/id';
import { PlayIcon } from '../utils/icons';
import { FamaashMark } from './BrandAssets';
import { PoweredByFooter } from './PoweredByFooter';
import { PracticeOptions } from './PracticeOptions';
import { WidgetControls } from './WidgetControls';

interface IntroStageProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

const DEFAULT_PRACTICE_AREAS = [
  'Car / motor vehicle accident',
  'Truck or commercial vehicle',
  'Slip & fall / premises',
  'Something else',
];

/**
 * The opener — shown until the lead picks a case type (the first user message
 * that starts the agent flow). Renders the hero intro video when the firm has
 * one; otherwise a compact header. Either way: greeting + case-type chips.
 */
export function IntroStage({ onClose, onMinimize, onExpand, isExpanded }: IntroStageProps) {
  const branding = useWidgetStore((s) => s.branding);
  const caseTypes = useWidgetStore((s) => s.caseTypes);
  const setCaseTypePicked = useWidgetStore((s) => s.setCaseTypePicked);
  const setPendingCaseType = useWidgetStore((s) => s.setPendingCaseType);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(false);

  const firmName = branding?.name ?? 'our team';
  const videoUrl = resolveIntroVideo(branding?.introVideoUrl);
  const posterUrl = resolveIntroPoster(branding?.introVideoPoster, branding?.introVideoUrl);
  const hasVideo = Boolean(videoUrl);
  // Case-type chips from boot config; fall back to legacy free-text practice areas.
  const options = caseTypes.length
    ? caseTypes.map((c) => c.label)
    : branding?.practiceAreas ?? DEFAULT_PRACTICE_AREAS;

  // Muted autoplay where allowed; play button unmutes on tap.
  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, [hasVideo]);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    void v.play();
    setPlayed(true);
  };

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play();
  };

  const pick = (label: string) => {
    // Optimistic lead bubble so the selection shows in the transcript.
    useWidgetStore.getState().addMessage({
      id: generateId('msg_lead'),
      role: 'lead',
      type: 'text',
      content: label,
      timestamp: Date.now(),
      status: 'sent',
    });
    const caseType = caseTypes.find((c) => c.label === label);
    const event = caseType
      ? {
          type: 'case_type_selected' as const,
          slug: caseType.slug,
          label: caseType.label,
          case_type_id: caseType.id,
        }
      : // Legacy free-text path when the firm has no structured case types.
        { type: 'practice_area_selected' as const, value: label };
    // Stash the pick; App sends it the moment the socket exists (queued there
    // until the agent's `ready`), so an early tap is never lost.
    setPendingCaseType(event);
    setCaseTypePicked(true);
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {hasVideo ? (
        <div className="relative shrink-0">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            playsInline
            loop
            preload="metadata"
            className="block aspect-[565/728] max-h-[370px] w-full object-cover"
            aria-label="Introduction video"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            {!played ? (
              <button
                type="button"
                onClick={play}
                aria-label="Play introduction video"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-famaash backdrop-blur transition-colors hover:bg-white/90"
              >
                <PlayIcon size={16} aria-hidden="true" />
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}
            <WidgetControls
              tone="overlay"
              onClose={onClose}
              onMinimize={onMinimize}
              onReplay={replay}
              onExpand={onExpand}
              isExpanded={isExpanded}
            />
          </div>
        </div>
      ) : (
        <header className="flex shrink-0 items-center justify-between px-3 py-2.5">
          <FamaashMark size={36} />
          <WidgetControls
            tone="solid"
            onClose={onClose}
            onMinimize={onMinimize}
            onExpand={onExpand}
            isExpanded={isExpanded}
          />
        </header>
      )}

      {/* Scrollable content: heading + options (subtext hidden to give the video room) */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <h1 className="text-[18px] font-bold leading-tight tracking-[-0.03em] text-[#1A1A1A]">
          Hi <span aria-hidden="true">👋</span> I&apos;m an AI intake assistant for {firmName}
        </h1>
        <div className="mt-4">
          <PracticeOptions options={options} onSelect={pick} />
        </div>
      </div>

      <PoweredByFooter />
    </div>
  );
}
