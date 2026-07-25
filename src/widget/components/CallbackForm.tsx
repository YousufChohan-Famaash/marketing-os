import { useState, type ReactNode } from 'react';
import { MessageSquareIcon, PhoneIcon } from '../utils/icons';
import { cn } from '../utils/cn';
import { nameError, phoneError, emailError as validateEmail, formatPhone } from '../utils/validation';
import { useWidgetStore } from '../store/widgetStore';
import { useKnownContact } from '../store/useKnownContact';

interface CallbackFormProps {
  heading: string;
  body: string;
  cta: string;
  /** 'alert' — red badge + phone CTA (call/help). 'brand' — purple badge + message CTA (text).
   * 'whatsapp' — like 'brand' but the CTA is WhatsApp green. */
  variant?: 'alert' | 'brand' | 'whatsapp';
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
  /** Optional media (e.g. the presence video) shown at the right of the heading
   * row. Only the in-panel channel views pass this; modals leave it off. */
  media?: ReactNode;
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
  media,
  onSubmit,
}: CallbackFormProps) {
  // Pre-fill from what we already know about the visitor (captured this session
  // or remembered from before), so quick actions never ask for the number twice.
  // An explicit initial* prop from the caller still wins.
  const known = useKnownContact();
  const rememberContact = useWidgetStore((s) => s.rememberContact);
  const [name, setName] = useState(initialName ?? known.name ?? '');
  const [phone, setPhone] = useState(formatPhone(initialPhone ?? known.phone ?? ''));
  const [email, setEmail] = useState(initialEmail ?? known.email ?? '');
  const [agreed, setAgreed] = useState(false);
  // Per-field errors surface once a field is blurred or a submit is attempted,
  // so we guide (not nag) and never send unvalidated data.
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; email?: boolean }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const touch = (f: 'name' | 'phone' | 'email') => setTouched((t) => ({ ...t, [f]: true }));
  const show = (f: 'name' | 'phone' | 'email') => touched[f] || submitAttempted;

  const nameErr = collectName ? nameError(name) : null;
  const phoneErr = phoneError(phone);
  const emailErr = collectEmail ? validateEmail(email, true) : null;
  const consentErr = consentLabel && !agreed;
  const valid = !nameErr && !phoneErr && !emailErr && !consentErr;
  const whatsapp = variant === 'whatsapp';
  const brand = variant === 'brand' || whatsapp;
  const CtaIcon = brand ? MessageSquareIcon : PhoneIcon;

  // When the visitor already gave us a number, don't ask for it again — confirm
  // the one on file and let them edit it (CEO feedback). Applies to every flow
  // that shares this form: Call / Talk to a human, Text me, I need help now.
  const prefilledPhone = (initialPhone ?? known.phone ?? '').trim();
  const hasKnownPhone = prefilledPhone.replace(/\D/g, '').length >= 7;
  const verbWord = brand ? 'text' : 'call';
  const shownHeading = hasKnownPhone ? 'Is this the best number to reach you?' : heading;
  const shownBody = hasKnownPhone
    ? `You gave us ${prefilledPhone}. Confirm and we'll ${verbWord} you at this number, or edit it below to use a different one.`
    : body;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-famaash-soft text-ink">
          {brand ? <MessageSquareIcon size={20} aria-hidden="true" /> : <PhoneIcon size={20} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold text-ink">{shownHeading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{shownBody}</p>
        </div>
        {media}
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
            onBlur={() => touch('name')}
            placeholder="First and last name"
            aria-invalid={show('name') && !!nameErr}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:outline-none',
              show('name') && nameErr ? 'border-danger focus:border-danger' : 'border-hairline focus:border-famaash',
            )}
          />
          {show('name') && nameErr && <p className="mt-1 text-[11.5px] text-danger">{nameErr}</p>}
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
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          onBlur={() => touch('phone')}
          placeholder="(555) 123-4567"
          aria-invalid={show('phone') && !!phoneErr}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:outline-none',
            show('phone') && phoneErr ? 'border-danger focus:border-danger' : 'border-hairline focus:border-famaash',
          )}
        />
        {show('phone') && phoneErr && <p className="mt-1 text-[11.5px] text-danger">{phoneErr}</p>}
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
            onBlur={() => touch('email')}
            placeholder="you@example.com"
            aria-invalid={(show('email') && !!emailErr) || !!emailError}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-soft focus:outline-none',
              (show('email') && emailErr) || emailError
                ? 'border-danger focus:border-danger'
                : 'border-hairline focus:border-famaash',
            )}
          />
          {((show('email') && emailErr) || emailError) && (
            <p className="mt-1 text-[11.5px] text-danger">{(show('email') && emailErr) || emailError}</p>
          )}
        </div>
      )}

      {consentLabel && (
        <div>
          <label
            className={cn(
              'flex items-start gap-2.5 rounded-lg border bg-subtle px-3 py-2.5',
              submitAttempted && consentErr ? 'border-danger' : 'border-hairline',
            )}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-famaash"
            />
            <span className="text-[11.5px] leading-relaxed text-muted">{consentLabel}</span>
          </label>
          {submitAttempted && consentErr && (
            <p className="mt-1 text-[11.5px] text-danger">Please agree before we continue.</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (busy) return;
          if (!valid) {
            // Reveal every field's error instead of silently doing nothing.
            setSubmitAttempted(true);
            return;
          }
          const p = phone.trim();
          const n = collectName ? name.trim() : undefined;
          const e = collectEmail ? email.trim() : undefined;
          // Remember it so the next quick action is already filled in.
          rememberContact({ phone: p, name: n, email: e });
          onSubmit(p, n, e);
        }}
        disabled={busy}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]',
          whatsapp ? 'bg-[#25D366]' : 'bg-famaash',
        )}
      >
        <CtaIcon size={16} aria-hidden="true" />
        {cta}
      </button>
    </div>
  );
}
