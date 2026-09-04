import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar } from '../config/demoMedia';
import { Avatar } from './Avatar';
import { useT } from '../i18n';

export function TypingIndicator() {
  const t = useT();
  const branding = useWidgetStore((s) => s.branding);
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);
  const name = agentTakeover?.agentName ?? branding?.assistantName ?? 'Assistant';
  const src = agentTakeover ? undefined : resolveAssistantAvatar(branding?.assistantAvatarUrl);

  return (
    <div
      className="flex w-full items-end gap-2"
      role="status"
      aria-label={t('Assistant is typing')}
    >
      <Avatar src={src} name={name} size={28} />
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#E9E9EB] px-3.5 py-3">
        <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
        <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
        <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
      </div>
    </div>
  );
}
