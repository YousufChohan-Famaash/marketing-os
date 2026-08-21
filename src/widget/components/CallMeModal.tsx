import { useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { ApiError, errorDetail, placeCallNow } from '../services/api';
import { resolveTcpa } from '../utils/compliance';
import { Modal } from './Modal';
import { CallbackForm } from './CallbackForm';

/**
 * Mid-chat "Call me" — reuses the launcher's Call-Me-Now REST flow, but from
 * inside an active conversation so the callback resumes the chat's intake
 * (channel-handoff Pass 1) instead of starting over. Same endpoint, same consent
 * ledger; the only delta is we pass the chat's `conversationId`. See
 * chat-in-call-button-frontend-guide.md.
 */
export function CallMeModal() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const setChatCallPhase = useWidgetStore((s) => s.setChatCallPhase);
  const setConnectCallStatus = useWidgetStore((s) => s.setConnectCallStatus);
  const conversationId = useWidgetStore((s) => s.conversationId);
  const firmId = useWidgetStore((s) => s.firmId);
  const compliance = useWidgetStore((s) => s.compliance);
  const language = useWidgetStore((s) => s.language);
  const branding = useWidgetStore((s) => s.branding);

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => setActiveModal(null);

  // Same consent derivation as the launcher's call channel (ChannelView): the
  // firm's authored 'call' copy for the active language wins; a too-short/
  // placeholder value falls back to a proper default. The version is recorded
  // with the consent so the exact wording is provable in the audit log.
  const firmName = branding?.name ?? 'the firm';
  const resolvedTcpa = resolveTcpa(compliance, language, 'call');
  const authoredConsent = resolvedTcpa.text.trim().length >= 30 ? resolvedTcpa.text : null;
  const consentLabel =
    authoredConsent ??
    `By sharing your number, you agree that ${firmName} may call you about your inquiry. Consent isn't a condition of hiring the firm.`;
  const consentVersion = authoredConsent ? resolvedTcpa.version : undefined;

  const submit = async (phone: string, name?: string) => {
    if (placing) return;
    setError(null);
    if (!conversationId) {
      setError("We couldn't start the call. Please try again.");
      return;
    }
    setPlacing(true);
    try {
      await placeCallNow({
        conversationId,
        firmId: firmId ?? undefined,
        phone,
        name,
        consentText: consentLabel,
        copyVersion: consentVersion,
      });
      // Clear any prior status, then enter the calling state and hand off to the
      // composer, which owns the live lifecycle (push + poll → connected/failed).
      setConnectCallStatus(null);
      setChatCallPhase('calling');
      close();
    } catch (err) {
      const detail = errorDetail(err);
      // A 400 here is almost always the consent gate — show the server's message
      // verbatim (e.g. "TCPA consent is required to place a call"), inline.
      setError(
        err instanceof ApiError && err.status === 400 && detail
          ? detail
          : "We couldn't start the call. Please try again.",
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Modal title="Call me instead" onClose={close}>
      {error && (
        <div className="mb-3 rounded-lg border border-[#F3C6C6] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-danger">
          {error}
        </div>
      )}
      <CallbackForm
        heading="Talk instead of type?"
        body="We'll call you now and pick up right where we left off — everything you've already shared is carried into the call."
        cta="Call me now"
        collectName
        consentLabel={consentLabel}
        busy={placing}
        onSubmit={submit}
      />
    </Modal>
  );
}
