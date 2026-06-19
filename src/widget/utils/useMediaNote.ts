import { useEffect, useRef, useState } from 'react';

export type MediaKind = 'audio' | 'video';

/** True when the browser can record (MediaRecorder + getUserMedia present). */
export function canRecordMedia(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * WhatsApp-style voice/video note recorder. `onComplete` fires with the final
 * blob (kind + duration) when the user stops; `cancel()` discards. The optional
 * `onStream` callback hands back the live MediaStream so a video preview can be
 * shown while recording.
 */
export function useMediaNote(
  onComplete: (blob: Blob, kind: MediaKind, durationMs: number) => void,
) {
  const [recording, setRecording] = useState<MediaKind | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Exposed so a video preview can attach the live feed *after* the recording UI
  // has rendered (the onStream callback fires before React re-renders).
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  const teardownStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async (kind: MediaKind, onStream?: (s: MediaStream) => void) => {
    if (recording || !canRecordMedia()) return;
    cancelRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
    } catch {
      return; // permission denied / no device
    }
    streamRef.current = stream;
    setStream(stream);
    onStream?.(stream);

    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const durationMs = performance.now() - startRef.current;
      const chunks = chunksRef.current;
      teardownStream();
      setRecording(null);
      setElapsedMs(0);
      if (!cancelRef.current && chunks.length) {
        const blob = new Blob(chunks, {
          type: rec.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm'),
        });
        onComplete(blob, kind, durationMs);
      }
    };
    rec.start();
    recRef.current = rec;
    startRef.current = performance.now();
    setRecording(kind);
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs(performance.now() - startRef.current), 200);
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  };
  const cancel = () => {
    cancelRef.current = true;
    stop();
  };

  // Clean up the camera/mic if the component unmounts mid-recording.
  useEffect(() => () => teardownStream(), []);

  return { recording, elapsedMs, stream, start, stop, cancel };
}
