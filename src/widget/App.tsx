import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ConsentModal } from './components/ConsentModal';
import { ModalHost } from './components/ModalHost';
import { SigningSheet } from './components/SigningSheet';
import { WidgetErrorFallback } from './components/WidgetErrorFallback';
import { WidgetShell } from './components/WidgetShell';
import { applyFont, applyTheme } from './config/theme';
import { getConsultationContext } from './config/env';
import { ApiError } from './services/api';
import { createHostBridge, type HostBridgeClient } from './services/hostBridge';
import { SocketContext } from './services/socketContext';
import {
  createSocket,
  getOrCreateConversationId,
  loadBootConfig,
  persistConversationId,
  rehydrateFromHistory,
  resetConversationId,
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
  const connectView = useWidgetStore((s) => s.connectView);
  const conversationStarted = useWidgetStore((s) => s.conversationStarted);
  const language = useWidgetStore((s) => s.language);
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
  // Set later to the "adopt a peer tab's new chat" handler. Held in a ref so
  // connectSocket (defined above it) can forward multi-tab new-chat broadcasts
  // without a declaration-order dependency.
  const adoptNewChatRef = useRef<(conversationId: string) => void>(() => {});
  // Highest start_new_intake nonce we've already acted on, so a reset never
  // re-fires for a stale request (e.g. after a role change re-runs the effect).
  const handledIntakeNonce = useRef(0);

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
        const s = await createSocket({
          // A peer tab started a fresh chat → follow it to the same new id.
          onRemoteNewChat: (id) => adoptNewChatRef.current(id),
          // Track whether THIS tab owns the live connection, so agent-driven
          // "new chat" is handled once (by the leader), not by every tab.
          onRoleChange: (isLeader) => useWidgetStore.getState().setSessionLeader(isLeader),
          // Surface a leader connection failure the same way a direct one did.
          onError: (msg) => { if (!disposedRef.current) setBootStatus('error', msg); },
        });
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

  // Drive the OPENED iframe panel size. The dashboard widget-size setting only
  // affects the collapsed teaser on the host page — once the panel is open it's
  // sized to its content, identically for every size:
  //   home / chat opener → the default portrait card (fits the video + grid)
  //   a started conversation or a routed channel → the tall scrolling panel
  useEffect(() => {
    if (!bridgeReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    // Three panel heights, sized to each view's content:
    //   schedule / live conversation → the tall scrolling panel (slot grid, chat)
    //   home menu → tall enough that the hero video + every option fit, no scroll
    //   short Call / Text / Send-details forms → the default height (no big void)
    if (connectView === 'schedule' || (connectView === 'chat' && conversationStarted)) {
      void bridge.requestTall();
    } else if (connectView === 'home') {
      void bridge.requestHome();
    } else {
      void bridge.requestShrink();
    }
  }, [bridgeReady, connectView, conversationStarted]);

  // Boot fetches ONLY /config — that alone paints the opener + case-type chips
  // (they're /config data, not agent data; the agent never renders them). The
  // LiveKit connection is deferred to the case-type pick (Option B in
  // chat-widget-fast-open-frontend-guide.md): it isn't needed to show the chips,
  // and deferring it avoids creating a Lead/Call on every open/bounce. A Free
  // Consultation hand-off already knows the case type, so it connects right away.
  useEffect(() => {
    disposedRef.current = false;
    // Per-run cancellation flag. `disposedRef` is shared across effect runs and
    // gets reset to false by a superseding run (e.g. React StrictMode's remount)
    // BEFORE this run's aborted /config fetch reaches its catch — which then
    // wrongly surfaced the abort as "We can't reach the chat right now". A local
    // flag is scoped to this run, so an aborted run never sets the error state.
    let cancelled = false;
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
        if (cancelled) return;
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
          const resumed = await rehydrateFromHistory(conversationId, abort.signal);
          if (cancelled) return;
          // Reopened a real conversation → drop straight into the chat showing the
          // transcript (not the home opener), and reconnect the live agent so it
          // resumes at the next question. An ended conversation shows the
          // transcript without reconnecting.
          if (resumed.messageCount > 0) {
            const st = useWidgetStore.getState();
            st.setConnectView('chat');
            st.setConversationStarted(true);
            if (resumed.status !== 'ended') connectSocket();
          }
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
            // Mobile Back button: step back one level inside the widget. A routed
            // channel (Call / Book / etc.) or chat goes to the widget home; from
            // home the widget closes. Returning false keeps the panel open so the
            // loader re-arms the trap; true tells it the panel closed.
            onBack: () => {
              const st = useWidgetStore.getState();
              if (st.connectView !== 'home') {
                st.setConnectView('home');
                return false;
              }
              st.closeWidget();
              return true;
            },
          },
          config.allowedOrigins ?? [],
        );
        // Bridge is live — let the sizing effect drive expand vs. compact.
        setBridgeReady(true);
      } catch (err) {
        // A superseded/unmounted run aborts its own fetch — that's not a real
        // failure, so never surface it as a boot error.
        if (cancelled || abort.signal.aborted) return;
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
      cancelled = true;
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

  // Ping the loader when any field is focused/blurred so it can resize the panel
  // for the mobile keyboard. iOS Safari fires no visualViewport event on focus
  // under a scroll-locked host body, so without this nudge the panel only
  // resizes once the user manually scrolls — the loader re-checks on this ping
  // across the keyboard's open/close animation.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const onFocusChange = (e: FocusEvent) => {
      if (isField(e.target)) bridgeRef.current?.syncKeyboard();
    };
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    return () => {
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
    };
  }, []);

  const notifyHostEvent = (event: AnalyticsEvent) => {
    bridgeRef.current?.notifyEvent(event);
  };

  // Tear down the live connection, clear every conversation slice, then point at
  // `freshId` and drop back to the chat opener. Shared by the "New chat" button,
  // the agent's start_new_intake, and following a peer tab's new chat. The socket
  // reconnects on the next case-type pick (Option B), same as a first-time chat.
  const resetToConversation = useCallback((freshId: string) => {
    unwireRef.current?.();
    unwireRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    connectingRef.current = false;
    setSocket(null);

    const st = useWidgetStore.getState();
    st.resetConversation();
    st.resetCapture();
    st.resetChips();
    st.endStreaming();
    st.setAgentTakeover(null);
    st.clearUnread();
    st.setCaseTypePicked(false);
    st.setConversationStarted(false);
    st.setPendingCaseType(null);
    st.setConnectCallStatus(null);
    // Fresh conversation: this tab leads again until the next connect re-elects.
    st.setSessionLeader(true);
    // Never let a stale start_new_intake re-fire against the new conversation.
    handledIntakeNonce.current = st.newIntakeNonce;

    conversationIdRef.current = freshId;
    setConversationId(freshId);
    st.setConnectView('chat');
  }, [setConversationId]);

  // "Start a new chat" (header button, or the leader acting on start_new_intake):
  // mint a fresh id, tell peer tabs to follow to it, then reset. The old
  // conversation is preserved server-side (a new Call+Lead is created next connect).
  const startNewChat = useCallback(() => {
    const fresh = resetConversationId(firmId);
    // Notify peers on the OLD conversation BEFORE tearing its socket down.
    socketRef.current?.notifyNewChat?.(fresh);
    resetToConversation(fresh);
  }, [firmId, resetToConversation]);

  // A peer tab started a new chat → adopt the SAME fresh id so all tabs share the
  // new conversation, and persist it so a reload resumes that one.
  const adoptNewChat = useCallback((freshId: string) => {
    if (freshId === conversationIdRef.current) return;
    persistConversationId(firmId, freshId);
    resetToConversation(freshId);
  }, [firmId, resetToConversation]);
  useEffect(() => {
    adoptNewChatRef.current = adoptNewChat;
  }, [adoptNewChat]);

  // The agent can ask to start a fresh intake (a typed "start a new chat"). The
  // relayed event bumps this nonce in EVERY tab, so gate on leadership: only the
  // leader mints + broadcasts; follower tabs adopt via onRemoteNewChat instead of
  // each minting their own id.
  const newIntakeNonce = useWidgetStore((s) => s.newIntakeNonce);
  const isSessionLeader = useWidgetStore((s) => s.isSessionLeader);
  useEffect(() => {
    if (newIntakeNonce > handledIntakeNonce.current && isSessionLeader) {
      handledIntakeNonce.current = newIntakeNonce;
      startNewChat();
    }
  }, [newIntakeNonce, isSessionLeader, startNewChat]);

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
        <div className="relative flex h-full w-full flex-col" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <WidgetShell onClose={handleClose} onMinimize={handleMinimize} onExpand={handleExpand} isExpanded={isExpanded} onNewChat={startNewChat} />
          <ModalHost />
          <ConsentModal />
          {activeSigning && <SigningSheet signing={activeSigning} />}
        </div>
      </SocketContext.Provider>
    </ErrorBoundary>
  );
}
