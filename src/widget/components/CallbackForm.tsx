import { useState } from 'react';
import { AlertIcon, MessageSquareIcon, PhoneIcon } from '../utils/icons';
import { cn } from '../utils/cn';

interface CallbackFormProps {
  heading: string;
  body: string;
  cta: string;
  /** 'alert' — red badge + phone CTA (call/help). 'brand' — purple badge + message CTA (text). */
  variant?: 'alert' | 'brand';
  onSubmit: (phone: string) => void;
}

/**
 * Phone-number collection step shared by the "call me", "I need help", and
 * "text me" flows: a badge, heading + body, a phone input, and the primary CTA.
 */
export function CallbackForm({
  heading,
  body,
  cta,
  variant = 'alert',
  onSubmit,
}: CallbackFormProps) {
  const [phone, setPhone] = useState('');
  const valid = phone.replace(/\D/g, '').length >= 7;
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

      <button
        type="button"
        onClick={() => valid && onSubmit(phone.trim())}
        disabled={!valid}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CtaIcon size={16} aria-hidden="true" />
        {cta}
      </button>
    </div>
  );
}
