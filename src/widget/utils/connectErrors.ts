import { ApiError, errorCode, errorDetail } from '../services/api';
import { translate, type UiLocale } from '../i18n';

export type ConnectAction = 'call' | 'text' | 'book';

/**
 * Visitor-safe copy for a failed connect action.
 *
 * We never render the backend's `detail`. It names internal fields and
 * infrastructure ("Firm not found", "Call dispatch unavailable: …") and the
 * widget runs on public marketing sites — on the live repro a caller was shown
 * "Provide conversationId (with firmId to auto-create) or firmId + leadId".
 * So we map on the status and the structured `code`, translate our own copy for
 * the visitor's locale, and console.error the raw detail for ourselves.
 * (connect-launcher-direct-firmid guide §7.)
 *
 * The prose sniffing below is a stopgap: the only structured code today is
 * `text_method_disabled`, so the useful 400s can't be told apart any other way.
 * It degrades to the generic line if the backend rewords a string, and should be
 * replaced with `detail.code` matching as soon as those codes exist.
 */
export function connectErrorMessage(
  err: unknown,
  action: ConnectAction,
  locale: UiLocale,
  firmPhone?: string | null,
): string {
  const status = err instanceof ApiError ? err.status : 0;
  const code = errorCode(err);
  const detail = errorDetail(err);
  const t = (s: string) => translate(locale, s);

  // For us, not the visitor.
  console.error('[famaash] connect action failed', { action, status, code, detail });

  if (code === 'text_method_disabled') {
    return t("That option isn't available right now. Try Call or Chat.");
  }

  if (status === 400 && detail) {
    const d = detail.toLowerCase();
    if (d.includes('consent')) {
      return action === 'text'
        ? t("Please tick the box so we're allowed to text you.")
        : t("Please tick the box so we're allowed to call you.");
    }
    if (d.includes('phone')) return t("That number doesn't look right. Can you check it?");
    if (d.includes('email')) return t("That email doesn't look right. Can you check it?");
    if (d.includes('too soon') || d.includes('minutes from now')) {
      return t('That time just went. Please pick another slot.');
    }
    if (d.includes('channel must be')) {
      return t("That option isn't available right now. Try Call or Chat.");
    }
  }

  // Nylas rejected the slot.
  if (status === 502 && action === 'book') {
    return t('That time just went. Please pick another slot.');
  }

  // 404 / 503 / anything unmapped. A dispatch failure still wrote the consent
  // record, so retrying is safe.
  return firmPhone
    ? `${t('Something went wrong on our side. Please try again, or call us at')} ${firmPhone}.`
    : t('Something went wrong on our side. Please try again.');
}
