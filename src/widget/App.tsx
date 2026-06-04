import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ConsentModal } from './components/ConsentModal';
import { ModalHost } from './components/ModalHost';
import { SigningSheet } from './components/SigningSheet';
import { WidgetErrorFallback } from './components/WidgetErrorFallback';
import { WidgetShell } from './components/WidgetShell';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const bridgeRef = useRef<HostBridgeClient | null>(null);

  const firmId = useMemo(readFirmIdFromQuery, []);

  // Boot: config → (resume history) → PAINT opener → connect in the background.
  useEffect(() => {
    let disposed = false;
    let localSocket: ConversationSocket | null = null;
    let unwire: (() => void) | null = null;
    const abort = new AbortController();

    (async () => {
      setBootStatus('loading');
      try {
        const config = await loadBootConfig(firmId, abort.signal);
        if (disposed) return;
        setBootConfig(config);

        // Persisted per-firm id so a refresh resumes the same conversation
        // (/token is idempotent). Returning visitors repaint their transcript.
        const { id: conversationId, returning } = getOrCreateConversationId(firmId);
        setConversationId(conversationId);
        if (returning) {
          await rehydrateFromHistory(conversationId, abort.signal);
          if (disposed) return;
        }

        // Paint the opener (video + greeting + chips) NOW — don't wait for the
        // LiveKit connection. The pick is buffered and flushed once we connect.
        setBootStatus('ready');

        localSocket = await createSocket(config);
        if (disposed) {
          localSocket.disconnect();
          return;
        }
        unwire = wireSocketToStore(localSocket);
        // Expose the socket before connect so a buffered pick can be queued.
        setSocket(localSocket);

        // Host bridge with origin allow-list from boot config.
        bridgeRef.current = createHostBridge(
          {
            onOpen: () => openWidget(),
            onClose: () => closeWidget(),
            onMinimize: () => closeWidget(),
          },
          config.allowedOrigins ?? [],
        );

        await localSocket.connect(firmId, conversationId);
        if (disposed) return;
        notifyHostEvent({ type: 'widget_opened', data: { firmId, conversationId } });
      } catch (err) {
        if (disposed) return;
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
    setIsExpanded(next);
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
