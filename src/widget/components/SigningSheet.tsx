import FocusTrap from 'focus-trap-react';
import type HelloSignEmbedded from 'hellosign-embedded';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import type { ActiveSigning } from '../store/slices/uiSlice';
import { createEsignSession } from '../services/api';
import { CloseIcon, SpinnerIcon } from '../utils/icons';
import { useT } from '../i18n';

/**
 * Inline document signing via the Dropbox Sign (HelloSign) embedded SDK.
 *
 * On open: fetch a fresh signing URL (`POST /esign/session`), load the SDK, and
 * render its iframe into our container. The `sign` event is the fast path — we
 * publish `document_signed` immediately so the agent advances in <1s (the
 * server webhook is only a slow fallback for persistence).
 */
export function SigningSheet({ signing }: { signing: ActiveSigning }) {
  const conversationId = useWidgetStore((s) => s.conversationId);
  const clientId = useWidgetStore((s) => s.dropboxSignClientId);
  const testMode = useWidgetStore((s) => s.dropboxSignTestMode);
  const setActiveSigning = useWidgetStore((s) => s.setActiveSigning);
  const updateMessage = useWidgetStore((s) => s.updateMessage);
  const socket = useSocket();
  const t = useT();

  const containerRef = useRef<HTMLDivElement>(null);
  const signedRef = useRef(false);
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => setActiveSigning(null);

  useEffect(() => {
    let cancelled = false;
    let client: HelloSignEmbedded | null = null;

    const markSigned = (itemId?: string) => {
      if (signedRef.current) return;
      signedRef.current = true;
      socket?.send({ type: 'document_signed', itemId });
      if (signing.messageId) {
        updateMessage(signing.messageId, { retainerStatus: 'signed', selectedOption: 'signed' });
      }
      setActiveSigning(null);
      useWidgetStore.getState().beginTyping();
    };

    (async () => {
      if (!conversationId) {
        setError(t('No active conversation.'));
        return;
      }
      if (!clientId) {
        setError(t('Inline signing isn’t configured for this firm.'));
        return;
      }
      try {
        const session = await createEsignSession(conversationId, signing.itemId);
        if (cancelled) return;
        const itemId = session.itemId ?? signing.itemId;

        const { default: HelloSign } = await import('hellosign-embedded');
        if (cancelled) return;

        client = new HelloSign({ clientId });
        client.on('sign', () => markSigned(itemId));
        client.on('decline', () => close());
        client.on('cancel', () => close());
        client.on('close', () => {
          // Fires after sign too; markSigned's guard makes this a no-op then.
          if (!signedRef.current) close();
        });
        client.on('error', () => setError(t('Signing failed. Please try again.')));

        client.open(session.signingUrl, {
          container: containerRef.current ?? undefined,
          testMode,
          // Test/sandbox apps usually aren't domain-verified.
          skipDomainVerification: testMode,
        });
        if (!cancelled) setLaunched(true);
      } catch {
        if (!cancelled) setError(t('Could not load the document. Please try again.'));
      }
    })();

    return () => {
      cancelled = true;
      try {
        client?.close();
      } catch {
        /* ignore */
      }
    };
    // Mount-once per signing request (SigningSheet remounts when `signing` changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, allowOutsideClick: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sign ${signing.name}`}
        className="absolute inset-0 z-50 flex flex-col bg-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{signing.name}</h2>
            <p className="mt-0.5 text-[12px] text-muted">{t('Review and sign to continue.')}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('Close document')}
            className="rounded-md p-1 text-muted hover:bg-hairline-soft hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* The Dropbox Sign SDK renders its iframe into this container. */}
        <div ref={containerRef} className="relative min-h-0 flex-1 bg-white">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-[13px] font-medium text-ink">{error}</p>
            </div>
          ) : (
            !launched && (
              <div className="flex h-full items-center justify-center">
                <SpinnerIcon size={24} className="text-famaash" />
              </div>
            )
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-hairline bg-bg-canvas px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="text-[12px] font-medium text-muted hover:text-ink"
          >
            {t('Close')}
          </button>
        </div>
      </div>
    </FocusTrap>
  );
}
