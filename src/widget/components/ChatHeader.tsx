import { useWidgetStore } from '../store/widgetStore';
import { ChevronLeftIcon } from '../utils/icons';
import { FamaashMark } from './BrandAssets';
import { WidgetControls } from './WidgetControls';

interface ChatHeaderProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
  /** Return to the Connect home menu (conversation is preserved). */
  onBack?: () => void;
}

export function ChatHeader({ onClose, onMinimize, onExpand, isExpanded, onBack }: ChatHeaderProps) {
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all options"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
        >
          <ChevronLeftIcon size={18} />
        </button>
      )}
      {agentTakeover ? (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-soft text-success">
            <span className="text-[13px] font-semibold">
              {agentTakeover.agentName.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">
              {agentTakeover.agentName}
            </p>
            <p className="flex items-center gap-1 truncate text-[11px] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {agentTakeover.agentTitle ?? 'Live agent'}
            </p>
          </div>
        </div>
      ) : (
        <FamaashMark size={36} />
      )}
      <WidgetControls tone="solid" onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
    </header>
  );
}
