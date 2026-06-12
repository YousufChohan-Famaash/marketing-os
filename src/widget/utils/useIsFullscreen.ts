import { useEffect, useState } from 'react';

/**
 * True when the widget iframe essentially fills the whole device screen — i.e.
 * the mobile full-screen layout the loader applies at <=640px. We compare the
 * iframe's inner width to the device `screen.width` (not a CSS breakpoint),
 * because a collapsed desktop panel is also narrow yet nowhere near full-screen.
 */
export function useIsFullscreen(): boolean {
  const compute = () => {
    if (typeof window === 'undefined' || !window.screen) return false;
    return window.innerWidth >= window.screen.width - 4;
  };

  const [full, setFull] = useState(compute);

  useEffect(() => {
    const onResize = () => setFull(compute());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return full;
}
