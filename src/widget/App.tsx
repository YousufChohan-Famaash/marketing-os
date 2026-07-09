import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ConsentModal } from './components/ConsentModal';
import { ModalHost } from './components/ModalHost';
import { SigningSheet } from './components/SigningSheet';
import { WidgetErrorFallback } from './components/WidgetErrorFallback';
import { WidgetShell } from './components/WidgetShell';
import { applyFont, applyTheme } from './config/theme';
import { shouldShowCinematic } from './config/connect';
import { resolveCinematicVideo } from './config/demoMedia';
import { getConsultationContext } from './config/env';
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

const CONNECT_VIEWS = ['home', 'call', 'chat', 'text', 'schedule', 'email'] as const;
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
  // Deferred LiveKit connection (Option B): the socket is created on the
  // case-type pick, not on open. These refs carry its lifecycle so the pick
  // effect can trigger it and the boot cleanup can tear it down.
  const socketRef = useRef<ConversationSocket | null>(null);
  const unwireRef = useRef<(() => void) | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const connectingRef = useRef(false);
  const disposedRef = useRef(false);

  const firmId = useMemo(readFirmIdFromQuery, []);

  // Connect the LiveKit session on demand: the first case-type pick (or a
  // Free Consultation hand-off, which already knows the case type). Idempotent —
  // guarded so a fast double-tap or a re-render can't open two rooms. The pick
  // itself is sent by the flush effect once `socket` is set (RealSocket queues
  // it until the agent's `ready` event).
  const connectSocket = useCallback(() => {
    if (socketRef.current || connectingRef.current) return;
    const cid = conversationIdRef.current;
    if (!cid) return;
    connectingRef.current = true;
    void (async () => {
      try {
        const s = await createSocket();
        if (disposedRef.current) { s.disconnect(); return; }
        socketRef.current = s;
        unwireRef.current = wireSocketToStore(s);
        setSocket(s); // expose before connect so a buffered pick can queue
        await s.connect(firmId, cid);
        if (disposedRef.current) return;
        bridgeRef.current?.notifyEvent({ type: 'widget_opened', data: { firmId, conversationId: cid } });
      } catch (err) {
        if (disposedRef.current) return;
        setBootStatus('error', err instanceof Error ? err.message : 'Connection failed');
      } finally {
        connectingRef.current = false;
      }
    })();
  }, [firmId, setBootStatus]);

  // Honor a ?view= deep-link (teaser channel tap, first iframe load) once.
  useEffect(() => {
    const v = readInitialView();
    if (v && v !== 'home') useWidgetStore.getState().setConnectView(v);
    // Free Consultation hand-off: we already have the case type from the wizard,
    // so drop straight into the chat conversation and skip the case-type opener.
    // The agent sends its acknowledgment opener after `ready` (no pick needed);
    // show typing dots meanwhile on a fresh conversation.
    if (getConsultationContext()) {
      const st = useWidgetStore.getState();
      st.setConnectView('chat');
      st.setCaseTypePicked(true);
      st.setConversationStarted(true);
      if (st.messages.length === 0) st.beginTyping();
    }
  }, []);

  // Drive the iframe size: Small-mode home is compact and expands to full the
  // moment a conversation/channel opens; everything else uses the full size.
  useEffect(() => {
    if (!bridgeReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    // The cinematic open needs the full panel even on a Small-mode home.
    const st = useWidgetStore.getState();
    const cinematicVideo = resolveCinematicVideo(
      st.connect.videoMode,
      st.branding?.introVideoUrl,
      st.connect.storyVideoUrl,
    );
    const cinematic = shouldShowCinematic(st.connect, {
      connectView,
      conversationStarted,
      cinematicDismissed,
      hasVideo: Boolean(cinematicVideo),
    });
    // Size the portrait panel to its content:
    //   medium/small home → short compact card
    //   chat opener (case-type chips, before a pick) → shorter card, no whitespace
    //   a started conversation / channel view → taller (scrolling chat, forms)
    //   large home (or cinematic) → the default portrait card (fits video + grid)
    const isHome = connectView === 'home';
    const isChatOpener = connectView === 'chat' && !conversationStarted;
    // Home is sized by its OWN layout only — never by whether a conversation has
    // already started. Previously a started conversation forced Home to the tall
    // size, so coming back to the menu looked different from where you began.
    // Compact card = medium/small WITH a video (and not mid-cinematic); with no
    // video Home falls back to the default portrait size.
    const compactHome =
      connectSize !== 'large' && Boolean(cinematicVideo) && !cinematic;
    if (isHome) {
      if (compactHome) void bridge.requestCompact();
      else void bridge.requestShrink();
    } else if (isChatOpener) {
      void bridge.requestShrink();
    } else {
      // A started conversation or a routed channel (call/text/schedule/email) —
      // these scroll, so give them the tall panel.
      void bridge.requestTall();
    }
  }, [bridgeReady, connectSize, connectView, conversationStarted, cinematicDismissed]);

  // Boot fetches ONLY /config — that alone paints the opener + case-type chips
  // (they're /config data, not agent data; the agent never renders them). The
  // LiveKit connection is deferred to the case-type pick (Option B in
  // chat-widget-fast-open-frontend-guide.md): it isn't needed to show the chips,
  // and deferring it avoids creating a Lead/Call on every open/bounce. A Free
  // Consultation hand-off already knows the case type, so it connects right away.
  useEffect(() => {
    disposedRef.current = false;
    const abort = new AbortController();
    const DEV = import.meta.env.DEV;
    const t0 = DEV ? performance.now() : 0;

    setBootStatus('loading');
    const { id: conversationId, returning } = getOrCreateConversationId(firmId);
    conversationIdRef.current = conversationId;
    setConversationId(conversationId);
    // Consultation hand-off: the case type is already chosen, so connect now —
    // the agent streams its acknowledgment opener after `ready` (no pick event).
    if (getConsultationContext()) connectSocket();

    // ── Config track — paints the opener ─────────────────────────────────
    void (async () => {
      try {
        const config = await loadBootConfig(firmId, abort.signal);
        if (disposedRef.current) return;
        setBootConfig(config);
        // Theme precedence: an explicit admin 'custom' palette overrides the
        // host-site colors already applied at boot. 'inherit' (default) keeps them.
        if (config.branding?.themeSource === 'custom' && config.branding.primaryColor) {
          applyTheme({
            primary: config.branding.primaryColor,
            accent: config.branding.accentColor,
          });
        }
        // Apply the firm's font across the widget (graceful fallback if unset).
        applyFont(config.branding?.fontFamily);
        if (returning) {
          await rehydrateFromHistory(conversationId, abort.signal);
          if (disposedRef.current) return;
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
        if (disposedRef.current) return;
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
      disposedRef.current = true;
      abort.abort();
      unwireRef.current?.();
      unwireRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [firmId, setBootConfig, setBootStatus, setConversationId, openWidget, closeWidget, connectSocket]);

  // Case-type pick (Option B): the first pick is what triggers the LiveKit
  // connection. If the socket isn't up yet, kick it off and show the "thinking"
  // state; this effect re-runs once `socket` is set and sends the buffered pick
  // (RealSocket queues it until the agent's `ready` event). On a later pick /
  // consultation the socket already exists and it flushes immediately.
  useEffect(() => {
    if (!pendingCaseType) return;
    // The agent opens with its first question after the pick — show typing dots
    // while the connection + `ready` handshake catch up.
    useWidgetStore.getState().beginTyping();
    if (socket) {
      socket.send(pendingCaseType);
      setPendingCaseType(null);
    } else {
      connectSocket();
    }
  }, [socket, pendingCaseType, setPendingCaseType, connectSocket]);

  // Open the widget locally when it boots — in production the host's launcher
  // would call `iframe.open()` over Penpal, but for local dev we self-open.
  useEffect(() => {
    if (!isWidgetOpen) {
      const t = setTimeout(() => openWidget(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isWidgetOpen, openWidget]);

  // Tell the loader we're mounted so it can reveal the panel on the next open.
  // CRITICAL: do NOT gate this on requestAnimationFrame. The panel is prewarmed
  // while display:none, and browsers freeze rAF for a hidden iframe — so an
  // rAF-gated signal never fires until the panel is already revealed, which
  // defeats prewarm entirely (the loader falls back to its ~6s reveal timer on
  // every open). postMessage runs fine while hidden. React has committed the DOM
  // by the time this effect runs, so the frame paints content (not blank) the
  // instant the loader un-hides it.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    try {
      window.parent.postMessage({ type: 'famaash:painted' }, '*');
    } catch {
      /* parent unreachable — the bridge notifyReady + fallback still cover it */
    }
  }, []);

  // Backup reveal signal over the bridge once it's connected (also not rAF-gated,
  // for the same hidden-iframe reason). Redundant with the paint ping above.
  useEffect(() => {
    if (!bridgeReady) return;
    bridgeRef.current?.notifyReady();
  }, [bridgeReady]);

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
