/**
 * Famaash Chat Widget loader.
 *
 * Host-side script. Injects a launcher button and the widget iframe, sets up
 * Penpal RPC, and exposes a tiny `window.Famaash` API for programmatic control.
 *
 * Security:
 *   - The iframe is created with sandbox="allow-scripts allow-forms allow-popups allow-same-origin".
 *   - Penpal connects with an explicit childOrigin (the widget's origin).
 *   - The iframe origin is read from the script tag's src attribute.
 */

import { connectToChild, type Connection, type Methods } from 'penpal';

interface IframeMethods {
  open(): Promise<void>;
  close(): Promise<void>;
  minimize(): Promise<void>;
  setContext(metadata: Record<string, unknown>): Promise<void>;
  identify(user: { id: string; email: string; name?: string }): Promise<void>;
}

interface HostMethods {
  requestClose(): void;
  requestMinimize(): void;
  getHostContext(): { url: string; referrer: string; utm: Record<string, string> };
  notifyEvent(event: { type: string; data: unknown }): void;
}

const LAUNCHER_ID = 'famaash-launcher';
const IFRAME_ID = 'famaash-iframe';
const Z_INDEX = '2147483647';
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-same-origin';

const styles = `
#${LAUNCHER_ID} {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #534FEB;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${Z_INDEX};
  transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
#${LAUNCHER_ID}:hover { transform: scale(1.05); }
#${LAUNCHER_ID}:focus-visible { outline: 3px solid rgba(83, 79, 235, 0.4); outline-offset: 2px; }
#${LAUNCHER_ID} svg { color: white; }
#${LAUNCHER_ID} .famaash-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #EF4444;
  color: white;
  font: 600 10px / 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-align: center;
}
#${IFRAME_ID} {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 110px);
  border: none;
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  background: white;
  z-index: ${Z_INDEX};
  color-scheme: light;
}
@media (max-width: 640px) {
  #${IFRAME_ID} {
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}
#${IFRAME_ID}.is-hidden, #${LAUNCHER_ID}.is-hidden { display: none; }
`;

function injectStyles(): void {
  if (document.getElementById('famaash-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'famaash-styles';
  tag.textContent = styles;
  document.head.appendChild(tag);
}

function parseUtm(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith('utm_')) utm[key] = value;
  });
  return utm;
}

function makeLauncher(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = LAUNCHER_ID;
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  btn.addEventListener('click', onClick);
  return btn;
}

function readScriptConfig(): { firmId: string; widgetOrigin: string } {
  const script = (document.currentScript ?? document.querySelector('script[data-firm-id]')) as
    | HTMLScriptElement
    | null;
  if (!script) {
    throw new Error('[famaash] loader could not locate its script tag');
  }
  const firmId = script.getAttribute('data-firm-id') ?? 'firm_demo';
  const widgetOrigin = new URL(script.src, window.location.href).origin;
  return { firmId, widgetOrigin };
}

(function boot() {
  const { firmId, widgetOrigin } = readScriptConfig();
  injectStyles();

  let iframe: HTMLIFrameElement | null = null;
  let iframeRemote: IframeMethods | null = null;
  let connection: Connection<IframeMethods> | null = null;
  let iframeReady: Promise<IframeMethods> | null = null;

  const hostMethods: HostMethods = {
    requestClose: () => {
      iframe?.classList.add('is-hidden');
      launcher.classList.remove('is-hidden');
    },
    requestMinimize: () => {
      iframe?.classList.add('is-hidden');
      launcher.classList.remove('is-hidden');
    },
    getHostContext: () => ({
      url: window.location.href,
      referrer: document.referrer,
      utm: parseUtm(),
    }),
    notifyEvent: (event) => {
      if (window.console && typeof window.console.debug === 'function') {
        // eslint-disable-next-line no-console
        console.debug('[famaash:event]', event);
      }
    },
  };

  function ensureIframe(): Promise<IframeMethods> {
    if (iframeReady) return iframeReady;

    const el = document.createElement('iframe');
    el.id = IFRAME_ID;
    el.title = 'Famaash chat widget';
    el.setAttribute('sandbox', SANDBOX);
    el.setAttribute('allow', 'microphone; camera; clipboard-write');
    el.src = `${widgetOrigin}/embed.html?firm_id=${encodeURIComponent(firmId)}`;
    document.body.appendChild(el);
    iframe = el;

    connection = connectToChild<IframeMethods>({
      iframe: el,
      methods: hostMethods as unknown as Methods,
      childOrigin: widgetOrigin,
      timeout: 10000,
    });

    iframeReady = connection.promise
      .then((remote: IframeMethods) => {
        iframeRemote = remote;
        return remote;
      })
      .catch((err: unknown) => {
        console.warn('[famaash] iframe connection failed', err);
        throw err;
      });

    return iframeReady;
  }

  function openWidget(): void {
    launcher.classList.add('is-hidden');
    ensureIframe()
      .then((remote) => {
        iframe?.classList.remove('is-hidden');
        return remote.open();
      })
      .catch(() => {
        launcher.classList.remove('is-hidden');
        iframe?.classList.add('is-hidden');
      });
  }

  function closeWidget(): void {
    iframe?.classList.add('is-hidden');
    launcher.classList.remove('is-hidden');
    iframeRemote?.close().catch(() => undefined);
  }

  const launcher = makeLauncher(openWidget);
  document.body.appendChild(launcher);

  type FamaashApi = {
    open(): void;
    close(): void;
    identify(user: { id: string; email: string; name?: string }): void;
    setContext(data: Record<string, unknown>): void;
  };
  const api: FamaashApi = {
    open: () => openWidget(),
    close: () => closeWidget(),
    identify: (user) => {
      ensureIframe()
        .then((remote) => remote.identify(user))
        .catch(() => undefined);
    },
    setContext: (data) => {
      ensureIframe()
        .then((remote) => remote.setContext(data))
        .catch(() => undefined);
    },
  };
  (window as unknown as { Famaash: FamaashApi }).Famaash = api;
})();
