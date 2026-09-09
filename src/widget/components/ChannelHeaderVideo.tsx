import { useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { useT } from '../i18n';
import { resolveAssistantAvatar, resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { VolumeOffIcon } from '../utils/icons';
import { useVideoSound } from '../utils/useVideoSound';
import { Avatar } from './Avatar';

/**
 * The one video on a contact screen: a small round attorney avatar pinned in the
 * header (top). It plays through ONCE (no loop) and then rests on its last frame;
 * once the visitor has already been greeted (the stage clip played + morphed in)
 * it doesn't auto-play again, so the countdown / confirmation screens show a
 * still face rather than replaying the clip. Tapping it toggles sound (shared
 * preference); a small mute badge shows while muted. Falls back to the firm
 * avatar when there's no video (or the screen has no per-view clip, e.g. email).
 */
export function ChannelHeaderVideo({ view, size = 34 }: { view: VideoView | null; size?: number }) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const introVideoPlayed = useWidgetStore((s) => s.introVideoPlayed);
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = view ? resolveViewVideo(view, settings, branding) : undefined;
  // Resume where the collapsing stage left off (same clip URL) instead of from 0.
  // Don't auto-play once the visitor's been greeted — rest on the last frame.
  const { soundOn, toggleSound } = useVideoSound(videoRef, video?.url, !introVideoPlayed);

  if (!video) {
    return (
      <Avatar
        src={resolveAssistantAvatar(branding?.assistantAvatarUrl)}
        name={branding?.assistantName ?? branding?.name ?? 'Assistant'}
        size={size}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={soundOn ? t('Mute video') : t('Unmute video')}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="block h-full w-full overflow-hidden rounded-full bg-obsidian">
        <video
          ref={videoRef}
          src={video.url}
          poster={video.poster}
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
      </span>
      {!soundOn && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white ring-2 ring-white">
          <VolumeOffIcon size={9} />
        </span>
      )}
    </button>
  );
}
