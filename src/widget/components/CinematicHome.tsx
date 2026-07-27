import { Fragment, useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { resolveCinematicVideo } from '../config/demoMedia';
import { CHANNEL_META, rankChannels } from '../config/connect';
import type { ConnectChannel } from '../types/domain';
import { cn } from '../utils/cn';
import {
  CalendarIcon,
  ChatIcon,
  PhoneIcon,
  SmartphoneIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from '../utils/icons';
import { useVideoSound } from '../utils/useVideoSound';
import { WidgetControls, languageName } from './WidgetControls';

const CHANNEL_ICON: Record<ConnectChannel, typeof PhoneIcon> = {
  call: PhoneIcon,
  chat: ChatIcon,
  text: SmartphoneIcon,
  schedule: CalendarIcon,
  email: PhoneIcon,
};
const SHORT: Record<ConnectChannel, string> = {
  call: 'Call',
  chat: 'Chat',
  text: 'Text',
  schedule: 'Book',
  email: 'Email',
};

interface CinematicHomeProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

/**
 * The persistent cinematic home: the attorney video fills the panel and LOOPS
 * (it never auto-advances). "Call me now" is the full-width primary; Chat / Text
 * / Book sit in a secondary row with the accordion hover (hovered one widens to
 * its full label, the others ease to icon-only). Picking any option routes to
 * that channel's screen. Replaces the old menu as the entry when a video exists.
 */
export function CinematicHome({ onClose, onMinimize, onExpand, isExpanded }: CinematicHomeProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { soundOn, toggleSound } = useVideoSound(videoRef);
  const setVideoSoundOn = useWidgetStore((s) => s.setVideoSoundOn);
  const [hovered, setHovered] = useState<ConnectChannel | null>(null);

  // Language + email affordances shown in the bottom meta row.
  const language = useWidgetStore((s) => s.language);
  const languages = useWidgetStore((s) => s.languages);
  const setLanguage = useWidgetStore((s) => s.setLanguage);
  const multiLanguage = Boolean(useWidgetStore((s) => s.flags?.multi_language)) && languages.length > 1;
  const emailEnabled = settings.channels.includes('email');

  const src = resolveCinematicVideo(settings.videoMode, branding?.introVideoUrl, settings.storyVideoUrl);
  const name = branding?.name ?? 'our team';

  // Captions: the WebVTT track for the active language (English, then the only
  // track, as fallbacks). Shown burned-in over the video, on by default since
  // the video autoplays. Backend-owned — absent until the captions spec ships.
  const caps = branding?.introVideoCaptions;
  const captionsUrl = caps?.[language] ?? caps?.en ?? (caps ? Object.values(caps)[0] : undefined);
  const [caption, setCaption] = useState('');
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !captionsUrl) {
      setCaption('');
      return;
    }
    const track = v.textTracks[0];
    if (!track) return;
    track.mode = 'hidden'; // render cues ourselves (positioned above the actions)
    const onCue = () => {
      const cue = track.activeCues && (track.activeCues[0] as VTTCue | undefined);
      setCaption(cue ? cue.text.replace(/<[^>]+>/g, '') : '');
    };
    track.addEventListener('cuechange', onCue);
    return () => track.removeEventListener('cuechange', onCue);
  }, [captionsUrl]);

  // Primary is Call; the rest (chat / text / book, never email) are secondary.
  const enabled = rankChannels(settings);
  const primary: ConnectChannel = enabled.includes('call') ? 'call' : enabled[0] ?? 'call';
  const secondary = enabled.filter((c) => c !== primary && c !== 'email').slice(0, 3);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play();
  };

  // Minimizing hides the panel but keeps it mounted, so silence every video (any
  // sound the visitor turned on) — it shouldn't keep talking from a hidden panel.
  const handleMinimize = () => {
    const v = videoRef.current;
    if (v) v.muted = true;
    setVideoSoundOn(false);
    onMinimize();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-obsidian" role="dialog" aria-label={`Contact ${name}`}>
      <video
        ref={videoRef}
        src={src}
        playsInline
        loop
        preload="auto"
        crossOrigin={captionsUrl ? 'anonymous' : undefined}
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Attorney introduction video"
      >
        {captionsUrl && (
          <track kind="captions" src={captionsUrl} srcLang={language} label="Captions" default />
        )}
      </video>
      {/* Legibility gradient behind the bottom content. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden="true" />

      {/* Mute toggle with a text label (top-left). */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? 'Mute video' : 'Play with sound'}
        className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-2 text-[11.5px] font-semibold text-white backdrop-blur transition-colors hover:bg-black/60"
      >
        {soundOn ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
        <span>{soundOn ? 'Sound on' : 'Tap for sound'}</span>
      </button>

      {/* Controls (top-right). */}
      <div className="absolute right-3 top-3 z-10">
        <WidgetControls
          tone="overlay"
          onClose={onClose}
          onMinimize={handleMinimize}
          onReplay={replay}
          onExpand={onExpand}
          isExpanded={isExpanded}
        />
      </div>

      {/* Bottom content: captions, headline, status, actions, meta, footer. */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3 pt-16">
        {/* Burned-in captions (on by default while the video autoplays). */}
        {caption && (
          <div className="mb-2 flex justify-center">
            <span className="box-decoration-clone rounded-md bg-black/60 px-2 py-1 text-center text-[13px] font-medium leading-relaxed text-white">
              {caption}
            </span>
          </div>
        )}
        <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-white">
          Talk to us <span className="font-normal text-white/85">your way.</span>
        </h2>
        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] font-medium text-white/85">
          <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          A real person is online &middot; 24/7
        </div>

        {/* Primary: Call me now (full width). */}
        <button
          type="button"
          onClick={() => setConnectView(primary)}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-full bg-white px-5 py-3.5 shadow-lg transition-transform hover:scale-[1.01]"
        >
          <PhoneIcon size={18} className="shrink-0 text-ink" aria-hidden="true" />
          <span className="text-[15px] font-bold text-ink">{primary === 'call' ? 'Call me now' : CHANNEL_META[primary].label}</span>
          <span className="mx-0.5 h-4 w-px bg-hairline" aria-hidden="true" />
          <span className="truncate text-[12px] text-muted">
            {primary === 'call' ? 'A real person in ~60 sec' : CHANNEL_META[primary].sublabel}
          </span>
        </button>

        {/* Secondary row: accordion hover (hovered widens, others go icon-only). */}
        {secondary.length > 0 && (
          <div className="mt-[18px] flex gap-2" onMouseLeave={() => setHovered(null)}>
            {secondary.map((id) => {
              const Icon = CHANNEL_ICON[id];
              const expanded = hovered === id;
              const collapsed = hovered !== null && !expanded;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setConnectView(id)}
                  onMouseEnter={() => setHovered(id)}
                  onFocus={() => setHovered(id)}
                  onBlur={() => setHovered(null)}
                  aria-label={CHANNEL_META[id].label}
                  style={{ flexGrow: expanded ? 4 : 1 }}
                  className="flex min-w-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10 px-3 py-2.5 text-white backdrop-blur transition-[flex-grow,background-color] duration-300 ease-out hover:bg-white/20"
                >
                  <Icon size={17} aria-hidden="true" className="shrink-0" />
                  <span
                    style={{
                      maxWidth: collapsed ? 0 : expanded ? 180 : 60,
                      opacity: collapsed ? 0 : 1,
                      marginLeft: collapsed ? 0 : 7,
                    }}
                    className="overflow-hidden whitespace-nowrap text-[12.5px] font-semibold transition-all duration-300 ease-out"
                  >
                    {expanded ? CHANNEL_META[id].label : SHORT[id]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Meta row: language selection + email option. */}
        {(multiLanguage || emailEnabled) && (
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
            {multiLanguage ? (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-white/55">
                {languages.map((code, i) => (
                  <Fragment key={code}>
                    {i > 0 && <span className="text-white/25" aria-hidden="true">&middot;</span>}
                    <button
                      type="button"
                      onClick={() => setLanguage(code)}
                      className={cn('transition-colors', code === language ? 'font-semibold text-white' : 'hover:text-white')}
                    >
                      {languageName(code)}
                    </button>
                  </Fragment>
                ))}
              </div>
            ) : (
              <span />
            )}
            {emailEnabled && (
              <button
                type="button"
                onClick={() => setConnectView('email')}
                className="shrink-0 text-white/55 underline underline-offset-2 hover:text-white"
              >
                Email us
              </button>
            )}
          </div>
        )}

        <div className="mt-2.5 text-center text-[11px] font-medium text-white/55">
          Powered by <span className="font-semibold text-white/75">Famaash</span>
        </div>
      </div>
    </div>
  );
}
