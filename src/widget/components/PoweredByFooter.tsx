import { useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { sanitizeUrl } from '../utils/richText';

export function PoweredByFooter() {
  const compliance = useWidgetStore((s) => s.compliance);
  const privacyUrl = compliance ? sanitizeUrl(compliance.privacyUrl) : null;
  const termsUrl = compliance ? sanitizeUrl(compliance.termsUrl) : null;
  // Falls back to the "F" badge until the logo file is in place.
  const [logoOk, setLogoOk] = useState(true);

  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-hairline-soft bg-bg-canvas px-3 py-1.5 text-[10px] text-muted-soft">
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-4 items-center justify-center rounded-md bg-white p-0.5 ring-1 ring-black/5">
          {logoOk ? (
            <img
              src="/famaash-logo.png"
              alt="Famaash"
              className="h-full w-auto object-contain"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <span
              className="inline-flex h-3 w-3 items-center justify-center rounded-sm bg-famaash text-[8px] font-bold text-white"
              aria-hidden="true"
            >
              F
            </span>
          )}
        </span>
        <span>Powered by Famaash</span>
      </span>
      <div className="flex items-center gap-2">
        {privacyUrl && (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-soft hover:text-ink no-underline"
          >
            Privacy
          </a>
        )}
        {termsUrl && (
          <a
            href={termsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-soft hover:text-ink no-underline"
          >
            Terms
          </a>
        )}
      </div>
    </footer>
  );
}
