import { useWidgetStore } from '../store/widgetStore';
import { ChevronLeftIcon } from '../utils/icons';
import { FamaashMark } from './BrandAssets';
import { WidgetControls } from './WidgetControls';
import { cn } from '../utils/cn';

interface ChatHeaderProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
  /** Return to the Connect home menu (conversation is preserved). */
  onBack?: () => void;
  /** Solid white bar (default) vs. transparent overlay on the intro video. */
  solid?: boolean;
  className?: string;
}

export function ChatHeader({
  onClose,
  onMinimize,
  onExpand,
  isExpanded,
  onBack,
  solid = true,
  className,
}: ChatHeaderProps) {
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);

  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 transition-colors duration-200',
        solid ? 'bg-white' : 'bg-transparent',
        className,
      )}
    >
      {/* Left cluster: back + brand sit together (never centered). */}
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to all options"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              solid
                ? 'text-muted hover:bg-subtle hover:text-ink'
                : 'bg-white/70 text-ink-soft backdrop-blur hover:bg-white/90',
            )}
          >
            <ChevronLeftIcon size={18} />
          </button>
        )}
        {agentTakeover ? (
          <div
            className={cn(
              'flex min-w-0 items-center gap-2',
              !solid && 'rounded-pill bg-white/70 py-0.5 pl-0.5 pr-2.5 backdrop-blur',
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <span className="text-[13px] font-semibold">{(agentTakeover.agentName || 'Specialist').charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{agentTakeover.agentName || 'Specialist'}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                {agentTakeover.agentTitle ?? 'Live agent'}
              </p>
            </div>
          </div>
        ) : (
          <span
            className={cn(
              'flex items-center justify-center rounded-full',
              !solid && 'bg-white/70 p-1 backdrop-blur',
            )}
          >
            <FamaashMark size={32} />
          </span>
        )}
      </div>

      <WidgetControls
        tone={solid ? 'solid' : 'overlay'}
        onClose={onClose}
        onMinimize={onMinimize}
        onExpand={onExpand}
        isExpanded={isExpanded}
      />
    </header>
  );
}
