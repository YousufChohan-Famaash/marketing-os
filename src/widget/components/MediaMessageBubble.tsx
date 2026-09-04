import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import type { Message } from '../types/domain';
import { useT } from '../i18n';

/**
 * A lead's recorded voice / video note in the transcript (right-aligned, brand
 * tinted). Uses native players for reliable playback. Shows upload status and
 * the same Undo affordance as text messages during the grace window.
 */
export function MediaMessageBubble({ message }: { message: Message }) {
  const t = useT();
  const socket = useSocket();
  const undoableMessageId = useWidgetStore((s) => s.undoableMessageId);
  const canUndo = undoableMessageId === message.id;
  const isVideo = message.mediaKind === 'video';
  const secs = Math.round((message.mediaDurationMs ?? 0) / 1000);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  const undo = () => {
    socket?.send({ type: 'retract_message', clientMessageId: message.id });
    useWidgetStore.getState().removeMessage(message.id);
    useWidgetStore.getState().clearUndoable();
  };

  return (
    <div className="group flex w-full flex-col items-end gap-1">
      <div className="overflow-hidden rounded-2xl rounded-br-md bg-famaash-light p-1.5">
        {isVideo ? (
          <video
            src={message.mediaUrl}
            controls
            playsInline
            className="block w-[230px] rounded-xl"
          />
        ) : (
          <audio src={message.mediaUrl} controls className="block w-[230px]" />
        )}
      </div>
      {!isVideo && message.mediaTranscript && (
        <p className="max-w-[250px] px-2 text-right text-[11px] italic leading-snug text-muted">
          🎤 {mmss} &middot; &ldquo;{message.mediaTranscript}&rdquo;
        </p>
      )}
      <div className="flex items-center gap-2 px-2 text-[10px] text-muted">
        {message.status === 'sending' && <span>{t('Uploading…')}</span>}
        {message.status === 'failed' && <span className="text-danger">{t("Couldn't send")}</span>}
        {canUndo && (
          <button type="button" onClick={undo} className="font-semibold text-famaash hover:underline">
            {t('Undo')}
          </button>
        )}
      </div>
    </div>
  );
}
