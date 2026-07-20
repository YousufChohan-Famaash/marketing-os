import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar } from '../config/demoMedia';
import { Avatar } from './Avatar';
import { cn } from '../utils/cn';

/**
 * Compact attorney presence: photo + name + a live cue. Shown at the top of the
 * channel/form views so tapping Call / Text / Schedule / Send keeps a human face
 * and warmth instead of dropping into a plain white form (feedback round 1, #1).
 */
export function AttorneyPresence({ className }: { className?: string }) {
  const branding = useWidgetStore((s) => s.branding);
  const name = branding?.assistantName ?? branding?.name ?? 'our team';
  const avatar = resolveAssistantAvatar(branding?.assistantAvatarUrl);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0">
        <Avatar src={avatar} name={name} size={44} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-bold leading-tight text-ink">{name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-success">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          A real person in ~60 sec
        </div>
      </div>
    </div>
  );
}
