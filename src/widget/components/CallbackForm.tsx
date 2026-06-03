import { useState } from 'react';
import { AlertIcon, PhoneIcon } from '../utils/icons';

interface CallbackFormProps {
  heading: string;
  body: string;
  cta: string;
  onSubmit: (phone: string) => void;
}

/**
 * Phone-number collection step shared by the "call me" and "I need help"
 * flows: soft alert badge, heading + body, a phone input, and the primary CTA.
 * Matches the Figma callback dialog.
 */
export function CallbackForm({ heading, body, cta, onSubmit }: CallbackFormProps) {
  const [phone, setPhone] = useState('');
  const valid = phone.replace(/\D/g, '').length >= 7;

  return (
    <div className="space-y-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFEFEF] text-[#F86669]">
        <AlertIcon size={20} aria-hidden="true" />
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
        <PhoneIcon size={16} aria-hidden="true" />
        {cta}
      </button>
    </div>
  );
}
