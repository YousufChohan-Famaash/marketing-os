import { useWidgetStore } from '../store/widgetStore';
import { CHANNEL_META, rankChannels } from '../config/connect';
import type { ConnectChannel } from '../types/domain';
import { CalendarIcon, ChatIcon, ChevronRightIcon, FileIcon, PhoneIcon, SmartphoneIcon } from '../utils/icons';
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
  text: SmartphoneIcon,
  schedule: CalendarIcon,
  email: FileIcon,
};

const HEADLINE_LEAD = 'Hurt? Talk to us';
const HEADLINE_ACCENT = 'your way.';

/**
 * The Connect launcher home menu: a hero attorney video, then a 2×2 grid of
 * channel cards with "Send your details" below. The layout is the SAME for
 * every widget size — the size setting only controls the collapsed teaser on
 * the host page, never this expanded view. Channels route into their own view
 * (reversible); email is the demoted "Send your details" card.
 */
export function ConnectHome({ onClose, onMinimize, onExpand, isExpanded }: ConnectHomeProps) {
  const branding = useWidgetStore((s) => s.branding);
  const settings = useWidgetStore((s) => s.connect);
  const setConnectView = useWidgetStore((s) => s.setConnectView);

  const firmName = branding?.name ?? 'our team';
  const ranked = rankChannels(settings).slice(0, 4);
  const hasEmail = settings.channels.includes('email');

  const go = (id: ConnectChannel) => {
    // 'email' now routes to the stepwise "Send your details" form (not mailto).
    setConnectView(id);
  };

  const headline = (
    <h2 className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">
      {HEADLINE_LEAD} <span className="text-famaash">{HEADLINE_ACCENT}</span>
    </h2>
  );

  // Hero video + 2×2 channel grid — identical across every widget size.
  return (
    <div className="flex h-full w-full flex-col bg-white" role="dialog" aria-label={`Contact ${firmName}`}>
      <div className="relative shrink-0">
        {/* Full-width cover video; only the expanded view gets a taller frame. */}
        <ConnectVideo className={cn('w-full', isExpanded ? 'h-[400px]' : 'aspect-[16/11] max-h-[248px]')} />
        <div className="absolute right-2.5 top-2.5">
          <WidgetControls tone="overlay" onClose={onClose} onMinimize={onMinimize} onExpand={onExpand} isExpanded={isExpanded} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 pt-3">
        {headline}
        <StatusLine className="mt-2.5" />

        {isExpanded ? (
          // Expanded: a stacked list of full-width channel rows.
          <div className="mt-3.5 flex flex-col gap-2.5">
            {ranked.map((id) => (
              <RowChannelCard key={id} id={id} onClick={() => go(id)} />
            ))}
          </div>
        ) : (
          // Portrait: a compact 2×2 grid.
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            {ranked.map((id) => (
              <GridChannelCard key={id} id={id} onClick={() => go(id)} />
            ))}
          </div>
        )}

        {hasEmail && (
          <div className="mt-3">
            <RowChannelCard id="email" onClick={() => go('email')} />
          </div>
        )}
      </div>

      <PoweredByFooter />
    </div>
  );
}

function RowChannelCard({ id, onClick }: { id: ConnectChannel; onClick: () => void }) {
  const meta = CHANNEL_META[id];
  const Icon = CHANNEL_ICON[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3 text-left transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-famaash-soft text-ink">
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-tight text-ink">{meta.label}</span>
        <span className="mt-0.5 block text-[12.5px] text-muted">{meta.sublabel}</span>
      </span>
      <ChevronRightIcon size={17} className="shrink-0 text-muted-soft" aria-hidden="true" />
    </button>
  );
}

function GridChannelCard({ id, onClick }: { id: ConnectChannel; onClick: () => void }) {
  const meta = CHANNEL_META[id];
  const Icon = CHANNEL_ICON[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-white p-2.5 text-left transition-colors hover:border-famaash-stroke hover:bg-famaash-soft"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-famaash-soft text-ink">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold leading-tight text-ink">{meta.label}</span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted">{meta.sublabel}</span>
      </span>
    </button>
  );
}

function StatusLine({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-[12.5px] font-medium text-success', className)}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
      A real person in ~60 sec &middot; 24/7
    </div>
  );
}

