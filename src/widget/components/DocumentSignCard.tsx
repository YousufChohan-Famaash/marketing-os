import type { Message } from '../types/domain';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { CheckIcon, SignatureIcon } from '../utils/icons';
import { cn } from '../utils/cn';

/**
 * Card for a `document_sign` message — "Review & Sign" opens the inline Dropbox
 * Sign sheet (SigningSheet) for this document. After signing it flips to a
 * "Signed" state (the agent also advances to the next document / portal link).
 * If `document.allowDefer`, also offers "text me the link instead" (defer).
 */
export function DocumentSignCard({ message }: { message: Message }) {
  const setActiveSigning = useWidgetStore((s) => s.setActiveSigning);
  const socket = useSocket();
  const doc = message.document;
  const name = doc?.name ?? 'Document';
  const signed = message.selectedOption === 'signed' || doc?.status === 'signed';
  const deferred = message.selectedOption === 'deferred';

  const open = () => {
    setActiveSigning({ itemId: doc?.itemId, name, messageId: message.id });
  };

  const defer = () => {
    socket?.send({ type: 'defer_documents' });
    useWidgetStore.getState().updateMessage(message.id, { selectedOption: 'deferred' });
  };

  return (
    <div
      className={cn(
        'mt-2 max-w-[85%] rounded-lg border bg-white p-3 shadow-sm',
        signed ? 'border-success/30 bg-success-soft/30' : 'border-famaash-border',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            signed ? 'bg-success/15 text-success' : 'bg-famaash-light text-famaash',
          )}
        >
          {signed ? <CheckIcon size={18} /> : <SignatureIcon size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">
            {signed ? `${name} signed` : name}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {signed ? 'A signed copy is saved to your file.' : 'Review the document and sign inline.'}
          </p>
          {!signed && !deferred && (
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <button
                type="button"
                onClick={open}
                className="inline-flex items-center gap-1.5 rounded-md bg-famaash px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-95"
              >
                Review &amp; Sign
              </button>
              {doc?.allowDefer && (
                <button
                  type="button"
                  onClick={defer}
                  className="text-[12px] font-medium text-muted hover:text-ink"
                >
                  Can&apos;t sign now? Text me the link instead
                </button>
              )}
            </div>
          )}
          {deferred && (
            <p className="mt-1 text-[12px] text-muted">We&apos;ve texted you the link.</p>
          )}
        </div>
      </div>
    </div>
  );
}
