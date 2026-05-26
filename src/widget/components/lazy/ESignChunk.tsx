import { useRef, useState, type PointerEvent } from 'react';
import { useSocket } from '../../services/socketContext';
import { useWidgetStore } from '../../store/widgetStore';
import { Modal } from '../Modal';

export default function ESignChunk() {
  const setActiveModal = useWidgetStore((s) => s.setActiveModal);
  const messages = useWidgetStore((s) => s.messages);
  const updateMessage = useWidgetStore((s) => s.updateMessage);
  const socket = useSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  const close = () => setActiveModal(null);

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const submit = () => {
    if (!hasInk) return;
    setSigned(true);
    const retainerMsg = messages.find((m) => m.type === 'retainer');
    if (retainerMsg) {
      updateMessage(retainerMsg.id, { retainerStatus: 'signed' });
    }
    socket?.send({
      type: 'retainer_signed',
      envelopeId: 'DS-99481',
      signedAt: Date.now(),
    });
    setTimeout(close, 800);
  };

  return (
    <Modal
      title="Retainer agreement"
      description="33% contingency · DocuSign envelope #DS-99481"
      onClose={close}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk || signed}
            className="text-[12px] font-medium text-muted hover:text-ink disabled:opacity-50"
          >
            Clear signature
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!hasInk || signed}
            className="rounded-md bg-famaash px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-95 disabled:opacity-50"
          >
            {signed ? 'Signed ✓' : 'Sign'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-hairline bg-subtle p-3 text-[12px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">CONTINGENCY FEE RETAINER AGREEMENT</p>
          <p className="mt-2">
            This agreement is between you ("Client") and Famaash Law
            ("Firm"). The Firm will represent you on a contingency basis at 33% of any
            recovery. No fee unless we win.
          </p>
          <p className="mt-1.5 text-muted">[…full PDF preview omitted in prototype]</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            Sign below
          </p>
          <canvas
            ref={canvasRef}
            width={520}
            height={140}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="block h-[140px] w-full touch-none rounded-md border border-dashed border-hairline bg-white"
            aria-label="Signature pad"
          />
          {!hasInk && (
            <p className="mt-1 text-[11px] text-muted-soft">
              Draw your signature with your finger or pointer.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
