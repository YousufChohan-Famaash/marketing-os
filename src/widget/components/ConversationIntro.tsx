import { useWidgetStore } from "../store/widgetStore";
import { resolveAssistantAvatar } from "../config/demoMedia";
import { Avatar } from "./Avatar";

/**
 * The pinned greeting at the top of the chat. The video itself is the morphing
 * stage above (ChannelMorphVideo, driven by WidgetShell); this is just the
 * assistant's opening line + avatar, so it reads as the first message.
 */
export function ConversationIntro() {
  const branding = useWidgetStore((s) => s.branding);
  const assistantName = branding?.assistantName ?? branding?.name ?? "Assistant";
  const assistantAvatar = resolveAssistantAvatar(branding?.assistantAvatarUrl);

  return (
    <div className="flex w-full items-start gap-3">
      <div className="relative shrink-0">
        <Avatar src={assistantAvatar} name={assistantName} size={40} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-success"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#1A1A1A]">
          Let&apos;s talk about it
        </h2>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">
          Chat with us! You can also continue this on your phone or schedule a
          call with one of our experts.
        </p>
      </div>
    </div>
  );
}
