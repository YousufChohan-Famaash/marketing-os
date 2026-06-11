import { useEffect, useState } from 'react';

/**
 * Reactively track a CSS media query against the widget's own window. Used to
 * pick the date picker that fits: a month grid on big screens, the iOS-style
 * wheel slider (touch-friendly) on small ones.
 */
export function useMediaQuery(query: string): boolean {
  const supported =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function';

  const [matches, setMatches] = useState(() =>
    supported ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!supported) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query, supported]);

  return matches;
}
