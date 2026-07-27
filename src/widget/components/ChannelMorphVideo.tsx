import { useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCaptionsUrl, resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { useVideoCaptions } from '../utils/useVideoCaptions';
import { useVideoSound } from '../utils/useVideoSound';

// Default collapsed-slot geometry, matched to the ChannelView header:
// px-2 (8) + back button (32) + gap-2 (8) = 48px left; header ~50px tall.
const DEFAULTS = { headerH: 50, avatar: 34, avatarLeft: 48, avatarTop: 8, stageH: 300 };

interface ChannelMorphVideoProps {
  view: VideoView;
  collapsed: boolean;
  /** Geometry overrides so a different header (e.g. the chat) can line up. */
  headerH?: number;
  avatarLeft?: number;
  avatarTop?: number;
  avatar?: number;
  stageH?: number;
  /** When set, tapping the COLLAPSED thumbnail calls this (e.g. open a lightbox)
   * instead of toggling sound. The expanded stage still shows the unmute button. */
  onThumbClick?: () => void;
}

/**
 * ONE video element that greets full-width at the top of a screen, then animates
 * into the small header-avatar slot. Because it's a single element that only
 * changes geometry (never remounts), playback is continuous through the collapse
 * — it keeps its timestamp instead of restarting. Muted + looping; the unmute
 * control shows in the expanded stage. The parent drives `collapsed`, geometry,
 * and (optionally) what tapping the collapsed thumbnail does.
 */
export function ChannelMorphVideo({
  view,
  collapsed,
  headerH = DEFAULTS.headerH,
  avatarLeft = DEFAULTS.avatarLeft,
  avatarTop = DEFAULTS.avatarTop,
  avatar = DEFAULTS.avatar,
  stageH = DEFAULTS.stageH,
  onThumbClick,
}: ChannelMorphVideoProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const language = useWidgetStore((s) => s.language);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = resolveViewVideo(view, settings, branding);
  const captionsUrl = resolveCaptionsUrl(video?.captions, language);
  const { soundOn, toggleSound } = useVideoSound(videoRef);
  const caption = useVideoCaptions(videoRef, captionsUrl);
  if (!video) return null;

  const style = collapsed
    ? { top: avatarTop, left: avatarLeft, width: avatar, height: avatar, borderRadius: 9999 }
    : { top: headerH, left: 0, width: '100%', height: stageH, borderRadius: 0 };

  // Collapsed: whole circle is the tap target (open lightbox, or toggle sound).
  const onCollapsedTap = onThumbClick ?? toggleSound;

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
        crossOrigin={captionsUrl ? 'anonymous' : undefined}
        className="h-full w-full object-cover"
        aria-label="Attorney video"
      >
        {captionsUrl && (
          <track kind="captions" src={captionsUrl} srcLang={language} label="Captions" default />
        )}
      </video>
      {!collapsed && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white"
          aria-hidden="true"
        />
      )}
      {/* Captions over the expanded stage (hidden once collapsed to a thumbnail). */}
      {!collapsed && caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <span className="rounded-md bg-black/60 px-2 py-1 text-center text-[12.5px] font-medium leading-relaxed text-white">
            {caption}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={collapsed ? onCollapsedTap : toggleSound}
        aria-label={collapsed ? (onThumbClick ? 'Watch the welcome' : 'Unmute video') : soundOn ? 'Mute video' : 'Unmute video'}
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
