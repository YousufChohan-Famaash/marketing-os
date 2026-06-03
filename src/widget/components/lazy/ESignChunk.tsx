import FocusTrap from 'focus-trap-react';
import { useEffect, useState } from 'react';
import { useSocket } from '../../services/socketContext';
import { useWidgetStore } from '../../store/widgetStore';
import { createEsignSession } from '../../services/api';
import { CloseIcon, SpinnerIcon } from '../../utils/icons';

/**
 * Embedded retainer signing. Fetches a fresh Dropbox Sign signing URL for the
 * conversation and renders it in an iframe that fills the ENTIRE widget — so the
 * PDF preview gets the full surface (and full screen on mobile, since the host
 * iframe goes full-screen ≤640px). The backend verifies the real signature
 * out-of-band (webhook); the `retainer_signed` we send is a UI hint, fired on
 * the embedded "signed" event or the manual confirm.
 */
export default function ESignChunk() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const conversationId = useWidgetStore((s) => s.conversationId);
  const messages = useWidgetStore((s) => s.messages);
  const updateMessage = useWidgetStore((s) => s.updateMessage);
  const socket = useSocket();

  const [session, setSession] = useState<{ envelopeId: string; signingUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const close = () => setActiveModal(null);

  // Lock background scroll while the full-bleed sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the signing URL just-in-time (they're short-lived).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!conversationId) {
        setError('No active conversation.');
        return;
      }
      try {
        const s = await createEsignSession(conversationId);
        if (!cancelled) setSession(s);
      } catch {
        if (!cancelled) setError('Could not load the agreement. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const finish = () => {
    if (signed) return;
    setSigned(true);
    const retainerMsg = messages.find((m) => m.type === 'retainer');
    if (retainerMsg) updateMessage(retainerMsg.id, { retainerStatus: 'signed' });
    socket?.send({
      type: 'retainer_signed',
      envelopeId: session?.envelopeId ?? '',
      signedAt: Date.now(),
    });
    setTimeout(close, 800);
  };

  // Best-effort: react to Dropbox Sign / HelloSign embedded "signed" events.
  useEffect(() => {
    if (!session) return undefined;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; event?: string } | string | null;
      const kind =
        typeof data === 'string' ? data : (data && (data.type || data.event)) || '';
      if (/sign(ed|ature_request_signed|ing_complete)/i.test(String(kind))) {
        finish();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, allowOutsideClick: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="esign-title"
        className="absolute inset-0 z-50 flex flex-col bg-white"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <h2 id="esign-title" className="text-[15px] font-semibold text-ink">
              Retainer agreement
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Review and sign to engage the firm.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close document"
            className="rounded-md p-1 text-muted hover:bg-hairline-soft hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Document — fills all remaining space */}
        <div className="relative min-h-0 flex-1">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-[13px] font-medium text-ink">{error}</p>
            </div>
          ) : !session ? (
            <div className="flex h-full items-center justify-center">
              <SpinnerIcon size={24} className="text-famaash" />
            </div>
          ) : (
            <iframe
              src={session.signingUrl}
              title="Retainer document"
              className="h-full w-full border-0 bg-white"
              allow="camera; microphone"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline bg-bg-canvas px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="text-[12px] font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!session || signed}
            className="rounded-md bg-famaash px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-95 disabled:opacity-50"
          >
            {signed ? 'Signed ✓' : 'I have completed signing'}
          </button>
        </div>
      </div>
    </FocusTrap>
  );
}
