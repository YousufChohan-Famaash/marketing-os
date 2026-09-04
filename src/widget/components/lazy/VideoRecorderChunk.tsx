import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../../store/widgetStore';
import { useT } from '../../i18n';
import { RecordIcon } from '../../utils/icons';
import { Modal } from '../Modal';

type Phase = 'idle' | 'recording' | 'preview' | 'uploaded' | 'error';

export default function VideoRecorderChunk() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('Camera unavailable'));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunks.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase('preview');
    };
    recorder.start();
    recorderRef.current = recorder;
    setPhase('recording');
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const submit = () => {
    setPhase('uploaded');
    setTimeout(() => setActiveModal(null), 1000);
  };

  return (
    <Modal
      title={t('Record a video')}
      description={t('A short video helps us understand your case faster')}
      onClose={() => setActiveModal(null)}
      footer={
        phase === 'preview' ? (
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                setPhase('idle');
              }}
              className="text-[12px] font-medium text-muted hover:text-ink"
            >
              {t('Retake')}
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-famaash px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-95"
            >
              {t('Submit')}
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-3">
        {phase === 'error' && (
          <div className="rounded-md bg-danger-soft px-3 py-2 text-[12px] text-danger">
            {error ?? t('Camera unavailable.')}
          </div>
        )}
        {phase !== 'preview' && phase !== 'uploaded' && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full rounded-md bg-obsidian"
            aria-label={t('Live camera preview')}
          />
        )}
        {phase === 'preview' && previewUrl && (
          <video
            ref={previewRef}
            src={previewUrl}
            controls
            className="aspect-video w-full rounded-md bg-obsidian"
            aria-label={t('Recording preview')}
          />
        )}
        {phase === 'uploaded' && (
          <div className="rounded-md bg-success-soft px-3 py-3 text-center text-[13px] font-medium text-success">
            {t('Mock upload complete.')}
          </div>
        )}
        {phase === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="mx-auto flex items-center gap-2 rounded-pill bg-danger px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <RecordIcon size={14} aria-hidden="true" />
            {t('Start recording')}
          </button>
        )}
        {phase === 'recording' && (
          <button
            type="button"
            onClick={stopRecording}
            className="mx-auto flex items-center gap-2 rounded-pill bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <span className="block h-2.5 w-2.5 rounded-sm bg-danger" aria-hidden="true" />
            {t('Stop')}
          </button>
        )}
      </div>
    </Modal>
  );
}
