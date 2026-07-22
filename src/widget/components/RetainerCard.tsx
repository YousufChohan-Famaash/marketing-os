import type { Message } from '../types/domain';
import { CheckIcon, SignatureIcon } from '../utils/icons';
import { cn } from '../utils/cn';

interface RetainerCardProps {
  message: Message;
  onReviewAndSign: () => void;
}

export function RetainerCard({ message, onReviewAndSign }: RetainerCardProps) {
  const status = message.retainerStatus ?? 'pending';
  const signed = status === 'signed';
  const pct = message.contingencyPercent;

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
            signed ? 'bg-success/15 text-success' : 'bg-famaash-light text-ink',
          )}
        >
          {signed ? <CheckIcon size={18} /> : <SignatureIcon size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">
            {signed ? 'Retainer signed' : 'Retainer agreement'}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {signed
              ? 'A countersigned copy was emailed to you.'
              : typeof pct === 'number'
                ? `${pct}% contingency · review the terms and sign below`
                : 'Review the terms and sign below.'}
          </p>
          {!signed && (
            <button
              type="button"
              onClick={onReviewAndSign}
              disabled={status === 'signing'}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-famaash px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {status === 'signing' ? 'Opening…' : 'Review & sign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
