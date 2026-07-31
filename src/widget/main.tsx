import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, parseHostThemeFromQuery } from './config/theme';
import './styles/widget.css';

// Self-heal a stale deploy. When a new build rotates asset hashes, a page loaded
// from the previous build references chunks that no longer exist on the server —
// so a lazy import (e.g. the LiveKit socket, loaded when a chat starts) 404s with
// "Failed to fetch dynamically imported module". Vite fires `vite:preloadError`
// for exactly this. Reload once to fetch the fresh entry + current chunks. A
// short timestamp guard prevents a reload loop if the chunk is genuinely gone,
// while still re-arming for a future deploy.
const RELOAD_TS_KEY = 'famaash_chunk_reload_ts';
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_TS_KEY)) || 0;
  } catch {
    /* storage blocked — fall through to a single best-effort reload */
  }
  const now = Date.now();
  // Reloaded very recently → don't loop; let the error surface normally.
  if (now - last < 10_000) return;
  try {
    sessionStorage.setItem(RELOAD_TS_KEY, String(now));
  } catch {
    /* ignore */
  }
  event.preventDefault(); // we're handling it by reloading
  window.location.reload();
});

// Inherit the host site's colors before first paint, so the widget never
// flashes the default purple. An explicit admin override (themeSource:
// 'custom') is applied later in App once the firm config loads.
const hostTheme = parseHostThemeFromQuery();
if (hostTheme) applyTheme(hostTheme);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Widget root element #root not found in embed.html');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
