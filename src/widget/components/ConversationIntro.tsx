import { useRef } from "react";
import { useWidgetStore } from "../store/widgetStore";
import { resolveAssistantAvatar, resolveViewVideo } from "../config/demoMedia";
import { ChevronLeftIcon, VolumeOffIcon, VolumeOnIcon } from "../utils/icons";
import { useVideoSound } from "../utils/useVideoSound";
import { Avatar } from "./Avatar";
import { WidgetControls } from "./WidgetControls";

/** Header controls overlaid on the intro video (so they scroll away with it). */
export interface IntroControls {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
  onBack?: () => void;
}

/**
 * The intro video pinned at the top of the conversation scroll. It keeps its
 * full opener size (565:728) and simply scrolls up as messages accumulate —
 * it does NOT shrink into a message bubble. A play button lets the lead scroll
 * back up and replay it in the chat. When `controls` is passed they overlay the
 * video (instead of a separate header bar) and scroll out of view with it.
 */
export function ConversationIntro({ controls }: { controls?: IntroControls }) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const assistantName =
    branding?.assistantName ?? branding?.name ?? "Assistant";
  const assistantAvatar = resolveAssistantAvatar(branding?.assistantAvatarUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { soundOn, toggleSound } = useVideoSound(videoRef);

  // The in-chat clip (its own per-view video, falling back to the intro).
  const video = resolveViewVideo("chat", settings, branding);
  const videoUrl = video?.url;
  const posterUrl = video?.poster;

  if (!videoUrl) return null;

  return (
    // -mt-3 cancels the MessageList's top padding (py-3) so the video sits flush
    // against the panel's top edge, no white gap above it (per CEO feedback).
    <div className="-mt-3 flex flex-col gap-4 pb-2">
      {/* Portrait clip, narrower than the panel and centered so more of the
          frame shows (less side-cropping of the person). */}
      <div className="relative mx-auto aspect-[565/728] max-h-[440px] w-full max-w-[340px] overflow-hidden rounded-2xl bg-obsidian">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          playsInline
          loop
          preload="metadata"
          className="block h-full w-full object-cover"
          aria-label="Introduction video"
        />
        {/* Mute / unmute toggle (shared across every video), bottom-right. */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? 'Mute video' : 'Unmute video'}
          className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          {soundOn ? <VolumeOnIcon size={18} /> : <VolumeOffIcon size={18} />}
        </button>
        {/* Controls overlay the video and scroll away with it. */}
        {controls && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
            {controls.onBack ? (
              <button
                type="button"
                onClick={controls.onBack}
                aria-label="Back to all options"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-ink-soft backdrop-blur transition-colors hover:bg-white/90"
              >
                <ChevronLeftIcon size={18} />
              </button>
            ) : (
              <span className="h-8 w-8" />
            )}
            <WidgetControls
              tone="overlay"
              onClose={controls.onClose}
              onMinimize={controls.onMinimize}
              onExpand={controls.onExpand}
              isExpanded={controls.isExpanded}
            />
          </div>
        )}
      </div>
      <div className="flex w-full items-start gap-3">
        <div className="relative shrink-0">
          <Avatar src={assistantAvatar} name={assistantName} size={40} />
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#1A1A1A]">
            Let&apos;s talk about it
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            {/* I&apos;m {firmName}&apos;s AI assistant, and a real person takes it
            from here. */}
            Chat with us! You can also continue this on your phone or schedule a
            call with one of our experts.
          </p>
        </div>
      </div>
    </div>
  );
}
