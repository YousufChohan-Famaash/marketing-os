import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ConsentModal } from './components/ConsentModal';
import { ModalHost } from './components/ModalHost';
import { SigningSheet } from './components/SigningSheet';
import { WidgetErrorFallback } from './components/WidgetErrorFallback';
import { WidgetShell } from './components/WidgetShell';
import { applyTheme } from './config/theme';
import { shouldShowCinematic } from './config/connect';
import { ApiError } from './services/api';
import { createHostBridge, type HostBridgeClient } from './services/hostBridge';
import { SocketContext } from './services/socketContext';
import {
  createSocket,
  getOrCreateConversationId,
  loadBootConfig,
  rehydrateFromHistory,
} from './services/transport';
import { useWidgetStore } from './store/widgetStore';
import { wireSocketToStore } from './store/wireSocket';
import type { AnalyticsEvent, ConversationSocket } from './types/protocol';

/** Fallback firm when none is supplied via ?firm_id= (the Al-Muhami test org). */
const DEFAULT_FIRM_ID = '511eeb77-061e-4465-a772-a12d2c06cd83';

function readFirmIdFromQuery(): string {
  if (typeof window === 'undefined') return DEFAULT_FIRM_ID;
  const params = new URLSearchParams(window.location.search);
  return params.get('firm_id') ?? DEFAULT_FIRM_ID;
}

const CONNECT_VIEWS = ['home', 'call', 'chat', 'text', 'schedule'] as const;
type RoutableView = (typeof CONNECT_VIEWS)[number];

/** Validate an external view string (teaser deep-link / ?view=) to a routable view. */
function normalizeView(raw: string | null | undefined): RoutableView | null {
  return raw && (CONNECT_VIEWS as readonly string[]).includes(raw) ? (raw as RoutableView) : null;
}

function readInitialView(): RoutableView | null {
  if (typeof window === 'undefined') return null;
  return normalizeView(new URLSearchParams(window.location.search).get('view'));
}

