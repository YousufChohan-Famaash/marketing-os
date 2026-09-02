import { useWidgetStore } from "../store/widgetStore";
import { getHandoffLanguage } from "../config/env";

/**
 * In-language heads-up that the chat continues in English, shown when the
 * visitor's interface language isn't one the agent can actually converse in
 * (`conversationLanguages`). Spanish visitors arriving from the Free
 * Consultation wizard land here so they aren't left typing Spanish at an
 * English agent with no explanation (see spanish-free-consultation.md).
 *
 * Keyed by the interface language; an English fallback covers anything unlisted.
 * When the agent's set gains the language (e.g. `es` after QA), the notice
 * disappears on its own.
 */
const CONTINUES_IN_ENGLISH: Record<string, string> = {
  es: "El chat continúa en inglés.",
};

export function LanguageNotice() {
  const conversationLanguages = useWidgetStore((s) => s.conversationLanguages);
  const storeLang = useWidgetStore((s) => s.language);
  // The visitor's real interface language: the hand-off (Free Consultation) wins,
  // since the chat's own language may have fallen back to a firm-offered one.
  const interfaceLang = getHandoffLanguage() ?? storeLang;

  // Unknown agent set (older backend) → don't nag; agent speaks it → nothing to say.
  if (conversationLanguages.length === 0) return null;
  if (conversationLanguages.includes(interfaceLang)) return null;

  return (
    <div className="shrink-0 px-4 pt-2 text-center text-[11px] font-medium leading-snug text-muted">
      {CONTINUES_IN_ENGLISH[interfaceLang] ?? "This chat continues in English."}
    </div>
  );
}
