import { useMemo, useState } from 'react';
import { useWidgetStore } from '../store/widgetStore';
import { ApiError, errorDetail, submitLeadForm } from '../services/api';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FileIcon } from '../utils/icons';
import { cn } from '../utils/cn';

interface SendDetailsProps {
  consentLabel: string;
  /** Prefill from what the lead already shared in the chat session. */
  prefill: { name?: string; phone?: string; email?: string };
}

// Injury severity + timeline options are frontend-defined for now; the backend
// guide (SEND_YOUR_DETAILS_LEAD_FORM.md) proposes returning these from config so
// they're admin-editable later. Case-type options reuse the chat opener's list.
const SEVERITY_OPTIONS = [
  'Minor — treated and released',
  'Moderate — ongoing treatment',
  'Severe — hospitalization or surgery',
  'Not sure yet',
];
const TIMELINE_OPTIONS = [
  'Within the last week',
  '1–4 weeks ago',
  '1–6 months ago',
  'More than 6 months ago',
  'Not sure',
];
const DEFAULT_CASE_TYPES = [
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

/**
 * "Send your details" — a stepwise intake form (case type → injury severity →
 * timeline → contact info) for visitors who'd rather leave their details than
 * chat. Themed to match the widget. Submits to the lead-form endpoint; on
 * success it confirms we'll reach out. (Backend endpoint is pending — see
 * prompts/backend requests/SEND_YOUR_DETAILS_LEAD_FORM.md.)
 */
export function SendDetails({ consentLabel, prefill }: SendDetailsProps) {
  const caseTypes = useWidgetStore((s) => s.caseTypes);
  const branding = useWidgetStore((s) => s.branding);
  const conversationId = useWidgetStore((s) => s.conversationId);

  const caseOptions = useMemo(
    () => (caseTypes.length ? caseTypes.map((c) => c.label) : (branding?.practiceAreas ?? DEFAULT_CASE_TYPES)),
    [caseTypes, branding],
  );

  const [step, setStep] = useState(0);
  const [caseType, setCaseType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [name, setName] = useState(prefill.name ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [email, setEmail] = useState(prefill.email ?? '');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.replace(/\D/g, '').length >= 7;
  const emailValid = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = nameValid && phoneValid && emailValid && agreed && !submitting;

  // Single-select steps advance as soon as an option is tapped.
  const choose = (set: (v: string) => void, value: string) => {
    set(value);
    setStep((s) => Math.min(s + 1, 3));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    if (!conversationId) {
      setError('Your session expired — please reopen the chat and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const ct = caseTypes.find((c) => c.label === caseType);
      await submitLeadForm({
        conversationId,
        caseType: { id: ct?.id, slug: ct?.slug, label: caseType ?? '' },
        injurySeverity: severity ?? '',
        timeline: timeline ?? '',
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        consentText: consentLabel,
      });
      setDone(true);
    } catch (err) {
      const detail = errorDetail(err);
      setError(
        err instanceof ApiError && err.status === 400 && detail
          ? detail
          : "We couldn't submit your details. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const first = name.trim().split(/\s+/)[0];
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={26} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-[18px] font-bold text-ink">Thanks{first ? `, ${first}` : ''} — we've got your details</h3>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-muted">
          A real person will reach out{phone ? ` at ${phone}` : ''} within the hour. Keep an eye on your phone
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
            A few quick questions and we'll reach back within the hour.
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
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-famaash' : 'bg-hairline',
              )}
            />
          ))}
        </div>
        <span className="shrink-0 text-[11px] font-medium text-muted-soft">{step + 1}/4</span>
      </div>

      <p className="text-[14px] font-semibold text-ink">{STEP_TITLES[step]}</p>

      {step === 0 && (
        <OptionList options={caseOptions} selected={caseType} onSelect={(v) => choose(setCaseType, v)} />
      )}
      {step === 1 && (
        <OptionList options={SEVERITY_OPTIONS} selected={severity} onSelect={(v) => choose(setSeverity, v)} />
      )}
      {step === 2 && (
        <OptionList options={TIMELINE_OPTIONS} selected={timeline} onSelect={(v) => choose(setTimeline, v)} />
      )}

      {step === 3 && (
        <div className="space-y-3">
          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p>
          )}
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
            <span className="text-[11.5px] leading-relaxed text-muted">{consentLabel}</span>
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
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
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            aria-pressed={active}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-[14px] font-medium transition-colors',
              active
                ? 'border-famaash bg-famaash-soft text-famaash'
                : 'border-hairline bg-white text-ink hover:border-famaash-stroke hover:bg-famaash-soft',
            )}
          >
            {opt}
            <ChevronRightIcon size={16} className="shrink-0 text-muted-soft" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
