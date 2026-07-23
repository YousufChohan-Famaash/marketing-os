import type { ComplianceConfig, ConsentChannel } from '../types/domain';

/** Compliant default when the firm has authored no TCPA copy at all. */
export const DEFAULT_TCPA_CONSENT =
  'By providing your number you agree to receive calls and texts about your inquiry. ' +
  'Message and data rates may apply. Reply STOP to opt out.';

export interface ResolvedTcpa {
  /** The consent copy to show the lead. */
  text: string;
  /**
   * The server-minted template version to record with the consent (audit
   * proof). Undefined when we fell back to legacy/default copy that has none.
   */
  version?: string;
}

/**
 * Resolve the TCPA consent copy the firm authored in the Law App's Compliance
 * tab for the lead's language.
 *
 * Resolution order (mirrors the backend's `resolve_tcpa`):
 *   0. `tcpaByChannel[channel][language]` — channel-specific consent (call vs
 *      SMS vs booking vs form), when a channel is given and the firm authored it
 *   1. `tcpaTemplates[language]` — the per-language template the admin authored
 *   2. `tcpaConsent` — the legacy single string (firm never used the new tab)
 *   3. a compliant hardcoded default
 *
 * Never machine-translate — show the authored text as-is.
 */
export function resolveTcpa(
  compliance: ComplianceConfig | null | undefined,
  language: string,
  channel?: ConsentChannel,
): ResolvedTcpa {
  if (channel) {
    const byChannel = compliance?.tcpaByChannel?.[channel];
    const item = byChannel?.[language] ?? byChannel?.en;
    if (item?.text) return { text: item.text, version: item.version };
  }

  const item = compliance?.tcpaTemplates?.[language] ?? compliance?.tcpaTemplates?.en;
  if (item?.text) return { text: item.text, version: item.version };

  const legacy = compliance?.tcpaConsent;
  if (legacy) return { text: legacy };

  return { text: DEFAULT_TCPA_CONSENT };
}

/** Compliant default AI disclosure when the firm has authored none. */
export const DEFAULT_AI_DISCLOSURE =
  "You're chatting with an AI assistant. A real person can join anytime.";

/**
 * Resolve the AI disclosure copy for the lead's language. Mirrors the backend's
 * `resolve_ai_disclosure`: per-language template, then the 'en' template, then
 * the legacy single string, then a built-in default. Never machine-translated.
 */
export function resolveAiDisclosure(
  compliance: ComplianceConfig | null | undefined,
  language: string,
): string {
  const item = compliance?.aiDisclosureTemplates?.[language] ?? compliance?.aiDisclosureTemplates?.en;
  if (item?.text) return item.text;
  if (compliance?.aiDisclosure?.trim()) return compliance.aiDisclosure;
  return DEFAULT_AI_DISCLOSURE;
}
