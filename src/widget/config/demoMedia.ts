/**
 * Placeholder intro video used in DEV when a firm's boot config has no
 * `branding.introVideoUrl`, so the video-first opener is visible while
 * building. In production (no DEV flag) firms without a real video fall back
 * to the compact header instead — we never ship this sample to real users.
 *
 * Small (~0.8 MB) public Big Buck Bunny clip so it autoplays fast.
 */
export const DEMO_INTRO_VIDEO = 'https://www.w3schools.com/html/mov_bbb.mp4';
export const DEMO_INTRO_POSTER: string | undefined = undefined;

/** Resolve the intro video to use: the firm's, or the demo one in DEV. */
export function resolveIntroVideo(url?: string | null): string | undefined {
  if (url) return url;
  return import.meta.env.DEV ? DEMO_INTRO_VIDEO : undefined;
}

export function resolveIntroPoster(
  poster?: string | null,
  url?: string | null,
): string | undefined {
  if (url) return poster ?? undefined; // real firm video → real (or no) poster
  return import.meta.env.DEV ? DEMO_INTRO_POSTER : undefined;
}
