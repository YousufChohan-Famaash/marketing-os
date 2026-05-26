import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { MicIcon, PaperclipIcon, SendIcon } from '../utils/icons';
import { cn } from '../utils/cn';

const MAX_HEIGHT_PX = 120;

export interface ComposerHandle {
  focus(): void;
}

export const Composer = forwardRef<ComposerHandle>(function Composer(_, ref) {
  const flags = useWidgetStore((s) => s.flags);
  const addMessage = useWidgetStore((s) => s.addMessage);
  const socket = useSocket();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`;
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || !socket) return;
    const clientId = generateId('msg_lead');
    addMessage({
      id: clientId,
      role: 'lead',
      type: 'text',
      content: trimmed,
      timestamp: Date.now(),
      status: 'sent',
    });
    socket.send({ type: 'lead_message', content: trimmed, clientMessageId: clientId });
    setValue('');
    requestAnimationFrame(autoResize);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-hairline bg-white px-3 py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        {flags?.file_upload && (
          <button
            type="button"
            aria-label="Attach file"
            className="shrink-0 rounded-md p-2 text-muted hover:bg-hairline-soft hover:text-ink"
          >
            <PaperclipIcon size={18} />
          </button>
        )}
        <label htmlFor="composer-textarea" className="sr-only">
          Type your message
        </label>
        <textarea
          ref={textareaRef}
          id="composer-textarea"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-md border border-hairline bg-subtle px-3 py-2 text-[14px] leading-relaxed placeholder:text-muted-soft focus:border-famaash-border focus:bg-white focus:outline-none"
          style={{ maxHeight: MAX_HEIGHT_PX }}
          aria-label="Message"
        />
        {flags?.voice && (
          <button
            type="button"
            aria-label="Voice input"
            className="shrink-0 rounded-md p-2 text-muted hover:bg-hairline-soft hover:text-ink"
          >
            <MicIcon size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'shrink-0 rounded-md p-2 transition-colors',
            canSend
              ? 'bg-famaash text-white hover:opacity-95'
              : 'cursor-not-allowed bg-hairline text-muted-soft',
          )}
        >
          <SendIcon size={16} />
        </button>
      </form>
    </div>
  );
});
