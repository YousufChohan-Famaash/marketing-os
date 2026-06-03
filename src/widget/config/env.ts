/**
 * Runtime configuration for the widget transport.
 *
 * The widget talks to the live backend: REST boot/token + a LiveKit room data
 * channel. The only knob is the REST base URL, resolved from (first match):
 *   1. URL query  ?api_base=<url>
 *   2. Build-time env  VITE_WIDGET_API_BASE
 *   3. default (prod API host)
 */

const DEFAULT_API_BASE = 'https://api.catafleet.com/api/v1/widget';

function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** REST base URL for the backend, normalized without a trailing slash. */
export function getApiBase(): string {
  const fromQuery = queryParam('api_base');
  const base = fromQuery ?? import.meta.env.VITE_WIDGET_API_BASE ?? DEFAULT_API_BASE;
  return base.replace(/\/+$/, '');
}
