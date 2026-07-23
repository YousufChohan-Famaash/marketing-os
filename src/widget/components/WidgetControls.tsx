import { useEffect, useRef, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { CheckIcon, MinimizeIcon, CollapseIcon, GlobeIcon, MaximizeIcon, ReplayIcon } from '../utils/icons';
import { useIsFullscreen } from '../utils/useIsFullscreen';
import { cn } from '../utils/cn';

interface WidgetControlsProps {
  onClose: () => void;
  onMinimize: () => void;
  onReplay?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  /** 'overlay' floats over the hero video; 'solid' sits on the white header. */
  tone?: 'overlay' | 'solid';
}

export function WidgetControls({
  onMinimize,
  onReplay,
  onExpand,
  isExpanded = false,
  tone = 'solid',
}: WidgetControlsProps) {
  const wrap =
    tone === 'overlay'
      ? 'bg-white/70 backdrop-blur'
      : 'bg-[#F5F8FB] border border-[#EAEEF3]';

  // Expand/collapse is a no-op when the chat already fills the screen (mobile)
  // or in Small mode (the panel sizes itself around the conversation).
  const isFullscreen = useIsFullscreen();
  const isCompact = useWidgetStore((s) => s.connect.size !== 'large');
  const showExpand = Boolean(onExpand) && !isFullscreen && !isCompact;

  // Language picker only when the firm is multi-language AND offers >1 language.
  const multiLanguage = useWidgetStore((s) => s.flags?.multi_language);
  const languageCount = useWidgetStore((s) => s.languages.length);
  const showLanguage = Boolean(multiLanguage) && languageCount > 1;

  return (
    <div className={cn('flex items-center gap-0.5 rounded-pill px-1.5 py-1', wrap)}>
      {showLanguage && <LanguagePicker />}
      {onReplay && (
        <ControlBtn label="Replay video" onClick={onReplay}>
          <ReplayIcon size={15} />
        </ControlBtn>
      )}
      {showExpand && (
        <ControlBtn
          label={isExpanded ? 'Collapse chat' : 'Expand chat'}
          onClick={onExpand}
          active={isExpanded}
        >
          {isExpanded ? <CollapseIcon size={15} /> : <MaximizeIcon size={15} />}
        </ControlBtn>
      )}
      <ControlBtn label="Minimize chat" onClick={onMinimize}>
        <MinimizeIcon size={15} />
      </ControlBtn>
    </div>
  );
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  ar: 'العربية',
  fr: 'Français',
  pt: 'Português',
  de: 'Deutsch',
  zh: '中文',
  hi: 'हिन्दी',
};
const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code.toUpperCase();

/** Globe control that opens a menu of the firm's offered languages. */
function LanguagePicker() {
  const language = useWidgetStore((s) => s.language);
  const languages = useWidgetStore((s) => s.languages);
  const setLanguage = useWidgetStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ControlBtn label="Language" onClick={() => setOpen((o) => !o)} active={open}>
        <GlobeIcon size={15} />
      </ControlBtn>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-hairline bg-white py-1 shadow-lg">
          {languages.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLanguage(code);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-subtle',
                code === language ? 'font-semibold text-famaash' : 'text-ink',
              )}
            >
              <span>{languageName(code)}</span>
              {code === language && <CheckIcon size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'text-famaash' : 'text-ink-soft',
      )}
    >
      {children}
    </button>
  );
}
