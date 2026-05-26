import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { UploadedFile } from '../types/domain';
import { CloseIcon, FileIcon, ImageIcon, UploadIcon } from '../utils/icons';
import { generateId } from '../utils/id';
import { cn } from '../utils/cn';

interface FileUploadZoneProps {
  /** Fired once when all files in the batch finish their mock upload. */
  onComplete: (files: UploadedFile[]) => void;
  /** Hide the zone after completion (typical case). */
  hideOnComplete?: boolean;
  disabled?: boolean;
}

const SIM_UPLOAD_DURATION_MS = 2000;
const SIM_UPLOAD_STEP_MS = 80;

export function FileUploadZone({
  onComplete,
  hideOnComplete = true,
  disabled,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [completed, setCompleted] = useState(false);
  // Hold onComplete in a ref so the completion-watching effect doesn't
  // re-fire each time the parent re-renders (it passes a fresh arrow every
  // time). Without this, the post-upload event cascade (field_captured,
  // scope_chips, retainer message) caused the effect to re-enter before the
  // `completed` setState had committed — runaway loop.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const next: UploadedFile[] = acceptedFiles.map((f) => ({
        id: generateId('file'),
        name: f.name,
        size: f.size,
        type: f.type,
        url: URL.createObjectURL(f),
        thumbnail: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        status: 'uploading',
        progress: 0,
      }));
      setFiles((prev) => [...prev, ...next]);
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || completed,
    multiple: true,
  });

  // Mock upload progress per-file. Stops once `completed` is true.
  useEffect(() => {
    if (completed) return undefined;
    const interval = setInterval(() => {
      setFiles((prev) => {
        let changed = false;
        const next = prev.map((f) => {
          if (f.status === 'uploading') {
            const inc = (SIM_UPLOAD_STEP_MS / SIM_UPLOAD_DURATION_MS) * 100;
            const newProgress = Math.min(100, f.progress + inc);
            const done = newProgress >= 100;
            changed = true;
            return {
              ...f,
              progress: newProgress,
              status: done ? ('uploaded' as const) : ('uploading' as const),
            };
          }
          return f;
        });
        return changed ? next : prev;
      });
    }, SIM_UPLOAD_STEP_MS);
    return () => clearInterval(interval);
  }, [completed]);

  // Fire onComplete when ALL files are uploaded and there's at least one.
  // `onComplete` deliberately omitted from deps — read via ref above.
  useEffect(() => {
    if (completed) return;
    if (files.length === 0) return;
    if (files.every((f) => f.status === 'uploaded')) {
      setCompleted(true);
      onCompleteRef.current(files);
    }
  }, [files, completed]);

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  if (completed && hideOnComplete) {
    return (
      <div className="mt-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-[13px] text-ink">
        <span className="font-medium">{files.length}</span>{' '}
        file{files.length === 1 ? '' : 's'} uploaded.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div
        {...getRootProps({
          className: cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors',
            isDragActive
              ? 'border-famaash bg-famaash-light'
              : 'border-hairline bg-subtle hover:bg-famaash-light/40',
            (disabled || completed) && 'cursor-not-allowed opacity-60',
          ),
        })}
      >
        <input {...getInputProps()} aria-label="Upload files" />
        <UploadIcon size={20} className="text-muted" aria-hidden="true" />
        <p className="text-[13px] text-muted">
          {isDragActive ? 'Drop files here' : 'Drop files here or click to browse'}
        </p>
        <p className="text-[11px] text-muted-soft">Images, PDFs accepted</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-hairline bg-white px-2 py-1.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-subtle">
                {f.thumbnail ? (
                  <img
                    src={f.thumbnail}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : f.type.startsWith('image/') ? (
                  <ImageIcon size={14} className="text-muted" />
                ) : (
                  <FileIcon size={14} className="text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-ink">{f.name}</p>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-hairline">
                  <div
                    className={cn(
                      'h-full transition-all',
                      f.status === 'failed' ? 'bg-danger' : 'bg-famaash',
                    )}
                    style={{ width: `${f.progress}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(f.progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Upload progress for ${f.name}`}
                  />
                </div>
              </div>
              {f.status === 'uploading' && (
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  aria-label={`Cancel upload of ${f.name}`}
                  className="shrink-0 rounded p-1 text-muted hover:bg-hairline-soft hover:text-ink"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
