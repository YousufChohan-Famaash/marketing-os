import { useCallback, useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCinematicVideo, resolveViewVideo } from '../config/demoMedia';
import { CaptureDrawer } from './CaptureDrawer';
import { CaptureProgress } from './CaptureProgress';
import { ChannelView } from './ChannelView';
import { ChannelMorphVideo } from './ChannelMorphVideo';
import { ChatDisclosure } from './ChatDisclosure';
import { ChatHeader } from './ChatHeader';
import { CinematicHome } from './CinematicHome';
import { Composer, type ComposerHandle } from './Composer';
import { ConnectingState } from './ConnectingState';
import { ConnectHome } from './ConnectHome';
import { MessageList } from './MessageList';
import { PoweredByFooter } from './PoweredByFooter';
import { SafetyButtons } from './SafetyButtons';
import { VideoLightbox } from './VideoLightbox';

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

  // In-chat video: full-width stage on entry that collapses into the header
  // avatar (same morph as the contact screens). Tapping the collapsed thumbnail
  // opens the lightbox. Only present when the firm has a chat clip.
  const hasChatMorph =
    connectView === 'chat' && Boolean(resolveViewVideo('chat', connect, branding));
  const [stageOpen, setStageOpen] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const collapseStage = useCallback(() => setStageOpen(false), []);
  // The video is edge-to-edge (v12) while the stage is open: it fills the top of
  // the panel and the header floats over it transparently. CHAT_HEADER_H must
  // match the header height so the panel's top padding clears the floating header.
  const CHAT_HEADER_H = 52;
  const stageActive = hasChatMorph && stageOpen;

  // Expand the stage only on a FRESH chat (before a case type is picked).
  // Returning to an already-started conversation keeps it collapsed, so the big
  // video doesn't slam back over the composer/messages on re-entry.
  useEffect(() => {
    if (connectView === 'chat' && !caseTypePicked) setStageOpen(true);
  }, [connectView, caseTypePicked]);
  // Auto-collapse after a beat, and the moment the lead engages (picks a type).
  useEffect(() => {
    if (!hasChatMorph || !stageOpen) return;
    const t = setTimeout(() => setStageOpen(false), 5000);
    return () => clearTimeout(t);
  }, [hasChatMorph, stageOpen]);
  useEffect(() => {
    if (caseTypePicked) setStageOpen(false);
  }, [caseTypePicked]);

  // Focus the composer once we're into the chat — but NOT on touch devices.
  // Auto-focusing there force-opens the on-screen keyboard the instant a case
  // type is picked, and iOS's fixed-iframe + keyboard handling then shoves the
  // panel into a broken state (blank gap, content scrolled above the keyboard).
  // Let mobile visitors tap the field when they're ready.
  useEffect(() => {
    if (bootStatus !== 'ready' || connectView !== 'chat' || !caseTypePicked) return;
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse) return;
    composerRef.current?.focus();
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

  // ── Chat channel ───────────────────────────────────────────────────────────
  // The case-type opener (greeting + pills) now renders INSIDE the chat itself
  // (MessageList → ConversationIntro + ChatOpenerChips), not a separate screen.
  // The conversation chrome (capture, safety, disclosure, composer) appears once
  // a case type is picked and the agent flow starts.
  return (
    <div
      className="fa-view-in relative flex h-full w-full flex-col overflow-hidden bg-bg"
      style={{ paddingTop: CHAT_HEADER_H }}
    >
      {/* Edge-to-edge video (v12): full-width stage flush to the top that morphs
          into the header slot on collapse; tap it (collapsed) to open the lightbox.
          Rendered before the header so the header floats on top of it. */}
      {hasChatMorph && (
        <ChannelMorphVideo
          view="chat"
          collapsed={!stageOpen}
          fullBleed
          headerH={CHAT_HEADER_H}
          avatarLeft={52}
          avatarTop={10}
          avatar={32}
          stageH={300}
          onThumbClick={() => setLightboxOpen(true)}
          paused={lightboxOpen}
        />
      )}
      {/* Floats over the video while the stage is open (transparent), reverts to
          the solid bar with the collapsed avatar once it tucks away. */}
      <ChatHeader
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
        isExpanded={isExpanded}
        onBack={backToHome}
        hasMorph={hasChatMorph}
        solid={!stageActive}
        className="absolute inset-x-0 top-0 z-30"
      />
      {caseTypePicked && (
        <div className="flex justify-center pb-1">
          <CaptureProgress />
        </div>
      )}
      {caseTypePicked && <CaptureDrawer />}
      {/* The opener (greeting + case-type pills) lives inside the list until a
          type is picked; the conversation chrome stays visible throughout. */}
      <MessageList
        topSpacerHeight={hasChatMorph ? (stageOpen ? 300 : 0) : undefined}
        onInteract={collapseStage}
      />
      <SafetyButtons />
      <ChatDisclosure />
      <Composer ref={composerRef} onFocus={collapseStage} />
      <PoweredByFooter />
      {lightboxOpen && (
        <VideoLightbox
          view="chat"
          onClose={() => setLightboxOpen(false)}
          onCall={() => {
            setLightboxOpen(false);
            setConnectView('call');
          }}
          onChat={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
