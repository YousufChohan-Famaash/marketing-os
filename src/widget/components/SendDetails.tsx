import { useEffect, useMemo, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import {
  ApiError,
  errorDetail,
  fetchWebFormConfig,
  submitWebForm,
  type WebFormConfig,
  type WebFormOption,
} from '../services/api';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FileIcon } from '../utils/icons';
import { cn } from '../utils/cn';

interface SendDetailsProps {
  consentLabel: string;
  /** Prefill from what the lead already shared in the chat session. */
  prefill: { name?: string; phone?: string; email?: string };
}

// Fallbacks only when /forms/config can't be reached — the live options are
// served by the backend (so labels can change without an FE deploy).
const FALLBACK_SEVERITY: WebFormOption[] = [
  { value: 'minor', label: 'Minor — treated and released' },
  { value: 'moderate', label: 'Moderate — ongoing treatment' },
  { value: 'severe', label: 'Severe — hospitalization or surgery' },
  { value: 'unsure', label: 'Not sure yet' },
];
const FALLBACK_TIMING: WebFormOption[] = [
  { value: 'within_week', label: 'Within the last week' },
  { value: '1_4_weeks', label: '1–4 weeks ago' },
  { value: '1_6_months', label: '1–6 months ago' },
  { value: 'over_6_months', label: 'More than 6 months ago' },
  { value: 'unsure', label: 'Not sure' },
];
const DEFAULT_CASE_LABELS = [
  'Car / motor vehicle accident',
  'Truck or commercial vehicle',
  'Slip & fall / premises',
  'Something else',
];

const STEP_TITLES = [
  'What type of case is this?',
  'How severe were the injuries?',
  'When did it happen?',
  'Where can we reach you?',
];

/** Pull UTM attribution off the URL, if any (best-effort; usually empty in-iframe). */
function readUtm(): Record<string, string> | undefined {
  if (typeof window === 'undefined') return undefined;
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  return Object.keys(utm).length ? utm : undefined;
}

/**
 * "Send your details" — a 4-step lead-capture wizard (case type → injury
 * severity → timing → contact). Options for steps 1–3 come from
 * GET /widget/forms/config; submit goes to POST /widget/forms/submit, gated on
 * the firm's `web_form` module. Themed to match the widget.
 */
