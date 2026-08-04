import { useEffect, useRef, useState } from 'react';
import type { Message, ScopeChip as ScopeChipModel } from '../types/domain';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { CalendarPicker } from './CalendarPicker';
import { ChatOpenerChips } from './ChatOpenerChips';
import { ConversationIntro } from './ConversationIntro';
import { DocumentSignCard } from './DocumentSignCard';
import { DocumentUploadCard } from './DocumentUploadCard';
import { EmailInput, NameInput, NumberInput, PhoneInput } from './FieldInputs';
import { FileUploadZone } from './FileUploadZone';
import { LinkCard } from './LinkCard';
import { MediaMessageBubble } from './MediaMessageBubble';
import { MessageBubble } from './MessageBubble';
import { QuickReplyChips } from './QuickReplyChips';
import { RetainerCard } from './RetainerCard';
import { ScopeChip } from './ScopeChip';
import { TypingIndicator } from './TypingIndicator';
import { VideoMessage } from './VideoMessage';

type TimelineItem =
  | { kind: 'message'; order: number; data: Message }
  | { kind: 'chip'; order: number; data: ScopeChipModel };

const SCROLL_TOLERANCE = 64;

/**
 * Coerce `options` to a clean string[]. The backend should send plain strings
 * (it normalizes option objects to their label), but we defend against
 * `{label,value}` shapes and stray empties so chips always render.
 */
