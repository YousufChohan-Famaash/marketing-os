import { useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { PlayIcon } from '../utils/icons';

/**
 * The video + heading + subtext block shown at the top of the conversation
 * scroll area (inline variant). Scrolls away naturally as messages accumulate.
 * Mirrors the Figma "small rounded video" treatment in states 2 & 3.
 */
export function ConversationIntro() {
  const branding = useWidgetStore((s) => s.branding);
  const firmName = branding?.name ?? 'our team';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(false);

  if (!branding?.introVideoUrl) return null;

  const play = () => {
    void videoRef.current?.play();
    setPlayed(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-2 pt-1">
      <div className="relative w-[65%] overflow-hidden rounded-[25px] bg-obsidian shadow-sm">
        <video
          ref={videoRef}
          src={branding.introVideoUrl}
          poster={branding.introVideoPoster}
          controls={played}
          playsInline
          preload="metadata"
          className="block aspect-[7/8] w-full object-cover"
          aria-label="Introduction video"
        />
        {!played && (
          <button
            type="button"
            onClick={play}
            aria-label="Play introduction video"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-famaash shadow-lg backdrop-blur">
              <PlayIcon size={22} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <div className="w-full">
        <h2 className="text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#1A1A1A]">
          Hi <span aria-hidden="true">👋</span> I&apos;m an AI intake assistant for {firmName}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed tracking-[-0.01em] text-[#0D0D12]">
          I&apos;ll help you understand if we can take your case and connect you with
          the right attorney. What kind of matter brings you here today?
        </p>
      </div>
    </div>
  );
}
