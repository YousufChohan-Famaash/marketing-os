/**
 * The pinned greeting at the top of the chat. The video itself is the morphing
 * stage above (ChannelMorphVideo, driven by WidgetShell); this is just the
 * assistant's opening line, so it reads as the first message.
 */
export function ConversationIntro() {
  return (
    <div className="flex w-full items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[18px] font-bold leading-snug tracking-[-0.02em] text-[#1A1A1A]">
          Let&apos;s talk about it
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-muted">
          Chat with us! You can also continue this on your phone or schedule a
          call with one of our experts.
        </p>
      </div>
    </div>
  );
}
