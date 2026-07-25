import { useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { postVideoEvent } from '../services/api';
import { PlayIcon, VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { useVideoSound } from '../utils/useVideoSound';

interface ViewHeroVideoProps {
  /** Which surface this hero belongs to — picks the per-view clip. */
  view: VideoView;
  /** Override the video's height cap (default 300px). */
  className?: string;
}

/**
 * The intro clip shown at the top of a channel surface (Call / Text / Book / the
 * chat opener). It plays the clip authored for that view, falling back to the
 * firm's intro/cinematic video until per-view clips are uploaded.
 *
 * It is NOT pinned — it sits at the top of the surface's scroll area and scrolls
 * away as the visitor engages with the form, so it never eats the space below.
 * Autoplays muted; a corner button unmutes (shared across every video via
 * useVideoSound). The surface keeps its own header for back / window controls.
 * Renders nothing when the firm has no video at all.
 */
export function ViewHeroVideo({ view, className }: ViewHeroVideoProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const firmId = useWidgetStore((s) => s.firmId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedRef = useRef(false);
  const { soundOn, toggleSound } = useVideoSound(videoRef);

  const video = resolveViewVideo(view, settings, branding);
  if (!video) return null;

  return (
    // Narrower than the panel and centered: the clips are portrait, so a tighter
    // column crops less of the frame and shows more of the person.
    <div className="relative mx-auto w-full max-w-[340px] overflow-hidden bg-obsidian">
      <video
        ref={videoRef}
        src={video.url}
        poster={video.poster}
        playsInline
        loop
        preload="metadata"
        className={cn('block aspect-[565/728] max-h-[400px] w-full object-cover', className)}
        aria-label="Introduction video"
        onPlay={() => {
          if (playedRef.current || !firmId) return;
          playedRef.current = true;
          postVideoEvent(firmId, 'intro', 'play');
        }}
      />
      {/* Light fade of the video's bottom into the white surface below. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-white"
        aria-hidden="true"
      />
      {/* Optional firm-authored caption chip. */}
      {video.caption && (
        <span className="absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-70px)] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
          <PlayIcon size={10} aria-hidden="true" />
          <span className="truncate">{video.caption}</span>
        </span>
      )}
      {/* Mute / unmute toggle (shared preference), bottom-right over the video. */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Unmute video'}
        className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60"
      >
        {soundOn ? <VolumeOnIcon size={18} /> : <VolumeOffIcon size={18} />}
      </button>
    </div>
  );
}
