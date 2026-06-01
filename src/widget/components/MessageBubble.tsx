import { memo, type ReactNode } from 'react';
import type { Message } from '../types/domain';
import { cn } from '../utils/cn';
import { matchPracticeIcon } from './BrandAssets';
import { RichText } from './RichText';

interface MessageBubbleProps {
  message: Message;
  /** Renders below the bubble — e.g. QuickReplyChips, FileUploadZone, retainer card. */
  affordance?: ReactNode;
}

function bubbleStyle(role: Message['role']): string {
  if (role === 'lead') {
    // Figma: light-purple pill, dark text, right-aligned.
    return 'bg-[#EEEEFF] text-[#1A1A1A] rounded-pill border border-[#F3F3F3] ml-auto';
  }
  if (role === 'agent') {
    return 'bg-success-soft text-ink rounded-2xl rounded-bl-md border border-success/30 font-message';
  }
  // AI: no bubble chrome in the new design — plain text in the message font.
  return 'bg-transparent text-[#1E2939] font-message';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const MessageBubble = memo(function MessageBubble({
  message,
  affordance,
}: MessageBubbleProps) {
  const isLead = message.role === 'lead';
  const isAi = message.role === 'ai' || message.role === 'agent';
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';
  const leadIcon = isLead ? matchPracticeIcon(message.content, 16) : null;

  return (
    <div
      className={cn(
        'group flex flex-col gap-1',
        isLead ? 'items-end' : 'items-start',
      )}
    >
      <div
        className={cn(
          'inline-flex max-w-[88%] text-[0.8125rem] leading-relaxed',
          'whitespace-pre-wrap break-words',
          // AI text is chrome-free; lead/agent keep bubble padding + shadow.
          message.role === 'ai' ? 'px-0.5 py-1' : 'px-4 py-2.5 shadow-sm',
          bubbleStyle(message.role),
          message.isStreaming && 'stream-cursor',
        )}
      >
        {message.hasMarkdown && isAi ? (
          <RichText content={message.content} />
        ) : isLead ? (
          <span className="flex items-center gap-2">
            {leadIcon}
            <span>{message.content}</span>
          </span>
        ) : (
          <span>{message.content}</span>
        )}
      </div>
      {affordance && <div className="w-full">{affordance}</div>}
      <div
        className={cn(
          'flex items-center gap-1 px-2 text-[10px] text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100',
          isLead ? 'self-end' : 'self-start',
        )}
      >
        {isSending && <span>Sending…</span>}
        {isFailed && <span className="text-danger">Failed to send</span>}
        {!isSending && !isFailed && <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>}
      </div>
    </div>
  );
});
