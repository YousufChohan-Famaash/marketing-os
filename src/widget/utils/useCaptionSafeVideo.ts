import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Make a captioned video resilient to a CDN that doesn't reliably send CORS
 * headers on the media file.
 *
 * Captions (a <track>) require the <video> to carry crossOrigin="anonymous",
 * which turns the VIDEO itself into a CORS-gated request. So if the CDN serves a
 * header-less response for the .mp4 (e.g. a CloudFront cache entry populated by a
 * request that had no Origin), the browser blocks the whole load and the video
 * goes blank — even though the same file plays fine without crossOrigin (the
 * small teaser, which sets no crossOrigin, is unaffected).
 *
 * Strategy: start with crossOrigin on so captions work when CORS is healthy; if
 * that load errors, drop crossOrigin + the captions track and reload, so the
 * video always at least plays (captions gracefully degrade). This is a safety net
 * for a misbehaving CDN — the real fix is the CDN returning Access-Control-Allow-
 * Origin consistently, after which the first (captioned) attempt just succeeds.
 */
export function useCaptionSafeVideo(
  videoRef: RefObject<HTMLVideoElement>,
  captionsUrl: string | undefined,
) {
  const [corsBlocked, setCorsBlocked] = useState(false);

  // A new clip (or captions URL) gets a fresh attempt at the captioned load.
  useEffect(() => {
    setCorsBlocked(false);
  }, [captionsUrl]);

  const useCaptions = Boolean(captionsUrl) && !corsBlocked;

  // Only a crossOrigin (captioned) load is CORS-gated; if it failed, fall back to
  // a plain load. Guarded so an unrelated media error can't loop.
  const onError = useCallback(() => {
    setCorsBlocked((prev) => (captionsUrl && !prev ? true : prev));
  }, [captionsUrl]);

  // Reload once when we drop to the no-CORS path so the attribute change and the
  // removed track actually take effect, then resume playback.
  useEffect(() => {
    if (!corsBlocked) return;
    const v = videoRef.current;
    if (!v) return;
    try {
      v.load();
      void v.play().catch(() => undefined);
    } catch {
      /* best-effort */
    }
  }, [corsBlocked, videoRef]);

  return {
    /** Pass to the <video>: 'anonymous' while trying captions, else undefined. */
    crossOrigin: useCaptions ? ('anonymous' as const) : undefined,
    /** Render the <track> + caption overlay only while this is true. */
    useCaptions,
    /** Wire to the <video>'s onError. */
    onError,
  };
}
