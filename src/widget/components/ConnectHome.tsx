import { useWidgetStore } from '../store/widgetStore';
import { CHANNEL_META, rankChannels } from '../config/connect';
import type { ConnectChannel } from '../types/domain';
import {
  CalendarIcon,
  ChatIcon,
  ChevronRightIcon,
  MailIcon,
  MessageSquareIcon,
  PhoneIcon,
} from '../utils/icons';
import { cn } from '../utils/cn';
import { ConnectVideo } from './ConnectVideo';
import { PoweredByFooter } from './PoweredByFooter';
import { WidgetControls } from './WidgetControls';

interface ConnectHomeProps {
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

const CHANNEL_ICON: Record<ConnectChannel, typeof PhoneIcon> = {
  call: PhoneIcon,
  chat: ChatIcon,
  text: MessageSquareIcon,
  schedule: CalendarIcon,
  email: MailIcon,
};

/** ~60s style hint shown on the call card; others get a chevron. */
const CHANNEL_TAG: Partial<Record<ConnectChannel, string>> = { call: '~60s' };

/**
 * The Connect launcher home menu. Renders the intent-ranked contact channels in
 * one of two admin-selected sizes:
 *   Large — hero attorney video, stacked option cards, then chat.
 *   Small — compact card: video tile on the left, headline, channel buttons in
 *           a row, and a status line.
 * Channels route into their own view (reversible); email is demoted to a link.
 */
export function ConnectHome({ onClose, onMinimize, onExpand, isExpanded }: ConnectHomeProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  const firmName = branding?.name ?? 'our team';
  const ranked = rankChannels(settings);
  const hasEmail = settings.channels.includes('email');
  const isSmall = settings.size === 'small';

  const go = (id: ConnectChannel) => {
    if (id === 'email') {
      if (settings.email && typeof window !== 'undefined') {
        window.open(`mailto:${settings.email}`, '_blank', 'noopener');
      }
      return;
    }
    setConnectView(id);
  };

  // ── Small: compact horizontal card ─────────────────────────────────────────
  if (isSmall) {
    return (
      <div className="flex h-full w-full flex-col bg-white" role="dialog" aria-label={`Contact ${firmName}`}>
        <header className="flex shrink-0 items-center justify-end px-3 py-2">
          <WidgetControls tone="solid" onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
        </header>
        <div className="flex gap-3 px-4 pb-2">
          <ConnectVideo compact className="aspect-square h-[92px] w-[92px] shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
            <h2 className="text-[16px] font-bold leading-tight tracking-[-0.02em] text-ink">
              How can we help?
            </h2>
            <div className="flex gap-1.5">
              {ranked.map((id) => {
                const Icon = CHANNEL_ICON[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => go(id)}
                    aria-label={CHANNEL_META[id].label}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-hairline bg-white px-1 py-2 text-ink transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
                  >
                    <Icon size={18} className="text-famaash" aria-hidden="true" />
                    <span className="text-[10px] font-semibold">{shortLabel(id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <StatusLine className="px-4 pt-2" />
        {hasEmail && (
          <div className="px-4 pb-1 pt-2">
            <EmailLink onClick={() => go('email')} />
          </div>
        )}
        <div className="mt-auto">
          <PoweredByFooter />
        </div>
      </div>
    );
  }

  // ── Large: hero video + stacked cards ──────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col bg-white" role="dialog" aria-label={`Contact ${firmName}`}>
      <header className="flex shrink-0 items-center justify-end px-3 py-2">
        <WidgetControls tone="solid" onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-3">
        <ConnectVideo className="aspect-[16/10] w-full rounded-2xl" />

        <StatusLine className="mt-3" />

        <h2 className="mt-3 text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink">
          How can we help?
        </h2>

        <div className="mt-3 flex flex-col gap-2.5">
          {ranked.map((id, i) => (
            <ChannelCard key={id} id={id} primary={i === 0} onClick={() => go(id)} />
          ))}
        </div>

        {hasEmail && (
          <div className="mt-3.5 text-center">
            <EmailLink onClick={() => go('email')} />
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-soft">
          AI-assisted intake for {firmName}. A team member can join anytime.
        </p>
      </div>

      <PoweredByFooter />
    </div>
  );
}

function ChannelCard({
  id,
  primary,
  onClick,
}: {
  id: ConnectChannel;
  primary: boolean;
  onClick: () => void;
}) {
  const meta = CHANNEL_META[id];
  const Icon = CHANNEL_ICON[id];
  const tag = CHANNEL_TAG[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-transform hover:translate-x-0.5',
        primary
          ? 'border-transparent bg-famaash text-[color:var(--famaash-on-brand)]'
          : 'border-hairline bg-white text-ink hover:border-famaash-stroke',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          primary ? 'bg-white/15 text-[color:var(--famaash-on-brand)]' : 'bg-famaash-soft text-famaash',
        )}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{meta.label}</span>
        <span className={cn('block text-[12.5px]', primary ? 'opacity-80' : 'text-muted')}>
          {meta.sublabel}
        </span>
      </span>
      {tag ? (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold',
            primary ? 'bg-white/20 text-[color:var(--famaash-on-brand)]' : 'bg-famaash-soft text-famaash',
          )}
        >
          {tag}
        </span>
      ) : (
        <ChevronRightIcon size={17} className={cn('shrink-0', primary ? 'opacity-80' : 'text-muted-soft')} />
      )}
    </button>
  );
}

function StatusLine({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-[12.5px] font-medium text-success', className)}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
      Online now, we answer in seconds
    </div>
  );
}

function EmailLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12.5px] text-muted underline decoration-hairline underline-offset-[3px] hover:text-ink"
    >
      Or send us an email
    </button>
  );
}

function shortLabel(id: ConnectChannel): string {
  return id === 'call' ? 'Call' : id === 'chat' ? 'Chat' : id === 'text' ? 'Text' : id === 'schedule' ? 'Schedule' : 'Email';
}
