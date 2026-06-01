import { useEffect, useRef } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { CaptureDrawer } from './CaptureDrawer';
import { CaptureProgress } from './CaptureProgress';
import { ChatHeader } from './ChatHeader';
import { Composer, type ComposerHandle } from './Composer';
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
  const introCompleted = useWidgetStore(
    (s) => s.capturedFields.practice_area !== undefined,
  );
  const introEnabled = useWidgetStore(
    (s) => Boolean(s.branding?.introVideoUrl) && Boolean(s.flags?.video_intro),
  );

  // Focus management — push focus to the composer once we're past intro.
  useEffect(() => {
    if (bootStatus === 'ready' && (introCompleted || !introEnabled)) {
      composerRef.current?.focus();
    }
  }, [bootStatus, introCompleted, introEnabled]);

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

  if (introEnabled && !introCompleted) {
    return <IntroStage onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg">
      <ChatHeader onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
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
