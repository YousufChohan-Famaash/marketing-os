import { Suspense, lazy } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { EmergencyModal } from './EmergencyModal';
import { HumanTakeoverModal } from './HumanTakeoverModal';
import { SpinnerIcon } from '../utils/icons';

// Lazy chunks — each loaded only when its modal opens.
const VoiceCallChunk = lazy(() => import('./lazy/VoiceCallChunk'));
const VideoRecorderChunk = lazy(() => import('./lazy/VideoRecorderChunk'));

function ChunkFallback() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm">
      <div className="rounded-full bg-white p-3 shadow-lg">
        <SpinnerIcon size={20} className="text-famaash" />
      </div>
    </div>
  );
}

export function ModalHost() {
  const activeModal = useWidgetStore((s) => s.activeModal);

  if (!activeModal) return null;

  if (activeModal === 'human-takeover') return <HumanTakeoverModal />;
  if (activeModal === 'emergency') return <EmergencyModal />;

  return (
    <Suspense fallback={<ChunkFallback />}>
      {activeModal === 'voice' && <VoiceCallChunk />}
      {activeModal === 'video' && <VideoRecorderChunk />}
    </Suspense>
  );
}
