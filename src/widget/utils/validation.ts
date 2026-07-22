/**
 * Human-facing validation for the contact fields shared by the chat forms
 * (Call, Text, Schedule, Send your details). Each returns a short message to
 * show under the field, or null when the value is acceptable. Keep the messages
 * plain and specific so a visitor knows exactly what to fix.
 */

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Please enter your name.';
  if (v.length < 2) return 'Please enter your full name.';
  return null;
}

export function phoneError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Please enter your phone number.';
  if (/[a-z]/i.test(v)) return 'Phone numbers can only contain digits.';
  // Digits plus the usual punctuation (+, spaces, dashes, parens, dots).
  if (!/^[+()\-.\s\d]+$/.test(v)) return 'Enter a valid phone number.';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 10) return 'Enter a complete phone number.';
  if (digits.length > 15) return 'That number has too many digits.';
  return null;
}

export function emailError(value: string, required = false): string | null {
  const v = value.trim();
  if (!v) return required ? 'Please enter your email.' : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'Enter a valid email address.';
  return null;
}
