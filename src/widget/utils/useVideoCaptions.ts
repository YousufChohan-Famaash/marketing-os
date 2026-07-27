import { useEffect, useState, type RefObject } from 'react';

/**
 * Render burned-in captions from a WebVTT track ourselves (so we control the
 * position over the video). Loads the track hidden, then mirrors the active
 * cue's text. Returns '' when there's no track or no active cue.
 *
 * The caller renders `<track kind="captions" src={captionsUrl} default>` inside
 * the <video> and sets crossOrigin="anonymous" (the .vtt + .mp4 must be CORS
 * enabled). Absent captionsUrl → no track, empty string.
 */
export function useVideoCaptions(videoRef: RefObject<HTMLVideoElement>, captionsUrl?: string): string {
  const [caption, setCaption] = useState('');
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !captionsUrl) {
      setCaption('');
      return;
    }
    const track = v.textTracks[0];
    if (!track) return;
    track.mode = 'hidden'; // we render cues ourselves
    const onCue = () => {
      const cue = track.activeCues && (track.activeCues[0] as VTTCue | undefined);
      setCaption(cue ? cue.text.replace(/<[^>]+>/g, '') : '');
    };
    track.addEventListener('cuechange', onCue);
    return () => track.removeEventListener('cuechange', onCue);
  }, [captionsUrl, videoRef]);
  return caption;
}
