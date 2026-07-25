import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCinematicVideo, resolveIntroVideo } from '../config/demoMedia';
import { CaptureDrawer } from './CaptureDrawer';
import { CaptureProgress } from './CaptureProgress';
import { ChannelView } from './ChannelView';
import { ChatDisclosure } from './ChatDisclosure';
import { ChatHeader } from './ChatHeader';
import { CinematicHome } from './CinematicHome';
import { Composer, type ComposerHandle } from './Composer';
import { ConnectingState } from './ConnectingState';
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
  // The looping cinematic video IS the home entry. Without a real video we fall
  // back to the classic menu, so a firm with no video never sees a black panel.
  const connect = useWidgetStore((s) => s.connect);
  const branding = useWidgetStore((s) => s.branding);
  const cinematicVideo = resolveCinematicVideo(
    connect.videoMode,
    branding?.introVideoUrl,
    connect.storyVideoUrl,
  );

  // Scroll-aware chat header: transparent (overlaid on the intro video) while
  // the video is in view, solid white once it scrolls away. Only the chat with
  // an intro video overlays; without a video the header is always solid.
  const hasIntroVideo = Boolean(resolveIntroVideo(branding?.introVideoUrl));
  const [pastVideo, setPastVideo] = useState(false);
  const headerSolid = !hasIntroVideo || pastVideo;

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

  // Fail closed: the firm doesn't have the chat_widget module — render nothing.
  if (bootStatus === 'disabled') {
    return null;
  }

  if (bootStatus === 'loading' || bootStatus === 'idle') {
    return <ConnectingState />;
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

  // ── Home entry: the cinematic video (looping), or the classic menu fallback ──
  if (connectView === 'home') {
    return (
      <div className="fa-view-in relative h-full w-full">
        {cinematicVideo ? (
          <CinematicHome onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
        ) : (
          <ConnectHome onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
        )}
      </div>
    );
  }

  // ── Routed contact channels (reversible → back to the menu) ────────────────
  if (
    connectView === 'call' ||
    connectView === 'text' ||
    connectView === 'schedule' ||
    connectView === 'email'
  ) {
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
    <div className="fa-view-in relative flex h-full w-full flex-col overflow-hidden bg-bg">
      <ChatHeader
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
        isExpanded={isExpanded}
        onBack={backToHome}
        solid={headerSolid}
        className={hasIntroVideo ? 'absolute inset-x-0 top-0 z-30' : undefined}
      />
      {hasIntroVideo ? (
        // Capture pill floats below the overlay header so it doesn't take space.
        <div className="pointer-events-none absolute inset-x-0 top-[52px] z-20 flex justify-center">
          <div className="pointer-events-auto">
            <CaptureProgress />
          </div>
        </div>
      ) : (
        <div className="flex justify-center pb-1">
          <CaptureProgress />
        </div>
      )}
      <CaptureDrawer />
      <MessageList onScrolledChange={hasIntroVideo ? setPastVideo : undefined} />
      <SafetyButtons />
      <ChatDisclosure />
      <Composer ref={composerRef} />
      <PoweredByFooter />
    </div>
  );
}
