import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCaptionsUrl, resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { useCaptionSafeVideo } from '../utils/useCaptionSafeVideo';
import { useVideoCaptions } from '../utils/useVideoCaptions';
import { ChatIcon, CloseIcon, PauseIcon, PhoneIcon, PlayIcon } from '../utils/icons';

interface VideoLightboxProps {
  /** Which per-view clip to play (defaults to the in-chat clip). */
  view?: VideoView;
  onClose: () => void;
  /** Primary action (route to Call). */
  onCall: () => void;
  /** Secondary action (dismiss and keep chatting). */
  onChat: () => void;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/**
 * A pop-up player for the attorney's recorded welcome, opened by tapping the
 * collapsed video thumbnail. Plays with sound, shows a scrubber + time, and
 * offers the two primary next steps (Call / Chat) beneath it.
 */
export function VideoLightbox({ view = 'chat', onClose, onCall, onChat }: VideoLightboxProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const language = useWidgetStore((s) => s.language);
  const video = resolveViewVideo(view, settings, branding);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const captionsUrl = resolveCaptionsUrl(video?.captions, language);
  const { crossOrigin, useCaptions, onError } = useCaptionSafeVideo(videoRef, captionsUrl);
  const caption = useVideoCaptions(videoRef, useCaptions ? captionsUrl : undefined);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video) return;
    v.muted = false;
    v.currentTime = 0;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [video?.url]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!video) return null;

  const firstName = (branding?.assistantName ?? branding?.name ?? '').trim().split(/\s+/)[0];
  const title = branding?.introVideoCaption?.trim() || (firstName ? `A welcome from ${firstName}` : 'A welcome');

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative aspect-video cursor-pointer bg-obsidian" onClick={toggle}>
          <video
            ref={videoRef}
            src={video.url}
            poster={video.poster}
            playsInline
            crossOrigin={crossOrigin}
            onError={onError}
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              setCur(v.currentTime);
              if (v.duration) setDur(v.duration);
            }}
            onEnded={() => setPlaying(false)}
          >
            {useCaptions && captionsUrl && (
              <track kind="captions" src={captionsUrl} srcLang={language} label="Captions" default />
            )}
          </video>
          {/* Burned-in captions, centered above the scrubber. */}
          {caption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-11 flex justify-center px-4">
              <span className="rounded-md bg-black/60 px-2 py-1 text-center text-[13px] font-medium leading-relaxed text-white">
                {caption}
              </span>
            </div>
          )}
          {/* Recorded tag (this is a recording, not a live stream). */}
          <span className="absolute left-2.5 top-2.5 rounded-pill bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            Recorded
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <CloseIcon size={15} />
          </button>
          {/* Play / pause. */}
          <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/40 backdrop-blur">
            {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} className="ml-0.5" />}
          </span>
          {/* Scrubber + time. */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-7">
            <div className="h-1 flex-1 overflow-hidden rounded bg-white/30">
              <div className="h-full bg-famaash" style={{ width: `${dur ? (cur / dur) * 100 : 0}%` }} />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-white">
              {fmt(cur)} / {fmt(dur)}
            </span>
          </div>
        </div>

        <div className="p-4">
          <p className="text-[15.5px] font-bold text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] text-muted">A quick hello from the attorney. Recorded.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onCall}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:opacity-95"
            >
              <PhoneIcon size={15} aria-hidden="true" />
              Call me now
            </button>
            <button
              type="button"
              onClick={onChat}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
            >
              <ChatIcon size={15} aria-hidden="true" />
              Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
