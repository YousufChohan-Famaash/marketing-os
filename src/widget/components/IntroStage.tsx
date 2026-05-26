import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { cn } from '../utils/cn';
import {
  CloseIcon,
  LanguagesIcon,
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from '../utils/icons';
import { PoweredByFooter } from './PoweredByFooter';

interface IntroStageProps {
  onClose: () => void;
}

const DEFAULT_PRACTICE_AREAS = [
  'Car Accident',
  'Slip & Fall',
  'Workers’ Compensation',
  'Medical Malpractice',
];

/**
 * Full-widget-area intro: video playing as background, language + playback
 * controls floating over it, practice-area chips overlaid near the bottom.
 *
 * Picking a chip captures `practice_area` field and the widget transitions
 * to the chat view (driven by WidgetShell observing `capturedFields.practice_area`).
 *
 * Deferred (per spec): Español language switching (i18n shim), expand-to-fullscreen.
 * Buttons are wired but render as visual stubs that don't change behavior yet.
 */
export function IntroStage({ onClose }: IntroStageProps) {
  const branding = useWidgetStore((s) => s.branding);
  const socket = useSocket();
  const videoRef = useRef<HTMLVideoElement>(null);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const areas = branding?.practiceAreas ?? DEFAULT_PRACTICE_AREAS;
  const caption =
    branding?.introVideoCaption ??
    `Welcome to ${branding?.name ?? 'our team'}. What kind of matter can we help with?`;

  // Try to autoplay (muted = browser-allowed). If it fails, stay paused.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play();
    setIsPlaying(true);
  };

  const pick = (area: string) => {
    if (!socket) return;
    socket.send({ type: 'practice_area_selected', value: area });
  };

  const handleChipKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const len = areas.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      chipRefs.current[(idx + 1) % len]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      chipRefs.current[(idx - 1 + len) % len]?.focus();
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-obsidian"
      role="region"
      aria-label="Welcome — choose matter type"
    >
      {/* Video background */}
      <video
        ref={videoRef}
        src={branding?.introVideoUrl}
        poster={branding?.introVideoPoster}
        muted={isMuted}
        playsInline
        loop
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Introduction video"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" aria-hidden="true" />

      {/* Top control bar */}
      <div className="relative z-10 flex items-center justify-between gap-1 p-2">
        <div className="flex items-center gap-1">
          <IconButton onClick={togglePlay} label={isPlaying ? 'Pause video' : 'Play video'}>
            {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          </IconButton>
          <IconButton onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <VolumeOffIcon size={14} /> : <VolumeOnIcon size={14} />}
          </IconButton>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            title="Language selection — coming soon"
            className="flex items-center gap-1 rounded-md bg-white/85 px-2.5 py-1 text-[12px] font-medium text-ink-soft opacity-90 backdrop-blur disabled:cursor-not-allowed"
          >
            Español
            <LanguagesIcon size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton onClick={replay} label="Replay video">
            <ReplayIcon size={14} />
          </IconButton>
          <IconButton
            onClick={() => undefined}
            label="Expand — coming soon"
            disabled
          >
            <MaximizeIcon size={14} />
          </IconButton>
          <IconButton onClick={onClose} label="Close chat">
            <CloseIcon size={14} />
          </IconButton>
        </div>
      </div>

      {/* Spacer to push caption + chips toward bottom half */}
      <div className="relative flex-1" />

      {/* Caption + chips */}
      <div className="relative z-10 flex flex-col gap-3 px-4 pb-2">
        <p className="text-[15px] font-semibold leading-snug text-white drop-shadow-md">
          {caption}
        </p>
        <div role="group" aria-label="Matter type options" className="grid grid-cols-2 gap-2">
          {areas.map((area, i) => (
            <button
              key={area}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              type="button"
              onClick={() => pick(area)}
              onKeyDown={(e) => handleChipKey(e, i)}
              className={cn(
                'flex items-center gap-2 rounded-pill bg-white/95 px-3 py-2 text-left text-[13px] font-medium text-ink shadow-sm backdrop-blur',
                'transition-colors hover:bg-white',
              )}
            >
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-famaash"
              />
              <span className="truncate">{area}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <PoweredByFooter />
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md bg-white/85 text-ink-soft backdrop-blur transition-colors',
        'hover:bg-white disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
