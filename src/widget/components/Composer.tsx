import {
  forwardRef,
  useEffect,
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
import { useSpeechToText } from "../utils/useSpeechToText";
import {
  MicIcon,
  PlusIcon,
  SendArrowIcon,
  VideoIcon,
  WaveformIcon,
} from "../utils/icons";
import { cn } from "../utils/cn";

const MAX_HEIGHT_PX = 120;

// Mirror the backend caps (media-messages-guide §5) so we stop/refuse client-side
// instead of wasting an upload that the server would reject with 413.
const MEDIA_LIMITS: Record<MediaKind, { maxMs: number; maxBytes: number }> = {
  audio: { maxMs: 120_000, maxBytes: 15 * 1024 * 1024 },
  video: { maxMs: 60_000, maxBytes: 50 * 1024 * 1024 },
};

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
  const menuRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the attachment menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
    // Refuse oversized clips before uploading (server would 413 anyway).
    if (blob.size > MEDIA_LIMITS[kind].maxBytes) {
      store.updateMessage(clientId, { status: "failed" });
      return;
    }
    uploadMedia(conversationId, kind, blob, durationMs)
      .then((res) => {
        store.updateMessage(clientId, {
          mediaUrl: res.url || localUrl,
          mediaTranscript: res.transcript ?? undefined,
          status: "sent",
        });
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
  const startVideoNote = () => {
    stt.stop();
    void note.start("video", undefined, MEDIA_LIMITS.video.maxMs);
  };

  // Attach the live camera feed once the recording view has rendered. Doing this
  // in an effect (not the start callback) guarantees the <video> element exists.
  useEffect(() => {
    const v = previewRef.current;
    if (note.recording === "video" && v && note.stream) {
      v.srcObject = note.stream;
      void v.play();
    }
  }, [note.recording, note.stream]);

  // "Talk instead of type" dictation: final phrases drop into the textarea; the
  // live interim phrase shows as a preview strip above the composer.
  const stt = useSpeechToText({
    onText: (chunk) => {
      const clean = chunk.trim();
      if (!clean) return;
      setValue((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${clean}` : `${prev}${clean}`));
      requestAnimationFrame(autoResize);
    },
  });
  const startVoiceNote = () => {
    stt.stop();
    void note.start("audio", undefined, MEDIA_LIMITS.audio.maxMs);
  };

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
    stt.stop();
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

  // What the attachment (+) menu can offer, given firm config + browser support.
  const voiceAvailable = (allowVoiceNotes && canRecordMedia()) || Boolean(flags?.voice);
  const videoAvailable = (allowVideoNotes && canRecordMedia()) || Boolean(flags?.video_record);
  const hasAttachments = voiceAvailable || videoAvailable || stt.supported;

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
    const isVideo = note.recording === "video";
    return (
      <div className="shrink-0 bg-white px-3 py-2.5">
        {isVideo && (
          // Live camera preview so the lead sees exactly what's being recorded.
          <div className="relative mb-2 overflow-hidden rounded-2xl bg-black">
            <video
              ref={previewRef}
              muted
              playsInline
              autoPlay
              className="aspect-video w-full -scale-x-100 object-cover"
            />
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
              REC {mmss}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-pill bg-[#EEEEFF] px-3 py-2">
          {!isVideo && (
            <span className="flex items-center gap-2 text-[13px] font-semibold tabular-nums text-[#1A1A1A]">
              <span className="h-2.5 w-2.5 rounded-full bg-danger animate-pulse" aria-hidden="true" />
              {mmss}
            </span>
          )}
          <span className="flex-1 truncate text-[12px] text-muted">
            {isVideo ? "Recording video — tap send when done." : "Recording voice note…"}
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
      {stt.listening && (
        <div className="mb-2 flex items-center gap-2 rounded-pill bg-[#EEEEFF] px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-famaash">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            Listening
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] italic text-muted">
            {stt.interim || "Speak now — your words will appear in the box."}
          </span>
          <button
            type="button"
            onClick={stt.stop}
            className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-muted hover:bg-white/70"
          >
            Done
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        {/* Attachment menu: voice note, talk-to-type, video — behind a plus button. */}
        {hasAttachments && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Add voice, dictation, or video"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                menuOpen ? "bg-famaash text-white" : "bg-[#EEEEFF] text-[#6B6B8A] hover:text-famaash",
              )}
            >
              <PlusIcon size={18} className={cn("transition-transform duration-200", menuOpen && "rotate-45")} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-2xl border border-hairline bg-white py-1.5 shadow-lg"
              >
                {voiceAvailable && (
                  <AttachmentItem
                    icon={<MicIcon size={17} />}
                    label="Voice note"
                    hint="Record and send audio"
                    onClick={() => {
                      setMenuOpen(false);
                      if (allowVoiceNotes && canRecordMedia()) startVoiceNote();
                      else setActiveModal("voice");
                    }}
                  />
                )}
                {stt.supported && (
                  <AttachmentItem
                    icon={<WaveformIcon size={17} />}
                    label="Speech to text"
                    hint="Talk and we'll type it"
                    onClick={() => {
                      setMenuOpen(false);
                      stt.toggle();
                    }}
                  />
                )}
                {videoAvailable && (
                  <AttachmentItem
                    icon={<VideoIcon size={17} />}
                    label="Video"
                    hint="Record and send video"
                    onClick={() => {
                      setMenuOpen(false);
                      if (allowVideoNotes && canRecordMedia()) startVideoNote();
                      else setActiveModal("video");
                    }}
                  />
                )}
              </div>
            )}
          </div>
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
          placeholder={stt.listening ? "Listening…" : "Type a message…"}
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

function AttachmentItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-subtle"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEEEFF] text-famaash">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </button>
  );
}
