import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { PlayIcon } from '../utils/icons';
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
 * Intro picker (Figma state 1): full-bleed hero video with floating controls,
 * heading + subtext, and the vertical practice-area option rows below.
 */
export function IntroStage({ onClose, onMinimize, onExpand, isExpanded }: IntroStageProps) {
  const branding = useWidgetStore((s) => s.branding);
  const socket = useSocket();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(false);

  const firmName = branding?.name ?? 'our team';
  const areas = branding?.practiceAreas ?? DEFAULT_PRACTICE_AREAS;

  // Muted autoplay where allowed; play button unmutes on tap.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, []);

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

  const pick = (area: string) => {
    if (!socket) return;
    // Optimistic lead bubble so the selection shows in the transcript.
    useWidgetStore.getState().addMessage({
      id: generateId('msg_lead'),
      role: 'lead',
      type: 'text',
      content: area,
      timestamp: Date.now(),
      status: 'sent',
    });
    socket.send({ type: 'practice_area_selected', value: area });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Hero video */}
      <div className="relative shrink-0">
        <video
          ref={videoRef}
          src={branding?.introVideoUrl}
          poster={branding?.introVideoPoster}
          playsInline
          loop
          preload="metadata"
          className="block max-h-[46%] w-full object-cover"
          style={{ height: '44vh', maxHeight: 320 }}
          aria-label="Introduction video"
        />
        {/* white fade into content */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
          aria-hidden="true"
        />
        {/* top controls */}
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

      {/* Scrollable content: heading, subtext, options */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <h1 className="text-[18px] font-bold leading-tight tracking-[-0.03em] text-[#1A1A1A]">
          Hi <span aria-hidden="true">👋</span> I&apos;m an AI intake assistant for {firmName}
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed tracking-[-0.01em] text-[#0D0D12]">
          I&apos;ll help you understand if we can take your case and connect you with
          the right attorney. What kind of matter brings you here today?
        </p>
        <div className="mt-5">
          <PracticeOptions options={areas} onSelect={pick} />
        </div>
      </div>

      <PoweredByFooter />
    </div>
  );
}
