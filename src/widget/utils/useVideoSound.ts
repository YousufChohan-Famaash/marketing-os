import { useEffect, type RefObject } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { loadVideoPosition, saveVideoPosition } from './videoPosition';

/**
 * Wire a <video> to the widget-wide sound preference (uiSlice.videoSoundOn).
 *
 * Every video autoplays and starts muted or unmuted to match the shared flag, so
 * once the visitor unmutes one video every later video opens unmuted too (and
 * once they mute, all start muted). Playback is resilient: if the browser blocks
 * unmuted autoplay we fall back to muted so the clip always plays.
 *
 * Pass `resumeKey` (the clip URL) to persist + restore playback position, so a
 * sibling element of the same clip continues from where this one left off rather
 * than restarting — used for the contact screen's stage → header-avatar handoff.
 *
 * Returns the current `soundOn` and a `toggleSound` handler for the on-video
 * mute/unmute button. Toggling flips the shared flag, so it propagates to the
 * next video the visitor opens.
 */
export function useVideoSound(videoRef: RefObject<HTMLVideoElement>, resumeKey?: string) {
  const soundOn = useWidgetStore((s) => s.videoSoundOn);
  const setSoundOn = useWidgetStore((s) => s.setVideoSoundOn);

  // Resume from a sibling's last position, then keep the shared position current
  // while this one plays.
  useEffect(() => {
    if (!resumeKey) return;
    const v = videoRef.current;
    if (!v) return;
    // Capture the handoff time ONCE, before our own `timeupdate` saver can
    // overwrite it with this fresh element's near-zero currentTime.
    const target = loadVideoPosition(resumeKey);
    let restored = target <= 0.2; // nothing meaningful to resume to
    const restore = () => {
      if (restored) return;
      if (v.readyState < 1) return; // not seekable yet — a later event retries
      try {
        v.currentTime = target;
        restored = true;
      } catch {
        /* keep waiting for a seekable state */
      }
    };
    restore();
    v.addEventListener('loadedmetadata', restore);
    v.addEventListener('loadeddata', restore);
    v.addEventListener('canplay', restore);
    const onTime = () => saveVideoPosition(resumeKey, v.currentTime);
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('loadedmetadata', restore);
      v.removeEventListener('loadeddata', restore);
      v.removeEventListener('canplay', restore);
      v.removeEventListener('timeupdate', onTime);
      saveVideoPosition(resumeKey, v.currentTime); // final position for the handoff
    };
  }, [resumeKey, videoRef]);

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
