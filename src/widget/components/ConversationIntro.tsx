import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveIntroPoster, resolveIntroVideo } from '../config/demoMedia';
import { PlayIcon } from '../utils/icons';

/**
 * The intro video pinned at the top of the conversation scroll. It keeps its
 * full opener size (565:728) and simply scrolls up as messages accumulate —
 * it does NOT shrink into a message bubble. A play button lets the lead scroll
 * back up and replay it in the chat.
 */
export function ConversationIntro() {
  const branding = useWidgetStore((s) => s.branding);
  const firmName = branding?.name ?? 'our team';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [played, setPlayed] = useState(false);

  const videoUrl = resolveIntroVideo(branding?.introVideoUrl);
  const posterUrl = resolveIntroPoster(branding?.introVideoPoster, branding?.introVideoUrl);

  // Muted autoplay + loop (matches the opener); the play button unmutes/replays.
  useEffect(() => {
    if (!videoUrl) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, [videoUrl]);

  if (!videoUrl) return null;

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    void v.play();
    setPlayed(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Full-bleed, full-size video (escapes the list's px-4) — same as the opener. */}
      <div className="relative -mx-4 aspect-[565/728] max-h-[370px] overflow-hidden bg-obsidian">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          controls={played}
          playsInline
          loop
          preload="metadata"
          className="block h-full w-full object-cover"
          aria-label="Introduction video"
        />
        {!played && (
          <button
            type="button"
            onClick={play}
            aria-label="Play introduction video"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-famaash shadow-lg backdrop-blur">
              <PlayIcon size={24} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <div className="w-full">
        <h2 className="text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#1A1A1A]">
          Hi <span aria-hidden="true">👋</span> I&apos;m an AI intake assistant for {firmName}
        </h2>
      </div>
    </div>
  );
}
