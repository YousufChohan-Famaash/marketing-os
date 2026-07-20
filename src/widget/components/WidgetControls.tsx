import { useWidgetStore } from '../store/widgetStore';
import { MinimizeIcon, CollapseIcon, GlobeIcon, MaximizeIcon, ReplayIcon } from '../utils/icons';
import { useIsFullscreen } from '../utils/useIsFullscreen';
import { cn } from '../utils/cn';

interface WidgetControlsProps {
  onClose: () => void;
  onMinimize: () => void;
  onReplay?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  /** 'overlay' floats over the hero video; 'solid' sits on the white header. */
  tone?: 'overlay' | 'solid';
}

export function WidgetControls({
  onMinimize,
  onReplay,
  onExpand,
  isExpanded = false,
  tone = 'solid',
}: WidgetControlsProps) {
  const wrap =
    tone === 'overlay'
      ? 'bg-white/70 backdrop-blur'
      : 'bg-[#F5F8FB] border border-[#EAEEF3]';

  // Expand/collapse is a no-op when the chat already fills the screen (mobile)
  // or in Small mode (the panel sizes itself around the conversation).
  const isFullscreen = useIsFullscreen();
  const isCompact = useWidgetStore((s) => s.connect.size !== 'large');
  const showExpand = Boolean(onExpand) && !isFullscreen && !isCompact;

  return (
    <div className={cn('flex items-center gap-0.5 rounded-pill px-1.5 py-1', wrap)}>
      <ControlBtn label="Language — coming soon" disabled>
        <GlobeIcon size={15} />
      </ControlBtn>
      {onReplay && (
        <ControlBtn label="Replay video" onClick={onReplay}>
          <ReplayIcon size={15} />
        </ControlBtn>
      )}
      {showExpand && (
        <ControlBtn
          label={isExpanded ? 'Collapse chat' : 'Expand chat'}
          onClick={onExpand}
          active={isExpanded}
        >
          {isExpanded ? <CollapseIcon size={15} /> : <MaximizeIcon size={15} />}
        </ControlBtn>
      )}
      <ControlBtn label="Minimize chat" onClick={onMinimize}>
        <MinimizeIcon size={15} />
      </ControlBtn>
    </div>
  );
}

function ControlBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'text-famaash' : 'text-ink-soft',
      )}
    >
      {children}
    </button>
  );
}
