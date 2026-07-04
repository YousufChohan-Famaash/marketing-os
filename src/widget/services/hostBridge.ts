import { connectToParent, type Connection, type Methods } from 'penpal';
import type {
  AnalyticsEvent,
  HostBridge,
  HostContext,
  IdentifyPayload,
  IframeBridge,
} from '../types/protocol';

/**
 * Iframe-side Penpal setup. The widget runs inside an iframe loaded from
 * widget.famaash.com on a third-party law-firm site. Communication with the
 * host page goes through this bridge.
 *
 * Security: the Penpal connection is established with an explicit parentOrigin
 * regex — messages from any other origin are rejected. The loader on the host
 * side does the symmetric check (childOrigin of the widget iframe).
 */

const PENPAL_TIMEOUT_MS = 8000;

export interface IframeBridgeHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onSetView?: (view: string) => void;
  onSetContext?: (metadata: Record<string, unknown>) => void;
  onIdentify?: (user: IdentifyPayload) => void;
}

export interface HostBridgeClient {
  requestClose(): Promise<void>;
  requestMinimize(): Promise<void>;
  requestExpand(): Promise<void>;
  requestShrink(): Promise<void>;
  requestCompact(): Promise<void>;
  requestTall(): Promise<void>;
  getHostContext(): Promise<HostContext | null>;
  notifyEvent(event: AnalyticsEvent): void;
  /** Tell the host the widget has painted, so it can reveal the panel. */
  notifyReady(): void;
  destroy(): void;
  isConnected(): boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the parent-origin allow-list regex Penpal validates the host page
 * against. Rules (mirror the backend + widget-allowed-origins-frontend-guide.md):
 *
 *   - No configured origins → the firm hasn't restricted embedding, so accept
 *     any host (matches the dashboard's "empty = not restricted" copy).
 *   - Otherwise → the iframe's own origin is always trusted (so same-Vercel
 *     demo pages work), plus each configured origin. Exact origins match
 *     verbatim; a `https://*.base` entry matches any SUBDOMAIN of base (not the
 *     apex), same scheme and exact port — e.g. `https://*.firm.com` covers
 *     `www.firm.com` and `a.b.firm.com` but not `firm.com` or `firm.com.evil.com`.
 */
function originAllowList(origins: string[]): RegExp {
  const configured = origins.filter(Boolean);
  if (configured.length === 0) return /^.*$/;

  const selfOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const patterns: string[] = [];
  if (selfOrigin) patterns.push(escapeRegex(selfOrigin));

  for (const o of configured) {
    const wildcard = o.toLowerCase().match(/^(https?):\/\/\*\.([^/:]+)(?::(\d+))?$/);
    if (wildcard) {
      const [, scheme, base, port] = wildcard;
      patterns.push(`${scheme}://[^/:]+\\.${escapeRegex(base)}${port ? `:${port}` : ''}`);
    } else {
      patterns.push(escapeRegex(o.toLowerCase()));
    }
  }
  return new RegExp(`^(${patterns.join('|')})$`);
}

export function createHostBridge(
  handlers: IframeBridgeHandlers,
  allowedOrigins: string[] = [],
): HostBridgeClient {
  if (typeof window === 'undefined' || window.parent === window) {
    return makeNoOpClient();
  }

  const methods: IframeBridge = {
    async open() {
      handlers.onOpen?.();
    },
    async close() {
      handlers.onClose?.();
    },
    async minimize() {
      handlers.onMinimize?.();
    },
    async setView(view: string) {
      handlers.onSetView?.(view);
    },
    async setContext(metadata: Record<string, unknown>) {
      handlers.onSetContext?.(metadata);
    },
    async identify(user: IdentifyPayload) {
      handlers.onIdentify?.(user);
    },
  };

  const connection: Connection<HostBridge> = connectToParent<HostBridge>({
    methods: methods as unknown as Methods,
    parentOrigin: originAllowList(allowedOrigins),
    timeout: PENPAL_TIMEOUT_MS,
  });

  let connected = false;
  let remote: HostBridge | null = null;

  const ready: Promise<HostBridge | null> = connection.promise
    .then((r) => {
      connected = true;
      remote = r as unknown as HostBridge;
      return remote;
    })
    .catch((err: unknown) => {
      console.warn('[famaash-widget] host bridge connection failed', err);
      return null;
    });

  return {
    async requestClose() {
      const r = await ready;
      await r?.requestClose();
    },
    async requestMinimize() {
      const r = await ready;
      await r?.requestMinimize();
    },
    async requestExpand() {
      const r = await ready;
      await r?.requestExpand();
    },
    async requestShrink() {
      const r = await ready;
      await r?.requestShrink();
    },
    async requestCompact() {
      const r = await ready;
      await r?.requestCompact();
    },
    async requestTall() {
      const r = await ready;
      await r?.requestTall();
    },
    async getHostContext() {
      const r = await ready;
      if (!r) return null;
      try {
        return await r.getHostContext();
      } catch (err) {
        console.warn('[famaash-widget] getHostContext failed', err);
        return null;
      }
    },
    notifyEvent(event: AnalyticsEvent) {
      void ready.then((r) => {
        r?.notifyEvent(event).catch(() => undefined);
      });
    },
    notifyReady() {
      void ready.then((r) => {
        r?.notifyReady?.().catch(() => undefined);
      });
    },
    destroy() {
      connection.destroy();
      connected = false;
      remote = null;
    },
    isConnected() {
      return connected && remote !== null;
    },
  };
}

function makeNoOpClient(): HostBridgeClient {
  return {
    requestClose: async () => undefined,
    requestMinimize: async () => undefined,
    requestExpand: async () => undefined,
    requestShrink: async () => undefined,
    requestCompact: async () => undefined,
    requestTall: async () => undefined,
    getHostContext: async () => null,
    notifyEvent: () => undefined,
    notifyReady: () => undefined,
    destroy: () => undefined,
    isConnected: () => false,
  };
}
