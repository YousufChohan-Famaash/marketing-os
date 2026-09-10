import { useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { placeCallNow } from '../services/api';
import { connectErrorMessage } from '../utils/connectErrors';
import { resolveTcpa } from '../utils/compliance';
import { Modal } from './Modal';
import { CallbackForm } from './CallbackForm';
import { useT } from '../i18n';

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
  const setConversationId = useWidgetStore((s) => s.setConversationId);
  const firmId = useWidgetStore((s) => s.firmId);
  const firmPhone = useWidgetStore((s) => s.connect?.phone) ?? null;
  const compliance = useWidgetStore((s) => s.compliance);
  const uiLocale = useWidgetStore((s) => s.uiLocale);
  const branding = useWidgetStore((s) => s.branding);
  const t = useT();

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => setActiveModal(null);

  // Same consent derivation as the launcher's call channel (ChannelView): the
  // firm's authored 'call' copy for the active language wins; a too-short/
  // placeholder value falls back to a proper default. The version is recorded
  // with the consent so the exact wording is provable in the audit log.
  const firmName = branding?.name ?? 'the firm';
  const resolvedTcpa = resolveTcpa(compliance, uiLocale, 'call');
  const authoredConsent = resolvedTcpa.text.trim().length >= 30 ? resolvedTcpa.text : null;
  const consentLabel =
    authoredConsent ??
    `By sharing your number, you agree that ${firmName} may call you about your inquiry. Consent isn't a condition of hiring the firm.`;
  const consentVersion = authoredConsent ? resolvedTcpa.version : undefined;

  const submit = async (phone: string, name?: string) => {
    if (placing) return;
    setError(null);
    // A conversation normally exists here (this is the mid-chat button), but
    // don't refuse the call over a missing one: the endpoint needs only a phone
    // and creates-or-resumes from firmId.
    if (!conversationId && !firmId) {
      setError(t("We couldn't start the call. Please try again."));
      return;
    }
    setPlacing(true);
    try {
      const res = await placeCallNow({
        conversationId,
        firmId: firmId ?? undefined,
        phone,
        name,
        consentText: consentLabel,
        copyVersion: consentVersion,
      });
      // Keep the id the server used or minted, so the composer's poll has
      // something to key on and a later action stays on the same lead (§4).
      if (res.conversationId) setConversationId(res.conversationId);
      // Clear any prior status, then enter the calling state and hand off to the
      // composer, which owns the live lifecycle (push + poll → connected/failed).
      setConnectCallStatus(null);
      setChatCallPhase('calling');
      close();
    } catch (err) {
      // Our own copy, never the server's detail — it names internal fields and
      // this widget renders on public marketing sites (§7).
      setError(connectErrorMessage(err, 'call', uiLocale, firmPhone));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Modal title={t('Call me instead')} onClose={close}>
      {error && (
        <div className="mb-3 rounded-lg border border-[#F3C6C6] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-danger">
          {error}
        </div>
      )}
      <CallbackForm
        heading={t('Talk instead of type?')}
        body={t("We'll call you now and pick up right where we left off — everything you've already shared is carried into the call.")}
        cta={t('Call me now')}
        collectName
        consentLabel={consentLabel}
        busy={placing}
        onSubmit={submit}
      />
    </Modal>
  );
}
