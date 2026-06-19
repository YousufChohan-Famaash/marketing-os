import { useEffect, useRef, useState } from 'react';

/** Minimal typing for the Web Speech API (not in the standard DOM lib). */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(i: number): { transcript: string };
  [i: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser supports on-device speech recognition (Chrome/Edge/Safari). */
export function canDictate(): boolean {
  return getCtor() !== null;
}

/**
 * "Talk instead of type" dictation built on the Web Speech API. Final phrases
 * are pushed to `onText` (the composer appends them to the message); the live,
 * not-yet-final phrase is exposed as `interim` for an inline preview. Stopping
 * keeps everything already committed and drops the interim, like every other
 * dictation UI. No audio leaves the device — recognition is the browser's.
 */
export function useSpeechToText({
  lang,
  onText,
}: {
  lang?: string;
  onText: (finalChunk: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  // The user asked to stop, vs. the engine ending on its own (which we restart).
  const wantOnRef = useRef(false);

  const stop = () => {
    wantOnRef.current = false;
    setListening(false);
    setInterim('');
    recRef.current?.stop();
  };

  const start = () => {
    const Ctor = getCtor();
    if (!Ctor || listening) return;
    const rec = new Ctor();
    rec.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) onTextRef.current(text);
        else live += text;
      }
      setInterim(live);
    };
    rec.onerror = () => {
      // 'no-speech'/'aborted' just end the run; let onend decide whether to restart.
    };
    rec.onend = () => {
      setInterim('');
      // Chrome stops after a pause; while the user still wants to dictate, restart.
      if (wantOnRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
          wantOnRef.current = false;
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    wantOnRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantOnRef.current = false;
    }
  };

  const toggle = () => (listening ? stop() : start());

  useEffect(
    () => () => {
      wantOnRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { supported: canDictate(), listening, interim, start, stop, toggle };
}
