import { useEffect, type RefObject } from 'react';
import { useWidgetStore } from '../store/widgetStore';

/**
 * Wire a <video> to the widget-wide sound preference (uiSlice.videoSoundOn).
 *
 * Every video autoplays and starts muted or unmuted to match the shared flag, so
 * once the visitor unmutes one video every later video opens unmuted too (and
 * once they mute, all start muted). Playback is resilient: if the browser blocks
 * unmuted autoplay we fall back to muted so the clip always plays.
 *
 * Returns the current `soundOn` and a `toggleSound` handler for the on-video
 * mute/unmute button. Toggling flips the shared flag, so it propagates to the
 * next video the visitor opens.
 */
export function useVideoSound(videoRef: RefObject<HTMLVideoElement>) {
  const soundOn = useWidgetStore((s) => s.videoSoundOn);
  const setSoundOn = useWidgetStore((s) => s.setVideoSoundOn);

  // Apply the shared preference on mount and whenever it changes (e.g. another
  // video toggled it), always keeping the clip playing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !soundOn;
    v.play().catch(() => {
      // Unmuted autoplay blocked (no prior gesture) → play muted instead.
      if (!v.muted) {
        v.muted = true;
        v.play().catch(() => undefined);
      }
    });
  }, [soundOn, videoRef]);

  const toggleSound = () => {
    const v = videoRef.current;
    const next = !soundOn;
    // Set muted synchronously inside the click so the unmute counts as a user
    // gesture (satisfies the browser's autoplay-with-sound policy).
    if (v) {
      v.muted = !next;
      if (next) {
        if (v.ended) v.currentTime = 0; // a clip that finished muted replays with sound
        if (v.paused) void v.play();
      }
    }
    setSoundOn(next);
  };

  return { soundOn, toggleSound };
}
