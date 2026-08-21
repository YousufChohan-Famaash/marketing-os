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
import { fetchCallStatus, uploadMedia } from "../services/api";
import type { ConnectCallStatus } from "../types/protocol";
import { generateId } from "../utils/id";
import { canRecordMedia, useMediaNote, type MediaKind } from "../utils/useMediaNote";
import { useSpeechToText } from "../utils/useSpeechToText";
import {
  MicIcon,
  PhoneIcon,
  PhoneOffIcon,
  PlusIcon,
  SendArrowIcon,
  VideoIcon,
  WaveformIcon,
} from "../utils/icons";
import { cn } from "../utils/cn";

// Terminal dial states that resolve the "Calling you now…" banner.
const TERMINAL_CALL_STATUSES = ["connected", "completed", "no_answer", "busy", "failed"];

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

interface ComposerProps {
  /** Fired when the field is focused — a clear engagement signal (e.g. collapse
   *  the in-chat video into the header thumbnail without waiting for the timer). */
  onFocus?: () => void;
  /** 'light' (default) sits on the white chat; 'glass' sits over the dark video
   *  (translucent field, light text) so the composer reads as part of the video. */
  tone?: 'light' | 'glass';
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { onFocus, tone = 'light' },
  ref,
) {
  const glass = tone === 'glass';
  const flags = useWidgetStore((s) => s.flags);
  const addMessage = useWidgetStore((s) => s.addMessage);
  const beginTyping = useWidgetStore((s) => s.beginTyping);
  // Before a case type is picked, the first typed message doubles as the
  // (free-text) case-type selection and kicks off the agent flow.
  const caseTypePicked = useWidgetStore((s) => s.caseTypePicked);
  const setCaseTypePicked = useWidgetStore((s) => s.setCaseTypePicked);
  const setPendingCaseType = useWidgetStore((s) => s.setPendingCaseType);
  const setConversationStarted = useWidgetStore((s) => s.setConversationStarted);
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const conversationEnded = useWidgetStore((s) => s.conversationEnded);
  const allowVoiceNotes = useWidgetStore((s) => s.connect.allowVoiceNotes);
  const allowVideoNotes = useWidgetStore((s) => s.connect.allowVideoNotes);
  // Mid-chat "Call me" (chat-in-call-button guide).
  const activeConversationId = useWidgetStore((s) => s.conversationId);
  const agentTakeover = useWidgetStore((s) => s.agentTakeover);
  const humanRequested = useWidgetStore((s) => s.humanRequested);
  const chatCallPhase = useWidgetStore((s) => s.chatCallPhase);
  const setChatCallPhase = useWidgetStore((s) => s.setChatCallPhase);
  const connectCallStatus = useWidgetStore((s) => s.connectCallStatus);
  const setConnectCallStatus = useWidgetStore((s) => s.setConnectCallStatus);
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

  // Resolve a mid-chat call from the pushed status (best-effort data channel).
  useEffect(() => {
    if (chatCallPhase !== "calling" || !connectCallStatus) return;
    if (connectCallStatus === "connected" || connectCallStatus === "completed") {
      setChatCallPhase("connected");
    } else if (
      connectCallStatus === "no_answer" ||
      connectCallStatus === "busy" ||
      connectCallStatus === "failed"
    ) {
      setChatCallPhase("failed");
    }
  }, [chatCallPhase, connectCallStatus, setChatCallPhase]);

  // Poll the persisted dial state as a backstop to the push. We deliberately do
  // NOT time out into a failure — the push is best-effort, so an absent event
  // just leaves the calling banner up rather than hard-failing the UI (guide §4).
  useEffect(() => {
    if (chatCallPhase !== "calling" || !activeConversationId) return undefined;
    let cancelled = false;
    const id = setInterval(async () => {
      const status = await fetchCallStatus(activeConversationId);
      if (cancelled) return;
      if (TERMINAL_CALL_STATUSES.includes(status)) {
        setConnectCallStatus(status as ConnectCallStatus);
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chatCallPhase, activeConversationId, setConnectCallStatus]);

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
    if (!trimmed) return;
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
    // No case type picked yet → the socket isn't up. Treat this message as the
    // free-text case-type selection: it starts the flow, and App flushes it to
    // the agent once the socket is ready (queued in pendingCaseType).
    if (!caseTypePicked) {
      setPendingCaseType({ type: "practice_area_selected", value: trimmed });
      setCaseTypePicked(true);
      setConversationStarted(true);
    } else if (socket) {
      socket.send({
        type: "lead_message",
        content: trimmed,
        clientMessageId: clientId,
      });
    }
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

  // Offer the mid-chat call only when there's a live conversation to resume, no
  // call is already in flight, and no human handoff is pending/active — offering
  // an AI callback while they wait on a person reads as ignoring them (guide §7).
  const callEligible =
    chatCallPhase === "idle" && !!activeConversationId && !agentTakeover && !humanRequested;

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

  // On the phone → composer read-only so the voice agent and the chat can't both
  // write the same intake and clobber each other (guide §6). The transcript above
  // stays visible; if the call drops (phase → failed) the composer comes back.
  if (chatCallPhase === "connected") {
    return (
      <div className="shrink-0 bg-white px-3 py-3">
        <div className="flex items-center justify-center gap-2 rounded-pill bg-[#ECFDF5] px-3 py-2 text-[12.5px] font-semibold text-[#047857]">
          <PhoneIcon size={14} aria-hidden="true" />
          We're on the phone with you.
        </div>
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
            {isVideo ? "Recording video. Tap send when done." : "Recording voice note…"}
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
    <div className={cn('shrink-0 px-3 py-2.5', glass ? 'bg-transparent' : 'bg-white')}>
      {/* Mid-chat call status / entry point (chat-in-call-button guide §4, §7). */}
      {chatCallPhase === "calling" && (
        <div className="mb-2 flex items-center gap-2 rounded-pill bg-[#EEEEFF] px-3 py-1.5 text-[12px] font-semibold text-famaash">
          <PhoneIcon size={13} aria-hidden="true" />
          Calling you now…
        </div>
      )}
      {chatCallPhase === "failed" && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12px] text-danger">
          <PhoneOffIcon size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">We couldn't reach you. Try again, or keep chatting here.</span>
          <button
            type="button"
            onClick={() => setActiveModal("call-me")}
            className="shrink-0 font-semibold underline hover:opacity-80"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              setChatCallPhase("idle");
              setConnectCallStatus(null);
            }}
            aria-label="Dismiss"
            className="shrink-0 rounded-full px-1 text-[14px] leading-none text-danger hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}
      {callEligible && (
        <button
          type="button"
          onClick={() => setActiveModal("call-me")}
          className="mb-2 inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-famaash-border hover:text-famaash"
        >
          <PhoneIcon size={13} aria-hidden="true" />
          Call me instead
        </button>
      )}
      {stt.listening && (
        <div className="mb-2 flex items-center gap-2 rounded-pill bg-[#EEEEFF] px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-famaash">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            Listening
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] italic text-muted">
            {stt.interim || "Speak now. Your words will appear in the box."}
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
        className={cn(
          'flex items-center gap-1 rounded-3xl border py-1 pl-1.5 pr-1.5',
          glass ? 'border-white/25 bg-white/10 backdrop-blur' : 'border-hairline bg-[#F7F8FA]',
        )}
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
                menuOpen
                  ? "bg-famaash text-white"
                  : glass
                    ? "text-white/85 hover:bg-white/15 hover:text-white"
                    : "text-muted hover:bg-white hover:text-famaash",
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
          onFocus={onFocus}
          placeholder={stt.listening ? "Listening…" : "Type a message…"}
          rows={1}
          // Match the widget's UI font (not the message serif) so the input
          // doesn't read as a foreign field. 16px on mobile so iOS Safari doesn't
          // auto-zoom (the field is centered); 15px from sm up.
          className={cn(
            "min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[16px] leading-relaxed focus:outline-none sm:text-[15px]",
            glass ? "text-white placeholder:text-white/55" : "placeholder:text-muted-soft",
          )}
          style={{ maxHeight: MAX_HEIGHT_PX }}
          aria-label="Message"
        />

        {/* Send: a single clean circle, brand-filled once there's something to send. */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors",
            canSend ? "bg-famaash hover:opacity-95" : "cursor-not-allowed bg-muted-soft",
          )}
        >
          <SendArrowIcon size={16} />
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
