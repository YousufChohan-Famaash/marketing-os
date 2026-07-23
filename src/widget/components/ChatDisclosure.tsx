import { useWidgetStore } from '../store/widgetStore';
import { resolveAiDisclosure } from '../utils/compliance';

/**
 * Quiet, persistent AI disclosure shown just above the composer during a chat
 * (feedback round 1, 4.4: "disclose quietly"). Copy is the firm-authored
 * disclosure for the active language (`resolveAiDisclosure`), so it stays
 * multi-tenant and multi-language. A Privacy link is appended when the firm has
 * a privacy URL on file.
 */
export function ChatDisclosure() {
  const compliance = useWidgetStore((s) => s.compliance);
  const language = useWidgetStore((s) => s.language);

  const text = resolveAiDisclosure(compliance, language);
  const privacyUrl = compliance?.privacyUrl?.trim();

  return (
    <div className="shrink-0 px-4 pb-1 text-center text-[10.5px] leading-snug text-muted-soft">
      {text}
      {privacyUrl && (
        <>
          {' '}
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-muted"
          >
            Privacy
          </a>
        </>
      )}
    </div>
  );
}
