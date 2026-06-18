import { memo, useMemo, type ReactNode } from 'react';
import type { Message } from '../types/domain';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { resolveAssistantAvatar } from '../config/demoMedia';
import { cn } from '../utils/cn';
import { findLeadEmail, useGravatar } from '../utils/useGravatar';
import { UndoIcon } from '../utils/icons';
import { Avatar } from './Avatar';
import { matchPracticeIcon } from './BrandAssets';
import { RichText } from './RichText';

interface MessageBubbleProps {
  message: Message;
  /** Renders below the bubble — e.g. QuickReplyChips, FileUploadZone, retainer card. */
  affordance?: ReactNode;
}

function bubbleStyle(role: Message['role']): string {
  if (role === 'lead') {
    // Match the AI bubble radius, mirrored: rounded-2xl with a bottom-right tail.
    // bg uses the brand-light tint so the lead bubble themes with the host site.
    return 'bg-famaash-light text-[#1A1A1A] rounded-2xl rounded-br-md border border-[#F3F3F3] ml-auto';
  }
  if (role === 'agent') {
    return 'bg-success-soft text-ink rounded-2xl rounded-bl-md border border-success/30 font-message';
  }
  // AI: iMessage-style incoming bubble — soft gray, left-aligned, tail bottom-left.
  return 'bg-[#E9E9EB] text-[#1E2939] rounded-2xl rounded-bl-md font-message';
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

  // Slightly larger, more readable text when the chat is in its expanded size.
  const isExpanded = useWidgetStore((s) => s.isExpanded);
  const branding = useWidgetStore((s) => s.branding);
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);

  // A human-feeling avatar beside incoming (assistant / live-agent) messages.
  const isAgent = message.role === 'agent';
  const avatarName = isAgent
    ? agentTakeover?.agentName ?? branding?.assistantName ?? 'Agent'
    : branding?.assistantName ?? 'Assistant';
  const avatarSrc = isAgent ? undefined : resolveAssistantAvatar(branding?.assistantAvatarUrl);

  // The lead gets their Gravatar on the right — but only if one actually exists
  // for the email they gave us (otherwise the avatar renders nothing).
  const socket = useSocket();
  const undoableMessageId = useWidgetStore((s) => s.undoableMessageId);
  const canUndo = isLead && undoableMessageId === message.id;
  const undo = () => {
    socket?.send({ type: 'retract_message', clientMessageId: message.id });
    useWidgetStore.getState().removeMessage(message.id);
    useWidgetStore.getState().clearUndoable();
  };

  const capturedFields = useWidgetStore((s) => s.capturedFields);
  const messages = useWidgetStore((s) => s.messages);
  const leadEmail = useMemo(
    () => (isLead ? findLeadEmail(capturedFields, messages) : undefined),
    [isLead, capturedFields, messages],
  );
  const leadAvatar = useGravatar(leadEmail);

  return (
    <div
      className={cn(
        'group flex w-full gap-2',
        isLead ? 'justify-end' : 'justify-start',
      )}
    >
      {isAi && <Avatar src={avatarSrc} name={avatarName} size={28} className="mt-0.5" />}
      {/* Undo lives beside the (last) lead message — only the latest is undoable. */}
      {isLead && canUndo && (
        <button
          type="button"
          onClick={undo}
          aria-label="Undo message"
          title="Undo"
          className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full text-muted-soft transition-colors hover:bg-subtle hover:text-ink"
        >
          <UndoIcon size={15} />
        </button>
      )}
      <div
        className={cn(
          'flex min-w-0 max-w-[88%] flex-col gap-1',
          isLead ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'inline-flex max-w-full px-4 py-2.5 leading-relaxed',
            isExpanded ? 'text-[0.875rem]' : 'text-[0.8125rem]',
            'whitespace-pre-wrap break-words',
            // Lead/agent keep a subtle shadow; the AI gray bubble stays flat (iMessage-like).
            message.role !== 'ai' && 'shadow-sm',
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
      {isLead && leadAvatar && (
        <Avatar src={leadAvatar} size={28} fallback="none" className="mt-0.5" />
      )}
    </div>
  );
});
