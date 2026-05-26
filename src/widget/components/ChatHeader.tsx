import { useWidgetStore } from '../store/widgetStore';
import { CloseIcon, MinimizeIcon } from '../utils/icons';

interface ChatHeaderProps {
  onClose: () => void;
  onMinimize: () => void;
}

export function ChatHeader({ onClose, onMinimize }: ChatHeaderProps) {
  const branding = useWidgetStore((s) => s.branding);
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);
  const firmName = branding?.name ?? 'Chat';

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-hairline bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`${firmName} logo`}
            className="h-8 w-8 rounded-md object-cover"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-white"
            style={{ background: 'var(--famaash-brand)' }}
            aria-hidden="true"
          >
            <span className="text-[14px] font-semibold">
              {firmName.charAt(0)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">
            {agentTakeover ? agentTakeover.agentName : firmName}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted">
            {agentTakeover ? (
              <>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                  aria-hidden="true"
                />
                {agentTakeover.agentTitle ?? 'Live agent'}
              </>
            ) : (
              <>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-famaash"
                  aria-hidden="true"
                />
                AI assistant
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize chat"
          className="rounded-md p-1.5 text-muted hover:bg-hairline-soft hover:text-ink"
        >
          <MinimizeIcon size={16} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-md p-1.5 text-muted hover:bg-hairline-soft hover:text-ink"
        >
          <CloseIcon size={16} />
        </button>
      </div>
    </header>
  );
}
