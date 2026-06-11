import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSocket } from "../services/socketContext";
import { useWidgetStore } from "../store/widgetStore";
import { generateId } from "../utils/id";
import {
  MicIcon,
  SendArrowIcon,
  TextFormatIcon,
  VideoIcon,
} from "../utils/icons";
import { cn } from "../utils/cn";

const MAX_HEIGHT_PX = 120;

export interface ComposerHandle {
  focus(): void;
}

export const Composer = forwardRef<ComposerHandle>(function Composer(_, ref) {
  const flags = useWidgetStore((s) => s.flags);
  const addMessage = useWidgetStore((s) => s.addMessage);
  const beginTyping = useWidgetStore((s) => s.beginTyping);
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const conversationEnded = useWidgetStore((s) => s.conversationEnded);
  const socket = useSocket();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`;
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || !socket) return;
    const clientId = generateId("msg_lead");
    addMessage({
      id: clientId,
      role: "lead",
      type: "text",
      content: trimmed,
      timestamp: Date.now(),
      status: "sent",
    });
    socket.send({
      type: "lead_message",
      content: trimmed,
      clientMessageId: clientId,
    });
    // Show the typing dots immediately while we wait for the AI's reply.
    beginTyping();
    setValue("");
    requestAnimationFrame(autoResize);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0;

  if (conversationEnded) {
    return (
      <div className="shrink-0 bg-white px-3 py-3 text-center">
        <p className="text-[12px] text-muted">This conversation has ended.</p>
      </div>
    );
  }

  return (
    <div className="shrink-0 bg-white px-3 py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        {/* Left icon group */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-pill bg-[#EEEEFF] px-1.5 py-1.5">
          <ComposerIcon
            label="Format text"
            onClick={() => textareaRef.current?.focus()}
          >
            <TextFormatIcon size={17} />
          </ComposerIcon>
          <div
            className={cn(
              "flex items-center gap-0.5 overflow-hidden transition-all duration-150",
              canSend ? "max-w-0 opacity-0" : "max-w-[72px] opacity-100",
            )}
          >
            {flags?.voice && (
              <ComposerIcon
                label="Voice input"
                onClick={() => setActiveModal("voice")}
              >
                <MicIcon size={17} />
              </ComposerIcon>
            )}
            {flags?.video_record && (
              <ComposerIcon
                label="Record a video"
                onClick={() => setActiveModal("video")}
              >
                <VideoIcon size={17} />
              </ComposerIcon>
            )}
          </div>
        </div>

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
          className="font-message min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-relaxed placeholder:text-muted-soft focus:outline-none"
          style={{ maxHeight: MAX_HEIGHT_PX }}
          aria-label="Message"
        />

        {/* Send pill */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-pill py-1.5 pr-1.5 transition-colors",
            canSend ? "bg-[#EEEEFF]" : "pl-3.5 cursor-not-allowed opacity-60",
          )}
        >
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-[13px] font-medium text-[#1A1A1A] transition-all duration-150",
              canSend ? "max-w-0 opacity-0" : "max-w-[40px] opacity-100",
            )}
          >
            Send
          </span>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors",
              canSend ? "bg-famaash" : "bg-muted-soft",
            )}
          >
            <SendArrowIcon size={15} />
          </span>
        </button>
      </form>
    </div>
  );
});

function ComposerIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[#6B6B8A] transition-colors hover:bg-white/70"
    >
      {children}
    </button>
  );
}
