import FocusTrap from 'focus-trap-react';
import type HelloSignEmbedded from 'hellosign-embedded';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import type { ActiveSigning } from '../store/slices/uiSlice';
import { ApiError, createEsignSession, fetchDocuments } from '../services/api';
import { CloseIcon, SpinnerIcon } from '../utils/icons';
import { useT } from '../i18n';

/**
 * Inline document signing.
 *
 * On open: fetch a fresh signing URL (`POST /esign/session`); the response says which service the document goes
 * through (boldsign guide §4.4).
 *
 * - Dropbox Sign: load the embedded SDK and render its iframe into our container. Its `sign` event is the fast
 *   path — we publish `document_signed` immediately so the agent advances in <1s (the server webhook is only a
 *   slow fallback for persistence).
 * - BoldSign: a plain iframe with the link, no SDK. BoldSign sends no event we can rely on; after Finish it loads
 *   the firm's portal page (another origin) inside the iframe. The sheet notices the iframe navigating away (its
 *   second load) or the portal's "esign:signed" message, then re-reads GET /documents every 2 s for up to 30 s
 *   until the backend itself says the item is signed (boldsign guide §2, §11). Only then does it publish
 *   `document_signed`. A slower read every 5 s runs the whole time the sheet is open, in case the return isn't seen.
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
  /** The BoldSign link, when the document goes through BoldSign. */
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [frameLoads, setFrameLoads] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [slow, setSlow] = useState(false);
  const itemIdRef = useRef<string | undefined>(signing.itemId);

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
      try {
        const session = await createEsignSession(conversationId, signing.itemId);
        if (cancelled) return;
        const itemId = session.itemId ?? signing.itemId;
        itemIdRef.current = itemId;

        if (session.signingProvider === 'boldsign') {
          // A plain iframe; the return and the re-read are handled by the effects below.
          setFrameUrl(session.signingUrl);
          setLaunched(true);
          return;
        }

        if (!clientId) {
          setError(t('Inline signing isn’t configured for this firm.'));
          return;
        }
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
      } catch (e) {
        if (cancelled) return;
        // Withdrawn by the firm (cancel-signing guide §7): the backend's own words, and nothing to sign.
        if (e instanceof ApiError && e.status === 410) {
          let msg = '';
          try { const d = JSON.parse(e.detail ?? '') as { detail?: { message?: string } }; msg = d.detail?.message ?? ''; } catch { /* no body */ }
          setError(msg || t('This document was withdrawn by the firm. There is nothing to sign.'));
          if (signing.messageId) updateMessage(signing.messageId, { selectedOption: 'cancelled' });
          return;
        }
        setError(t('Could not load the document. Please try again.'));
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

  // BoldSign: re-read the document list until the backend says signed (guide §2). Fast after the return is seen
  // (2 s, up to 30 s), slow the whole time the sheet is open (5 s), never from the browser's say-so.
  useEffect(() => {
    if (!frameUrl || !conversationId) return;
    let stopped = false;
    let fastTicks = 0;
    const read = async () => {
      try {
        const d = await fetchDocuments(conversationId);
        if (stopped) return;
        const want = itemIdRef.current;
        const row = d.signing.find((x) => (want ? x.itemId === want : x.isRetainer && x.status === 'signed'));
        if (row?.status === 'signed') {
          stopped = true;
          if (signedRef.current) return;
          signedRef.current = true;
          socket?.send({ type: 'document_signed', itemId: row.itemId });
          if (signing.messageId) {
            updateMessage(signing.messageId, { retainerStatus: 'signed', selectedOption: 'signed' });
          }
          setActiveSigning(null);
          useWidgetStore.getState().beginTyping();
        }
      } catch {
        /* a read; the next tick tries again */
      }
    };
    const slowTimer = setInterval(() => { void read(); }, 5000);
    let fastTimer: ReturnType<typeof setInterval> | null = null;
    if (confirming) {
      void read();
      fastTimer = setInterval(() => {
        fastTicks += 1;
        if (fastTicks >= 15) {
          if (fastTimer) clearInterval(fastTimer);
          fastTimer = null;
          setSlow(true);
          return;
        }
        void read();
      }, 2000);
    }
    return () => {
      stopped = true;
      clearInterval(slowTimer);
      if (fastTimer) clearInterval(fastTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameUrl, confirming, conversationId]);

  // The portal page, booting inside the iframe after Finish, posts {type: "esign:signed", itemId} to any parent.
  // It carries no secret and is only a cue to re-read; the list is the source of truth.
  useEffect(() => {
    if (!frameUrl) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; itemId?: string } | null;
      if (d?.type === 'esign:signed') setConfirming(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frameUrl]);

  // The iframe's first load is BoldSign; a second load means it navigated away (back to the portal after Finish).
  const onFrameLoad = () => {
    setFrameLoads((n) => {
      if (n + 1 >= 2) setConfirming(true);
      return n + 1;
    });
  };

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
            <p className="mt-0.5 text-[12px] text-muted">
              {confirming
                ? slow
                  ? t('Signed. We’re finalising it, this can take a minute.')
                  : t('Saving your signature…')
                : t('Review and sign to continue.')}
            </p>
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

        {/* Dropbox: the SDK renders its iframe into this container. BoldSign: our own iframe, below. */}
        <div ref={containerRef} className="relative min-h-0 flex-1 bg-white">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-[13px] font-medium text-ink">{error}</p>
            </div>
          ) : (
            (!launched || (frameUrl && (frameLoads === 0 || confirming))) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <SpinnerIcon size={24} className="text-famaash" />
              </div>
            )
          )}
          {frameUrl && !error && (
            // No sandbox: BoldSign needs scripts, forms, popups and same-origin (boldsign guide §11).
            <iframe
              src={frameUrl}
              title={t('Sign your document')}
              allow="clipboard-write"
              onLoad={onFrameLoad}
              data-testid="boldsign-frame"
              className="relative h-full w-full border-0"
              style={{ visibility: confirming ? 'hidden' : 'visible' }}
            />
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
