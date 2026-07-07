import { useState } from 'react';
import { AlertIcon, MessageSquareIcon, PhoneIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { useWidgetStore } from '../store/widgetStore';
import { useKnownContact } from '../store/useKnownContact';

interface CallbackFormProps {
  heading: string;
  body: string;
  cta: string;
  /** 'alert' — red badge + phone CTA (call/help). 'brand' — purple badge + message CTA (text). */
  variant?: 'alert' | 'brand';
  /** TCPA consent text. When set, a required checkbox gates the CTA before we
   * ever capture the phone number. */
  consentLabel?: string;
  /** Also collect the lead's name (used by Call + Schedule). */
  collectName?: boolean;
  /** Also collect the lead's email (required by Schedule for the confirmation). */
  collectEmail?: boolean;
  /** Prefill from what the lead already shared in the chat session. */
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  /** Disable the CTA while a submit is in flight. */
  busy?: boolean;
  /** Inline error to show on the email field (e.g. a server 400). */
  emailError?: string | null;
  onSubmit: (phone: string, name?: string, email?: string) => void;
}

/**
 * Phone-number collection step shared by the "call me", "I need help", and
 * "text me" flows: a badge, heading + body, a phone input, the primary CTA,
 * and (when `consentLabel` is set) a TCPA consent gate the lead must accept
 * before the number is submitted.
 */
export function CallbackForm({
  heading,
  body,
  cta,
  variant = 'alert',
  consentLabel,
  collectName,
  collectEmail,
  initialName,
  initialPhone,
  initialEmail,
  busy,
  emailError,
  onSubmit,
}: CallbackFormProps) {
  // Pre-fill from what we already know about the visitor (captured this session
  // or remembered from before), so quick actions never ask for the number twice.
  // An explicit initial* prop from the caller still wins.
  const known = useKnownContact();
  const rememberContact = useWidgetStore((s) => s.rememberContact);
  const [name, setName] = useState(initialName ?? known.name ?? '');
  const [phone, setPhone] = useState(initialPhone ?? known.phone ?? '');
  const [email, setEmail] = useState(initialEmail ?? known.email ?? '');
  const [agreed, setAgreed] = useState(false);
  const phoneValid = phone.replace(/\D/g, '').length >= 7;
  const nameValid = !collectName || name.trim().length >= 2;
  const emailValid = !collectEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = phoneValid && nameValid && emailValid && (!consentLabel || agreed);
  const brand = variant === 'brand';
  const CtaIcon = brand ? MessageSquareIcon : PhoneIcon;

  return (
    <div className="space-y-4">
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full',
          brand ? 'bg-famaash-light text-famaash' : 'bg-[#FFEFEF] text-[#F86669]',
        )}
      >
        {brand ? <MessageSquareIcon size={20} aria-hidden="true" /> : <AlertIcon size={20} aria-hidden="true" />}
      </span>

      <div>
        <h3 className="text-[16px] font-bold text-ink">{heading}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
      </div>

      {collectName && (
        <div>
          <label
            htmlFor="callback-name"
            className="mb-1.5 block text-[12px] font-medium text-ink-soft"
          >
            Your name
          </label>
          <input
            id="callback-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last name"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:border-famaash focus:outline-none"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="callback-phone"
          className="mb-1.5 block text-[12px] font-medium text-ink-soft"
        >
          Phone Number
        </label>
        <input
          id="callback-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:border-famaash focus:outline-none"
        />
      </div>

      {collectEmail && (
        <div>
          <label
            htmlFor="callback-email"
            className="mb-1.5 block text-[12px] font-medium text-ink-soft"
          >
            Email <span className="text-muted-soft">(for your confirmation)</span>
          </label>
          <input
            id="callback-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:outline-none',
              emailError ? 'border-danger focus:border-danger' : 'border-hairline focus:border-famaash',
            )}
          />
          {emailError && <p className="mt-1 text-[11.5px] text-danger">{emailError}</p>}
        </div>
      )}

      {consentLabel && (
        <label className="flex items-start gap-2.5 rounded-lg border border-hairline bg-subtle px-3 py-2.5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-famaash"
          />
          <span className="text-[11.5px] leading-relaxed text-muted">{consentLabel}</span>
        </label>
      )}

      <button
        type="button"
        onClick={() => {
          if (!valid || busy) return;
          const p = phone.trim();
          const n = collectName ? name.trim() : undefined;
          const e = collectEmail ? email.trim() : undefined;
          // Remember it so the next quick action is already filled in.
          rememberContact({ phone: p, name: n, email: e });
          onSubmit(p, n, e);
        }}
        disabled={!valid || busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CtaIcon size={16} aria-hidden="true" />
        {cta}
      </button>
    </div>
  );
}