export function SendDetails({ consentLabel, prefill }: SendDetailsProps) {
  const chatCaseTypes = useWidgetStore((s) => s.caseTypes);
  const branding = useWidgetStore((s) => s.branding);
  const firmId = useWidgetStore((s) => s.firmId);
  const rememberContact = useWidgetStore((s) => s.rememberContact);

  const [phase, setPhase] = useState<'loading' | 'form' | 'unavailable'>('loading');
  const [config, setConfig] = useState<WebFormConfig | null>(null);

  const [step, setStep] = useState(0);
  const [caseKey, setCaseKey] = useState<string | null>(null); // id, or label when no id
  const [caseTypeId, setCaseTypeId] = useState<string | undefined>(undefined);
  const [accidentType, setAccidentType] = useState<string | undefined>(undefined);
  const [severity, setSeverity] = useState<string | null>(null); // option value
  const [timing, setTiming] = useState<string | null>(null); // option value
  const [name, setName] = useState(prefill.name ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [email, setEmail] = useState(prefill.email ?? '');
  const [agreed, setAgreed] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // bots fill this; humans never see it
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load the firm's form options. 403 = module off → hide. Other failures fall
  // back to built-in options so the form still works.
  useEffect(() => {
    if (!firmId) {
      setPhase('form');
      return;
    }
    const ctrl = new AbortController();
    fetchWebFormConfig(firmId, ctrl.signal)
      .then((cfg) => {
        setConfig(cfg);
        setPhase('form');
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setPhase(err instanceof ApiError && err.status === 403 ? 'unavailable' : 'form');
      });
    return () => ctrl.abort();
  }, [firmId]);

  // Step option sources: config first, then graceful fallbacks.
  const caseOptions = useMemo<{ id?: string; label: string }[]>(() => {
    if (config?.caseTypes?.length) return config.caseTypes.map((c) => ({ id: c.id, label: c.label }));
    if (chatCaseTypes.length) return chatCaseTypes.map((c) => ({ id: c.id, label: c.label }));
    if (branding?.practiceAreas?.length) return branding.practiceAreas.map((l) => ({ label: l }));
    return DEFAULT_CASE_LABELS.map((l) => ({ label: l }));
  }, [config, chatCaseTypes, branding]);
  const severityOptions = config?.injurySeverityOptions ?? FALLBACK_SEVERITY;
  const timingOptions = config?.incidentTimingOptions ?? FALLBACK_TIMING;

  const consentDisplay = config?.consentText || consentLabel;

  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.replace(/\D/g, '').length >= 7;
  const emailValid = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = nameValid && phoneValid && emailValid && agreed && !submitting;

  const advance = () => setStep((s) => Math.min(s + 1, 3));

  const pickCase = (value: string, label: string) => {
    const opt = caseOptions.find((o) => (o.id ?? o.label) === value);
    setCaseKey(value);
    setCaseTypeId(opt?.id);
    setAccidentType(label);
    advance();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (!firmId) {
      setError("We couldn't submit your details. Please try again.");
      return;
    }
    setSubmitting(true);
    // Remember for the next quick action (auto-fill call/help/text).
    rememberContact({ phone: phone.trim(), name: name.trim(), email: email.trim() || undefined });
    try {
      await submitWebForm({
        firmId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        caseTypeId,
        accidentType,
        injurySeverity: severity ?? undefined,
        incidentTiming: timing ?? undefined,
        consentText: consentDisplay,
        copyVersion: config?.consentVersion,
        website: honeypot,
        utm: readUtm(),
      });
      setDone(true);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const detail = errorDetail(err);
      if (status === 403) {
        setError("This form isn't available right now. Please try another option.");
      } else if (status === 429) {
        setError('Too many submissions — please try again in a bit.');
      } else if (status === 400 && detail) {
        setError(detail);
      } else {
        setError("We couldn't submit your details. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-hairline border-t-famaash" />
        <p className="mt-3 text-[13px] text-muted">Loading…</p>
      </div>
    );
  }

  if (phase === 'unavailable') {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-famaash-soft text-famaash">
          <FileIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">Not available right now</h3>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
          This form isn't enabled for this firm. Please use one of the other options to reach us.
        </p>
      </div>
    );
  }

  if (done) {
    const first = name.trim().split(/\s+/)[0];
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">Thanks{first ? `, ${first}` : ''} — we've got your details</h3>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
          A real person will reach out{phone ? ` at ${phone}` : ''} shortly. Keep an eye on your phone
          {email.trim() ? ' and email' : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Intro badge */}
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-famaash-soft text-famaash">
          <FileIcon size={20} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-[16px] font-bold text-ink">Send your details</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            A few quick questions and we'll reach back shortly.
          </p>
        </div>
      </div>

      {/* Progress + step back */}
      <div className="flex items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            aria-label="Previous step"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
          >
            <ChevronLeftIcon size={16} />
          </button>
        ) : (
          <span className="h-7 w-7 shrink-0" />
        )}
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-famaash' : 'bg-hairline')}
            />
          ))}
        </div>
        <span className="shrink-0 text-[11px] font-medium text-muted-soft">{step + 1}/4</span>
      </div>

      <p className="text-[14px] font-semibold text-ink">{STEP_TITLES[step]}</p>

      {step === 0 && (
        <OptionList
          options={caseOptions.map((o) => ({ value: o.id ?? o.label, label: o.label }))}
          selected={caseKey}
          onSelect={pickCase}
        />
      )}
      {step === 1 && (
        <OptionList
          options={severityOptions}
          selected={severity}
          onSelect={(v) => {
            setSeverity(v);
            advance();
          }}
        />
      )}
      {step === 2 && (
        <OptionList
          options={timingOptions}
          selected={timing}
          onSelect={(v) => {
            setTiming(v);
            advance();
          }}
        />
      )}

      {step === 3 && (
        <div className="space-y-3">
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p>}
          {/* Honeypot — off-screen, not a tab stop; real users leave it empty. */}
          <input
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />
          <Field label="Your name">
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              className={inputCls}
            />
          </Field>
          <Field label="Phone number">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
          </Field>
          <Field label="Email" hint="optional">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </Field>

          <label className="flex items-start gap-2.5 rounded-lg border border-hairline bg-subtle px-3 py-2.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-famaash"
            />
            <span className="text-[11.5px] leading-relaxed text-muted">{consentDisplay}</span>
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {submitting ? 'Sending…' : 'Submit my details'}
          </button>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:border-famaash focus:outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
        {label} {hint && <span className="text-muted-soft">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: WebFormOption[];
  selected: string | null;
  onSelect: (value: string, label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value, opt.label)}
            aria-pressed={active}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-[14px] font-medium transition-colors',
              active
                ? 'border-famaash bg-famaash-soft text-famaash'
                : 'border-hairline bg-white text-ink hover:border-famaash-stroke hover:bg-famaash-soft',
            )}
          >
            {opt.label}
            <ChevronRightIcon size={16} className="shrink-0 text-muted-soft" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
