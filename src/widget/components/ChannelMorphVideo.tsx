import { useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { useVideoSound } from '../utils/useVideoSound';

// Geometry of the collapsed avatar slot, matched to the ChannelView header:
// px-2 (8) + back button (32) + gap-2 (8) = 48px left; header ~50px tall.
const HEADER_H = 50;
const AVATAR = 34;
const AVATAR_LEFT = 48;
const AVATAR_TOP = 8;
const STAGE_H = 300;

/**
 * ONE video element that greets full-width at the top of a contact screen, then
 * animates into the small header-avatar slot. Because it's a single element that
 * only changes geometry (never remounts), playback is continuous through the
 * collapse — it keeps its timestamp instead of restarting. Muted + looping; the
 * unmute control shows in the expanded stage, and the whole circle toggles sound
 * once collapsed. ChannelView drives `collapsed`.
 */
export function ChannelMorphVideo({ view, collapsed }: { view: VideoView; collapsed: boolean }) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { soundOn, toggleSound } = useVideoSound(videoRef);
  const video = resolveViewVideo(view, settings, branding);
  if (!video) return null;

  const style = collapsed
    ? { top: AVATAR_TOP, left: AVATAR_LEFT, width: AVATAR, height: AVATAR, borderRadius: 9999 }
    : { top: HEADER_H, left: 0, width: '100%', height: STAGE_H, borderRadius: 0 };

  return (
    <div
      className="absolute z-20 overflow-hidden bg-obsidian shadow-sm transition-all duration-500 ease-out"
      style={style}
    >
      <video
        ref={videoRef}
        src={video.url}
        poster={video.poster}
        playsInline
        loop
        preload="auto"
        className="h-full w-full object-cover"
        aria-label="Attorney video"
      />
      {!collapsed && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white"
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Unmute video'}
        className={
          collapsed
            ? 'absolute inset-0'
            : 'absolute bottom-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60'
        }
      >
        {!collapsed && (soundOn ? <VolumeOnIcon size={16} /> : <VolumeOffIcon size={16} />)}
      </button>
    </div>
  );
}
