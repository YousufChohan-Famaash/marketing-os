import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { Message } from '../types/domain';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { uploadDocument } from '../services/api';
import { CheckIcon, FileIcon, UploadIcon } from '../utils/icons';
import { useT } from '../i18n';
import { cn } from '../utils/cn';

/**
 * Card for a `document_upload` message — one document at a time. Picking a file
 * uploads it THROUGH the backend (POST /documents/upload, multipart — no
 * browser→S3, no CORS), then publishes `file_uploaded { itemId }` so the agent
 * finalizes it and sends the next box. "Skip" publishes `skip_document` (the
 * portal link at the end covers skipped docs).
 */
export function DocumentUploadCard({ message }: { message: Message }) {
  const conversationId = useWidgetStore((s) => s.conversationId);
  const updateMessage = useWidgetStore((s) => s.updateMessage);
  const socket = useSocket();
  const t = useT();

  const doc = message.document;
  const name = doc?.name ?? 'Document';
  const settled = message.selectedOption; // 'uploaded' | 'skipped' once done
  const allowSkip = doc?.allowSkip !== false;

  const [status, setStatus] = useState<'idle' | 'uploading' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  const upload = useCallback(
    async (file: File) => {
      if (!conversationId || !doc) return;
      setFileName(file.name);
      setStatus('uploading');
      setProgress(0);
      try {
        await uploadDocument(conversationId, doc.itemId, file, setProgress);
        socket?.send({ type: 'file_uploaded', itemId: doc.itemId });
        updateMessage(message.id, { selectedOption: 'uploaded' });
        useWidgetStore.getState().beginTyping();
      } catch {
        setStatus('failed');
      }
    },
    [conversationId, doc, socket, updateMessage, message.id],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const f = accepted[0];
      if (f) void upload(f);
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: status === 'uploading' || Boolean(settled),
  });

  const skip = () => {
    if (!doc) return;
    socket?.send({ type: 'skip_document', itemId: doc.itemId });
    updateMessage(message.id, { selectedOption: 'skipped' });
    useWidgetStore.getState().beginTyping();
  };

  if (settled) {
    const uploaded = settled === 'uploaded';
    return (
      <div
        className={cn(
          'mt-2 flex max-w-[85%] items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px]',
          uploaded
            ? 'border-success/30 bg-success-soft/30 text-ink'
            : 'border-hairline bg-subtle text-muted',
        )}
      >
        {uploaded ? (
          <CheckIcon size={16} className="shrink-0 text-success" aria-hidden="true" />
        ) : (
          <FileIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="font-medium">{name}</span>
        <span>{uploaded ? t('uploaded') : t('skipped')}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-[85%] space-y-2">
      <div
        {...getRootProps({
          className: cn(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors',
            isDragActive
              ? 'border-famaash bg-famaash-light'
              : 'border-hairline bg-subtle hover:bg-famaash-light/40',
            status === 'uploading' && 'pointer-events-none opacity-70',
          ),
        })}
      >
        <input {...getInputProps()} aria-label={`${t('Upload')} ${name}`} />
        <UploadIcon size={20} className="text-muted" aria-hidden="true" />
        <p className="text-[13px] font-medium text-ink">{name}</p>
        {status === 'uploading' ? (
          <div className="mt-1 w-full">
            <p className="truncate text-[11px] text-muted">{fileName}</p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full bg-famaash transition-all"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-soft">
            {status === 'failed'
              ? t('Upload failed. Tap to try again')
              : t('Tap to choose a file or drop it here · images / PDF')}
          </p>
        )}
      </div>

      {allowSkip && status !== 'uploading' && (
        <button
          type="button"
          onClick={skip}
          className="text-[12px] font-medium text-muted hover:text-ink"
        >
          {t("Skip, I don't have it")}
        </button>
      )}
    </div>
  );
}
