import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element has been visible in the viewport at least once, then
 * stays true (we only gate the FIRST load, never unload).
 *
 * Used to defer heavy media (video src) until its slot is actually on screen.
 * The widget iframe is prewarmed `display:none` and only revealed on open, so a
 * video gated on this downloads nothing until the panel is shown — turning the
 * "autoplay every view's video on open" payload into just the poster images
 * (attorney-video-recorder-frontend-guide appendix).
 *
 * Falls back to `true` where IntersectionObserver is unavailable, so the media
 * still loads (current behavior) rather than never showing.
 */
export function useInViewport<T extends Element>(ref: RefObject<T>): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}
