import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ModalHost } from './components/ModalHost';
import { WidgetErrorFallback } from './components/WidgetErrorFallback';
import { WidgetShell } from './components/WidgetShell';
import { fetchBootConfig } from './services/mockBootConfig';
import { createHostBridge, type HostBridgeClient } from './services/hostBridge';
import { MockSocket } from './services/mockSocket';
import { SocketContext } from './services/socketContext';
import { useWidgetStore } from './store/widgetStore';
import { wireSocketToStore } from './store/wireSocket';
import type { AnalyticsEvent, ConversationSocket } from './types/protocol';
import { generateId } from './utils/id';

function readFirmIdFromQuery(): string {
  if (typeof window === 'undefined') return 'firm_famaash_demo';
  const params = new URLSearchParams(window.location.search);
  return params.get('firm_id') ?? 'firm_famaash_demo';
}

export function App() {
  const setBootConfig = useWidgetStore((s) => s.setBootConfig);
  const setBootStatus = useWidgetStore((s) => s.setBootStatus);
  const openWidget = useWidgetStore((s) => s.openWidget);
  const closeWidget = useWidgetStore((s) => s.closeWidget);
  const isWidgetOpen = useWidgetStore((s) => s.isWidgetOpen);

  const [socket, setSocket] = useState<ConversationSocket | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const bridgeRef = useRef<HostBridgeClient | null>(null);

  const firmId = useMemo(readFirmIdFromQuery, []);

  // Boot: fetch config → spin up socket → wire to store → init host bridge.
  useEffect(() => {
    let disposed = false;
    let localSocket: ConversationSocket | null = null;
    let unwire: (() => void) | null = null;

    (async () => {
      setBootStatus('loading');
      try {
        const config = await fetchBootConfig(firmId);
        if (disposed) return;
        setBootConfig(config);

        const conversationId = generateId('conv');
        localSocket = new MockSocket(config);
        unwire = wireSocketToStore(localSocket);
        await localSocket.connect(firmId, conversationId);
        if (disposed) return;
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

        setBootStatus('ready');
        notifyHostEvent({ type: 'widget_opened', data: { firmId, conversationId } });
      } catch (err) {
        if (disposed) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setBootStatus('error', message);
      }
    })();

    return () => {
      disposed = true;
      unwire?.();
      localSocket?.disconnect();
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, [firmId, setBootConfig, setBootStatus, openWidget, closeWidget]);

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
        </div>
      </SocketContext.Provider>
    </ErrorBoundary>
  );
}
