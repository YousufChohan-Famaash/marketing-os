import { useWidgetStore } from '../store/widgetStore';
import { ChevronDownIcon, ChevronUpIcon } from '../utils/icons';
import { useT } from '../i18n';

export function CaptureProgress() {
  const capturedFields = useWidgetStore((s) => s.capturedFields);
  const progressTotal = useWidgetStore((s) => s.progressTotal);
  const isCaptureDrawerOpen = useWidgetStore((s) => s.isCaptureDrawerOpen);
  const toggle = useWidgetStore((s) => s.toggleCaptureDrawer);
  const t = useT();

  const captured = Object.keys(capturedFields).length;
  if (captured === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isCaptureDrawerOpen}
      aria-controls="capture-drawer"
      className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 py-1 text-[12px] font-medium text-ink-soft shadow-sm hover:bg-subtle"
    >
      <span>
        <span className="font-semibold text-ink">{captured}</span> {t('of')} {progressTotal} {t('details captured')}
      </span>
      {isCaptureDrawerOpen ? (
        <ChevronUpIcon size={12} aria-hidden="true" />
      ) : (
        <ChevronDownIcon size={12} aria-hidden="true" />
      )}
    </button>
  );
}
