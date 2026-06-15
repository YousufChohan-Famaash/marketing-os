import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, parseHostThemeFromQuery } from './config/theme';
import './styles/widget.css';

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
