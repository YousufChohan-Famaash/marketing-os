import { useEffect, useRef, useState } from "react";
import { useWidgetStore } from "../store/widgetStore";
import { resolveIntroVideo } from "../config/demoMedia";
import { CHANNEL_META, rankChannels } from "../config/connect";
import type { ConnectChannel } from "../types/domain";
import {
  CalendarIcon,
  ChatIcon,
  CloseIcon,
  MailIcon,
  PhoneIcon,
  SmartphoneIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "../utils/icons";
import { cn } from "../utils/cn";

const CHANNEL_ICON: Record<ConnectChannel, typeof PhoneIcon> = {
  call: PhoneIcon,
  chat: ChatIcon,
  text: SmartphoneIcon,
  schedule: CalendarIcon,
  email: MailIcon,
};
const SHORT: Record<ConnectChannel, string> = {
  call: "Call",
  chat: "Chat",
  text: "Text",
  schedule: "Schedule",
  email: "Email",
};

/**
 * Cinematic full-screen open (admin `fullscreenOpen`): the attorney video plays
 * across the whole panel on open, with next-step quick actions overlaid, then
 * fades and settles into the home menu underneath. Skipping, picking a channel,
 * or the video ending all dismiss it. Shown once per open.
 */
export function CinematicOpen() {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const setConnectView = useWidgetStore((s) => s.setConnectView);
  const dismissCinematic = useWidgetStore((s) => s.dismissCinematic);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [closing, setClosing] = useState(false);

  const src =
    settings.videoMode === "story"
      ? (settings.storyVideoUrl ?? resolveIntroVideo(branding?.introVideoUrl))
      : resolveIntroVideo(branding?.introVideoUrl);
  const name = branding?.assistantName ?? branding?.name ?? "our team";
  const channels = rankChannels(settings).slice(0, 4);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, []);

  const settle = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => dismissCinematic(), 380);
  };

  const pick = (id: ConnectChannel) => {
    setConnectView(id);
    settle();
  };

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = soundOn;
    setSoundOn(!soundOn);
    if (v.paused) void v.play();
  };

  return (
    <div
      className={cn(
        "absolute inset-0 z-[60] overflow-hidden bg-black transition-[opacity,transform] duration-[380ms] ease-out",
        closing ? "scale-[1.04] opacity-0" : "opacity-100",
      )}
      role="dialog"
      aria-label={`Welcome video from ${name}`}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        onEnded={settle}
      />

      {/* Skip */}
      <button
        type="button"
        onClick={settle}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur hover:bg-black/60"
      >
        Skip <CloseIcon size={13} aria-hidden="true" />
      </button>

      {/* Sound toggle */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? "Mute" : "Unmute"}
        className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
      >
        {soundOn ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
      </button>

      {/* Caption + next-step quick actions */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-16">
        <p className="text-[19px] font-bold leading-tight text-white">
          Meet {name}
        </p>
        <p className="mt-0.5 text-[12.5px] text-white/80">
          A quick hello — pick how you'd like to talk.
        </p>
        <div className="mt-3 flex gap-2">
          {channels.map((id) => {
            const Icon = CHANNEL_ICON[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                aria-label={CHANNEL_META[id].label}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/25 bg-white/10 px-1 py-2 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <Icon size={18} aria-hidden="true" />
                <span className="text-[10px] font-semibold">{SHORT[id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/20">
        <div
          className="h-full bg-famaash transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
