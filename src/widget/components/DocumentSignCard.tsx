import type { Message } from '../types/domain';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { CheckIcon, FileIcon, SignatureIcon } from '../utils/icons';
import { cn } from '../utils/cn';

/**
 * Card for a `document_sign` message — "Review & Sign" opens the inline Dropbox
 * Sign sheet (SigningSheet) for this document. Every card also gets a uniform
 * "Skip" button when `document.allowSkip` (same `skip_document{itemId}` event as
 * the upload boxes) — skipped docs are recoverable via the texted portal link.
 * After signing/skipping it collapses to a settled row and the agent advances.
 */
export function DocumentSignCard({ message }: { message: Message }) {
  const setActiveSigning = useWidgetStore((s) => s.setActiveSigning);
  const updateMessage = useWidgetStore((s) => s.updateMessage);
  const socket = useSocket();

  const doc = message.document;
  const name = doc?.name ?? 'Document';
  const allowSkip = doc?.allowSkip === true;
  const signed = message.selectedOption === 'signed' || doc?.status === 'signed';
  const skipped = message.selectedOption === 'skipped';

  const open = () => {
    setActiveSigning({ itemId: doc?.itemId, name, messageId: message.id });
  };

  const skip = () => {
    if (!doc) return;
    socket?.send({ type: 'skip_document', itemId: doc.itemId });
    updateMessage(message.id, { selectedOption: 'skipped' });
    useWidgetStore.getState().beginTyping();
  };

  if (signed || skipped) {
    return (
      <div
        className={cn(
          'mt-2 flex max-w-[85%] items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px]',
          signed
            ? 'border-success/30 bg-success-soft/30 text-ink'
            : 'border-hairline bg-subtle text-muted',
        )}
      >
        {signed ? (
          <CheckIcon size={16} className="shrink-0 text-success" aria-hidden="true" />
        ) : (
          <FileIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
        )}
        <span className="font-medium">{name}</span>
        <span>{signed ? 'signed' : 'skipped'}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-[85%] rounded-lg border border-famaash-border bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-famaash-light text-famaash">
          <SignatureIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{name}</p>
          <p className="mt-0.5 text-[12px] text-muted">Review the document and sign inline.</p>
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-1.5 rounded-md bg-famaash px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-95"
            >
              Review &amp; Sign
            </button>
            {allowSkip && (
              <button
                type="button"
                onClick={skip}
                className="text-[12px] font-medium text-muted hover:text-ink"
              >
                Skip / I&apos;ll do it later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
