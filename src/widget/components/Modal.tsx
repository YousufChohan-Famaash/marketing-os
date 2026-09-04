import FocusTrap from 'focus-trap-react';
import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from '../utils/icons';
import { useT } from '../i18n';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer area for action buttons. */
  footer?: ReactNode;
}

export function Modal({ title, description, onClose, children, footer }: ModalProps) {
  const t = useT();
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, allowOutsideClick: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className="absolute inset-0 z-50 flex items-center justify-center bg-obsidian/40 p-4 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-hairline px-4 py-3">
            <div>
              <h2 id="modal-title" className="text-[15px] font-semibold text-ink">
                {title}
              </h2>
              {description && (
                <p id="modal-description" className="mt-0.5 text-[12px] text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Close dialog')}
              className="rounded-md p-1 text-muted hover:bg-hairline-soft hover:text-ink"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="border-t border-hairline bg-bg-canvas px-4 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </FocusTrap>
  );
}
