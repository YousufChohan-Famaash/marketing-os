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
import type { ConversationTokenResponse } from './services/api';
import {
  clearConversationId,
  consultationKey,
  createFreshChatSession,
  createSocket,
  loadBootConfig,
  persistConversationId,
  readHandoffKey,
  readStoredConversationId,
  rehydrateFromHistory,
  writeHandoffKey,
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
  const bootStatus = useWidgetStore((s) => s.bootStatus);
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
  // The language the first (boot) config was fetched in, so the re-fetch effect
  // only fires on a SUBSEQUENT picker change, not on the initial derivation.
  const langBaselineRef = useRef<string | null>(null);
  // Set later to the "reconnect + resume the current chat" handler, so
  // connectSocket (defined above it) can hand it to the socket's onDisconnect.
  const reconnectResumeRef = useRef<() => void>(() => {});
  // Timestamp of the last auto-reconnect, to rate-limit drop→reconnect loops.
  const reconnectGuardRef = useRef(0);

  const firmId = useMemo(readFirmIdFromQuery, []);

  // Open (or resume) the LiveKit session. Idempotent — guarded so a fast
  // double-tap or a re-render can't open two rooms.
  //   resume : conversationIdRef is a stored (server-minted) id → RealSocket POSTs
  //            /token{conversation_id} and the agent resumes.
  //   cold   : no stored id AND no preset → mint SERVER-SIDE here (POST /token with
  //            NO conversation_id), store the returned id, and join that room. We
  //            never mint an id on the client (guide §1).
  //   preset : a "start new chat" already minted the room → the leader joins it.
  const connectSocket = useCallback((presetSession?: ConversationTokenResponse) => {
    if (socketRef.current || connectingRef.current) return;
    connectingRef.current = true;
    void (async () => {
      try {
        let preset = presetSession;
        let cid = conversationIdRef.current;
        if (!cid && !preset) {
          // Cold first visit: the server mints the id (and the Call+Lead).
          preset = await createFreshChatSession(firmId);
          if (disposedRef.current) return;
          cid = preset.conversation_id;
          conversationIdRef.current = cid;
          setConversationId(cid);
          persistConversationId(firmId, cid);
        } else if (preset && !cid) {
          cid = preset.conversation_id;
          conversationIdRef.current = cid;
        }
        const s = await createSocket({
          // A peer tab started a fresh chat → follow it to the same new id.
          onRemoteNewChat: (id) => adoptNewChatRef.current(id),
          // The server handed back a DIFFERENT conversation id than we asked to
          // resume — either the stored chat was finished (it minted a fresh empty
          // one) or the stored id was dead and a known visitor_id resolved to the
          // visitor's live conversation. Adopt it (persist + ref/store), drop the
          // transcript rehydrated for the old id, and pull the ADOPTED one's
          // history: empty for a fresh replacement, the real thread for a resumed
          // live one. rehydrate upserts on hist# ids, so it's safe racing the room
          // join. No reconnect — we're already joining the correct room.
          onConversationId: (id) => {
            if (!id || id === conversationIdRef.current) return;
            conversationIdRef.current = id;
            setConversationId(id);
            persistConversationId(firmId, id);
            useWidgetStore.getState().resetConversation();
            void rehydrateFromHistory(id);
          },
          // Track whether THIS tab owns the live connection, so agent-driven
          // "new chat" is handled once (by the leader), not by every tab.
          onRoleChange: (isLeader) => useWidgetStore.getState().setSessionLeader(isLeader),
          // Surface a leader connection failure the same way a direct one did.
          onError: (msg) => { if (!disposedRef.current) setBootStatus('error', msg); },
          // The live connection dropped (agent left / idle / network) → reconnect
          // and resume, so the chat doesn't go dead with no way back to the agent.
          onDisconnect: () => reconnectResumeRef.current(),
          // A pre-minted room (cold mint above, or a "start new chat") → join directly.
          presetSession: preset,
        });
        if (disposedRef.current) { s.disconnect(); return; }
        socketRef.current = s;
        unwireRef.current = wireSocketToStore(s);
        setSocket(s); // expose before connect so a buffered pick can queue
        await s.connect(firmId, cid as string);
        if (disposedRef.current) return;
        bridgeRef.current?.notifyEvent({ type: 'widget_opened', data: { firmId, conversationId: cid } });
      } catch (err) {
        if (disposedRef.current) return;
        setBootStatus('error', err instanceof Error ? err.message : 'Connection failed');
      } finally {
        connectingRef.current = false;
      }
    })();
  }, [firmId, setBootStatus, setConversationId]);

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

  // Boot fetches /config (paints the opener + case-type chips). The conversation
  // id is READ-ONLY here — we never mint one on the client (guide §1); the server
  // mints it on the first /token (cold visit connects when the chat view opens; a
  // returning id resumes below). A Free Consultation hand-off connects right away
  // (its answers seed the first /token so the agent acknowledges the accident).
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
    const ctx = getConsultationContext();
    const stored = readStoredConversationId(firmId);
    let storedId = stored.id;
    let returning = stored.returning;
    // Free-Consultation hand-off: a case type was chosen in the wizard. Chats are
    // stateful now, so injecting that case type into a persisted conversation is
    // wrong — picking a NEW case type must open a BRAND-NEW chat seeded with it.
    // We key on the wizard answers: a different case type ⇒ start fresh (drop the
    // stored id so connectSocket cold-mints a new conv whose first /token carries
    // the ctx). The SAME answers on a reload keep the stored id, so a refresh
    // resumes the chat we already started for that consultation (no chat-per-reload).
    if (ctx && consultationKey(ctx) !== readHandoffKey(firmId)) {
      clearConversationId(firmId);
      writeHandoffKey(firmId, consultationKey(ctx));
      storedId = null;
      returning = false;
    }
    conversationIdRef.current = storedId; // null on a cold first visit / new case type
    setConversationId(storedId);
    // Consultation hand-off: the case type is already chosen, so connect now — a
    // new case type cold-mints (its answers seed the first /token so the agent
    // acknowledges them); a matching reload resumes the chat we already started.
    if (ctx) connectSocket();

    // ── Config track — paints the opener ─────────────────────────────────
    void (async () => {
      try {
        // Best-guess the visitor's language before we know the firm's offered set
        // (the backend falls back if it isn't offered), so the first video is
        // already language-matched. The picker re-fetches on a later change.
        const navLang = (typeof navigator !== 'undefined' ? navigator.language : 'en')
          .slice(0, 2)
          .toLowerCase();
        const config = await loadBootConfig(firmId, navLang, abort.signal);
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
        if (returning && storedId) {
          const resumed = await rehydrateFromHistory(storedId, abort.signal);
          if (cancelled) return;
          if (resumed.notFound) {
            // The stored id has no server conversation (a stale client-minted id
            // from before this change). Drop it and carry on as a cold visit —
            // the server mints a fresh one when the chat view opens. Guide §2-§3.
            clearConversationId(firmId);
            conversationIdRef.current = null;
            setConversationId(null);
          } else {
            // Reopened a real conversation → drop straight into the chat (not the
            // home opener) and reconnect the live agent so it resumes at the next
            // question. Connect whenever the conversation is real — it has messages
            // OR the backend still calls it active. An ended conversation shows the
            // transcript without reconnecting. This "always connect on open" is
            // what keeps resume working (session-persistence guide Rule 1).
            const resumable = resumed.messageCount > 0 || resumed.status === 'active';
            if (resumable) {
              const st = useWidgetStore.getState();
              st.setConnectView('chat');
              st.setCaseTypePicked(true);
              st.setConversationStarted(true);
              if (resumed.status !== 'ended') connectSocket();
            }
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

  // Language swap: when the visitor picks a different language, re-fetch
  // /config?language= so the intro / channel videos (+ posters + captions +
  // compliance copy) become the language-matched clip. We DON'T re-run boot or
  // touch the conversation — just swap the config-derived fields. The first
  // post-boot language is the baseline, so this only fires on a picker change.
  useEffect(() => {
    if (bootStatus !== 'ready') return undefined;
    if (langBaselineRef.current === null) {
      langBaselineRef.current = language; // establish baseline; no fetch on boot
      return undefined;
    }
    if (langBaselineRef.current === language) return undefined;
    langBaselineRef.current = language;
    const abort = new AbortController();
    void (async () => {
      try {
        const fresh = await loadBootConfig(firmId, language, abort.signal);
        if (!abort.signal.aborted) useWidgetStore.getState().applyLanguageConfig(fresh);
      } catch {
        /* keep the current video on failure — never blank the slot */
      }
    })();
    return () => abort.abort();
  }, [language, bootStatus, firmId]);

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

  // Reset to a fresh conversation `freshId` and RECONNECT immediately so the
  // agent opens the intake. `presetSession` is the just-minted session from a
  // "start new chat" (POST /token {new_chat:true}); the leader joins THAT room so
  // the agent's fresh-intake opener isn't lost. A follower adopting a peer's new
  // chat passes no preset (it resumes by id / relays). Reconnecting is the half
  // that was missing — disconnect-without-reconnect is the new-chat bug.
  const resetToConversation = useCallback(
    (freshId: string, presetSession?: ConversationTokenResponse) => {
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
      st.setPendingCaseType(null);
      st.setConnectCallStatus(null);
      // Fresh conversation: this tab leads again until the next connect re-elects.
      st.setSessionLeader(true);
      // Never let a stale start_new_intake re-fire against the new conversation.
      handledIntakeNonce.current = st.newIntakeNonce;

      conversationIdRef.current = freshId;
      setConversationId(freshId);

      // Connect NOW (new_chat:true already minted the room + new Call+Lead) so the
      // agent is live, AND show the fresh case-type opener. The case-type pick is
      // what reliably starts the agent's intake — same as a first chat — so this
      // works whether or not the agent also auto-opens on the fresh connect. (When
      // the backend does auto-open, that message just shows above the opener.)
      st.setConnectView('chat');
      st.setCaseTypePicked(false);
      st.setConversationStarted(false);
      // eslint-disable-next-line no-console
      console.info('[famaash] new chat → fresh opener + connect on', freshId);
      connectSocket(presetSession);
    },
    [setConversationId, connectSocket],
  );

  // "Start a new chat" (header button, or the leader acting on start_new_intake):
  // the SERVER mints the fresh conversation + agent (new_chat:true); we join the
  // minted room and tell peers to follow. The old conversation is preserved.
  const startNewChat = useCallback(async () => {
    let session: ConversationTokenResponse;
    try {
      session = await createFreshChatSession(firmId, { newChat: true });
    } catch (err) {
      if (!disposedRef.current) {
        setBootStatus('error', err instanceof Error ? err.message : 'Could not start a new chat');
      }
      return;
    }
    // Notify peers on the OLD conversation BEFORE tearing its socket down.
    socketRef.current?.notifyNewChat?.(session.conversation_id);
    persistConversationId(firmId, session.conversation_id);
    resetToConversation(session.conversation_id, session);
  }, [firmId, resetToConversation, setBootStatus]);

  // A peer tab started a new chat → adopt the SAME fresh id so all tabs share the
  // new conversation, and persist it so a reload resumes that one. No preset: the
  // initiator already minted it, so this tab resumes by id (or follows the leader).
  const adoptNewChat = useCallback((freshId: string) => {
    if (freshId === conversationIdRef.current) return;
    persistConversationId(firmId, freshId);
    resetToConversation(freshId);
  }, [firmId, resetToConversation]);
  useEffect(() => {
    adoptNewChatRef.current = adoptNewChat;
  }, [adoptNewChat]);

  // Reconnect + resume the CURRENT conversation: tear down the dead socket, re-pull
  // the transcript, and reconnect (POST /token with the same id → the agent
  // resumes at the next question). Used when the live connection drops and when
  // re-entering the chat view without a live socket, so the chat never sits dead
  // with no agent. `force` bypasses the auto-drop rate-limit for user-driven entry.
  const reconnectResume = useCallback(
    (force = false) => {
      if (disposedRef.current) return;
      const cid = conversationIdRef.current;
      if (!cid) return;
      const now = Date.now();
      if (!force && now - reconnectGuardRef.current < 4000) return; // avoid drop→reconnect loops
      reconnectGuardRef.current = now;

      unwireRef.current?.();
      unwireRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
      connectingRef.current = false;
      setSocket(null);

      // Resume does NOT mean the agent is about to speak — it usually just
      // reconnects and waits for the lead's next message. Showing typing dots
      // here left them bouncing with nothing behind them until the 30s safety
      // timer expired (bad UX). Clear any stale typing state instead; a real
      // message_chunk from the agent re-arms the indicator on its own.
      useWidgetStore.getState().endStreaming();
      // eslint-disable-next-line no-console
      console.info('[famaash] resuming chat on', cid);
      void (async () => {
        try {
          await rehydrateFromHistory(cid);
        } catch {
          /* keep whatever is already in the store */
        }
        if (disposedRef.current) return;
        connectSocket();
      })();
    },
    [connectSocket],
  );
  useEffect(() => {
    reconnectResumeRef.current = () => reconnectResume(false);
  }, [reconnectResume]);

  // Resume when re-entering the chat view without a live connection (e.g. after a
  // trip to the home menu during which the connection dropped). Skips the fresh
  // opener (no case type yet → the pick connects) and any case where a socket is
  // already up, so it only fills a genuine gap.
  useEffect(() => {
    if (bootStatus !== 'ready' || connectView !== 'chat') return;
    const st = useWidgetStore.getState();
    if (!st.caseTypePicked) return;
    if (socketRef.current || connectingRef.current) return;
    reconnectResume(true);
  }, [connectView, bootStatus, reconnectResume]);

  // The agent can ask to start a fresh intake (a typed "start a new chat"). The
  // relayed event bumps this nonce in EVERY tab, so gate on leadership: only the
  // leader mints + broadcasts; follower tabs adopt via onRemoteNewChat instead of
  // each minting their own id.
  const newIntakeNonce = useWidgetStore((s) => s.newIntakeNonce);
  const isSessionLeader = useWidgetStore((s) => s.isSessionLeader);
  useEffect(() => {
    if (newIntakeNonce > handledIntakeNonce.current && isSessionLeader) {
      handledIntakeNonce.current = newIntakeNonce;
      void startNewChat();
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
