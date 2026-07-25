import { useEffect, useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar, resolveIntroPoster, resolveIntroVideo } from '../config/demoMedia';
import { postVideoEvent } from '../services/api';
import { PlayIcon, VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { Avatar } from './Avatar';

interface ConnectVideoProps {
  /** Sizing/aspect/radius classes for the tile. */
  className?: string;
  /** Smaller play/sound controls for the Small-mode tile. */
  compact?: boolean;
}

/**
 * The attorney video on the Connect launcher. Shows one clip at a time per the
 * admin `videoMode`:
 *   intro  → the firm's intro video (or the dev sample)
 *   story  → the firm's "story" video, falling back to the intro
 *   none   → a branded avatar tile (no video)
 * Autoplays muted when `settings.autoplay`, otherwise shows paused with a play
 * button; tapping unmutes. Live presence badge sits top-left. Contact options
 * are never drawn on the video — the parent renders them below it.
 */
export function ConnectVideo({ className, compact }: ConnectVideoProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const firmId = useWidgetStore((s) => s.firmId);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Shared sound preference: this thumbnail starts muted/unmuted like every other
  // video and its toggle updates the same memory.
  const soundOn = useWidgetStore((s) => s.videoSoundOn);
  const setVideoSoundOn = useWidgetStore((s) => s.setVideoSoundOn);
  // Analytics: fire `play` once on first play, `complete` once near the end
  // (timeupdate-based so a looping teaser still reports completion).
  const playedRef = useRef(false);
  const completedRef = useRef(false);

  const mode = settings.videoMode;
  const analyticsKind = mode === 'story' ? 'story' : 'intro';
  const introUrl = resolveIntroVideo(branding?.introVideoUrl);
  const src =
    mode === 'none'
      ? undefined
      : mode === 'story'
        ? settings.storyVideoUrl ?? introUrl
        : introUrl;
  const poster =
    mode === 'story'
      ? settings.storyVideoPoster
      : resolveIntroPoster(branding?.introVideoPoster, branding?.introVideoUrl);

  // This is a recorded greeting, not a live stream, so we caption it instead of
  // tagging it "LIVE". Firm-authored caption wins, else "A welcome from <first name>".
  const firstName = (branding?.assistantName ?? '').trim().split(/\s+/)[0];
  const welcome =
    branding?.introVideoCaption?.trim() || (firstName ? `A welcome from ${firstName}` : 'A welcome');

  useEffect(() => {
    if (!src) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    if (settings.autoplay) {
      v.play().catch(() => {
        if (!v.muted) {
          v.muted = true;
          v.play().catch(() => undefined);
        }
      });
    }
  }, [src, settings.autoplay, soundOn]);

  // None → branded avatar tile.
  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-famaash-light',
          className,
        )}
        aria-hidden="true"
      >
        <Avatar
          src={resolveAssistantAvatar(branding?.assistantAvatarUrl)}
          name={branding?.assistantName ?? branding?.name ?? 'Assistant'}
          size={compact ? 44 : 72}
        />
      </div>
    );
  }

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !soundOn;
    v.muted = !next;
    if (next && v.paused) void v.play();
    setVideoSoundOn(next);
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop
        preload="metadata"
        className="h-full w-full object-cover"
        aria-label="Attorney introduction video"
        onPlay={() => {
          if (playedRef.current || !firmId) return;
          playedRef.current = true;
          postVideoEvent(firmId, analyticsKind, 'play');
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (completedRef.current || !firmId || !v.duration) return;
          if (v.currentTime / v.duration >= 0.98) {
            completedRef.current = true;
            postVideoEvent(firmId, analyticsKind, 'complete');
          }
        }}
      />
      {/* Recorded greeting caption (no "LIVE" tag). Hidden on the tiny thumbnail,
          where the play control alone conveys a playable recording. */}
      {!compact && (
        <span className="absolute left-2.5 top-2.5 inline-flex max-w-[calc(100%-20px)] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
          <PlayIcon size={10} aria-hidden="true" />
          <span className="truncate">{welcome}</span>
        </span>
      )}
      {/* Sound toggle: tap to play with sound, tap again to mute. */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Unmute video'}
        className={cn(
          'absolute z-10 flex items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform hover:scale-105',
          compact
            ? 'bottom-1.5 right-1.5 h-7 w-7'
            : 'left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2',
        )}
      >
        {soundOn ? <VolumeOnIcon size={compact ? 13 : 18} /> : <VolumeOffIcon size={compact ? 13 : 18} />}
      </button>
    </div>
  );
}
