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
