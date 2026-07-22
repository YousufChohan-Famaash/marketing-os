import { memo } from 'react';
import type { LinkCardPayload } from '../types/domain';
import { ExternalLinkIcon, FileIcon } from '../utils/icons';
import { sanitizeUrl } from '../utils/richText';

interface LinkCardProps {
  card: LinkCardPayload;
}

export const LinkCard = memo(function LinkCard({ card }: LinkCardProps) {
  const safeHref = sanitizeUrl(card.url);

  // If URL is unsafe, render an inert visual card with no anchor.
  const containerClass =
    'group block max-w-[85%] rounded-md border border-hairline bg-white p-3 shadow-sm transition-all hover:border-famaash-border hover:shadow-md';

  const body = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-famaash-light text-ink">
        {card.thumbnailUrl ? (
          <img
            src={card.thumbnailUrl}
            alt=""
            className="h-10 w-10 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon size={20} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-semibold text-ink">
          {card.title}
        </p>
        {card.description && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted">
            {card.description}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-soft">
          <span>{card.domain}</span>
          <ExternalLinkIcon size={10} aria-hidden="true" />
        </p>
      </div>
    </div>
  );

  if (!safeHref) {
    return <div className={containerClass}>{body}</div>;
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`${containerClass} no-underline`}
    >
      {body}
    </a>
  );
});
