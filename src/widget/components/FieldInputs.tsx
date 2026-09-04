import { useState } from 'react';
import { useT } from '../i18n';
import { cn } from '../utils/cn';

/**
 * Typed answer widgets rendered under an AI question (name / phone / email /
 * number). Each collects input and reports a formatted string via `onSubmit`,
 * which the caller sends as a `lead_message`. The free-text composer is always
 * available too, so these are convenience inputs, not the only path.
 */

const FIELD =
  'w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-[16px] text-ink placeholder:text-muted-soft focus:border-famaash focus:outline-none sm:text-[14px]';

function SubmitButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg bg-famaash px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-95',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  );
}

export function NameInput({ onSubmit }: { onSubmit: (content: string) => void }) {
  const t = useT();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const valid = first.trim().length > 0 && last.trim().length > 0;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input
          className={FIELD}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder={t('First name')}
          aria-label={t('First name')}
          autoComplete="given-name"
        />
        <input
          className={FIELD}
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder={t('Last name')}
          aria-label={t('Last name')}
          autoComplete="family-name"
        />
      </div>
      <SubmitButton
        disabled={!valid}
        onClick={() => onSubmit(`${first.trim()} ${last.trim()}`)}
      >
        {t('Continue')}
      </SubmitButton>
    </div>
  );
}

const COUNTRY_CODES = ['+1', '+44', '+92', '+91', '+61', '+971'];

export function PhoneInput({ onSubmit }: { onSubmit: (content: string) => void }) {
  const t = useT();
  const [code, setCode] = useState('+1');
  const [num, setNum] = useState('');
  const valid = num.replace(/\D/g, '').length >= 7;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label={t('Country code')}
          className="rounded-lg border border-hairline bg-white px-2 py-2.5 text-[16px] text-ink focus:border-famaash focus:outline-none sm:text-[14px]"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className={FIELD}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder={t('Phone number')}
          aria-label={t('Phone number')}
        />
      </div>
      <SubmitButton disabled={!valid} onClick={() => onSubmit(`${code} ${num.trim()}`)}>
        {t('Continue')}
      </SubmitButton>
    </div>
  );
}

export function EmailInput({ onSubmit }: { onSubmit: (content: string) => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <div className="mt-2 space-y-2">
      <input
        className={FIELD}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label={t('Email address')}
      />
      <SubmitButton disabled={!valid} onClick={() => onSubmit(email.trim())}>
        {t('Continue')}
      </SubmitButton>
    </div>
  );
}

export function NumberInput({ onSubmit }: { onSubmit: (content: string) => void }) {
  const t = useT();
  const [value, setValue] = useState('');
  const valid = value.trim().length > 0;
  return (
    <div className="mt-2 space-y-2">
      <input
        className={FIELD}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('Enter a number')}
        aria-label={t('Number')}
      />
      <SubmitButton disabled={!valid} onClick={() => onSubmit(value.trim())}>
        {t('Continue')}
      </SubmitButton>
    </div>
  );
}
