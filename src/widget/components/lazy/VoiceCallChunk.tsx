import { useEffect, useState } from 'react';
import { useWidgetStore } from '../../store/widgetStore';
import { MicIcon, MicOffIcon, PhoneOffIcon } from '../../utils/icons';
import { Modal } from '../Modal';

export default function VoiceCallChunk() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const branding = useWidgetStore((s) => s.branding);
  const [connectStage, setConnectStage] = useState<'connecting' | 'connected'>('connecting');
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setConnectStage('connected'), 1500);
    return () => clearTimeout(t);
  }, []);

  const close = () => setActiveModal(null);

  return (
    <Modal
      title="Voice with AI agent"
      description={`Calling ${branding?.name ?? 'support'}…`}
      onClose={close}
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-famaash-light text-famaash">
          <span className="text-2xl font-semibold">
            {(branding?.name ?? 'A').charAt(0)}
          </span>
        </div>
        <p className="text-[13px] text-muted">
          {connectStage === 'connecting' ? 'Connecting to AI voice agent…' : 'Connected'}
        </p>
        <p className="rounded-md bg-warning-soft px-3 py-1.5 text-[11px] font-medium text-warning">
          This is a UI prototype. No real call is happening.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-ink hover:bg-hairline"
          >
            {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Hang up"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-danger text-white hover:opacity-90"
          >
            <PhoneOffIcon size={20} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