export function App() {
  const setBootConfig = useWidgetStore((s) => s.setBootConfig);
  const setBootStatus = useWidgetStore((s) => s.setBootStatus);
  const setConversationId = useWidgetStore((s) => s.setConversationId);
  const openWidget = useWidgetStore((s) => s.openWidget);
  const closeWidget = useWidgetStore((s) => s.closeWidget);
  const isWidgetOpen = useWidgetStore((s) => s.isWidgetOpen);
  const pendingCaseType = useWidgetStore((s) => s.pendingCaseType);
  const setPendingCaseType = useWidgetStore((s) => s.setPendingCaseType);
  const activeSigning = useWidgetStore((s) => s.activeSigning);

  const [socket, setSocket] = useState<ConversationSocket | null>(null);
  // The chat opens expanded by default now; the user can collapse it back down.
  // Lives in the store so message rendering can nudge font size when expanded.
  const isExpanded = useWidgetStore((s) => s.isExpanded);
  const setExpanded = useWidgetStore((s) => s.setExpanded);
  const connectSize = useWidgetStore((s) => s.connect.size);
  const connectView = useWidgetStore((s) => s.connectView);
  const conversationStarted = useWidgetStore((s) => s.conversationStarted);
  const cinematicDismissed = useWidgetStore((s) => s.cinematicDismissed);
  const bridgeRef = useRef<HostBridgeClient | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  const firmId = useMemo(readFirmIdFromQuery, []);

  // Honor a ?view= deep-link (teaser channel tap, first iframe load) once.
  useEffect(() => {
    const v = readInitialView();
    if (v && v !== 'home') useWidgetStore.getState().setConnectView(v);
  }, []);

  // Drive the iframe size: Small-mode home is compact and expands to full the
  // moment a conversation/channel opens; everything else uses the full size.
  useEffect(() => {
    if (!bridgeReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    // The cinematic open needs the full panel even on a Small-mode home.
    const cinematic = shouldShowCinematic(useWidgetStore.getState().connect, {
      connectView,
      conversationStarted,
      cinematicDismissed,
    });
    const compact =
      connectSize !== 'large' && connectView === 'home' && !conversationStarted && !cinematic;
    if (compact) void bridge.requestCompact();
    else void bridge.requestExpand();
  }, [bridgeReady, connectSize, connectView, conversationStarted, cinematicDismissed]);

  // Boot runs two independent tracks IN PARALLEL so the agent connection isn't
  // gated behind /config:
  //   • Connection track: import LiveKit → POST /token → room.connect
  //   • Config track:      GET /config → (resume history) → PAINT the opener
  // The conversation_id is generated synchronously, so /token needs nothing
  // from /config. By the time the user reads the chips and picks, the room is
  // usually already connected and the pick flushes instantly.
  useEffect(() => {
    let disposed = false;
    let localSocket: ConversationSocket | null = null;
    let unwire: (() => void) | null = null;
    const abort = new AbortController();
    const DEV = import.meta.env.DEV;
    const t0 = DEV ? performance.now() : 0;

    setBootStatus('loading');
    const { id: conversationId, returning } = getOrCreateConversationId(firmId);
    setConversationId(conversationId);

    // ── Connection track (parallel) ──────────────────────────────────────
    void (async () => {
      try {
        const s = await createSocket();
        if (disposed) {
          s.disconnect();
          return;
        }
        localSocket = s;
        unwire = wireSocketToStore(s);
        setSocket(s); // expose before connect so a buffered pick can queue
        await s.connect(firmId, conversationId);
        if (disposed) return;
        if (DEV) {
          // eslint-disable-next-line no-console
          console.log('[famaash-widget] connected in', Math.round(performance.now() - t0), 'ms');
        }
        notifyHostEvent({ type: 'widget_opened', data: { firmId, conversationId } });
      } catch (err) {
        if (disposed) return;
        const message = err instanceof Error ? err.message : 'Connection failed';
        setBootStatus('error', message);
      }
    })();

    // ── Config track (parallel) — gates the opener ───────────────────────
    void (async () => {
      try {
        const config = await loadBootConfig(firmId, abort.signal);
        if (disposed) return;
        setBootConfig(config);
        // Theme precedence: an explicit admin 'custom' palette overrides the
        // host-site colors already applied at boot. 'inherit' (default) keeps them.
        if (config.branding?.themeSource === 'custom' && config.branding.primaryColor) {
          applyTheme({
            primary: config.branding.primaryColor,
            accent: config.branding.accentColor,
          });
        }
        if (returning) {
          await rehydrateFromHistory(conversationId, abort.signal);
          if (disposed) return;
        }
        // Don't override a connection failure that already set 'error'.
        if (useWidgetStore.getState().bootStatus !== 'error') {
          setBootStatus('ready');
          if (DEV) {
            // eslint-disable-next-line no-console
            console.log('[famaash-widget] opener ready in', Math.round(performance.now() - t0), 'ms');
          }
        }
        bridgeRef.current = createHostBridge(
          {
            onOpen: () => openWidget(),
            onClose: () => closeWidget(),
            onMinimize: () => closeWidget(),
            // Teaser channel deep-link: route the panel to the requested view.
            onSetView: (view) => {
              const v = normalizeView(view);
              if (v) useWidgetStore.getState().setConnectView(v);
              openWidget();
            },
          },
          config.allowedOrigins ?? [],
        );
        // Bridge is live — let the sizing effect drive expand vs. compact.
        setBridgeReady(true);
      } catch (err) {
        if (disposed) return;
        // Fail closed: firm lacks the chat_widget module → don't render at all.
        if (err instanceof ApiError && err.status === 403) {
          setBootStatus('disabled');
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        setBootStatus('error', message);
      }
    })();

    return () => {
      disposed = true;
      abort.abort();
      unwire?.();
      localSocket?.disconnect();
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [firmId, setBootConfig, setBootStatus, setConversationId, openWidget, closeWidget]);

  // Flush the buffered opener pick once a socket exists (RealSocket itself
  // queues it until the agent's `ready` event arrives).
  useEffect(() => {
    if (socket && pendingCaseType) {
      socket.send(pendingCaseType);
      // The agent opens with its first question after the case-type pick —
      // show the typing dots while it (and the `ready` handshake) catch up.
      useWidgetStore.getState().beginTyping();
      setPendingCaseType(null);
    }
  }, [socket, pendingCaseType, setPendingCaseType]);

  // Open the widget locally when it boots — in production the host's launcher
  // would call `iframe.open()` over Penpal, but for local dev we self-open.
  useEffect(() => {
    if (!isWidgetOpen) {
      const t = setTimeout(() => openWidget(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isWidgetOpen, openWidget]);

  const notifyHostEvent = (event: AnalyticsEvent) => {
    bridgeRef.current?.notifyEvent(event);
  };

  const handleClose = () => {
    closeWidget();
    notifyHostEvent({ type: 'widget_closed', data: {} });
    void bridgeRef.current?.requestClose();
  };

  const handleMinimize = () => {
    closeWidget();
    void bridgeRef.current?.requestMinimize();
  };

  const handleExpand = () => {
    const next = !isExpanded;
    setExpanded(next);
    if (next) {
      void bridgeRef.current?.requestExpand();
    } else {
      void bridgeRef.current?.requestShrink();
    }
  };

  const handleError = (error: Error) => {
    notifyHostEvent({
      type: 'widget_error',
      data: { message: error.message, stack: error.stack },
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={WidgetErrorFallback}
      onError={handleError}
      onReset={() => setBootStatus('idle')}
    >
      <SocketContext.Provider value={socket}>
        <div className="relative flex h-full w-full flex-col">
          <WidgetShell onClose={handleClose} onMinimize={handleMinimize} onExpand={handleExpand} isExpanded={isExpanded} />
          <ModalHost />
          <ConsentModal />
          {activeSigning && <SigningSheet signing={activeSigning} />}
        </div>
      </SocketContext.Provider>
    </ErrorBoundary>
  );
}