function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      if (typeof o === 'string') return o;
      if (o && typeof o === 'object') {
        const obj = o as Record<string, unknown>;
        return String(obj.label ?? obj.value ?? obj.text ?? '');
      }
      return String(o);
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MessageList({
  topSpacerHeight,
  onInteract,
  hideIntro,
}: {
  /** Reserves the collapsing video stage's height at the top of the scroll so
   * the conversation sits below the video and slides up as it collapses. */
  topSpacerHeight?: number;
  /** Fires on scroll so the parent can collapse the video stage into the header. */
  onInteract?: () => void;
  /** Hide the text greeting while the video stage is expanded — the playing clip
   * IS the greeting then, and hiding the text frees room for more opener pills.
   * The greeting appears once the video collapses into the thumbnail. */
  hideIntro?: boolean;
} = {}) {
  const messages = useWidgetStore((s) => s.messages);
  const chips = useWidgetStore((s) => s.chips);
  const isAiTyping = useWidgetStore((s) => s.isAiTyping);
  // The case-type opener now lives inside the chat: greeting (ConversationIntro)
  // + these pills, shown until the lead picks a type.
  const caseTypePicked = useWidgetStore((s) => s.caseTypePicked);
  const setActiveSigning = useWidgetStore((s) => s.setActiveSigning);
  const updateMessage = useWidgetStore((s) => s.updateMessage);

  const socket = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  // Order by client arrival sequence (seq), not server timestamps — the latter
  // aren't monotonic against client-stamped lead bubbles. Fall back to timestamp
  // only if seq is somehow absent.
  const timeline: TimelineItem[] = [
    ...messages.map<TimelineItem>((m) => ({
      kind: 'message',
      order: m.seq ?? m.timestamp,
      data: m,
    })),
    ...chips.map<TimelineItem>((c) => ({
      kind: 'chip',
      order: c.seq ?? c.timestamp,
      data: c,
    })),
  ].sort((a, b) => a.order - b.order);

  // Auto-follow the conversation only once there are real messages — never the
  // opener (greeting + pills), so entering the chat leaves the video stage in
  // view instead of scrolling past it (which would look like an instant collapse).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned || timeline.length === 0) return;
    el.scrollTop = el.scrollHeight;
  }, [timeline.length, isAiTyping, pinned]);

  // Re-pin to bottom whenever the message content of the LAST message grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned || messages.length === 0) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.map((m) => m.content).join('|'), pinned]);

  // On mount, jump straight to the latest message when a transcript already
  // exists — i.e. a RESUMED chat. (A fresh chat mounts empty; we skip it so the
  // greeting + video stage stay in view rather than scrolling past them.) A
  // resumed transcript often contains async-loading media (images, video,
  // cards) that grow the scroll height AFTER the first paint, so a single
  // synchronous scroll landed above the true bottom — resume opened near the
  // top. Re-assert the bottom across the next few frames + a short delay so the
  // late layout is caught and we land on the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || timeline.length === 0) return undefined;
    const jump = () => { el.scrollTop = el.scrollHeight; };
    const rafs: number[] = [];
    let cancelled = false;
    const schedule = (n: number) => {
      if (cancelled || n === 0) return;
      rafs.push(requestAnimationFrame(() => { jump(); schedule(n - 1); }));
    };
    setPinned(true);
    jump();
    schedule(3);
    const t = setTimeout(jump, 300);
    return () => { cancelled = true; rafs.forEach(cancelAnimationFrame); clearTimeout(t); };
    // Resume = a fresh mount of this component; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distanceFromBottom <= SCROLL_TOLERANCE);
  };

  const sendQuickReply = (msg: Message, option: string) => {
    if (!socket) return;
    // The chosen chip stays highlighted in place (no mirrored lead bubble).
    updateMessage(msg.id, { selectedOption: option });
    socket.send({ type: 'quick_reply_selected', messageId: msg.id, selectedOption: option });
    useWidgetStore.getState().beginTyping();
  };

  const sendDate = (msg: Message, value: { iso: string; label: string }) => {
    if (!socket) return;
    // Collapse the picker; show the friendly label, but send ISO to the backend.
    updateMessage(msg.id, { selectedOption: value.label });
    const leadId = generateId('msg_lead');
    useWidgetStore.getState().addMessage({
      id: leadId,
      role: 'lead',
      type: 'text',
      content: value.label,
      timestamp: Date.now(),
      status: 'sent',
    });
    // Date fields expect an unambiguous ISO YYYY-MM-DD reply.
    socket.send({ type: 'lead_message', content: value.iso, clientMessageId: leadId });
    useWidgetStore.getState().beginTyping();
    useWidgetStore.getState().setUndoable(leadId);
  };

  // Generic answer for typed widgets (name/phone/email/number) and quick-date
  // chips: shows the lead bubble and sends the value as a lead_message verbatim.
  const sendLeadAnswer = (msg: Message, content: string) => {
    if (!socket) return;
    updateMessage(msg.id, { selectedOption: content });
    const leadId = generateId('msg_lead');
    useWidgetStore.getState().addMessage({
      id: leadId,
      role: 'lead',
      type: 'text',
      content,
      timestamp: Date.now(),
      status: 'sent',
    });
    socket.send({ type: 'lead_message', content, clientMessageId: leadId });
    useWidgetStore.getState().beginTyping();
    useWidgetStore.getState().setUndoable(leadId);
  };

  const handleFilesUploaded = (msg: Message, files: Message['files'] = []) => {
    if (!socket || !files || files.length === 0) return;
    updateMessage(msg.id, { files });
    socket.send({ type: 'file_uploaded', files });
    useWidgetStore.getState().beginTyping();
  };

  const handleRetainerReview = (msg: Message) => {
    // Legacy single retainer card — sign inline; backend auto-resolves the retainer.
    setActiveSigning({ name: 'Retainer Agreement', messageId: msg.id });
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      // Collapse the video stage only on a genuine user scroll gesture (wheel /
      // touch) — not the programmatic auto-scroll, which would collapse it the
      // instant the chat opens.
      onWheel={onInteract}
      onTouchMove={onInteract}
      className="flex-1 overflow-y-auto px-4 py-3"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
      aria-label="Conversation"
    >
      {topSpacerHeight != null && (
        <div
          className="shrink-0 transition-[height] duration-500 ease-out"
          style={{ height: topSpacerHeight }}
          aria-hidden="true"
        />
      )}
      {/* While the video is expanded (hideIntro) the greeting + grid are hidden;
          the pills are overlaid on the video instead. Once it collapses to the
          thumbnail, the greeting + grid render here as normal. */}
      {!hideIntro && <ConversationIntro />}
      {!caseTypePicked && !hideIntro && <ChatOpenerChips />}
      <div className="mt-2 flex flex-col gap-3">
        {timeline.map((item) => {
          if (item.kind === 'chip') {
            return (
              <div key={`chip_${item.data.id}`} className="flex justify-start">
                <ScopeChip chip={item.data} />
              </div>
            );
          }
          const m = item.data;
          if (m.type === 'video_intro' || m.type === 'video_message') {
            return <VideoMessage key={m.id} message={m} />;
          }
          if (m.type === 'media') {
            return <MediaMessageBubble key={m.id} message={m} />;
          }
          if (m.type === 'link_card' && m.linkCard) {
            return <LinkCard key={m.id} card={m.linkCard} />;
          }
          if (m.type === 'retainer') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  <RetainerCard message={m} onReviewAndSign={() => handleRetainerReview(m)} />
                }
              />
            );
          }
          if (m.type === 'document_sign') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={<DocumentSignCard message={m} />}
              />
            );
          }
          if (m.type === 'document_upload') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={<DocumentUploadCard message={m} />}
              />
            );
          }
          if (m.type === 'date_picker') {
            const quickDates = normalizeOptions(m.options);
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming &&
                  !m.selectedOption && (
                    <div>
                      {quickDates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {quickDates.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => sendLeadAnswer(m, opt)}
                              className="rounded-pill border border-famaash-stroke bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F8FB]"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      <CalendarPicker
                        mode={m.datePickerMode}
                        onSubmit={(value) => sendDate(m, value)}
                      />
                    </div>
                  )
                }
              />
            );
          }
          if (m.type === 'name_input') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming &&
                  !m.selectedOption && (
                    <NameInput onSubmit={(c) => sendLeadAnswer(m, c)} />
                  )
                }
              />
            );
          }
          if (m.type === 'phone_input') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming &&
                  !m.selectedOption && (
                    <PhoneInput onSubmit={(c) => sendLeadAnswer(m, c)} />
                  )
                }
              />
            );
          }
          if (m.type === 'email_input') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming &&
                  !m.selectedOption && (
                    <EmailInput onSubmit={(c) => sendLeadAnswer(m, c)} />
                  )
                }
              />
            );
          }
          if (m.type === 'number_input') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming &&
                  !m.selectedOption && (
                    <NumberInput onSubmit={(c) => sendLeadAnswer(m, c)} />
                  )
                }
              />
            );
          }
          if (m.type === 'quick_reply') {
            const opts = normalizeOptions(m.options);
            if (opts.length > 0) {
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  affordance={
                    !m.isStreaming && (
                      <QuickReplyChips
                        options={opts}
                        selected={m.selectedOption}
                        multiSelect={m.multiSelect}
                        onSelect={(opt) => sendQuickReply(m, opt)}
                      />
                    )
                  }
                />
              );
            }
          }
          if (m.type === 'file_upload' && m.role !== 'lead') {
            return (
              <MessageBubble
                key={m.id}
                message={m}
                affordance={
                  !m.isStreaming && (
                    <FileUploadZone
                      onComplete={(files) => handleFilesUploaded(m, files)}
                    />
                  )
                }
              />
            );
          }
          return <MessageBubble key={m.id} message={m} />;
        })}
        {isAiTyping && <TypingIndicator />}
      </div>
    </div>
  );
}
