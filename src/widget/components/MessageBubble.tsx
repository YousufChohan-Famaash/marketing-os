import { memo, type ReactNode } from 'react';
import type { Message } from '../types/domain';
import { cn } from '../utils/cn';
import { RichText } from './RichText';

interface MessageBubbleProps {
  message: Message;
  /** Renders below the bubble — e.g. QuickReplyChips, FileUploadZone, retainer card. */
  affordance?: ReactNode;
}

function bubbleStyle(role: Message['role']): string {
  if (role === 'lead') {
    return 'bg-famaash text-white rounded-2xl rounded-br-md ml-auto';
  }
  if (role === 'agent') {
    return 'bg-success-soft text-ink rounded-2xl rounded-bl-md border border-success/30';
  }
  return 'bg-subtle text-ink rounded-2xl rounded-bl-md border border-hairline';
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

  return (
    <div
      className={cn(
        'group flex flex-col gap-1',
        isLead ? 'items-end' : 'items-start',
      )}
    >
      <div
        className={cn(
          'inline-flex max-w-[85%] px-4 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm',
          'whitespace-pre-wrap break-words',
          bubbleStyle(message.role),
          message.isStreaming && 'stream-cursor',
        )}
      >
        {message.hasMarkdown && isAi ? (
          <RichText content={message.content} />
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
