import { useWidgetStore } from '../store/widgetStore';

/**
 * Quiet, persistent AI disclosure shown just above the composer during a chat
 * (feedback round 1, 4.4: "disclose quietly"). The copy is the firm-authored
 * `compliance.aiDisclosure` when set, so it stays multi-tenant; otherwise a
 * sensible default that names the firm. A Privacy link is appended when the firm
 * has a privacy URL on file.
 */
export function ChatDisclosure() {
  const compliance = useWidgetStore((s) => s.compliance);
  const firm = useWidgetStore((s) => s.branding)?.name;

  const text =
    compliance?.aiDisclosure?.trim() ||
    `You're chatting with ${firm ? `${firm}'s` : 'our'} AI assistant. A real person can join anytime.`;
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
