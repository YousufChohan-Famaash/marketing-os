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
  onSetContext?: (metadata: Record<string, unknown>) => void;
  onIdentify?: (user: IdentifyPayload) => void;
}

export interface HostBridgeClient {
  requestClose(): Promise<void>;
  requestMinimize(): Promise<void>;
  getHostContext(): Promise<HostContext | null>;
  notifyEvent(event: AnalyticsEvent): void;
  destroy(): void;
  isConnected(): boolean;
}

/**
 * Build a regex that matches any of the supplied origins, PLUS the iframe's
 * own origin (so same-domain demo deployments — widget + host page on one
 * Vercel project — always handshake without explicit allow-list entries).
 *
 * Cross-origin embeds (real client sites embedding widget.famaash.com on
 * a third-party law-firm domain) still go through `allowedOrigins` from boot config.
 */
function originAllowList(origins: string[]): RegExp {
  const selfOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const set = new Set<string>([selfOrigin, ...origins].filter(Boolean));
  const escaped = [...set].map((o) =>
    o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`^(${escaped.join('|')})$`);
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
    getHostContext: async () => null,
    notifyEvent: () => undefined,
    destroy: () => undefined,
    isConnected: () => false,
  };
}
