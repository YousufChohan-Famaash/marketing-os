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
  // The opener (greeting + case-type chips) shows until the lead picks a case
  // type — that pick is the first user message that starts the agent flow.
  const caseTypePicked = useWidgetStore((s) => s.caseTypePicked);

  // Focus management — push focus to the composer once we're into the chat.
  useEffect(() => {
    if (bootStatus === 'ready' && caseTypePicked) {
      composerRef.current?.focus();
    }
  }, [bootStatus, caseTypePicked]);

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

  if (!caseTypePicked) {
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
