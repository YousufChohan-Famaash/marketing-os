import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCaptionsUrl, resolveViewVideo } from '../config/demoMedia';
import type { VideoView } from '../types/domain';
import { PlayIcon, VolumeOffIcon, VolumeOnIcon } from '../utils/icons';
import { useCaptionSafeVideo } from '../utils/useCaptionSafeVideo';
import { useVideoCaptions } from '../utils/useVideoCaptions';

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
  /** Pause the clip entirely (e.g. while the lightbox plays it) so the two
   * don't run — and talk over each other — at once. */
  paused?: boolean;
  /** Edge-to-edge (v12): the expanded stage starts at the very top and fills the
   * header area too, so the header floats over the video transparently instead of
   * a solid bar pushing the video down. A top gradient keeps the header legible. */
  fullBleed?: boolean;
  /** Show the little mute toggle beside the collapsed thumbnail. Only where the
   * header has room for it (the chat) — a titled header (contact screens) would
   * collide with the title, and there the shared mute + expanded control cover it. */
  showThumbSound?: boolean;
}

/**
 * ONE video element that greets full-width at the top of a screen, then animates
 * into the small header-avatar slot. Because it's a single element that only
 * changes geometry (never remounts), playback is continuous through the collapse
 * — it keeps its timestamp instead of restarting. It plays ONCE (no loop); once
 * it ends a play button offers a replay, and re-expanding the thumbnail replays
 * it. The parent drives `collapsed`, geometry, and (optionally) what tapping the
 * collapsed thumbnail does.
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
  paused = false,
  fullBleed = false,
  showThumbSound = false,
}: ChannelMorphVideoProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const language = useWidgetStore((s) => s.language);
  const soundOn = useWidgetStore((s) => s.videoSoundOn);
  const setVideoSoundOn = useWidgetStore((s) => s.setVideoSoundOn);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = resolveViewVideo(view, settings, branding);
  const captionsUrl = resolveCaptionsUrl(video?.captions, language);
  const { crossOrigin, useCaptions, onError } = useCaptionSafeVideo(videoRef, captionsUrl);
  const caption = useVideoCaptions(videoRef, useCaptions ? captionsUrl : undefined);

  // Own the clip's mute/play state:
  //   paused (lightbox open) → fully paused, so it never talks over the popup
  //   otherwise              → follows the shared sound preference (the thumbnail
  //                            keeps its voice; a button beside it toggles it)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) {
      v.pause();
      return;
    }
    // A finished clip stays finished (it shows a replay affordance) — don't let a
    // sound toggle or the lightbox closing silently restart it. Explicit replay
    // paths (the play button, re-expanding, unmuting) handle restarting.
    if (v.ended) return;
    v.muted = !soundOn;
    v.play().catch(() => {
      if (!v.muted) {
        v.muted = true;
        v.play().catch(() => undefined);
      }
    });
  }, [paused, soundOn]);

  // Play-once state: the clip doesn't loop, so track when it finishes to offer a
  // replay. Re-expanding the collapsed thumbnail replays an ended clip.
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (collapsed) return;
    const v = videoRef.current;
    if (v?.ended) {
      v.currentTime = 0;
      void v.play();
    }
  }, [collapsed]);

  if (!video) return null;

  const style = collapsed
    ? { top: avatarTop, left: avatarLeft, width: avatar, height: avatar, borderRadius: 9999 }
    : fullBleed
      ? { top: 0, left: 0, width: '100%', height: headerH + stageH, borderRadius: 0 }
      : { top: headerH, left: 0, width: '100%', height: stageH, borderRadius: 0 };

  // Toggle the shared sound preference (set muted synchronously so the unmute
  // counts as a user gesture for the browser's autoplay-with-sound policy).
  const toggleSound = () => {
    const next = !soundOn;
    const v = videoRef.current;
    if (v) {
      v.muted = !next;
      if (next && v.paused) void v.play();
    }
    setVideoSoundOn(next);
  };
  // Collapsed: whole circle is the tap target (open lightbox, re-expand, or
  // toggle sound as a last resort).
  const onCollapsedTap = onThumbClick ?? toggleSound;
  // Replay from the start (the clip plays once; this is the "watch again").
  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = !soundOn;
    setEnded(false);
    void v.play();
  };

  return (
    <>
    <div
      className={`absolute overflow-hidden bg-obsidian shadow-sm transition-all duration-500 ease-out ${
        // Expanded: sit UNDER the floating header (z-30) so its controls stay on
        // top. Collapsed: sit ABOVE the (now solid) header so the little avatar
        // shows in its slot instead of being covered by the header background.
        collapsed ? 'z-40' : 'z-20'
      }`}
      style={style}
    >
      <video
        ref={videoRef}
        src={video.url}
        poster={video.poster}
        playsInline
        preload="auto"
        crossOrigin={crossOrigin}
        onError={onError}
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
        className="h-full w-full object-cover"
        aria-label="Attorney video"
      >
        {useCaptions && captionsUrl && (
          <track kind="captions" src={captionsUrl} srcLang={language} label="Captions" default />
        )}
      </video>
      {/* Top scrim so the transparent header (back / title / controls) stays
          legible over the video in edge-to-edge mode. */}
      {!collapsed && fullBleed && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent"
          aria-hidden="true"
        />
      )}
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
      {/* Finished (expanded): a center play button to watch it again. */}
      {!collapsed && ended && (
        <button
          type="button"
          onClick={replay}
          aria-label="Replay video"
          className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/50 backdrop-blur transition-transform hover:scale-105"
        >
          <PlayIcon size={22} className="ml-0.5" />
        </button>
      )}
      {/* Finished (collapsed): a small play glyph hints the thumbnail replays. */}
      {collapsed && ended && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/50 text-white">
            <PlayIcon size={10} className="ml-px" />
          </span>
        </span>
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
    {/* Mute/unmute the thumbnail, sitting just beside it (tapping the thumbnail
        itself opens the lightbox, so sound needs its own control here). */}
    {collapsed && showThumbSound && (
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Unmute video'}
        className="absolute z-30 flex items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
        style={{ top: avatarTop + (avatar - 26) / 2, left: avatarLeft + avatar + 4, width: 26, height: 26 }}
      >
        {soundOn ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
      </button>
    )}
    </>
  );
}
