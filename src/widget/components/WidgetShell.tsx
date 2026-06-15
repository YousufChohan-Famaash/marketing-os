import { useEffect, useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { shouldShowCinematic } from '../config/connect';
import { CaptureDrawer } from './CaptureDrawer';
import { CaptureProgress } from './CaptureProgress';
import { ChannelView } from './ChannelView';
import { ChatHeader } from './ChatHeader';
import { CinematicOpen } from './CinematicOpen';
import { Composer, type ComposerHandle } from './Composer';
import { ConnectHome } from './ConnectHome';
import { IntroStage } from './IntroStage';
import { MessageList } from './MessageList';
import { PoweredByFooter } from './PoweredByFooter';
import { SafetyButtons } from './SafetyButtons';

interface WidgetShellProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

export function WidgetShell({ onClose, onMinimize, onExpand, isExpanded }: WidgetShellProps) {
  const composerRef = useRef<ComposerHandle>(null);
  const bootStatus = useWidgetStore((s) => s.bootStatus);
  const bootError = useWidgetStore((s) => s.bootError);
  // The opener (greeting + case-type chips) shows until the lead picks a case
  // type — that pick is the first user message that starts the agent flow.
  const caseTypePicked = useWidgetStore((s) => s.caseTypePicked);
  // Which Connect surface is showing (home menu vs. a routed channel).
  const connectView = useWidgetStore((s) => s.connectView);
  const setConnectView = useWidgetStore((s) => s.setConnectView);
  const backToHome = () => setConnectView('home');
  // Cinematic full-screen open plays over the home menu, then settles into it.
  const connect = useWidgetStore((s) => s.connect);
  const conversationStarted = useWidgetStore((s) => s.conversationStarted);
  const cinematicDismissed = useWidgetStore((s) => s.cinematicDismissed);
  const showCinematic = shouldShowCinematic(connect, {
    connectView,
    conversationStarted,
    cinematicDismissed,
  });

  // Focus management — push focus to the composer once we're into the chat.
  useEffect(() => {
    if (bootStatus === 'ready' && connectView === 'chat' && caseTypePicked) {
      composerRef.current?.focus();
    }
  }, [bootStatus, connectView, caseTypePicked]);

  // Esc closes the widget.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (bootStatus === 'loading' || bootStatus === 'idle') {
    return (
      <div className="flex h-full items-center justify-center bg-bg p-6 text-center text-muted">
        <p className="text-[13px]">Connecting…</p>
      </div>
    );
  }

  if (bootStatus === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-bg p-6 text-center">
        <p className="text-[14px] font-semibold text-ink">
          We can't reach the chat right now.
        </p>
        <p className="mt-2 text-[12px] text-muted">{bootError ?? 'Please try again.'}</p>
      </div>
    );
  }

  // ── Connect launcher home menu ─────────────────────────────────────────────
  if (connectView === 'home') {
    return (
      <div className="relative h-full w-full">
        <ConnectHome onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
        {showCinematic && <CinematicOpen />}
      </div>
    );
  }

  // ── Routed contact channels (reversible → back to the menu) ────────────────
  if (connectView === 'call' || connectView === 'text' || connectView === 'schedule') {
    return (
      <ChannelView
        channel={connectView}
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
        isExpanded={isExpanded}
      />
    );
  }

  // ── Chat channel: case-type opener, then the conversation ──────────────────
  if (!caseTypePicked) {
    return (
      <IntroStage
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
        isExpanded={isExpanded}
        onBack={backToHome}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg">
      <ChatHeader onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} onBack={backToHome} />
      <div className="flex justify-center pb-1">
        <CaptureProgress />
      </div>
      <CaptureDrawer />
      <MessageList />
      <SafetyButtons />
      <Composer ref={composerRef} />
      <PoweredByFooter />
    </div>
  );
}
