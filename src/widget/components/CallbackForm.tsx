import { useState } from 'react';
import { AlertIcon, MessageSquareIcon, PhoneIcon } from '../utils/icons';
import { cn } from '../utils/cn';

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
  onSubmit: (phone: string, name?: string) => void;
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
  onSubmit,
}: CallbackFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const phoneValid = phone.replace(/\D/g, '').length >= 7;
  const nameValid = !collectName || name.trim().length >= 2;
  const valid = phoneValid && nameValid && (!consentLabel || agreed);
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
        onClick={() => valid && onSubmit(phone.trim(), collectName ? name.trim() : undefined)}
        disabled={!valid}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CtaIcon size={16} aria-hidden="true" />
        {cta}
      </button>
    </div>
  );
}
