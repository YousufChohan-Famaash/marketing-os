import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar } from '../config/demoMedia';
import { ChevronLeftIcon, EditIcon } from '../utils/icons';
import { Avatar } from './Avatar';
import { WidgetControls } from './WidgetControls';
import { cn } from '../utils/cn';
import { useT } from '../i18n';

interface ChatHeaderProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
  /** Return to the Connect home menu (conversation is preserved). */
  onBack?: () => void;
  /** Start a fresh conversation. When set, shows a "New chat" button. */
  onNewChat?: () => void;
  /** Solid white bar (default) vs. transparent overlay on the intro video. */
  solid?: boolean;
  /** The firm has a morphing chat video (drives the Avatar-vs-slot choice). */
  hasMorph?: boolean;
  /** The morph video is currently COLLAPSED into the header, so reserve its slot.
   * While the video is full-bleed (expanded) there's no thumbnail here, so the
   * title sits flush after the back button instead of past an empty gap. */
  thumbInHeader?: boolean;
  className?: string;
}

export function ChatHeader({
  onClose,
  onMinimize,
  onExpand,
  isExpanded,
  onBack,
  onNewChat,
  solid = true,
  hasMorph = false,
  thumbInHeader = false,
  className,
}: ChatHeaderProps) {
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);
  const branding = useWidgetStore((s) => s.branding);
  const t = useT();
  // "Live chat with {firm}" identity beside the avatar. Multi-tenant: the firm's
  // own name (then the assistant name), with a graceful fallback so it never
  // renders a blank title.
  const firmName = (branding?.name ?? branding?.assistantName ?? '').trim();

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
            aria-label={t('Back to all options')}
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
              <span className="text-[13px] font-semibold">{(agentTakeover.agentName || t('Specialist')).charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{agentTakeover.agentName || t('Specialist')}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                {agentTakeover.agentTitle ?? t('Live agent')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {thumbInHeader ? (
              // The morph video is collapsed into this slot; reserve the space.
              <span className="h-10 w-10 shrink-0" aria-hidden="true" />
            ) : hasMorph ? (
              // Video is full-bleed (no thumbnail here) → title flush, no slot.
              null
            ) : (
              <span
                className={cn(
                  'flex items-center justify-center rounded-full',
                  !solid && 'bg-white/70 p-1 backdrop-blur',
                )}
              >
                <Avatar
                  src={resolveAssistantAvatar(branding?.assistantAvatarUrl)}
                  name={branding?.assistantName ?? branding?.name ?? 'Assistant'}
                  size={40}
                />
              </span>
            )}
            {/* Live-chat identity. Over the video (transparent header) it goes
                white with a shadow; on the solid bar it's ink + muted. */}
            {firmName ? (
              <div className="min-w-0 leading-tight">
                <p
                  className={cn(
                    'truncate text-[14.5px] font-semibold',
                    solid ? 'text-ink' : 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]',
                  )}
                >
                  {firmName}
                </p>
                <p
                  className={cn(
                    'flex items-center gap-1 truncate text-[12px]',
                    solid ? 'text-muted' : 'text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]',
                  )}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                  {t('Live chat')}
                </p>
              </div>
            ) : (
              <p
                className={cn(
                  'flex items-center gap-1.5 truncate text-[13px] font-semibold',
                  solid ? 'text-ink' : 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]',
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                {t('Live chat')}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            aria-label={t('Start a new chat')}
            title={t('New chat')}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              solid
                ? 'text-muted hover:bg-subtle hover:text-ink'
                : 'bg-white/70 text-ink-soft backdrop-blur hover:bg-white/90',
            )}
          >
            <EditIcon size={16} />
          </button>
        )}
        <WidgetControls
          tone={solid ? 'solid' : 'overlay'}
          onClose={onClose}
          onMinimize={onMinimize}
          onExpand={onExpand}
          isExpanded={isExpanded}
        />
      </div>
    </header>
  );
}
