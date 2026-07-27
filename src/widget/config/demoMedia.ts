import type { ConnectSettings, FirmBranding, VideoView } from '../types/domain';

/**
 * Media resolvers — map the firm's boot-config branding to the URLs the widget
 * renders. No placeholders, no demo/sample assets: when a firm hasn't configured
 * a video or avatar, the widget shows its real fallback (compact opener /
 * initials), never stand-in media. These stay as thin functions so there's one
 * place that maps branding → media.
 */

/** The firm's intro video URL, or undefined when none is configured. */
export function resolveIntroVideo(url?: string | null): string | undefined {
  return url || undefined;
}

/** The firm's intro poster — only meaningful when there's a real video. */
export function resolveIntroPoster(
  poster?: string | null,
  url?: string | null,
): string | undefined {
  return url ? (poster ?? undefined) : undefined;
}

/** The firm's assistant photo, or undefined → Avatar falls back to initials. */
export function resolveAssistantAvatar(url?: string | null): string | undefined {
  return url || undefined;
}

/**
 * The video the cinematic full-screen open should play: the story video (or the
 * intro as a fallback) in story mode, otherwise the intro. Undefined when there
 * is no real video — callers must then skip the cinematic entirely.
 */
export function resolveCinematicVideo(
  videoMode: string,
  introVideoUrl?: string | null,
  storyVideoUrl?: string | null,
): string | undefined {
  if (videoMode === 'none') return undefined;
  if (videoMode === 'story') return storyVideoUrl || resolveIntroVideo(introVideoUrl);
  return resolveIntroVideo(introVideoUrl);
}

/** A video resolved for a specific surface (view), ready to render. */
export interface ResolvedViewVideo {
  url: string;
  poster?: string;
  caption?: string;
  /** WebVTT tracks keyed by language code. */
  captions?: Record<string, string>;
}

/**
 * Pick the caption (WebVTT) URL for the active language: exact match, then the
 * English track, then whatever single track exists. Undefined → no captions.
 */
export function resolveCaptionsUrl(
  captions: Record<string, string> | undefined,
  language: string,
): string | undefined {
  if (!captions) return undefined;
  return captions[language] ?? captions.en ?? Object.values(captions)[0];
}

/**
 * The video to play on a given surface. A purpose-built clip authored for that
 * view (settings.channelVideos[view]) wins; otherwise we fall back to the firm's
 * intro/cinematic clip so the surface is never blank until per-view videos are
 * authored in the dashboard. Returns undefined only when the firm has no video
 * at all (or videoMode === 'none').
 */
export function resolveViewVideo(
  view: VideoView,
  settings: Pick<ConnectSettings, 'channelVideos' | 'videoMode' | 'storyVideoUrl'>,
  branding?: Pick<FirmBranding, 'introVideoUrl' | 'introVideoPoster' | 'introVideoCaptions'> | null,
): ResolvedViewVideo | undefined {
  const custom = settings.channelVideos?.[view];
  if (custom?.url) {
    return { url: custom.url, poster: custom.poster, caption: custom.caption, captions: custom.captions };
  }
  const url = resolveCinematicVideo(settings.videoMode, branding?.introVideoUrl, settings.storyVideoUrl);
  if (!url) return undefined;
  // Falling back to the intro clip → carry the intro's caption tracks too.
  return {
    url,
    poster: resolveIntroPoster(branding?.introVideoPoster, branding?.introVideoUrl),
    captions: branding?.introVideoCaptions,
  };
}
