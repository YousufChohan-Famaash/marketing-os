import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSocket } from "../services/socketContext";
import { useWidgetStore } from "../store/widgetStore";
import { uploadMedia } from "../services/api";
import { generateId } from "../utils/id";
import { canRecordMedia, useMediaNote, type MediaKind } from "../utils/useMediaNote";
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
  const allowVoiceNotes = useWidgetStore((s) => s.connect.allowVoiceNotes);
  const allowVideoNotes = useWidgetStore((s) => s.connect.allowVideoNotes);
  const socket = useSocket();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [value, setValue] = useState("");

  // WhatsApp-style voice/video note: record → optimistic bubble → upload → send.
  const sendMedia = (blob: Blob, kind: MediaKind, durationMs: number) => {
    const store = useWidgetStore.getState();
    const clientId = generateId("msg_media");
    const localUrl = URL.createObjectURL(blob);
    store.addMessage({
      id: clientId,
      role: "lead",
      type: "media",
      content: "",
      mediaKind: kind,
      mediaUrl: localUrl,
      mediaDurationMs: durationMs,
      timestamp: Date.now(),
      status: "sending",
    });
    store.setUndoable(clientId);
    const conversationId = store.conversationId;
    if (!conversationId || !socket) {
      store.updateMessage(clientId, { status: "failed" });
      return;
    }
    uploadMedia(conversationId, kind, blob, durationMs)
      .then((res) => {
        store.updateMessage(clientId, { mediaUrl: res.url || localUrl, status: "sent" });
        socket.send({
          type: "lead_media_message",
          clientMessageId: clientId,
          kind,
          url: res.url,
          mediaId: res.mediaId,
          mimeType: res.mimeType,
          durationMs: res.durationMs ?? Math.round(durationMs),
        });
        store.beginTyping();
      })
      .catch(() => store.updateMessage(clientId, { status: "failed" }));
  };

  const note = useMediaNote(sendMedia);
  const startVideoNote = () =>
    void note.start("video", (stream) => {
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        void previewRef.current.play();
      }
    });

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
    // Offer an Undo for the grace window.
    useWidgetStore.getState().setUndoable(clientId);
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

  if (note.recording) {
    const secs = Math.floor(note.elapsedMs / 1000);
    const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    return (
      <div className="shrink-0 bg-white px-3 py-2.5">
        <div className="flex items-center gap-3 rounded-pill bg-[#EEEEFF] px-3 py-2">
          {note.recording === "video" && (
            <video
              ref={previewRef}
              muted
              playsInline
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          )}
          <span className="flex items-center gap-2 text-[13px] font-semibold tabular-nums text-[#1A1A1A]">
            <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" aria-hidden="true" />
            {mmss}
          </span>
          <span className="flex-1 truncate text-[12px] text-muted">
            {note.recording === "video" ? "Recording video…" : "Recording voice note…"}
          </span>
          <button
            type="button"
            onClick={note.cancel}
            className="rounded-full px-3 py-1 text-[12px] font-semibold text-muted hover:bg-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={note.stop}
            aria-label="Send recording"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-famaash text-white"
          >
            <SendArrowIcon size={15} />
          </button>
        </div>
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
            {/* Voice/video notes (WhatsApp-style). Prefer recording when the
                firm enables it; otherwise fall back to the legacy modals. */}
            {allowVoiceNotes && canRecordMedia() ? (
              <ComposerIcon label="Record a voice note" onClick={() => void note.start("audio")}>
                <MicIcon size={17} />
              </ComposerIcon>
            ) : (
              flags?.voice && (
                <ComposerIcon label="Voice input" onClick={() => setActiveModal("voice")}>
                  <MicIcon size={17} />
                </ComposerIcon>
              )
            )}
            {allowVideoNotes && canRecordMedia() ? (
              <ComposerIcon label="Record a video note" onClick={startVideoNote}>
                <VideoIcon size={17} />
              </ComposerIcon>
            ) : (
              flags?.video_record && (
                <ComposerIcon label="Record a video" onClick={() => setActiveModal("video")}>
                  <VideoIcon size={17} />
                </ComposerIcon>
              )
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
