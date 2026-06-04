import type { Message } from '../types/domain';
import { useWidgetStore } from '../store/widgetStore';
import { CheckIcon, SignatureIcon } from '../utils/icons';
import { cn } from '../utils/cn';

/**
 * Card for a `document_sign` message — "Review & Sign" opens the inline Dropbox
 * Sign sheet (SigningSheet) for this document. After signing it flips to a
 * "Signed" state (the agent also advances to the next document / portal link).
 */
export function DocumentSignCard({ message }: { message: Message }) {
  const setActiveSigning = useWidgetStore((s) => s.setActiveSigning);
  const doc = message.document;
  const name = doc?.name ?? 'Document';
  const signed = message.selectedOption === 'signed' || doc?.status === 'signed';

  const open = () => {
    setActiveSigning({ itemId: doc?.itemId, name, messageId: message.id });
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
          {!signed && (
            <button
              type="button"
              onClick={open}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-famaash px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-95"
            >
              Review &amp; Sign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
