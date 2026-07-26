import { useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar, resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { postVideoEvent } from '../services/api';
import { VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { useVideoSound } from '../utils/useVideoSound';
import { Avatar } from './Avatar';

interface ViewVideoThumbProps {
  /** Which surface this thumbnail belongs to — picks the per-view clip. */
  view: VideoView;
  /** Sizing classes for the tile (portrait by default). */
  className?: string;
}

/**
 * A compact portrait video thumbnail shown beside a form's heading on the
 * data-collection screens (Call / Text / Book / chat opener). The attorney keeps
 * "speaking" (autoplays muted + looping) without a full hero eating the space,
 * so the form fields stay front and center. Falls back to a branded avatar tile
 * when the firm has no video. A small corner button unmutes (shared preference).
 */
export function ViewVideoThumb({ view, className }: ViewVideoThumbProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const firmId = useWidgetStore((s) => s.firmId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedRef = useRef(false);
  const { soundOn, toggleSound } = useVideoSound(videoRef);

  const video = resolveViewVideo(view, settings, branding);

  // No firm video → a branded avatar tile so the heading still has a face.
  if (!video) {
    return (
      <div
        className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-famaash-light', className)}
        aria-hidden="true"
      >
        <Avatar
          src={resolveAssistantAvatar(branding?.assistantAvatarUrl)}
          name={branding?.assistantName ?? branding?.name ?? 'Assistant'}
          size={44}
        />
      </div>
    );
  }

  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-2xl bg-obsidian', className)}>
      <video
        ref={videoRef}
        src={video.url}
        poster={video.poster}
        playsInline
        loop
        preload="metadata"
        className="h-full w-full object-cover"
        aria-label="Attorney video"
        onPlay={() => {
          if (playedRef.current || !firmId) return;
          playedRef.current = true;
          postVideoEvent(firmId, 'intro', 'play');
        }}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Unmute video'}
        className="absolute bottom-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform hover:scale-105"
      >
        {soundOn ? <VolumeOnIcon size={13} /> : <VolumeOffIcon size={13} />}
      </button>
    </div>
  );
}
